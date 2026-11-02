import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../tools/tools.js',import.meta.url),'utf8');
function fixture(query){
 const make=(dataset,textContent='')=>({dataset,textContent,attrs:{},handlers:{},hidden:false,classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name);},contains(name){return this.values.has(name);}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;}});
 const buttons=['all','translate','academic','dev','design'].map(filter=>make({filter}));
 const cards=[make({category:'translate',name:'deepl'},'DeepL'),make({category:'academic',name:'zotero'},'Zotero'),make({category:'dev',name:'github'},'GitHub')];
 const groups=cards.map(card=>({...make({}),querySelectorAll(){return card.classList.contains('hidden')?[]:[card];}}));
 const search=make({});search.value='';const empty=make({});
 const document={querySelectorAll(s){return s.includes('filter-btn')?buttons:s==='.tool-card'?cards:groups;},getElementById(id){return id==='tools-search'?search:empty;}};
 vm.runInNewContext(source,{document,window:{location:{search:query}},URLSearchParams});return{buttons,cards,search,empty,groups};
}
test('分类直达时只显示匹配工具并同步按钮状态',()=>{const f=fixture('?category=academic');assert.deepEqual(f.cards.map(c=>!c.classList.contains('hidden')),[false,true,false]);assert.equal(f.buttons[2].attrs['aria-pressed'],'true');assert.equal(f.empty.hidden,true);});
test('未知分类安全回退完整目录',()=>{const f=fixture('?category=unknown');assert(f.cards.every(c=>!c.classList.contains('hidden')));assert.equal(f.buttons[0].attrs['aria-pressed'],'true');});
test('直达分类后仍能搜索、显示空状态并切换分类',()=>{const f=fixture('?category=translate');f.search.value='github';f.search.handlers.input();assert.equal(f.empty.hidden,false);assert(f.groups.every(g=>g.classList.contains('hidden')));f.buttons[3].handlers.click();assert.equal(f.empty.hidden,true);assert(!f.cards[2].classList.contains('hidden'));assert.equal(f.buttons[1].attrs['aria-pressed'],'false');});
