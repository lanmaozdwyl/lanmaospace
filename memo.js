// Lanmao Space 备忘录：Supabase 登录 + 浏览器内加密。
// 安全要点：
// 1. 备忘录明文只存在内存和正在编辑的输入框里，从不写进 localStorage、
//    不放进仓库、不随页面一起发出去。上传到 Supabase 的只有密文和 IV。
// 2. 备忘录口令只用来在内存里派生密钥，从不上传、不存储。密钥也只在内存里。
// 3. 登录密码只证明身份，和备忘录口令是两回事；重置登录密码不会丢备忘录，
//    但备忘录口令忘了就解不开，没有找回办法。
// 4. 所有用户输入都用 textContent 渲染，不用 innerHTML 拼用户内容。

const $ = (id) => document.getElementById(id);

const setupPanel = $("setup-panel");
const loginPanel = $("login-panel");
const ownerPanel = $("owner-panel");
const passphrasePanel = $("passphrase-panel");
const appPanel = $("app-panel");
const passphraseTitle = $("passphrase-title");
const passphraseDesc = $("passphrase-desc");
const passphraseConfirmGroup = $("passphrase-confirm-group");
const loginForm = $("login-form");
const passphraseForm = $("passphrase-form");
const editorForm = $("editor-form");
const memoList = $("memo-list");
const memoEmpty = $("memo-empty");
const memoStatus = $("memo-status");
const searchInput = $("memo-search");

const CHECK_VALUE = "lanmao-memo-check-v1";
const PBKDF2_ITERATIONS = 210000;

let supabase = null;
let currentUser = null;
let vault = null;
let cryptoKey = null;
let notes = [];
let editingId = null;
let searchQuery = "";

function showOnly(panel) {
    for (const el of [setupPanel, loginPanel, ownerPanel, passphrasePanel, appPanel]) {
        el.hidden = el !== panel;
    }
}

// 备忘录只认店主邮箱：访客注册的账号能进网站，但打不开备忘录。
// ownerEmail 为空时谁也打不开，避免没填好就误放行。
function isOwner(user) {
    const config = window.LANMAO_MEMO_CONFIG;
    const ownerEmail = config && typeof config.ownerEmail === "string" ? config.ownerEmail.trim().toLowerCase() : "";
    return Boolean(ownerEmail) && Boolean(user && user.email) && user.email.toLowerCase() === ownerEmail;
}

function setPanelStatus(panel, message) {
    let el = panel.querySelector(".memo-status");
    if (!el) {
        el = document.createElement("p");
        el.className = "memo-status";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        panel.prepend(el);
    }
    el.textContent = message;
}

function clearPanelStatus(panel) {
    const el = panel.querySelector(".memo-status");
    if (el) el.textContent = "";
}

function setAppStatus(message) {
    memoStatus.textContent = message;
}

function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveKey(passphrase, saltBytes) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptNote(key, note) {
    const iv = randomBytes(12);
    const data = new TextEncoder().encode(JSON.stringify(note));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

async function decryptNote(key, ciphertextBase64, ivBase64) {
    const data = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
        key,
        base64ToBytes(ciphertextBase64)
    );
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (typeof parsed !== "object" || parsed === null) throw new Error("备忘录格式不对。");
    return {
        title: typeof parsed.title === "string" ? parsed.title : "",
        body: typeof parsed.body === "string" ? parsed.body : ""
    };
}

function lock() {
    cryptoKey = null;
    vault = null;
    notes = [];
    editingId = null;
    searchQuery = "";
    searchInput.value = "";
    $("memo-passphrase").value = "";
    $("memo-passphrase-confirm").value = "";
    $("note-title").value = "";
    $("note-body").value = "";
    editorForm.hidden = true;
    memoList.replaceChildren();
    memoEmpty.hidden = true;
    setAppStatus("");
}

