import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../tools/tools.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../tools/index.html',import.meta.url),'utf8');
function fixture(query){
 const make=(dataset,textContent='')=>({dataset,textContent,attrs:{},handlers:{},hidden:false,classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name);},contains(name){return this.values.has(name);}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;},querySelector(sel){if(sel==='.filter-count')return this.badge||(this.badge=make({},''));return null;}});
 const buttons=['all','translate','academic','dev','design'].map(filter=>make({filter}));
 const cards=[make({category:'translate',name:'deepl'},'DeepL'),make({category:'academic',name:'zotero'},'Zotero'),make({category:'dev',name:'github'},'GitHub')];
 const groups=cards.map(card=>({...make({}),querySelectorAll(){return card.classList.contains('hidden')?[]:[card];}}));
 const search=make({});search.value='';search.tagName='INPUT';search.focused=false;search.focus=function(){this.focused=true;};search.blur=function(){this.focused=false;};
 const empty=make({});
 const emptyReset=make({});
 const searchClear=make({});searchClear.hidden=true;
 const docHandlers={};
 const document={
  addEventListener(k,fn){docHandlers[k]=fn;},
  querySelectorAll(s){return s.includes('filter-btn')?buttons:s==='.tool-card'?cards:groups;},
  getElementById(id){
   if(id==='tools-search')return search;
   if(id==='tools-empty')return empty;
   if(id==='tools-empty-reset')return emptyReset;
   if(id==='tools-search-clear')return searchClear;
   return null;
  }
 };
 vm.runInNewContext(source,{document,window:{location:{search:query}},URLSearchParams});
 const press=(key,opts={})=>{const e={key,target:{tagName:'BODY'},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...opts};docHandlers.keydown(e);return e;};
 return{buttons,cards,search,empty,emptyReset,searchClear,groups,press,docHandlers};
}
const vis=f=>f.cards.map(c=>!c.classList.contains('hidden'));
test('分类直达时只显示匹配工具并同步按钮状态',()=>{const f=fixture('?category=academic');assert.deepEqual(f.cards.map(c=>!c.classList.contains('hidden')),[false,true,false]);assert.equal(f.buttons[2].attrs['aria-pressed'],'true');assert.equal(f.empty.hidden,true);});
test('未知分类安全回退完整目录',()=>{const f=fixture('?category=unknown');assert(f.cards.every(c=>!c.classList.contains('hidden')));assert.equal(f.buttons[0].attrs['aria-pressed'],'true');});
test('直达分类后仍能搜索、显示空状态并切换分类',()=>{const f=fixture('?category=translate');f.search.value='github';f.search.handlers.input();assert.equal(f.empty.hidden,false);assert(f.groups.every(g=>g.classList.contains('hidden')));f.buttons[3].handlers.click();assert.equal(f.empty.hidden,true);assert(!f.cards[2].classList.contains('hidden'));assert.equal(f.buttons[1].attrs['aria-pressed'],'false');});
test('数字键 3 切到第三个分类，同步高亮、aria-pressed 并阻止默认行为',()=>{const f=fixture('');const e=f.press('3');assert.deepEqual(vis(f),[false,true,false]);assert.equal(f.buttons[2].attrs['aria-pressed'],'true');assert(f.buttons[2].classList.contains('active'));assert(f.buttons[2].classList.contains('key-flash'));assert.equal(f.buttons[0].attrs['aria-pressed'],'false');assert.equal(e.defaultPrevented,true);});
test('数字键 1 回到全部，并保留当前搜索词',()=>{const f=fixture('?category=dev');f.press('1');assert(vis(f).every(Boolean));assert.equal(f.buttons[0].attrs['aria-pressed'],'true');f.search.value='zotero';f.search.handlers.input();f.press('4');assert.deepEqual(vis(f),[false,false,false]);assert.equal(f.empty.hidden,false);});
test('超出分类数量的数字键 5~9 之外的 6~9 与 0 被忽略且不拦截',()=>{const f=fixture('?category=translate');for(const k of ['6','7','8','9','0']){const e=f.press(k);assert.equal(e.defaultPrevented,false);}assert.deepEqual(vis(f),[true,false,false]);assert.equal(f.buttons[1].attrs['aria-pressed'],'true');f.press('5');assert.equal(f.buttons[4].attrs['aria-pressed'],'true');});
test('在搜索框里打字时不拦截数字键与斜杠',()=>{const f=fixture('');const e1=f.press('3',{target:f.search});const e2=f.press('/',{target:f.search});assert.equal(e1.defaultPrevented,false);assert.equal(e2.defaultPrevented,false);assert(vis(f).every(Boolean));assert.equal(f.buttons[0].attrs['aria-pressed'],'true');assert.equal(f.search.focused,false);});
test('textarea、select 与可编辑区域同样不被拦截',()=>{const f=fixture('');for(const target of [{tagName:'TEXTAREA'},{tagName:'SELECT'},{tagName:'DIV',isContentEditable:true}]){const e=f.press('2',{target});assert.equal(e.defaultPrevented,false);}assert(vis(f).every(Boolean));});
test('斜杠聚焦搜索框并阻止斜杠被输入',()=>{const f=fixture('');const e=f.press('/');assert.equal(f.search.focused,true);assert.equal(e.defaultPrevented,true);});
test('Esc 先清空搜索内容并恢复列表，再按一次退出搜索焦点',()=>{const f=fixture('');f.search.focused=true;f.search.value='github';f.search.handlers.input();assert.equal(f.empty.hidden,true);assert.deepEqual(vis(f),[false,false,true]);const e1=f.press('Escape',{target:f.search});assert.equal(f.search.value,'');assert(vis(f).every(Boolean));assert.equal(f.search.focused,true);assert.equal(e1.defaultPrevented,true);f.press('Escape',{target:f.search});assert.equal(f.search.focused,false);});
test('搜索框失焦后按 Esc 仍可清空残留搜索词；无内容时不做任何事',()=>{const f=fixture('');f.search.value='deepl';f.search.handlers.input();f.press('Escape');assert.equal(f.search.value,'');assert(vis(f).every(Boolean));const e=f.press('Escape');assert.equal(e.defaultPrevented,false);});
test('带 Ctrl/Meta/Alt 的组合键与输入法组字、已处理事件都不触发快捷键',()=>{const f=fixture('');for(const opts of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true}]){const e=f.press('3',opts);assert.equal(e.preventDefault===undefined,false);}assert(vis(f).every(Boolean));assert.equal(f.buttons[0].attrs['aria-pressed'],'true');const s=f.press('/',{ctrlKey:true});assert.equal(s.defaultPrevented,false);assert.equal(f.search.focused,false);});
test('键盘切换后点击按钮仍然正常，两种入口共用同一套状态',()=>{const f=fixture('');f.press('2');assert.equal(f.buttons[1].attrs['aria-pressed'],'true');f.buttons[3].handlers.click();assert.equal(f.buttons[3].attrs['aria-pressed'],'true');assert.equal(f.buttons[1].attrs['aria-pressed'],'false');assert.deepEqual(vis(f),[false,false,true]);});
test('键盘支持符合 CSP：脚本无 eval、Function、内联脚本，页面无内联事件属性',()=>{assert.doesNotMatch(source,/\beval\s*\(|new\s+Function|document\.write|innerHTML/);assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>/i);assert.doesNotMatch(html,/<[^>]+\son[a-z]+\s*=/i);assert.match(html,/<script src="tools\.js"><\/script>/);});
test('页面包含键盘提示与搜索框快捷键声明',()=>{assert.match(html,/class="tools-keyhint"/);assert.match(html,/aria-keyshortcuts="\/"/);});
test('搜索无匹配时提供一键重置按钮，点击清空搜索词并还原为全部分类',()=>{
 const f=fixture('?category=translate');
 f.search.value='nonexistent';
 f.search.handlers.input();
 assert.equal(f.empty.hidden,false);
 assert.equal(f.searchClear.hidden,false);
 f.emptyReset.handlers.click();
 assert.equal(f.search.value,'');
 assert.equal(f.buttons[0].attrs['aria-pressed'],'true');
 assert.equal(f.empty.hidden,true);
 assert.equal(f.searchClear.hidden,true);
 assert(f.cards.every(c=>!c.classList.contains('hidden')));
 assert.equal(f.search.focused,true);
});
test('搜索输入框快捷清空按钮，点击即刻重置输入与筛选状态',()=>{
 const f=fixture('');
 f.search.value='deepl';
 f.search.handlers.input();
 assert.equal(f.searchClear.hidden,false);
 f.searchClear.handlers.click();
 assert.equal(f.search.value,'');
 assert.equal(f.searchClear.hidden,true);
 assert(f.cards.every(c=>!c.classList.contains('hidden')));
 assert.equal(f.search.focused,true);
});
test('工具站分类数量智能徽章与空状态重置结构规范',()=>{
 assert.match(html,/id="tools-empty-reset"/);
 assert.match(html,/class="tools-search-clear"/);
 assert.match(html,/class="filter-count"/);
 assert.match(source,/updateCategoryCounts/);
});
