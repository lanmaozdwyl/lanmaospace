// 复核自托管的 Supabase SDK：lib/vendor/vendor.json 里记的东西现在还成立吗？
//   node scripts/vendor-supabase-sdk.mjs              复核（只读，需要联网到 registry.npmjs.org）
//   node scripts/vendor-supabase-sdk.mjs --rebuild    重新打包并覆盖 vendored 文件
//
// 为什么要有这个文件：站点原先从 cdn.jsdelivr.net 动态 import SDK，CSP 就得放行整个 jsdelivr 域。
// 改成自托管后那条信任边界没了，代价是"这份字节从哪来"必须能重现，否则只是把一个第三方换成另一个第三方。
// 所以默认动作是复核而不是打包：本地 bundle 的 sha256 对得上清单，清单里每个包的回源 sha512
// 也还和官方元数据一致，才算数。
//
// --rebuild 需要构建工具（esbuild），那是另一条信任链，不在这个脚本里自动装：
//   npm install --no-save --registry=https://registry.npmjs.org @supabase/supabase-js@2.39.0 esbuild
//   npx esbuild node_modules/@supabase/supabase-js/dist/module/index.js --bundle --format=esm \
//     --platform=browser --target=es2020 --minify --legal-comments=none \
//     --outfile=lib/vendor/supabase-js-2.39.0.mjs
// 打包完必须再跑一次不带 --rebuild 的复核，并手工确认清单里的 packages 段落跟着版本变了。
// 镜像站装依赖时不要直接提交产物：先按本脚本回源核对，两边一致才有意义。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(`${root}/lib/vendor/vendor.json`, 'utf8'));
const bundlePath = `${root}/${manifest.bundle.file}`;
const bundle = readFileSync(bundlePath);
const sha256 = createHash('sha256').update(bundle).digest('hex');
let failures = 0;

if (sha256 !== manifest.bundle.sha256) {
    console.log(`FAIL bundle sha256 不一致\n  清单 ${manifest.bundle.sha256}\n  实际 ${sha256}`);
    failures++;
} else console.log(`OK   bundle ${manifest.bundle.file} ${bundle.length} bytes ${shorten(sha256)}`);
if (bundle.length !== manifest.bundle.bytes) {
    console.log(`FAIL bundle 字节数 ${bundle.length} != 清单 ${manifest.bundle.bytes}`);
    failures++;
}

// 每个依赖包回源一次：只取元数据里的 dist.integrity，不下 tarball，成本可控。
for (const pkg of manifest.packages) {
    const url = `https://registry.npmjs.org/${pkg.name.replace('/', '%2f')}/${pkg.version}`;
    let meta;
    try {
        meta = JSON.parse(spawnSync('curl', ['-sS', '--max-time', '30', url], { encoding: 'utf8', maxBuffer: 8 << 20 }).stdout);
    } catch { meta = null; }
    if (!meta || meta.error) { console.log(`FAIL ${pkg.name}@${pkg.version} 取不到官方元数据`); failures++; continue; }
    if (meta.dist.integrity !== pkg.sha512) {
        console.log(`FAIL ${pkg.name}@${pkg.version} 官方 sha512 与清单不同\n  清单 ${pkg.sha512}\n  官方 ${meta.dist.integrity}`);
        failures++;
        continue;
    }
    console.log(`OK   ${pkg.name}@${pkg.version} 回源一致`);
}

function shorten(value) { return value.slice(0, 12) + '…'; }

if (process.argv.includes('--rebuild')) {
    console.log('\n--rebuild 是提示用的：按文件头部的三条命令手工执行，别在这里自动装依赖。');
    process.exit(0);
}
console.log(failures ? `\nMISMATCH ${failures} 项，不要上线这份 vendored 文件` : '\nPASS: vendored SDK 与清单、npm 官方元数据一致。');
process.exitCode = failures ? 1 : 0;
