import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    ALLOWED_AVATAR_TYPES,
    AVATAR_COLORS,
    AVATAR_EMOJIS,
    MAX_AVATAR_BYTES,
    avatarDisplay,
    avatarPublicUrl,
    avatarStoragePath,
    fallbackAvatarDisplay,
    fetchProfile,
    hashString,
    validateAvatarFile
} from "../lib/avatar.mjs";

test("avatar presets are non-empty and stable", () => {
    assert.equal(AVATAR_EMOJIS.length, 12);
    assert.equal(AVATAR_COLORS.length, 7);
    assert.ok(AVATAR_EMOJIS.every((emoji) => typeof emoji === "string" && emoji.length > 0));
    assert.ok(ALLOWED_AVATAR_TYPES.includes("image/png"));
    assert.equal(MAX_AVATAR_BYTES, 2097152);
});

test("validateAvatarFile accepts images within 2 MB and rejects the rest", () => {
    assert.equal(validateAvatarFile({ type: "image/png", size: 1024 }), null);
    assert.equal(validateAvatarFile({ type: "image/gif", size: MAX_AVATAR_BYTES }), null);
    assert.match(validateAvatarFile({ type: "application/pdf", size: 10 }), /只支持/);
    assert.match(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES + 1 }), /2 MB/);
    assert.match(validateAvatarFile({ type: "image/png", size: 0 }), /空/);
    assert.match(validateAvatarFile({ type: "", size: 10 }), /只支持/);
    assert.match(validateAvatarFile(null), /选择一张/);
});

test("avatarStoragePath is one fixed path per user", () => {
    assert.equal(avatarStoragePath("user-123"), "user-123/avatar");
    assert.throws(() => avatarStoragePath(""), /用户 id/);
    assert.throws(() => avatarStoragePath(null), /用户 id/);
});

test("avatarDisplay normalizes emoji and upload profiles, rejects incomplete rows", () => {
    assert.deepEqual(
        avatarDisplay({ avatar_kind: "emoji", avatar_emoji: "🦊", avatar_color: AVATAR_COLORS[1] }),
        { type: "emoji", emoji: "🦊", color: AVATAR_COLORS[1] }
    );
    assert.deepEqual(
        avatarDisplay({ avatar_kind: "emoji", avatar_emoji: "🐱", avatar_color: "" }),
        { type: "emoji", emoji: "🐱", color: AVATAR_COLORS[0] }
    );
    assert.deepEqual(
        avatarDisplay({ avatar_kind: "upload", avatar_path: "uid/avatar" }),
        { type: "image", path: "uid/avatar" }
    );
    assert.equal(avatarDisplay({ avatar_kind: "upload", avatar_path: "" }), null);
    assert.equal(avatarDisplay({ avatar_kind: "emoji", avatar_emoji: "" }), null);
    assert.equal(avatarDisplay({ avatar_kind: "other" }), null);
    assert.equal(avatarDisplay(null), null);
});

test("fallback avatar is deterministic and stays inside the preset lists", () => {
    const first = fallbackAvatarDisplay("小白兔");
    const second = fallbackAvatarDisplay("小白兔");
    assert.deepEqual(first, second);
    assert.ok(AVATAR_EMOJIS.includes(first.emoji));
    assert.ok(AVATAR_COLORS.includes(first.color));
    assert.equal(hashString(""), 0);
    assert.equal(hashString("a"), 97);
});

test("avatarPublicUrl uses the storage bucket public URL", () => {
    const fake = {
        storage: {
            from: (bucket) => ({
                getPublicUrl: (path) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` } })
            })
        }
    };
    assert.equal(
        avatarPublicUrl(fake, "uid/avatar"),
        "https://example.supabase.co/storage/v1/object/public/avatars/uid/avatar"
    );
});

test("fetchProfile returns null when the user has no profile row", async () => {
    const fake = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null })
                })
            })
        })
    };
    assert.equal(await fetchProfile(fake, "uid-1"), null);
});

test("个人头像设置：未保存修改防丢失拦截、离页守卫与状态指示微徽章", () => {
    const html = readFileSync(new URL("../profile.html", import.meta.url), "utf8");
    const css = readFileSync(new URL("../profile.css", import.meta.url), "utf8");
    const js = readFileSync(new URL("../profile.js", import.meta.url), "utf8");

    // 1. HTML 与 CSS 节点与样式验证
    assert(html.includes('id="avatar-dirty-badge"'), "需包含未保存修改微徽章");
    assert(html.includes('class="profile-dirty-badge"'), "需声明 profile-dirty-badge 类名");
    assert(css.includes(".profile-dirty-badge"), "CSS 需定义未保存修改微徽章样式");
    assert(css.includes(".profile-dirty-badge[hidden]"), "CSS 需支持 hidden 属性隐藏");

    // 2. JS 离页保护与脏状态逻辑验证
    assert(js.includes("function captureBaseline()"), "需包含基准状态快照函数");
    assert(js.includes("function checkDirty()"), "需包含动态脏状态计算函数");
    assert(js.includes("function updateDirty()"), "需包含脏状态同步与徽章更新函数");
    assert(js.includes("function canLeave()"), "需包含二次确认拦截判断函数");
    assert(js.includes('window.addEventListener("beforeunload"'), "需监听 beforeunload 原生弹窗保护");
    assert(js.includes('document.addEventListener("click"'), "需捕获 a 标签与 signout 按钮的点击拦截");
    assert(js.includes('captureBaseline();'), "保存与重置成功后需刷新基准快照");
});
