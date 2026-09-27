import { readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPT = resolve(ROOT, '.publish-state.json');
const sleep = ms => new Promise(done => setTimeout(done, ms));

// Only these reviewed project files can be published. Never upload a user's
// working directory recursively, credentials, local saves, or Git metadata.
export const FILES = [
  '.github/workflows/pages.yml', '.gitignore', 'LICENSE', 'ASSETS.md',
  'README.md', 'package.json', 'package-lock.json', 'publish-windows.cmd',
  'dist/.nojekyll', 'dist/index.html', 'dist/styles.css', 'dist/engine.js',
  'dist/app.js', 'dist/navigation.js', 'dist/room.bundle.js', 'dist/vendor/THREE-LICENSE.txt', 'dist/assets/archive-room.webp',
  'src/room.js', 'src/software-renderer.js', 'scripts/build.mjs',
  'scripts/serve.mjs', 'scripts/check.mjs', 'scripts/publish-github.mjs',
  'tests/engine.test.cjs', 'tests/publisher.test.cjs', 'tests/navigation.test.cjs',
  'docs/DEPLOY.md', 'docs/DEPLOY-WINDOWS.md', 'docs/QA.md', 'docs/preview.jpg',
];

export function validName(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value);
}

export function canResume(receipt, repository) {
  return receipt?.format === 1 && receipt.repositoryId === repository.id &&
    receipt.owner === repository.owner?.login && receipt.name === repository.name &&
    repository.private === false;
}

export async function collectFiles(root = ROOT) {
  return Promise.all(FILES.map(async path => {
    const file = resolve(root, path);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`不是普通项目文件：${path}`);
    if (info.size > 5 * 1024 * 1024) throw new Error(`文件超过发布工具的 5 MB 限制：${path}`);
    return { path, bytes: await readFile(file) };
  }));
}

function gh(args, { input, interactive = false, allowFailure = false } = {}) {
  const result = spawnSync('gh', args, {
    cwd: ROOT, encoding: 'utf8', windowsHide: !interactive,
    input, stdio: interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
    timeout: interactive ? undefined : 90000,
  });
  if (result.error?.code === 'ENOENT') throw new Error('未找到 GitHub CLI。先安装 GitHub CLI，再重新运行发布工具。');
  if ((result.error || result.status !== 0) && !allowFailure) {
    throw new Error(result.stderr?.trim() || result.error?.message || 'GitHub 命令未完成；可以重新运行本工具继续。');
  }
  return result;
}

function api(endpoint, method = 'GET', data) {
  const args = ['api', endpoint, '--hostname', 'github.com', '--method', method,
    '-H', 'Accept: application/vnd.github+json'];
  if (data !== undefined) args.push('--input', '-');
  const out = gh(args, { input: data === undefined ? undefined : JSON.stringify(data) }).stdout.trim();
  return out ? JSON.parse(out) : null;
}

function optionalApi(endpoint) {
  try { return api(endpoint); }
  catch (error) { if (/HTTP 404/.test(error.message)) return null; throw error; }
}

async function retryRead(read, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const value = read();
    if (value) return value;
    await sleep(3000);
  }
  throw new Error('GitHub 仍在同步新仓库。稍后重新运行本工具即可继续。');
}

