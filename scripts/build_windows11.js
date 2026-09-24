import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist', 'windows11');

/**
 * Prepares the distribution directory by copying Electron runtime binaries.
 */
function prepareDistributionDir(targetDist) {
  if (fs.existsSync(targetDist)) {
    fs.rmSync(targetDist, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDist, { recursive: true });

  // Source candidates for offline Electron runtime
  const localElectronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
  const existingManagerDist = path.join(rootDir, 'dist', 'Antigravity-MCP-Manager');

  const sourceDir = fs.existsSync(localElectronDist) ? localElectronDist : existingManagerDist;
  if (!fs.existsSync(sourceDir)) {
    throw new Error('未找到本地已安装的 Electron 运行时，无法离线构建 windows11.exe');
  }

  console.log(`[1/4] 从本地运行时镜像复制二进制依赖: ${sourceDir}`);
  fs.cpSync(sourceDir, targetDist, { recursive: true });

  // Ensure executable is named windows11.exe
  const candidates = ['electron.exe', 'Antigravity-MCP-Manager.exe'];
  for (const c of candidates) {
    const srcExe = path.join(targetDist, c);
    if (fs.existsSync(srcExe)) {
      const destExe = path.join(targetDist, 'windows11.exe');
      if (srcExe !== destExe) {
        fs.renameSync(srcExe, destExe);
      }
      break;
    }
  }
}

/**
 * Copies latest application source code into resources/app
 */
function syncAppResources(targetDist) {
  console.log('[2/4] 同步最新业务代码与前端模块至 resources/app...');
  const appDir = path.join(targetDist, 'resources', 'app');
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appDir, { recursive: true });

  // Copy src, bin, and package.json
  fs.cpSync(path.join(rootDir, 'src'), path.join(appDir, 'src'), { recursive: true });
  if (fs.existsSync(path.join(rootDir, 'bin'))) {
    fs.cpSync(path.join(rootDir, 'bin'), path.join(appDir, 'bin'), { recursive: true });
  }
  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(appDir, 'package.json'));

  // Remove default_app.asar if present to prioritize resources/app
  const defaultAsar = path.join(targetDist, 'resources', 'default_app.asar');
  if (fs.existsSync(defaultAsar)) {
    try { fs.unlinkSync(defaultAsar); } catch {}
  }
}

/**
 * Compiles a native lightweight windows11.exe launcher in the project root
 */
function compileRootLauncher(rootPath, distExePath) {
  console.log('[3/4] 在项目根目录编译生成原生快速入口 windows11.exe...');
  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  const rootExe = path.join(rootPath, 'windows11.exe');

  if (!fs.existsSync(cscPath)) {
    console.warn('未检测到 .NET csc.exe，跳过根目录快捷入口生成');
    return;
  }

  const csCode = `
using System;
using System.Diagnostics;
using System.IO;

class Launcher {
    static void Main(string[] args) {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string targetExe = Path.Combine(baseDir, "dist", "windows11", "windows11.exe");
        if (!File.Exists(targetExe)) {
            targetExe = Path.Combine(baseDir, "dist", "Antigravity-MCP-Manager", "Antigravity-MCP-Manager.exe");
        }
        if (!File.Exists(targetExe)) {
            Console.WriteLine("Error: windows11.exe not found at: " + targetExe);
            return;
        }
        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = targetExe;
        psi.Arguments = string.Join(" ", args);
        psi.WorkingDirectory = baseDir;
        psi.UseShellExecute = false;
        Process.Start(psi);
    }
}
`;
  const tempCs = path.join(rootPath, 'scripts', '_launcher_temp.cs');
  fs.writeFileSync(tempCs, csCode, 'utf8');

  try {
    execSync(`"${cscPath}" /target:winexe /optimize+ /out:"${rootExe}" "${tempCs}"`, { stdio: 'pipe' });
    console.log(`[Build] 根目录快捷启动器已生成: ${rootExe}`);
  } catch (err) {
    console.warn('[Build] 编译根目录启动器提示:', err.message);
  } finally {
    if (fs.existsSync(tempCs)) fs.unlinkSync(tempCs);
  }
}

/**
 * Main build process
 */
function main() {
  console.log('🚀 开始构建适用于 Windows 11 的执行程序包 (windows11.exe)...\n');
  const start = Date.now();

  try {
    prepareDistributionDir(distDir);
    syncAppResources(distDir);

    const distExe = path.join(distDir, 'windows11.exe');
    compileRootLauncher(rootDir, distExe);

    const sizeMb = (fs.statSync(distExe).size / (1024 * 1024)).toFixed(1);
    const costSec = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n🎉 [BUILD COMPLETE] windows11.exe 全部构建完成！(耗时 ${costSec}s)`);
    console.log(`   1. 独立完整分发目录: ${distDir}`);
    console.log(`      核心程序: ${distExe} (${sizeMb} MB)`);
    console.log(`   2. 项目根目录一键启动器: ${path.join(rootDir, 'windows11.exe')}`);
  } catch (err) {
    console.error('❌ 构建失败:', err.message);
    process.exit(1);
  }
}

main();
