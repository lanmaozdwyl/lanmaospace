// 与 scripts/check.mjs 共用同一份测试清单，只跑功能测试。
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TESTS} from './test-list.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.execPath,['--test',...TESTS],{cwd:root,stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode = result.status ?? 1;
