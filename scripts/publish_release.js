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

async function createGitHubRelease(token, repoOwner, repoName, releaseData) {
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Antigravity-Release-Publisher',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(releaseData)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Create release failed [${res.status}]: ${errorText}`);
  }
  return res.json();
}

async function uploadReleaseAsset(token, uploadUrlTemplate, filePath, assetName) {
  const cleanUrl = uploadUrlTemplate.replace(/\{.*?\}$/, '') + `?name=${encodeURIComponent(assetName)}`;
  const fileStat = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`Uploading ${assetName} (${(fileStat.size / (1024 * 1024)).toFixed(2)} MB)...`);
  const res = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Antigravity-Release-Publisher',
      'Content-Type': 'application/zip',
      'Content-Length': fileStat.size.toString()
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload asset failed [${res.status}]: ${errText}`);
  }
  return res.json();
}

async function main() {
  const token = getGitCredential();
  if (!token) {
    console.error('ERROR: Could not retrieve GitHub credentials from git credential helper or environment.');
    process.exit(1);
  }

  const repoOwner = 'liumourenbb';
  const repoName = 'antigravity-mcp-manager';
  const releasePayload = {
    tag_name: 'v1.0.0',
    target_commitish: 'main',
    name: 'Antigravity MCP Manager v1.0.0 (Windows 11 Native Client)',
    body: '## Antigravity MCP Manager v1.0.0 🚀\n\n' +
      '首个正式发布版本，原生支持 Windows 11 本地 Electron 桌面客户端以及 Web 控制台，深度符合项目架构规范与 80 行代码红线。\n\n' +
      '### ✨ 核心特性\n' +
      '- 🖥️ **Windows 11 独立可执行程序**：内置 `windows11.exe` 与极简启动器，免安装即开即用。\n' +
      '- ⚡ **双模驱动**：支持原生 Electron IPC 模式与纯 HTTP 独立服务模式。\n' +
      '- 🔍 **全空间项目发现**：一键扫描本地 Antigravity 空间与全盘项目 MCP 配置。\n' +
      '- 📋 **智能多格式粘贴解析**：自动解析 Claude / Cline / RooCode 等任意格式 MCP 配置并支持项目级一键导入。\n' +
      '- 🛠️ **多源环境管理与诊断**：支持环境隔离、停用池沉淀、JetBrains 冗余诊断及配置安全快照备份。\n\n' +
      '### 📦 资产下载\n' +
      '- `antigravity-mcp-manager-v1.0.0-windows11-x64.zip`：Windows 11 x64 独立绿色版打包文件。\n',
    draft: false,
    prerelease: false
  };

  try {
    console.log('Creating GitHub Release v1.0.0...');
    const release = await createGitHubRelease(token, repoOwner, repoName, releasePayload);
    console.log(`Release created successfully: ${release.html_url}`);

    const zipPath = path.resolve(__dirname, '../dist/antigravity-mcp-manager-v1.0.0-windows11-x64.zip');
    if (fs.existsSync(zipPath)) {
      const asset = await uploadReleaseAsset(token, release.upload_url, zipPath, 'antigravity-mcp-manager-v1.0.0-windows11-x64.zip');
      console.log(`Asset uploaded successfully: ${asset.browser_download_url}`);
    } else {
      console.warn(`Asset zip not found at: ${zipPath}`);
    }
    console.log('\nAll done! Release is live on GitHub.');
  } catch (err) {
    console.error('Failed to publish release:', err.message);
    process.exit(1);
  }
}

main();