async function saveReceipt(receipt) {
  await writeFile(RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
}

export async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('请安装 Node.js 22 或更高版本。');
  const files = await collectFiles();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file.path).update('\0').update(file.bytes).update('\0');
  const sourceHash = hash.digest('hex');
  if (process.argv.includes('--check')) {
    console.log(`发布文件检查通过：${files.length} 个文件，${files.reduce((n, f) => n + f.bytes.length, 0)} 字节。`);
    console.log('检查模式不登录、不连接 GitHub、不创建仓库。');
    return;
  }

  console.log('\n第七号档案 · GitHub Pages 本机发布工具\n');
  const check = gh(['auth', 'status', '--hostname', 'github.com'], { allowFailure: true });
  if (check.status !== 0) {
    console.log('请按照 GitHub CLI 的提示，在自己的浏览器完成登录授权。');
    gh(['auth', 'login', '--hostname', 'github.com', '--web', '--git-protocol', 'https', '--scopes', 'workflow'], { interactive: true });
  }
  const account = api('user');
  const owner = account.login;
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) throw new Error('GitHub 返回了无法识别的账号名称。');

  let saved;
  try { saved = JSON.parse(await readFile(RECEIPT, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('本地发布记录无法读取，请保留该文件并检查。'); }
  const defaultName = saved?.owner === owner && validName(saved.name) ? saved.name : 'seventh-archive';
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let name;
  try {
    console.log(`当前账号：${owner}`);
    console.log('本工具会发布公开仓库：游戏代码、说明和场景图片将对所有人可见。');
    name = (await prompt.question(`仓库名称 [${defaultName}]，按回车使用默认名称：`)).trim() || defaultName;
  } finally { prompt.close(); }
  if (!validName(name)) throw new Error('仓库名请使用 1–100 位英文字母、数字、点、短横线或下划线，并以字母或数字开头。');

  const full = `${owner}/${name}`;
  const prefix = `repos/${full}`;
  let repository = optionalApi(prefix);
  let receipt;
  if (repository) {
    if (!canResume(saved, repository)) {
      throw new Error(`仓库 ${full} 已存在，且不是本工具已记录的发布目标。为保护原有内容，本次未修改它；请重新运行并换一个仓库名。`);
    }
    receipt = saved;
    console.log(`继续已记录的发布：${repository.html_url}`);
  } else {
    console.log('[1/5] 创建公开仓库…');
    repository = api('user/repos', 'POST', {
      name, private: false, auto_init: true, has_wiki: false,
      description: '原创中文密室逃脱游戏：场景探索、道具解谜、自动存档，纯前端零依赖。',
    });
    receipt = { format: 1, owner, name, repositoryId: repository.id, repositoryUrl: repository.html_url };
    await saveReceipt(receipt);
  }

  let mainRef = optionalApi(`${prefix}/git/ref/heads/main`);
  if (!mainRef) {
    const initial = await retryRead(() => optionalApi(`${prefix}/git/ref/heads/${encodeURIComponent(repository.default_branch)}`));
    // Creating a branch here never renames or deletes another branch.
    mainRef = repository.default_branch === 'main' ? initial :
      api(`${prefix}/git/refs`, 'POST', { ref: 'refs/heads/main', sha: initial.object.sha });
  }
  if (!receipt.baseHead) { receipt.baseHead = mainRef.object.sha; await saveReceipt(receipt); }
  // If a network interruption happened after GitHub accepted the ref update,
  // recover from the saved candidate instead of treating our own commit as a conflict.
  if (receipt.pendingCommit === mainRef.object.sha) {
    receipt.commitSha = receipt.pendingCommit;
    receipt.sourceHash = receipt.pendingSourceHash;
    delete receipt.pendingCommit;
    delete receipt.pendingSourceHash;
    await saveReceipt(receipt);
  }

  const expectedHead = receipt.commitSha || receipt.baseHead;
  if (mainRef.object.sha !== expectedHead) {
    throw new Error('远程 main 分支已被其他操作修改。为避免覆盖改动，本工具已停止，请先检查仓库。');
  }
  if (!receipt.commitSha || receipt.sourceHash !== sourceHash) {
    console.log(`[2/5] 上传 ${files.length} 个项目文件…`);
    const parent = api(`${prefix}/git/commits/${mainRef.object.sha}`);
    const treeEntries = [];
    for (const [index, file] of files.entries()) {
      console.log(`  ${index + 1}/${files.length}  ${file.path}`);
      const blob = api(`${prefix}/git/blobs`, 'POST', { content: file.bytes.toString('base64'), encoding: 'base64' });
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = api(`${prefix}/git/trees`, 'POST', { base_tree: parent.tree.sha, tree: treeEntries });
    const commit = api(`${prefix}/git/commits`, 'POST', {
      message: 'feat: publish The Seventh Archive escape room', tree: tree.sha, parents: [mainRef.object.sha],
    });
    receipt.pendingCommit = commit.sha;
    receipt.pendingSourceHash = sourceHash;
    await saveReceipt(receipt);
    api(`${prefix}/git/refs/heads/main`, 'PATCH', { sha: commit.sha, force: false });
    receipt.commitSha = commit.sha;
    receipt.sourceHash = sourceHash;
    delete receipt.pendingCommit;
    delete receipt.pendingSourceHash;
    await saveReceipt(receipt);
  } else console.log('[2/5] 文件已上传，继续配置部署。');
  if (repository.default_branch !== 'main') api(prefix, 'PATCH', { default_branch: 'main' });

  console.log('[3/5] 启用 GitHub Pages…');
  const currentPages = optionalApi(`${prefix}/pages`);
  if (!currentPages) api(`${prefix}/pages`, 'POST', { build_type: 'workflow' });
  else if (currentPages.build_type !== 'workflow') api(`${prefix}/pages`, 'PUT', { build_type: 'workflow' });
  await retryRead(() => optionalApi(`${prefix}/actions/workflows/pages.yml`));

  console.log('[4/5] 运行测试与部署，通常需要几分钟…');
  const dispatchedAt = Date.now();
  api(`${prefix}/actions/workflows/pages.yml/dispatches`, 'POST', { ref: 'main' });
  const run = await retryRead(() => {
    const result = api(`${prefix}/actions/workflows/pages.yml/runs?event=workflow_dispatch&branch=main&per_page=10`);
    return result.workflow_runs.find(r => r.head_sha === receipt.commitSha && Date.parse(r.created_at) >= dispatchedAt - 3000);
  }, 15);
  receipt.runUrl = run.html_url;
  await saveReceipt(receipt);
  console.log(`查看进度：${run.html_url}`);
  let complete = false;
  const deadline = Date.now() + 20 * 60 * 1000;
  let previousStatus;
  while (Date.now() < deadline) {
    const progress = api(`${prefix}/actions/runs/${run.id}`);
    if (progress.status !== previousStatus) console.log(`  部署状态：${progress.status}`);
    previousStatus = progress.status;
    if (progress.status === 'completed') {
      if (progress.conclusion !== 'success') throw new Error(`工作流结果为 ${progress.conclusion}。请查看 ${progress.html_url}，修复后重新运行本工具。`);
      complete = true; break;
    }
    await sleep(5000);
  }
  if (!complete) throw new Error(`等待部署超时，但没有取消云端任务。请查看 ${run.html_url} 获取最终结果。`);

  console.log('[5/5] 获取实际网站地址并检查访问…');
  const pages = api(`${prefix}/pages`);
  const website = new URL(pages.html_url);
  if (website.protocol !== 'https:' || !website.hostname.endsWith('.github.io')) {
    throw new Error('部署完成，但返回的地址不是预期的 HTTPS GitHub Pages 地址；请在仓库 Pages 设置中查看。');
  }
  let reachable = false;
  for (let i = 0; i < 6; i++) {
    try {
      const response = await fetch(website.href, { signal: AbortSignal.timeout(10000) });
      if (response.ok && (await response.text()).includes('第七号档案')) { reachable = true; break; }
    } catch { /* A local network failure does not undo a successful deployment. */ }
    await sleep(5000);
  }
  receipt.website = website.href;
  receipt.deployed = true;
  receipt.reachableFromThisComputer = reachable;
  await saveReceipt(receipt);
  await writeFile(resolve(ROOT, 'PUBLISH-RESULT.txt'),
    `Repository: ${repository.html_url}\nWebsite: ${website.href}\nWorkflow: ${run.html_url}\nDeployment: success\nLocal accessibility: ${reachable ? 'verified' : 'not verified'}\n`);
  console.log(`\nGitHub 已报告部署成功。\n仓库：${repository.html_url}\n游戏：${website.href}`);
  if (!reachable) console.log('本机暂时没有验证到游戏页面，请检查网络后打开上方地址；云端工作流已成功。');
  console.log('地址也已保存到项目文件夹里的 PUBLISH-RESULT.txt。');
  try {
    const opener = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', website.href]] :
      process.platform === 'darwin' ? ['open', [website.href]] : ['xdg-open', [website.href]];
    const child = spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
  } catch { /* The printed URL is usable even without a desktop URL opener. */ }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`\n发布没有全部完成：${error.message}`);
    if (/workflow|scope|permission|403/i.test(error.message)) {
      console.error('如提示缺少 workflow 权限，可在本机运行：gh auth refresh --hostname github.com --scopes workflow');
    }
    console.error('已完成的远程步骤不会被删除。保留 .publish-state.json，排除问题后重新运行，可继续同一仓库。');
    process.exitCode = 1;
  });
}
