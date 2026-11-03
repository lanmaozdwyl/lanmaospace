// 个人空间导出只读云端已保存内容；不读取账号邮箱、密码或配置密钥。
export const SPACE_POST_LIMIT=500;
const POST_FIELDS='id,user_id,body,archived,moderation_hidden,created_at,updated_at,edited_at';
async function unwrap(query,active){const {data,error}=await query;active();if(error)throw error;return data;}
async function snapshot(client,userId,active){
 const [profile,avatar]=await Promise.all([
  unwrap(client.from('user_spaces').select('display_name,bio,links,updated_at').eq('user_id',userId).maybeSingle(),active),
  unwrap(client.from('profiles').select('avatar_kind,avatar_emoji,avatar_color,avatar_path').eq('user_id',userId).maybeSingle(),active)
 ]);
 const posts=[];
 for(let offset=0;;offset+=100){
  const page=await unwrap(client.from('space_posts').select(POST_FIELDS).eq('user_id',userId).order('id',{ascending:true}).range(offset,offset+99),active);
  if(!Array.isArray(page))throw Error('动态目录读取不完整，请重试。');
  posts.push(...page);
  if(posts.length>5000)throw Error('动态数量过多，已停止导出，请联系店主。');
  if(page.length<100)break;
 }
 return {profile,avatar,posts};
}
export async function exportOwnSpace(client,userId,active=()=>{}){
 const {data,error}=await client.auth.getUser();active();if(error)throw error;
 if(!data.user||data.user.id!==userId)throw Error('只能导出当前登录账号自己的内容。');
 const before=await snapshot(client,userId,active),after=await snapshot(client,userId,active);active();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('导出期间云端内容发生变化，未生成文件，请重新导出。');
 return {format:'lanmao-space-export',version:1,exported_at:new Date().toISOString(),user_id:userId,...before};
}
export async function readSpaceUsage(client,userId,active=()=>{}){
 const {count,error}=await client.from('space_posts').select('id',{count:'exact',head:true}).eq('user_id',userId);active();if(error)throw error;
 if(!Number.isSafeInteger(count)||count<0)throw Error('暂时无法读取准确用量。');
 return {used:count,limit:SPACE_POST_LIMIT,remaining:Math.max(0,SPACE_POST_LIMIT-count)};
}
