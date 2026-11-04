// Lanmao Space 我的头像：选预设 emoji + 渐变色，或上传一张图。
// 头像存在 profiles 表 + avatars 存储桶；表/桶还没建好时提示运行 avatars.sql，不崩页。
// 用户输入只用 textContent / createElement 渲染，不拼 innerHTML。

import { getSupabase, isConfigured } from './lib/supabase-client.js';
import {
    AVATAR_COLORS,
    AVATAR_EMOJIS,
    avatarDisplay,
    avatarPublicUrl,
    avatarStoragePath,
    fallbackAvatarDisplay,
    fetchProfile,
    validateAvatarFile
} from './lib/avatar.mjs';

const SETUP_HINT = "头像功能还没接好：请店主先在 Supabase 运行 supabase/avatars.sql，之后再保存。";

let supabase = null;
let userId = null;
let currentProfile = null;
let selectedEmoji = AVATAR_EMOJIS[0];
let selectedColor = AVATAR_COLORS[0];
let selectedFile = null;
let previewObjectUrl = null;
let dirty = false;
let baselineState = null;

function setDirtyBadge(isDirty) {
    const badge = document.getElementById("avatar-dirty-badge");
    if (badge) badge.hidden = !isDirty;
}

function captureBaseline() {
    if (!currentProfile) {
        baselineState = { kind: "none", emoji: selectedEmoji, color: selectedColor };
    } else if (currentProfile.avatar_kind === "upload") {
        baselineState = { kind: "upload", path: currentProfile.avatar_path };
    } else {
        baselineState = { kind: "emoji", emoji: currentProfile.avatar_emoji, color: currentProfile.avatar_color };
    }
    dirty = false;
    setDirtyBadge(false);
}

function checkDirty() {
    if (!baselineState) return false;
    if (selectedFile) return true;
    if (baselineState.kind === "upload") {
        return dirty;
    }
    return selectedEmoji !== baselineState.emoji || selectedColor !== baselineState.color;
}

function updateDirty() {
    dirty = checkDirty();
    setDirtyBadge(dirty);
}

function canLeave() {
    if (dirty && !window.confirm("当前头像修改尚未保存，确定要离开吗？未保存的内容将会丢失。")) {
        return false;
    }
    return true;
}

function setStatus(message) {
    const status = document.getElementById("avatar-status");
    if (status) status.textContent = message;
}

function setBusy(busy) {
    for (const id of ["save-avatar", "reset-avatar"]) {
        const button = document.getElementById(id);
        if (button) button.disabled = busy;
    }
}

function renderPreview() {
    const preview = document.getElementById("avatar-preview");
    if (!preview) return;
    preview.replaceChildren();
    if (selectedFile) {
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(selectedFile);
        const img = document.createElement("img");
        img.src = previewObjectUrl;
        img.alt = "上传图片预览";
        preview.append(img);
        return;
    }
    preview.style.background = selectedColor;
    const emoji = document.createElement("span");
    emoji.textContent = selectedEmoji;
    preview.append(emoji);
}

function renderPresets() {
    const emojiGrid = document.getElementById("avatar-presets");
    const colorGrid = document.getElementById("avatar-colors");
    if (!emojiGrid || !colorGrid) return;
    emojiGrid.replaceChildren();
    for (const emoji of AVATAR_EMOJIS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "avatar-preset";
        button.textContent = emoji;
        button.setAttribute("aria-label", `头像图案 ${emoji}`);
        button.setAttribute("aria-pressed", String(emoji === selectedEmoji));
        if (emoji === selectedEmoji) button.classList.add("is-selected");
        button.addEventListener("click", () => {
            selectedEmoji = emoji;
            selectedFile = null;
            const input = document.getElementById("avatar-upload");
            if (input) input.value = "";
            const note = document.getElementById("avatar-file-note");
            if (note) note.hidden = true;
            dirty = true;
            updateDirty();
            renderPresets();
            renderPreview();
        });
        emojiGrid.append(button);
    }
    colorGrid.replaceChildren();
    AVATAR_COLORS.forEach((color, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "avatar-color";
        button.style.background = color;
        button.setAttribute("aria-label", `背景色 ${index + 1}`);
        button.setAttribute("aria-pressed", String(color === selectedColor));
        if (color === selectedColor) button.classList.add("is-selected");
        button.addEventListener("click", () => {
            selectedColor = color;
            dirty = true;
            updateDirty();
            renderPresets();
            renderPreview();
        });
        colorGrid.append(button);
    });
}

