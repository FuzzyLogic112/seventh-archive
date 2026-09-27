import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(resolve(root, 'dist', match[1]));
for (const file of ['dist/engine.js','dist/app.js','scripts/serve.mjs']) {
  const r = spawnSync(process.execPath, ['--check', resolve(root, file)], {stdio:'inherit'});
  if (r.status) process.exit(r.status);
}
if (!html.includes('lang="zh-CN"') || !html.includes('viewport')) throw new Error('Missing document metadata');
console.log('Static references and JavaScript syntax passed. No build step is required.');
