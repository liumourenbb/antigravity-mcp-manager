import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGitCredential() {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken.trim();

  const child = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });

  if (child.status !== 0 || !child.stdout) return null;
  const lines = child.stdout.split('\n');
  for (const line of lines) {
    if (line.startsWith('password=')) {
      return line.slice('password='.length).trim();
    }
  }
  return null;
}

async function getOrCreateRelease(token, owner, repo, releaseData) {
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${releaseData.tag_name}`;
  const getRes = await fetch(getUrl, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Antigravity-Publisher'
    }
  });

  if (getRes.ok) {
    console.log(`Found existing release for tag ${releaseData.tag_name}`);
    return getRes.json();
  }

  const createUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
  const postRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Antigravity-Publisher',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(releaseData)
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`Create release failed [${postRes.status}]: ${err}`);
  }
  return postRes.json();
}

async function deleteExistingAsset(token, release, assetName) {
  if (!release.assets || !Array.isArray(release.assets)) return;
  const target = release.assets.find(a => a.name === assetName);
  if (!target) return;

  console.log(`Cleaning existing asset ${assetName} (id: ${target.id})...`);
  await fetch(target.url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Antigravity-Publisher'
    }
  });
}

function uploadAssetWithCurl(token, uploadUrlTemplate, filePath, assetName) {
  const cleanUrl = uploadUrlTemplate.replace(/\{.*?\}$/, '') + `?name=${encodeURIComponent(assetName)}`;
  const fileStat = fs.statSync(filePath);
  console.log(`Uploading ${assetName} (${(fileStat.size / (1024 * 1024)).toFixed(2)} MB) via curl...`);

  const args = [
    '--retry', '3',
    '--retry-delay', '3',
    '-X', 'POST',
    '-H', 'Accept: application/vnd.github+json',
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/zip',
    '--data-binary', `@${filePath}`,
    cleanUrl
  ];

  const res = spawnSync('curl.exe', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`curl upload failed with code ${res.status}: ${res.stderr || res.stdout}`);
  }
  try {
    const json = JSON.parse(res.stdout);
    if (json.browser_download_url) {
      console.log(`Asset uploaded successfully: ${json.browser_download_url}`);
      return json;
    }
  } catch {}
  return { ok: true };
}

async function main() {
  const token = getGitCredential();
  if (!token) {
    console.error('ERROR: Could not retrieve GitHub credentials.');
    process.exit(1);
  }

  const owner = 'liumourenbb';
  const repo = 'antigravity-mcp-manager';
  const releasePayload = {
    tag_name: 'v1.0.0',
    target_commitish: 'main',
    name: 'Antigravity MCP Manager v1.0.0 (Windows 11 Native Client & Rules Management)',
    body: '## Antigravity MCP Manager v1.0.0 🚀\n\n' +
      '首个正式发布版本，原生支持 Windows 11 本地 Electron 桌面客户端、Web 控制台与全局/项目规则管理。\n\n' +
      '### ✨ 核心特性\n' +
      '- 🖥️ **Windows 11 独立可执行程序**：内置 `windows11.exe`，免安装即开即用。\n' +
      '- 📜 **Antigravity 规则管理 (Rules)**：全面支持全局系统规则与工作区专属规则管理，内置规则大纲解析与 24KB 预算监视器。\n' +
      '- ⚡ **双模驱动**：支持原生 Electron IPC 模式与纯 HTTP 独立服务模式。\n' +
      '- 🔍 **全空间项目发现**：一键扫描本地 Antigravity 空间与全盘项目 MCP 配置。\n' +
      '- 📋 **智能多格式粘贴解析**：自动解析 Claude / Cline / RooCode 等任意格式 MCP 配置。\n' +
      '- 🛠️ **多源环境管理与诊断**：支持环境隔离、停用池沉淀、JetBrains 冗余诊断及配置安全快照备份。\n\n' +
      '### 📦 资产下载\n' +
      '- `antigravity-mcp-manager-v1.0.0-windows11-x64.zip`：Windows 11 x64 独立绿色版打包文件。\n',
    draft: false,
    prerelease: false
  };

  try {
    const release = await getOrCreateRelease(token, owner, repo, releasePayload);
    console.log(`Release available at: ${release.html_url}`);

    const zipPath = path.resolve(__dirname, '../dist/antigravity-mcp-manager-v1.0.0-windows11-x64.zip');
    const assetName = 'antigravity-mcp-manager-v1.0.0-windows11-x64.zip';

    if (fs.existsSync(zipPath)) {
      await deleteExistingAsset(token, release, assetName);
      uploadAssetWithCurl(token, release.upload_url, zipPath, assetName);
    }
    console.log('\nAll done! Release is live on GitHub.');
  } catch (err) {
    console.error('Failed to publish release:', err.message);
    process.exit(1);
  }
}

main();
