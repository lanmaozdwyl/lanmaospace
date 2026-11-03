// 只缓存离线提示与静态装饰资源，不缓存页面、配置、登录链接或用户数据。
const CACHE_NAME='lanmaospace-shell-v2';
const ASSETS=['/offline.html','/style.css','/images/icon-192.png','/images/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lanmaospace-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}
 if(!ASSETS.includes(u.pathname)||u.search)return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok&&!response.headers.get('Cache-Control')?.includes('no-store'))event.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(event.request,response.clone())));
  return response;
 }).catch(()=>caches.match(event.request)));
});
