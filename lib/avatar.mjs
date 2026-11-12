// Lanmao Space 用户头像共享逻辑：预设、校验、存储路径、头像归一化。
// 纯逻辑，不碰 DOM、不直接创建 Supabase 客户端，方便 Node 测试复用。
// 浏览器里的渲染（留言、页头、个人页）各自按 avatarDisplay 的结果画节点。

export const AVATAR_COLORS = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    "linear-gradient(135deg, #ffecd2, #fcb69f)"
];
export const AVATAR_EMOJIS = ["🐱", "🐶", "🐰", "🐼", "🦊", "🐸", "🦉", "🐝", "🦋", "🐳", "🐨", "🐯"];

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2097152;
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// 上传文件校验：只收图片、单张不超过 2 MB。返回 null 表示通过，否则返回提示文案。
export function validateAvatarFile(file) {
    if (!file || typeof file !== "object") return "请选择一张图片。";
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return "只支持 JPG、PNG、WebP、GIF 图片。";
    if (typeof file.size !== "number" || file.size <= 0) return "这张图片是空的，请换一张。";
    if (file.size > MAX_AVATAR_BYTES) return "图片太大了，请控制在 2 MB 以内。";
    return null;
}

// 每人固定一个存储路径，换图直接覆盖，不产生孤儿文件。
export function avatarStoragePath(userId) {
    if (typeof userId !== "string" || userId.length === 0) throw new Error("缺少用户 id，无法确定头像路径。");
    return `${userId}/avatar`;
}

export function avatarPublicUrl(client, path) {
    return client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function hashString(text) {
    let hash = 0;
    const input = typeof text === "string" ? text : "";
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
}

// 把 profiles 行归一化成渲染用的描述；不完整或未知类型返回 null，调用方回退默认头像。
export function avatarDisplay(profile) {
    if (!profile || typeof profile !== "object") return null;
    if (profile.avatar_kind === "upload" && typeof profile.avatar_path === "string" && profile.avatar_path.length > 0) {
        return { type: "image", path: profile.avatar_path };
    }
    if (profile.avatar_kind === "emoji" && typeof profile.avatar_emoji === "string" && profile.avatar_emoji.length > 0) {
        return {
            type: "emoji",
            emoji: profile.avatar_emoji,
            // 这个值会原样写进 style.background，所以只认预设渐变：
            // 若允许任意字符串，库里塞一条 url(https://…) 就等于给每个浏览成员空间的人挂上追踪请求。
            color: AVATAR_COLORS.includes(profile.avatar_color)
                ? profile.avatar_color
                : AVATAR_COLORS[0]
        };
    }
    return null;
}

// 没有头像记录时的回退：按名字哈希取预设 emoji + 渐变色，和旧版留言头像一致。
export function fallbackAvatarDisplay(name) {
    const hash = hashString(name || "");
    return {
        type: "emoji",
        emoji: AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length],
        color: AVATAR_COLORS[hash % AVATAR_COLORS.length]
    };
}

// 读自己的 profiles 行：没有行返回 null；表还没建好时抛错，调用方提示运行 avatars.sql。
export async function fetchProfile(client, userId) {
    const { data, error } = await client
        .from("profiles")
        .select("user_id, avatar_kind, avatar_emoji, avatar_color, avatar_path")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}
