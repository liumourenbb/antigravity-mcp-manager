import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { saveServer, deleteServer, readConfigFile } from '../src/core/config.js';
import { PATHS, findWorkspaceMcpConfig } from '../src/core/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 验证 index.html 中的 JS 语法
console.log('--- 正在验证 src/web/index.html 语法 ---');
const htmlPath = path.resolve(__dirname, '../src/web/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
let scriptIndex = 0;
for (const match of scriptMatches) {
  scriptIndex++;
  const code = match[1];
  try {
    new vm.Script(code, { filename: `index.html#inline-script-${scriptIndex}` });
    console.log(`[PASS] 内联脚本 #${scriptIndex} 语法检查通过`);
  } catch (err) {
    console.error(`[FAIL] 内联脚本 #${scriptIndex} 语法错误:`, err);
    process.exit(1);
  }
}

// 2. 验证 saveServer 的作用域跨域迁移逻辑
console.log('\n--- 正在验证 saveServer 作用域迁移逻辑 ---');
const TEST_SERVER_NAME = '__test_migration_demo__';
const TEST_WORKSPACE = 'A:\\code\\github';
const dummyConfig = {
  command: 'node',
  args: ['-v'],
  env: { TEST_KEY: '123' },
  description: 'Migration test server'
};

async function runTests() {
  try {
    // 步骤 A: 保存到 Global
    console.log('[Step 1] 保存到全局作用域 (global)...');
    const res1 = saveServer(TEST_SERVER_NAME, dummyConfig, 'global');
    assert.strictEqual(res1.name, TEST_SERVER_NAME, '保存到 global 失败');

    const globalConf1 = readConfigFile(PATHS.globalConfig);
    assert.ok(globalConf1.mcpServers[TEST_SERVER_NAME], '全局配置中未能找到测试服务');
    console.log('[PASS] 全局保存成功');

    // 步骤 B: 模拟跨作用域迁移：从 global 迁移到 workspace
    console.log('[Step 2] 从 global 迁移到 workspace (A:\\code\\github)...');
    const res2 = saveServer(
      TEST_SERVER_NAME,
      dummyConfig,
      'workspace',
      TEST_WORKSPACE,
      {
        originalName: TEST_SERVER_NAME,
        originalScope: 'global',
        originalWorkspaceDir: ''
      }
    );
    assert.strictEqual(res2.name, TEST_SERVER_NAME, '迁移到 workspace 失败');

    // 验证：全局配置中必须已经被删除
    const globalConf2 = readConfigFile(PATHS.globalConfig);
    assert.strictEqual(globalConf2.mcpServers[TEST_SERVER_NAME], undefined, '全局配置中测试服务未被正确移除！');
    console.log('[PASS] 全局配置中已被干净移除');

    // 验证：目标工作空间配置中必须存在
    const wsConfPath = findWorkspaceMcpConfig(TEST_WORKSPACE) || path.join(TEST_WORKSPACE, '.agents', 'mcp_config.json');
    assert.ok(fs.existsSync(wsConfPath), '工作空间配置文件不存在: ' + wsConfPath);
    const wsConf2 = JSON.parse(fs.readFileSync(wsConfPath, 'utf8'));
    assert.ok(wsConf2.mcpServers[TEST_SERVER_NAME], '工作空间配置中未找到迁移后的服务！');
    assert.deepStrictEqual(wsConf2.mcpServers[TEST_SERVER_NAME].command, dummyConfig.command);
    console.log('[PASS] 工作空间配置中已成功写入');

    // 步骤 C: 从 workspace 迁移回 global
    console.log('[Step 3] 从 workspace 迁移回 global...');
    const res3 = saveServer(
      TEST_SERVER_NAME,
      dummyConfig,
      'global',
      '',
      {
        originalName: TEST_SERVER_NAME,
        originalScope: 'workspace',
        originalWorkspaceDir: TEST_WORKSPACE
      }
    );
    assert.strictEqual(res3.name, TEST_SERVER_NAME, '迁移回 global 失败');

    // 验证：工作空间中已被删除
    const wsConf3 = JSON.parse(fs.readFileSync(wsConfPath, 'utf8'));
    assert.strictEqual(wsConf3.mcpServers[TEST_SERVER_NAME], undefined, '工作空间配置中测试服务未被正确移除！');

    // 验证：全局配置中重新出现
    const globalConf3 = readConfigFile(PATHS.globalConfig);
    assert.ok(globalConf3.mcpServers[TEST_SERVER_NAME], '全局配置中未找到迁移回来的服务！');
    console.log('[PASS] 迁移回 global 成功且工作空间已被干净清理');

    // 步骤 D: 清理全局测试数据
    console.log('[Step 4] 清理测试数据...');
    deleteServer(TEST_SERVER_NAME, 'global');
    const finalGlobal = readConfigFile(PATHS.globalConfig);
    assert.strictEqual(finalGlobal.mcpServers[TEST_SERVER_NAME], undefined, '全局测试服务清理失败');
    console.log('[PASS] 测试数据清理完成');

    console.log('\n=== 全部作用域迁移测试与脚本语法校验圆满通过 ===\n');
  } catch (err) {
    console.error('测试异常:', err);
    // 尽最大努力清理
    try { deleteServer(TEST_SERVER_NAME, 'global'); } catch (_) {}
    try { deleteServer(TEST_SERVER_NAME, 'workspace', TEST_WORKSPACE); } catch (_) {}
    process.exit(1);
  }
}

runTests();
