import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRESET_RULES,
  resolveRulesPath,
  parseRuleSections,
  loadRules,
  saveRules,
  appendPresetToRules,
  getProjectRulesOverview,
  initProjectRules,
  copyGlobalRulesToProject,
  batchSyncGlobalRules,
  getAntigravityLiveRules
} from '../src/core/rules.js';

console.log('🧪 Testing Rules module...\n');

// 1. Preset rules inspection
console.log('1. Checking PRESET_RULES...');
assert.ok(Array.isArray(PRESET_RULES), 'PRESET_RULES is array');
assert.ok(PRESET_RULES.length >= 5, 'Has at least 5 preset rules');
const rule7 = PRESET_RULES.find(r => r.id === 'rule-7-concise');
assert.ok(rule7, 'Rule 7 preset exists');
assert.ok(rule7.content.includes('80 行红线'), 'Rule 7 contains 80-line red line');
console.log('   ✔ Preset rules check passed\n');

// 2. Section parsing test
console.log('2. Testing parseRuleSections...');
const mockMarkdown = `# 用户规则 (User Rules)

1. 保持独立思考：严审漏洞
2. 直陈异议：有不同意见直接指出
### 7. 代码精简
单方法80行红线
`;
const sections = parseRuleSections(mockMarkdown);
console.log(`   Parsed ${sections.length} sections.`);
assert.strictEqual(sections.length, 4, 'Parsed 4 sections correctly');
assert.ok(sections[0].title.includes('用户规则'), 'Header 1 matched');
assert.ok(sections[1].title.includes('保持独立思考'), 'List item 1 matched');
assert.ok(sections[3].title.includes('代码精简'), 'Header 3 matched');
console.log('   ✔ Section parser test passed\n');

// 3. Load global & workspace project rules
console.log('3. Testing loadRules(global & workspace)...');
const globalRules = loadRules('global');
console.log(`   Global rules found: ${globalRules.exists}, size: ${globalRules.size} bytes`);
assert.strictEqual(typeof globalRules.content, 'string', 'Global content is a valid string');

const wsRules = loadRules('workspace', path.resolve('.'));
console.log(`   Workspace project rules found: ${wsRules.exists}, size: ${wsRules.size} bytes, total rules: ${wsRules.summary.totalRules}`);
assert.ok(wsRules.exists, 'Workspace project rules exist on disk');
assert.ok(wsRules.content.length > 0, 'Workspace content is not empty');
assert.ok(wsRules.sections.length > 0, 'Workspace rules parsed into sections');
console.log('   ✔ Rules load passed\n');

// 4. Temporary workspace rules test
console.log('4. Testing save and append preset on temp workspace...');
const tempDir = path.resolve('test/temp_workspace_rules');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

try {
  const saveRes = saveRules('workspace', tempDir, '# 项目测试规则\n1. 自定义条目');
  assert.strictEqual(saveRes.ok, true, 'Save temp rules succeeded');
  assert.strictEqual(saveRes.sections.length, 2, 'Temp rules parsed correctly');

  const appendRes = appendPresetToRules('workspace', tempDir, 'rule-7-concise');
  assert.strictEqual(appendRes.ok, true, 'Appended preset rule succeeded');
  assert.ok(appendRes.sections.some(s => s.title.includes('代码精简')), 'Preset appended successfully');
  console.log('   ✔ Save & Append preset passed\n');

  // 5. Test Project Rules Overview & Initialization
  console.log('5. Testing Project Rules Overview & Initialization...');
  const initRes = initProjectRules(tempDir, 'rule-7-concise');
  assert.strictEqual(initRes.ok, true, 'initProjectRules succeeded');
  assert.ok(fs.existsSync(path.join(tempDir, 'AGENTS.md')), 'AGENTS.md created in temp workspace');

  const copyRes = copyGlobalRulesToProject(tempDir);
  assert.strictEqual(copyRes.ok, true, 'copyGlobalRulesToProject succeeded');
  const copiedRules = loadRules('workspace', tempDir);
  assert.ok(copiedRules.content.includes('项目规则'), 'Project rules header present');

  const overview = getProjectRulesOverview();
  console.log(`   Project rules overview: ${overview.totalProjects} projects detected (${overview.configuredProjects} configured)`);
  assert.ok(overview.totalProjects >= 1, 'Detected at least 1 project in overview');
  assert.ok(Array.isArray(overview.projects), 'Overview contains projects array');

  // Test batchSyncGlobalRules
  const batchRes = batchSyncGlobalRules([tempDir], true);
  assert.strictEqual(batchRes.synced, 1, 'batchSyncGlobalRules successfully synced temp workspace');
  console.log('   ✔ Batch Sync test passed\n');

  // 6. Test Real-time Antigravity Live Rules Inspector
  console.log('6. Testing getAntigravityLiveRules...');
  const live = getAntigravityLiveRules();
  console.log(`   Antigravity running: ${live.isAntigravityRunning}, active workspace: ${live.activeWorkspace}`);
  assert.strictEqual(typeof live.isAntigravityRunning, 'boolean', 'isAntigravityRunning is boolean');
  assert.ok(live.activeWorkspace.length > 0, 'Active workspace resolved');
  assert.ok(live.effectiveRule, 'Effective rule object present');
  console.log(`   Effective rule path: ${live.effectiveRule.filePath} (exists: ${live.effectiveRule.exists})`);
  console.log('   ✔ Antigravity Live Rules check passed\n');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('🎉 All Rules module tests passed successfully!');