async function fetchVault() {
    const { data, error } = await supabase
        .from("memo_vault")
        .select("salt, check_ciphertext, check_iv")
        .eq("user_id", currentUser.id)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function showPassphrasePanel() {
    clearPanelStatus(passphrasePanel);
    $("memo-passphrase").value = "";
    $("memo-passphrase-confirm").value = "";
    try {
        vault = await fetchVault();
    } catch (error) {
        console.error(error);
        setPanelStatus(passphrasePanel, "读取备忘录配置失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。");
        showOnly(passphrasePanel);
        return;
    }
    if (vault) {
        passphraseTitle.textContent = "输入备忘录口令解锁";
        passphraseDesc.textContent = "备忘录口令和登录密码不同。内容用它加密，口令忘了就解不开，没有找回办法，请务必记住。";
        passphraseConfirmGroup.hidden = true;
        $("memo-passphrase-confirm").required = false;
    } else {
        passphraseTitle.textContent = "设置备忘录口令";
        passphraseDesc.textContent = "这是第一次使用：先设一个备忘录口令（至少 8 位，和登录密码不同）。之后所有设备解锁都用它，忘了就解不开，请务必记住。";
        passphraseConfirmGroup.hidden = false;
        $("memo-passphrase-confirm").required = true;
    }
    showOnly(passphrasePanel);
    $("memo-passphrase").focus();
}

async function unlockWithPassphrase(passphrase) {
    if (!crypto.subtle) {
        throw new Error("当前浏览器或地址不支持加密，请用现代浏览器通过 https 或本地地址打开。");
    }
    if (vault) {
        const key = await deriveKey(passphrase, base64ToBytes(vault.salt));
        // 校验串解不开 = 口令不对。不要把“口令错”说成“没有数据”。
        await decryptNote(key, vault.check_ciphertext, vault.check_iv).then((parsed) => {
            if (parsed.body !== CHECK_VALUE) throw new Error("备忘录口令不对，请再试一次。");
        });
        cryptoKey = key;
        return;
    }
    const salt = randomBytes(16);
    const key = await deriveKey(passphrase, salt);
    const check = await encryptNote(key, { title: "", body: CHECK_VALUE });
    const { error } = await supabase.from("memo_vault").insert({
        user_id: currentUser.id,
        salt: bytesToBase64(salt),
        check_ciphertext: check.ciphertext,
        check_iv: check.iv
    });
    if (error) throw error;
    vault = {
        salt: bytesToBase64(salt),
        check_ciphertext: check.ciphertext,
        check_iv: check.iv
    };
    cryptoKey = key;
}

async function loadNotes() {
    const { data, error } = await supabase
        .from("memos")
        .select("id, ciphertext, iv, created_at, updated_at")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false });
    if (error) throw error;
    const loaded = [];
    let skipped = 0;
    for (const row of data) {
        try {
            const note = await decryptNote(cryptoKey, row.ciphertext, row.iv);
            loaded.push({ id: row.id, ...note, createdAt: row.created_at, updatedAt: row.updated_at });
        } catch (decryptError) {
            console.error(decryptError);
            skipped += 1;
        }
    }
    notes = loaded;
    if (skipped > 0) {
        setAppStatus(`已同步，有 ${skipped} 条内容解不开，已跳过显示。请不要删除 Supabase 里的数据，先检查备忘录口令。`);
    } else {
        setAppStatus("");
    }
    renderNotes();
}

function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
}

function renderNotes() {
    memoList.replaceChildren();
    const query = searchQuery.trim().toLowerCase();
    const visible = notes.filter((note) => {
        if (!query) return true;
        return (note.title + "\n" + note.body).toLowerCase().includes(query);
    });
    memoEmpty.hidden = visible.length > 0;
    if (query && visible.length === 0) {
        memoEmpty.hidden = false;
        memoEmpty.textContent = "没有找到符合条件的备忘录。";
    } else if (!query) {
        memoEmpty.textContent = "还没有备忘录，点“写一条”开始记第一条吧。";
    }
    for (const note of visible) {
        const article = document.createElement("article");
        article.className = "memo-item";
        const title = document.createElement("h3");
        title.textContent = note.title.trim() ? note.title : "（无标题）";
        const time = document.createElement("time");
        time.textContent = formatTime(note.updatedAt || note.createdAt);
        const body = document.createElement("p");
        body.textContent = note.body;
        const actions = document.createElement("div");
        actions.className = "memo-item-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "编辑";
        editButton.setAttribute("aria-label", "编辑备忘录");
        editButton.addEventListener("click", () => openEditor(note));
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "删除";
        deleteButton.setAttribute("aria-label", "删除备忘录");
        deleteButton.addEventListener("click", () => deleteNote(note));
        actions.append(editButton, deleteButton);
        article.append(title, time, body, actions);
        memoList.append(article);
    }
}

function openEditor(note) {
    editingId = note ? note.id : null;
    $("note-title").value = note ? note.title : "";
    $("note-body").value = note ? note.body : "";
    editorForm.hidden = false;
    $("note-title").focus();
}

function closeEditor() {
    editingId = null;
    $("note-title").value = "";
    $("note-body").value = "";
    editorForm.hidden = true;
}

async function deleteNote(note) {
    if (!window.confirm("确定删除这条备忘录吗？删除后无法恢复。")) return;
    setAppStatus("正在删除…");
    const { error } = await supabase
        .from("memos")
        .delete()
        .eq("id", note.id)
        .eq("user_id", currentUser.id);
    if (error) {
        console.error(error);
        setAppStatus("删除失败，请刷新后重试。");
        return;
    }
    await loadNotes();
    setAppStatus("已删除。");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("login-button");
    button.disabled = true;
    clearPanelStatus(loginPanel);
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: $("login-email").value.trim(),
            password: $("login-password").value
        });
        if (error) throw error;
        currentUser = data.user;
        $("login-password").value = "";
        if (!isOwner(currentUser)) {
            showOnly(ownerPanel);
            return;
        }
        await showPassphrasePanel();
    } catch (error) {
        console.error(error);
        const message = String(error && error.message ? error.message : "");
        setPanelStatus(
            loginPanel,
            message.includes("Invalid login credentials")
                ? "邮箱或登录密码不对，请再试一次。"
                : "登录失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。"
        );
    } finally {
        button.disabled = false;
    }
});

passphraseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("unlock-button");
    button.disabled = true;
    clearPanelStatus(passphrasePanel);
    const passphrase = $("memo-passphrase").value;
    try {
        if (passphrase.length < 8) throw new Error("备忘录口令至少 8 位。");
        if (!vault && passphrase !== $("memo-passphrase-confirm").value) {
            throw new Error("两次输入的备忘录口令不一致。");
        }
        await unlockWithPassphrase(passphrase);
        $("memo-passphrase").value = "";
        $("memo-passphrase-confirm").value = "";
        setAppStatus("正在同步…");
        showOnly(appPanel);
        await loadNotes();
        if (!memoStatus.textContent) setAppStatus("已解锁，内容已同步。");
    } catch (error) {
        console.error(error);
        const message = String(error && error.message ? error.message : "");
        // AES-GCM 校验失败就是口令不对，不要把原始错误直接当结论。
        setPanelStatus(
            passphrasePanel,
            message.includes("备忘录口令") || message.includes("OperationError")
                ? "备忘录口令不对，请再试一次。"
                : message || "解锁失败，请刷新后重试。"
        );
        $("memo-passphrase").value = "";
        $("memo-passphrase").focus();
    } finally {
        button.disabled = false;
    }
});

$("new-note-button").addEventListener("click", () => openEditor(null));
$("cancel-edit-button").addEventListener("click", closeEditor);
$("lock-button").addEventListener("click", async () => {
    lock();
    await showPassphrasePanel();
});
$("signout-button").addEventListener("click", async () => {
    lock();
    await supabase.auth.signOut();
    showOnly(loginPanel);
});
$("owner-signout-button").addEventListener("click", async () => {
    lock();
    await supabase.auth.signOut();
    window.location.replace("login.html");
});
searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderNotes();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !editorForm.hidden) closeEditor();
});

editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("save-note-button");
    button.disabled = true;
    const title = $("note-title").value;
    const body = $("note-body").value;
    if (!title.trim() && !body.trim()) {
        setAppStatus("标题和内容不能都为空。");
        button.disabled = false;
        return;
    }
    setAppStatus("正在加密并同步…");
    try {
        const encrypted = await encryptNote(cryptoKey, { title, body });
        if (editingId) {
            const { error } = await supabase
                .from("memos")
                .update({ ciphertext: encrypted.ciphertext, iv: encrypted.iv, updated_at: new Date().toISOString() })
                .eq("id", editingId)
                .eq("user_id", currentUser.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from("memos").insert({
                user_id: currentUser.id,
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv
            });
            if (error) throw error;
        }
        closeEditor();
        await loadNotes();
        setAppStatus("已保存并同步。");
    } catch (error) {
        console.error(error);
        setAppStatus("保存失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。");
    } finally {
        button.disabled = false;
    }
});

async function init() {
    const config = window.LANMAO_MEMO_CONFIG;
    const url = config && typeof config.url === "string" ? config.url : "";
    const anonKey = config && typeof config.anonKey === "string" ? config.anonKey : "";
    const configured =
        url.startsWith("https://") &&
        url.includes(".supabase.co") &&
        anonKey.length >= 20 &&
        !anonKey.startsWith("YOUR-");
    if (!configured) {
        showOnly(setupPanel);
        return;
    }
    let createClient;
    try {
        ({ createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"));
    } catch (error) {
        console.error(error);
        showOnly(setupPanel);
        setPanelStatus(setupPanel, "无法加载 Supabase 的 JS 库，请检查网络或 CDN 是否可用，刷新后再试。");
        return;
    }
    supabase = createClient(url, anonKey);
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
            currentUser = null;
            lock();
            showOnly(loginPanel);
        } else if (event === "SIGNED_IN" && session && session.user && currentUser?.id !== session.user.id) {
            currentUser = session.user;
            if (!isOwner(currentUser)) {
                showOnly(ownerPanel);
            } else {
                await showPassphrasePanel();
            }
        }
    });
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        currentUser = data.session ? data.session.user : null;
    } catch (error) {
        console.error(error);
        setPanelStatus(loginPanel, "登录状态读取失败，请刷新后再试。");
        showOnly(loginPanel);
        return;
    }
    if (currentUser) {
        if (!isOwner(currentUser)) {
            showOnly(ownerPanel);
        } else {
            await showPassphrasePanel();
        }
    } else {
        showOnly(loginPanel);
    }
}

init();
