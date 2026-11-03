import {initTheme} from './lib/theme.mjs';
import {installViewport} from './lib/viewport.mjs';
installViewport();
const nav=document.createElement('nav');nav.className='mobile-dock';nav.setAttribute('aria-label','手机主要功能');
const items=[['/','首页','⌂'],['/reader.html','阅读','▤'],['/#focus','专注','◷'],['/space.html','我的','♙']];
const dockLinks=[];
function active(path){
 let p=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';if(p==='/index')p='/';
 if(path==='/')return p==='/'&&location.hash!=='#focus';
 if(path==='/#focus')return p==='/'&&location.hash==='#focus';
 if(path==='/space.html')return ['/space','/account','/profile','/memo'].includes(p);
 return p===path.replace(/\.html$/,'');
}
function updateDock(){for(const [a,href] of dockLinks){if(active(href))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
window.addEventListener?.('hashchange',updateDock);
for(const [href,label,icon] of items){const a=document.createElement('a');a.href=href;dockLinks.push([a,href]);if(active(href))a.setAttribute('aria-current','page');const symbol=document.createElement('span');symbol.className='dock-symbol';symbol.textContent=icon;symbol.setAttribute('aria-hidden','true');const name=document.createElement('span');name.textContent=label;a.append(symbol,name);nav.append(a);}
const more=document.createElement('button');more.type='button';more.innerHTML='<span class="dock-symbol" aria-hidden="true">•••</span><span>更多</span>';more.setAttribute('aria-haspopup','dialog');nav.append(more);
const sheet=document.createElement('dialog');sheet.className='mobile-sheet';sheet.id='mobile-menu';sheet.setAttribute('aria-labelledby','mobile-menu-title');more.setAttribute('aria-controls',sheet.id);more.setAttribute('aria-expanded','false');
const header=document.createElement('div');header.className='mobile-sheet-header';const title=document.createElement('h2');title.id='mobile-menu-title';title.textContent='常用功能';const close=document.createElement('button');close.type='button';close.textContent='关闭';header.append(title,close);sheet.append(header);
for(const [href,label,note] of [['/#ambient','自然声音','溪流、雨声与柔和伴读'],['/#contact','留言板','交流与反馈'],['/account.html','账号安全','改密与全设备退出'],['/profile.html','设置头像','预设与图片上传'],['/memo.html','店主备忘录','需要店主身份和独立口令']]){const a=document.createElement('a');a.href=href;const name=document.createElement('strong'),detail=document.createElement('span');name.textContent=label;detail.textContent=note;a.append(name,detail);a.addEventListener('click',()=>sheet.close());sheet.append(a);}
function action(label,fn){const b=document.createElement('button');b.type='button';b.className='mobile-sheet-action';b.textContent=label;b.addEventListener('click',fn);sheet.append(b);return b;}
let themeStorage;try{themeStorage=localStorage;}catch{}
const theme=initTheme({root:document.documentElement,body:document.body,button:document.getElementById('theme-toggle'),storage:themeStorage,media:matchMedia('(prefers-color-scheme:dark)')});
if(document.getElementById('spotlight-trigger'))action('搜索本站',()=>{sheet.close();document.getElementById('spotlight-trigger').click();});
action('切换明暗外观',()=>theme.toggle());
const signout=action('退出当前登录',()=>sheet.close());signout.setAttribute('data-signout','');
more.addEventListener('click',()=>{sheet.showModal();more.setAttribute('aria-expanded','true');});close.addEventListener('click',()=>sheet.close());sheet.addEventListener('close',()=>{more.setAttribute('aria-expanded','false');if(!document.querySelector('dialog[open]'))more.focus({preventScroll:true});});
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)sheet.close();}});
document.body.append(nav,sheet);document.body.classList.add('mobile-enabled');
const media=matchMedia('(max-width: 820px)');media.addEventListener('change',()=>{if(!media.matches&&sheet.open)sheet.close();});
let fullHeight=window.visualViewport?.height||window.innerHeight;
function keyboard(){const focused=document.activeElement,editing=focused?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=file]),[contenteditable=true]');const h=window.visualViewport?.height||innerHeight;if(!editing)fullHeight=h;document.body.classList.toggle('mobile-keyboard',!!editing&&fullHeight-h>140);}
window.visualViewport?.addEventListener('resize',keyboard);document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,100));
