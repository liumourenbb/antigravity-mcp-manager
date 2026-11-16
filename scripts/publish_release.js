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
  console.log(`Uploading ${assetName} (${(fileStat.size / (1024 * 1024)).toFixed(2)} MB)...`);

  const fileDir = path.dirname(filePath);
  const baseName = path.basename(filePath);

  const args = [
    '-s',
    '-S',
    '--retry', '3',
    '--retry-delay', '5',
    '-H', 'Accept: application/vnd.github+json',
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/zip',
    '-T', baseName,
    cleanUrl
  ];

  const res = spawnSync('curl.exe', args, { cwd: fileDir, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`curl upload failed [code ${res.status}]: ${res.stderr || res.stdout}`);
  }

  if (res.stdout) {
    try {
      const json = JSON.parse(res.stdout);
      if (json.browser_download_url) {
        console.log(`Asset uploaded successfully: ${json.browser_download_url}`);
        return json;
      }
      if (json.message) {
        console.error(`GitHub API response: ${json.message}`);
      }
    } catch {
      console.log('curl output:', res.stdout.slice(0, 300));
    }
  }
  return { ok: true };
}

function buildReleasePayload(version) {
  return {
    tag_name: `v${version}`,
    target_commitish: 'main',
    name: `Antigravity MCP Manager v${version} (Dark/Light Themes, Multi-Workspace Layering & Live MCP Refresh)`,
    body: `## Antigravity MCP Manager v${version} 🚀\n\n` +
      `重大版本升级！全面支持原生暗夜/白天双主题、Antigravity 项目多工作区与成员分层分组视图、MCP 名称实时搜索，以及单服务/分组/全局三级实时探针与热重载功能。\n\n` +
      `### ✨ 核心更新亮点\n` +
      `- 🌓 **原生 Dark / Light 双主题切换**：支持暗夜与白天主题平滑切换，针对低眩光与护眼进行深度配色重构，全站核心文本及状态标识均达 WCAG AAA（≥ 7:1）高清晰对比度。\n` +
      `- 🗂️ **多工作区分层视图 (Layered View)**：支持按 Antigravity 实际工作目录与项目专属分层分组展示 MCP，支持多成员文件夹识别与项目专属隔离。\n` +
      `- 🔍 **MCP 实时搜索与快捷键**：顶部 Command Bar 增加 MCP 实时名称模糊搜索与快速过滤，支持快捷键 \`Ctrl+F\` 快速聚焦与名称优先级排序。\n` +
      `- 🔄 **三级 MCP 实时探针与热重载**：\n` +
      `  - 单服务卡片底部提供刷新探测按钮，触发配置时间戳唤醒并执行 JSON-RPC \`initialize\` + \`tools/list\` 实时探针与耗时检测；\n` +
      `  - 分组标题栏支持“刷新本组”一键批量并发探测；\n` +
      `  - 顶部主工具栏提供全局“刷新”按钮，一键从磁盘重新同步全部工作区与全局 MCP 状态。\n` +
      `- 🛠️ **工具 Schema 实时拉取**：无本地磁盘缓存时提供“立即实时刷新并拉取工具”功能，探针完成后可直接在前端查看实时工具定义。\n` +
      `- 🎨 **弹窗与交互细节调优**：彻底消除双弹窗重叠问题，悬停详情浮窗完美随昼夜主题自适应变色。\n` +
      `- 🛡️ **架构防膨胀守卫**：全工程所有核心模块方法均严格收敛在 ≤ 80 行红线内。\n\n` +
      `### 📦 资产下载\n` +
      `- \`antigravity-mcp-manager-v${version}-windows11-x64.zip\`：Windows 11 x64 独立绿色版打包文件。\n`,
    draft: false,
    prerelease: false
  };
}

async function main() {
  const token = getGitCredential();
  if (!token) {
    console.error('ERROR: Could not retrieve GitHub credentials.');
    process.exit(1);
  }

  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '1.1.0';

  const owner = 'liumourenbb';
  const repo = 'antigravity-mcp-manager';
  const releasePayload = buildReleasePayload(version);

  try {
    const release = await getOrCreateRelease(token, owner, repo, releasePayload);
    console.log(`Release available at: ${release.html_url}`);

    const assetName = `antigravity-mcp-manager-v${version}-windows11-x64.zip`;
    const zipPath = path.resolve(__dirname, `../dist/${assetName}`);

    if (fs.existsSync(zipPath)) {
      await deleteExistingAsset(token, release, assetName);
      uploadAssetWithCurl(token, release.upload_url, zipPath, assetName);
    } else {
      console.warn(`Warning: Release zip not found at: ${zipPath}`);
    }
    console.log('\nAll done! Release is live on GitHub.');
  } catch (err) {
    console.error('Failed to publish release:', err.message);
    process.exit(1);
  }
}

main();