function showSetupHint() {
    const panel = document.getElementById("setup-panel");
    if (panel) panel.hidden = false;
}

function isSetupError(error) {
    const text = String((error && (error.message || error.code)) || "");
    return text.includes("profiles") || text.includes("avatars") || text.includes("42P01") || text.includes("PGRST301");
}

// 上传前在浏览器里缩到最长边 256px（WebP）；失败则原样上传，由服务端上限兜底。
async function prepareAvatarBlob(file) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        if (typeof bitmap.close === "function") bitmap.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
        return blob || file;
    } catch {
        return file;
    }
}

async function removeUploadedObject(path) {
    if (!path) return;
    try {
        await supabase.storage.from("avatars").remove([path]);
    } catch (error) {
        console.error(error);
    }
}

async function saveAvatar() {
    if (!supabase || !userId) return;
    setBusy(true);
    setStatus("正在保存…");
    try {
        if (selectedFile) {
            const blob = await prepareAvatarBlob(selectedFile);
            const path = avatarStoragePath(userId);
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(path, blob, { upsert: true, contentType: blob.type || selectedFile.type, cacheControl: "3600" });
            if (uploadError) throw uploadError;
            const { error } = await supabase.from("profiles").upsert({
                user_id: userId,
                avatar_kind: "upload",
                avatar_emoji: null,
                avatar_color: null,
                avatar_path: path,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            currentProfile = { avatar_kind: "upload", avatar_path: path };
        } else {
            if (currentProfile && currentProfile.avatar_kind === "upload" && currentProfile.avatar_path) {
                await removeUploadedObject(currentProfile.avatar_path);
            }
            const { error } = await supabase.from("profiles").upsert({
                user_id: userId,
                avatar_kind: "emoji",
                avatar_emoji: selectedEmoji,
                avatar_color: selectedColor,
                avatar_path: null,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
            currentProfile = { avatar_kind: "emoji", avatar_emoji: selectedEmoji, avatar_color: selectedColor, avatar_path: null };
        }
        selectedFile = null;
        const input = document.getElementById("avatar-upload");
        if (input) input.value = "";
        const note = document.getElementById("avatar-file-note");
        if (note) note.hidden = true;
        refreshHeaderAvatar();
        captureBaseline();
        setStatus("头像已保存，页头和留言旁都会显示新头像。");
    } catch (error) {
        console.error(error);
        setStatus(isSetupError(error) ? SETUP_HINT : "保存失败，请检查网络或 Supabase 项目是否暂停，刷新后再试。");
    } finally {
        setBusy(false);
    }
}

async function resetAvatar() {
    if (!supabase || !userId) return;
    if (!window.confirm("确定要恢复默认头像吗？上传的图片也会删除。")) return;
    setBusy(true);
    setStatus("正在恢复默认头像…");
    try {
        if (currentProfile && currentProfile.avatar_path) {
            await removeUploadedObject(currentProfile.avatar_path);
        }
        const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
        if (error) throw error;
        currentProfile = null;
        selectedEmoji = AVATAR_EMOJIS[0];
        selectedColor = AVATAR_COLORS[0];
        selectedFile = null;
        const input = document.getElementById("avatar-upload");
        if (input) input.value = "";
        const note = document.getElementById("avatar-file-note");
        if (note) note.hidden = true;
        renderPresets();
        renderPreview();
        refreshHeaderAvatar();
        captureBaseline();
        setStatus("已恢复默认头像。");
    } catch (error) {
        console.error(error);
        setStatus(isSetupError(error) ? SETUP_HINT : "恢复失败，请检查网络，刷新后再试。");
    } finally {
        setBusy(false);
    }
}

// 保存/恢复后顺手刷新本页页头的头像占位，不用整页刷新。
function refreshHeaderAvatar() {
    const slot = document.querySelector("[data-header-avatar]");
    if (!slot) return;
    const display = avatarDisplay(currentProfile);
    slot.replaceChildren();
    if (!display) {
        const fallback = document.createElement("span");
        fallback.textContent = "👤";
        slot.append(fallback);
        return;
    }
    if (display.type === "image") {
        const img = document.createElement("img");
        img.src = avatarPublicUrl(supabase, display.path);
        img.alt = "";
        slot.append(img);
        return;
    }
    slot.style.background = display.color;
    const emoji = document.createElement("span");
    emoji.textContent = display.emoji;
    slot.append(emoji);
}

async function init() {
    renderPresets();
    renderPreview();
    if (!isConfigured()) {
        showSetupHint();
        setStatus("头像功能还没接好，请稍后再试。");
        return;
    }
    try {
        supabase = await getSupabase();
    } catch (error) {
        console.error(error);
        setStatus("头像功能暂时加载失败，请检查网络，刷新后再试。");
        return;
    }
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
            window.location.replace(`/login.html?next=${encodeURIComponent(window.location.pathname)}`);
            return;
        }
        userId = sessionData.session.user.id;
    } catch (error) {
        console.error(error);
        setStatus("没能确认登录状态，请刷新后重试。");
        return;
    }
    try {
        currentProfile = await fetchProfile(supabase, userId);
    } catch (error) {
        console.error(error);
        showSetupHint();
        setStatus(SETUP_HINT);
        return;
    }
    const display = avatarDisplay(currentProfile);
    if (display && display.type === "emoji") {
        selectedEmoji = display.emoji;
        selectedColor = display.color;
        renderPresets();
        renderPreview();
    } else if (display && display.type === "image") {
        const preview = document.getElementById("avatar-preview");
        if (preview) {
            preview.replaceChildren();
            const img = document.createElement("img");
            img.src = avatarPublicUrl(supabase, display.path);
            img.alt = "当前头像";
            preview.append(img);
        }
    }

    const input = document.getElementById("avatar-upload");
    if (input) {
        input.addEventListener("change", () => {
            const file = input.files && input.files[0];
            const note = document.getElementById("avatar-file-note");
            if (!file) {
                selectedFile = null;
                if (note) note.hidden = true;
                updateDirty();
                renderPreview();
                return;
            }
            const problem = validateAvatarFile(file);
            if (problem) {
                setStatus(problem);
                input.value = "";
                selectedFile = null;
                if (note) note.hidden = true;
                updateDirty();
                renderPreview();
                return;
            }
            selectedFile = file;
            if (note) {
                note.hidden = false;
                note.textContent = `已选：${file.name}（${(file.size / 1024).toFixed(0)} KB），保存后上传。`;
            }
            setStatus("");
            dirty = true;
            updateDirty();
            renderPreview();
        });
    }
    const saveButton = document.getElementById("save-avatar");
    if (saveButton) saveButton.addEventListener("click", saveAvatar);
    const resetButton = document.getElementById("reset-avatar");
    if (resetButton) resetButton.addEventListener("click", resetAvatar);
    // 没选过头像时预览用默认回退，和留言旁一致。
    if (!currentProfile) {
        const fallback = fallbackAvatarDisplay("");
        selectedEmoji = fallback.emoji;
        selectedColor = fallback.color;
        renderPresets();
        renderPreview();
    }
    captureBaseline();

    window.addEventListener("beforeunload", (e) => {
        if (dirty) {
            e.preventDefault();
            e.returnValue = "";
        }
    });

    document.addEventListener("click", (e) => {
        const a = e.target.closest && e.target.closest("a[href], button[data-signout]");
        if (a && !a.hasAttribute("download") && !canLeave()) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
}

init();
