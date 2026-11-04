// 动态 Markdown 轻量排版：格式化辅助 + 安全预览。预览只用 createElement/textContent 构建节点，不解析任何 HTML 字符串。
export const MAX_POST=2000;
const INLINE={bold:['**','**','粗体文字'],italic:['*','*','斜体文字'],code:['`','`','代码']};
const LINE={quote:['> ','引用文字'],list:['- ','列表项']};
function clamp(n,len){return Math.min(Math.max(n,0),len);}
export function applyFormat(value,start,end,kind){
 value=String(value==null?'':value);const len=value.length;
 let s=Number.isInteger(start)?clamp(start,len):len;
 let e=Number.isInteger(end)?clamp(end,len):s;
 if(e<s){const t=s;s=e;e=t;}
 let out=null;
 if(Object.prototype.hasOwnProperty.call(INLINE,kind)){
  const [open,close,placeholder]=INLINE[kind];
  const inner=value.slice(s,e)||placeholder;
  out={value:value.slice(0,s)+open+inner+close+value.slice(e),start:s+open.length,end:s+open.length+inner.length};
 }else if(Object.prototype.hasOwnProperty.call(LINE,kind)){
  const [prefix,placeholder]=LINE[kind];
  const ls=s===0?0:value.lastIndexOf('\n',s-1)+1;
  let le=value.indexOf('\n',e);if(le===-1)le=len;
  if(e>s&&value[e-1]==='\n')le=e-1;
  if(le<ls)le=ls;
  const block=value.slice(ls,le);
  if(!block.trim()){
   const nb=prefix+placeholder;
   out={value:value.slice(0,ls)+nb+value.slice(le),start:ls+prefix.length,end:ls+nb.length};
  }else{
   const lines=block.split('\n');
   const all=lines.filter(l=>l.trim()).every(l=>l.startsWith(prefix));
   const nb=lines.map(l=>!l.trim()?l:all?l.slice(prefix.length):prefix+l).join('\n');
   out={value:value.slice(0,ls)+nb+value.slice(le),start:ls,end:ls+nb.length};
  }
 }
 if(!out||[...out.value].length>MAX_POST)return null;
 return out;
}
function mk(doc,tag,text){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function textNode(doc,s){return typeof doc.createTextNode==='function'?doc.createTextNode(s):mk(doc,'span',s);}
const INLINE_RE=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/;
export function renderInline(doc,s){
 const nodes=[];
 String(s==null?'':s).split(INLINE_RE).forEach((part,i)=>{
  if(!part)return;
  if(i%2===0){nodes.push(textNode(doc,part));return;}
  if(part.startsWith('**'))nodes.push(mk(doc,'strong',part.slice(2,-2)));
  else if(part.startsWith('`'))nodes.push(mk(doc,'code',part.slice(1,-1)));
  else nodes.push(mk(doc,'em',part.slice(1,-1)));
 });
 return nodes;
}
function lineEl(doc,tag,lines){const el=mk(doc,tag);lines.forEach((l,i)=>{if(i)el.append(mk(doc,'br'));el.append(...renderInline(doc,l));});return el;}
export function renderMarkdown(doc,text){
 const out=[];let cur=null;
 const flush=()=>{
  if(!cur)return;
  if(cur.type==='list'){const ul=mk(doc,'ul');cur.lines.forEach(l=>{const li=mk(doc,'li');li.append(...renderInline(doc,l));ul.append(li);});out.push(ul);}
  else if(cur.type==='quote'){const q=mk(doc,'blockquote');q.append(lineEl(doc,'p',cur.lines));out.push(q);}
  else out.push(lineEl(doc,'p',cur.lines));
  cur=null;
 };
 String(text==null?'':text).replace(/\r\n?/g,'\n').split('\n').forEach(line=>{
  if(!line.trim()){flush();return;}
  let type='p',body=line;
  if(line==='>'||line.startsWith('> ')){type='quote';body=line.slice(2);}
  else if(/^[-*] /.test(line)){type='list';body=line.slice(2);}
  if(!cur||cur.type!==type){flush();cur={type,lines:[]};}
  cur.lines.push(body);
 });
 flush();
 return out;
}
