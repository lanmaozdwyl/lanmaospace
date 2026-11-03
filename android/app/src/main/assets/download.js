(function(){
 if(window.LanmaoExport||!window.LanmaoFiles)return;
 const bridge=window.LanmaoFiles,names=new Map();let transfer=null,waiter=null;
 function send(type,body){bridge.postMessage(JSON.stringify(Object.assign({type:type,id:transfer.id},body||{})));}
 function wait(){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{waiter=null;reject(Error('保存响应超时'));},120000);waiter={resolve:x=>{clearTimeout(timeout);resolve(x);},reject:e=>{clearTimeout(timeout);reject(e);}};});}
 bridge.onmessage=function(e){let m;try{m=JSON.parse(e.data);}catch{return;}if(!transfer||m.id!==transfer.id)return;const w=waiter;waiter=null;if(!w)return;if(m.type==='error'||m.type==='cancel')w.reject(Error(m.type==='cancel'?'已取消保存':'保存失败'));else w.resolve(m);};
 document.addEventListener('click',function(e){const a=e.target.closest?.('a[download]');if(a&&a.href.startsWith('blob:'))names.set(a.href,a.download);},true);
 window.LanmaoExport={start:async function(url){
  if(transfer||!url.startsWith('blob:https://lanmaospace.pages.dev/'))return;
  transfer={id:String(Date.now())+'-'+Math.random().toString(36).slice(2)};
  try{
   const blob=await(await fetch(url)).blob();if(blob.size>64*1024*1024){alert('本机导出最大支持 64 MB；更大的备份请使用系统浏览器导出。');return;}
   let ready=wait();send('begin',{size:blob.size,name:names.get(url)||'lanmao-export.bin',mime:blob.type||'application/octet-stream'});await ready;
   for(let offset=0;offset<blob.size;offset+=65536){const bytes=new Uint8Array(await blob.slice(offset,offset+65536).arrayBuffer());let raw='';for(let i=0;i<bytes.length;i++)raw+=String.fromCharCode(bytes[i]);const ack=wait();send('chunk',{offset:offset,data:btoa(raw)});await ack;}
   const done=wait();send('end');await done;
  }catch(e){try{if(transfer)send('abort');}catch{}if(e.message!=='已取消保存')alert('导出没有完成，请重新导出或使用系统浏览器。');}
  finally{names.delete(url);transfer=null;waiter=null;}
 }};
})();
