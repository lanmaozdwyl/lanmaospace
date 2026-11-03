export const MIN_PASSWORD_LENGTH=8;
export function validateNewPassword(password){
 if(typeof password!=='string'||[...password].length<MIN_PASSWORD_LENGTH)return '新密码至少需要 8 位，并同时包含英文字母和数字。';
 if(!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return '新密码需同时包含英文字母和数字。';
 if([...password].length>128)return '密码请控制在 128 位以内。';
 return null;
}
export async function currentAccount(client,expectedId){const {data,error}=await client.auth.getUser();if(error)throw error;if(!data.user||expectedId&&data.user.id!==expectedId)throw Error('登录账号已变化，请重新打开账号安全页。');return data.user;}
export async function sendAccountReset(client,userId,origin){const user=await currentAccount(client,userId);if(!user.email)throw Error('此账号未绑定邮箱。');const {error}=await client.auth.resetPasswordForEmail(user.email,{redirectTo:origin+'/login.html'});if(error)throw error;}
export async function signOutEverywhere(client){const {error}=await client.auth.signOut({scope:'global'});if(error)throw error;}
