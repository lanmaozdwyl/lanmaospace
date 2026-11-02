import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {validateCatalog,productDetails} from '../lib/catalog.mjs';
const catalog=JSON.parse(readFileSync(new URL('../products.json',import.meta.url),'utf8'));
test('实际商品数据符合结构且图片存在',()=>{validateCatalog(catalog);for(const p of catalog)if(p.image)assert(existsSync(new URL('../'+p.image,import.meta.url)));});
test('没有维护资料时不编造更新日期或交付时效',()=>{assert.deepEqual(productDetails(catalog[0]),[['供货状态','请联系店主确认']]);});
test('真实填写的维护信息按原文呈现',()=>{const p={...catalog[0],availability:'unavailable',priceUpdatedAt:'2026-11-02',deliveryNote:'先咨询确认'};validateCatalog([p]);assert.deepEqual(productDetails(p),[['供货状态','暂不可供货'],['价格更新','2026-11-02'],['交付说明','先咨询确认']]);});
test('无效价格、伪日期、未知状态和外部图片拒绝发布',()=>{for(const patch of [{price:'124'},{price:-1},{priceUpdatedAt:'2026-02-30'},{availability:'invented'},{deliveryNote:''},{image:'https://example.org/a.png'}])assert.throws(()=>validateCatalog([{...catalog[0],...patch}]));assert.throws(()=>validateCatalog([catalog[0],catalog[0]]));});
