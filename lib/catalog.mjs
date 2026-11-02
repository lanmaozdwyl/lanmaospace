// 可选商品维护信息；缺少真实资料时不生成库存或日期。
export const availabilityLabels = Object.freeze({available:'可供货',consult:'供货请咨询',unavailable:'暂不可供货'});
export function validateCatalog(items) {
 if(!Array.isArray(items))throw Error('商品列表必须为数组');
 const names=new Set();
 for(const [i,p] of items.entries()){
  const fail=msg=>{throw Error(`商品 ${i+1}：${msg}`);};
  if(!p||typeof p!=='object')fail('格式不正确');
  for(const key of ['name','category','period','note'])if(typeof p[key]!=='string'||!p[key].trim())fail(`${key} 不能为空`);
  if(names.has(p.name))fail('名称重复');names.add(p.name);
  if(typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0)fail('价格必须为非负数字');
  if(p.availability!==undefined&&!Object.hasOwn(availabilityLabels,p.availability))fail('未知供货状态');
  if(p.priceUpdatedAt!==undefined){
   const d=p.priceUpdatedAt;
   if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)fail('价格更新日期须为真实 YYYY-MM-DD 日期');
  }
  if(p.deliveryNote!==undefined&&(typeof p.deliveryNote!=='string'||!p.deliveryNote.trim()||p.deliveryNote.length>600))fail('交付说明须为 1–600 字');
  if(p.image!==undefined&&(typeof p.image!=='string'||!/^images\/products\/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/.test(p.image)))fail('图片须使用 images/products 下的本地文件');
 }
 return items;
}
export function productDetails(p){
 const rows=[['供货状态',availabilityLabels[p.availability]||'请联系店主确认']];
 if(p.priceUpdatedAt)rows.push(['价格更新',p.priceUpdatedAt]);
 if(p.deliveryNote)rows.push(['交付说明',p.deliveryNote]);
 return rows;
}
