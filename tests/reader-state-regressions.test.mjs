import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../reader.js',import.meta.url),'utf8');
test('追加章节不会改变当前章节保存的相对阅读位置',()=>{
 const section={offsetTop:1200,offsetHeight:1000};
 const c={state:{currentChapterIndex:1},document:{querySelector:()=>section}};vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('    function getChapterScrollAnchor('),source.indexOf('    function saveProgress(')),c);
 const viewport={scrollTop:1450,scrollHeight:2400,clientHeight:600};
 assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,.25);
 viewport.scrollHeight=6000;assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,.25);
 assert.equal(c.getChapterScrollAnchor(viewport).scrollY,250);
 assert.equal(c.getChapterScrollAnchor(viewport).scrollAnchorVersion,2);
 c.state.currentBook={chapters:[{},{}]};viewport.scrollHeight=2200;viewport.scrollTop=1600;assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,1);
});
test('朗读切换后旧回调不能跳过新段落，同一回调也不能重复推进',()=>{
 const spoken=[];
 const c={state:{tts:{active:true,paused:false,currentParaIndex:0,paragraphs:[{text:'第一段'},{text:'第二段'},{text:'第三段'}]}},
  document:{querySelectorAll:()=>[]},isTTSSupported:()=>true,updateTTSBarUI(){},stopTTS(){},showToast(){},console,
  window:{speechSynthesis:{cancel(){},speak:u=>spoken.push(u)},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('    function speakCurrentParagraph('),source.indexOf('    function startTTS(')),c);
 c.speakCurrentParagraph();const old=spoken[0];c.state.tts.currentParaIndex=1;c.speakCurrentParagraph();const current=spoken[1];
 old.onend();old.onerror({error:'network'});assert.equal(c.state.tts.currentParaIndex,1);assert.equal(spoken.length,2);
 current.onend();assert.equal(c.state.tts.currentParaIndex,2);assert.equal(spoken.length,3);
 current.onend();assert.equal(c.state.tts.currentParaIndex,2);assert.equal(spoken.length,3);
});
