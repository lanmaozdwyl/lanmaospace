export function cleanSpace(values){
 const display_name=String(values.display_name||'').trim(),bio=String(values.bio||'').trim();
 if(!display_name||[...display_name].length>40)throw Error('昵称请填写 1–40 字。');
 if([...bio].length>600)throw Error('简介不能超过 600 字。');
 const links=values.links||[];
 if(!Array.isArray(links)||links.length>6)throw Error('最多设置 6 个链接。');
 return {display_name,bio,links:links.map(link=>{
  const label=String(link.label||'').trim(),url=String(link.url||'').trim();
  let parsed;try{parsed=new URL(url);}catch{throw Error('链接网址格式不正确。');}
  if(!label||[...label].length>40||url.length>1000||!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('链接须填写名称和 HTTP/HTTPS 网址，不能包含登录凭据。');
  return {label,url};
 })};
}
export function cleanPost(body){body=String(body||'').trim();if(!body||[...body].length>2000)throw Error('动态请填写 1–2000 字。');return body;}
export function memberId(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'')?value:null;}
