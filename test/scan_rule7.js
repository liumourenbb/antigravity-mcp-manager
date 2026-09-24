import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fnMatch = line.match(/(?:function\s+([a-zA-Z0-9_$]+)|(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/);
    if (fnMatch) {
      const name = fnMatch[1] || fnMatch[2] || fnMatch[3] || 'anonymous';
      let depth = 0;
      let started = false;
      let endLine = -1;

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        const clean = l.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/\/\/.*/, '');
        for (let char of clean) {
          if (char === '{') {
            depth++;
            started = true;
          } else if (char === '}') {
            depth--;
            if (started && depth === 0) {
              endLine = j + 1;
              break;
            }
          }
        }
        if (endLine !== -1) break;
      }

      if (endLine !== -1) {
        const len = endLine - (i + 1) + 1;
        results.push({ name, start: i + 1, end: endLine, lines: len });
      }
    }
  }

  return results;
}

const targetFiles = [
  'src/server.js',
  'src/core/config.js',
  'src/core/workspaces.js',
  'src/core/backup.js',
  'src/core/diagnostics.js',
  'src/core/jetbrains.js',
  'src/core/paths.js',
  'src/core/presets.js',
  'src/core/rules.js',
  'src/core/rules-router.js',
  'src/desktop/ipc.js',
  'src/desktop/main.js',
  'src/web/js/helpers.js',
  'src/web/js/api.js',
  'src/web/js/workspace-manager.js',
  'src/web/js/server-card-renderer.js',
  'src/web/js/paste-import-manager.js',
  'src/web/js/server-form-manager.js',
  'src/web/js/diagnostics-presets.js',
  'src/web/js/rules-manager.js',
  'src/web/js/app.js',
  'src/web/index.html'
];

console.log('====== 用户规则 7 架构与 80 行方法红线扫描 ======');
let violations = 0;

targetFiles.forEach(file => {
  const p = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(p)) return;
  const fns = getFunctions(p);
  const over = fns.filter(f => f.lines > 80);
  if (over.length > 0) {
    console.log(`\n❌ [超限报警: 单方法 > 80 行] ${file} (共发现 ${over.length} 个超限方法):`);
    over.forEach(f => {
      console.log(`   - 方法: ${f.name.padEnd(28)} | 行数: ${f.lines.toString().padStart(3)} 行 (L${f.start} ~ L${f.end})`);
      violations++;
    });
  } else {
    console.log(`✅ [合规通过] ${file} (${fns.length} 个方法均在 80 行以内)`);
  }
});

console.log(`\n扫描总结: 发现 ${violations} 处违反“单方法 80 行红线”的超长方法。`);
