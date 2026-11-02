# 商店商品维护

数据源是 products.json。修改前保存备份，保持价格为数字，运行 npm test；Cloudflare 也会检查数据后再发布。

可选字段：
- availability：available（可供货）、consult（供货请咨询）、unavailable（暂不可供货）。未填写显示“供货请咨询”。没有确认库存不要填写 available。
- priceUpdatedAt：实际核对价格的日期，格式 YYYY-MM-DD。未填写不显示，不能用网站部署日期代替。
- deliveryNote：实际交付方式、时效或限制，最多 600 字。未填写不显示，不编造承诺。

现有 name/category/period/note/price/image 保持原义。图片放 images/products 目录；数据中只写相对路径。供货状态只是人工维护信息，付款前仍须 QQ 确认。本站无在线支付、无自动发货。

上线检查：商品卡、详情、分类、搜索和数据加载失败后的“重新加载商品”。修改价格或接单方式仍需店主明确指示。
