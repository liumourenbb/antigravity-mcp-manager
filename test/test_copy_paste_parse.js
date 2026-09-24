import assert from 'assert';

function suggestServerName(config) {
  if (config.url || config.serverUrl) {
    try {
      const u = new URL(config.url || config.serverUrl);
      return u.hostname.replace(/\./g, '-') + '-mcp';
    } catch {
      return 'http-mcp';
    }
  }
  if (Array.isArray(config.args) && config.args.length > 0) {
    for (const a of config.args) {
      if (a && !a.startsWith('-') && a.includes('mcp')) {
        return a.replace(/@[^/]+\//, '').replace(/@.*$/, '');
      }
    }
    const nonFlag = config.args.find(a => a && !a.startsWith('-'));
    if (nonFlag) return nonFlag.replace(/@[^/]+\//, '').replace(/@.*$/, '');
  }
  return config.command || 'custom-mcp';
}

function parseMcpJsonString(rawText) {
  if (!rawText || !rawText.trim()) return null;
  const cleanText = rawText.trim();

  let parsed = null;
  // 1. 尝试直接标准解析
  try {
    parsed = JSON.parse(cleanText);
  } catch (e1) {
    // 2. 若失败，尝试容错处理：去除独立行注释与尾部多余逗号
    try {
      const fallbackText = cleanText
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(fallbackText);
    } catch (e2) {
      return { error: 'JSON 语法解析错误: ' + e1.message };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: '解析结果必须为有效的 JSON 对象' };
  }

  // 1. mcpServers
  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    const keys = Object.keys(parsed.mcpServers);
    if (keys.length === 0) return { error: 'mcpServers 对象为空' };
    const name = keys[0];
    return { name, config: parsed.mcpServers[name] };
  }

  // 2. single config
  if (parsed.command || parsed.url || parsed.serverUrl) {
    return { name: suggestServerName(parsed), config: parsed };
  }

  // 3. key-value map
  const keys = Object.keys(parsed);
  if (keys.length > 0) {
    const firstKey = keys[0];
    const val = parsed[firstKey];
    if (val && typeof val === 'object' && (val.command || val.url || val.serverUrl || val.args)) {
      return { name: firstKey, config: val };
    }
  }

  return { error: '未能识别出有效的 MCP 配置结构（需包含 command 或 url 字段）' };
}

// Test 1: Full mcpServers root object with URL scheme (contains ://)
const t1 = JSON.stringify({
  mcpServers: {
    "test-postgres": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/db"]
    }
  }
});
const r1 = parseMcpJsonString(t1);
assert.strictEqual(r1.name, 'test-postgres');
assert.strictEqual(r1.config.command, 'npx');
console.log('[PASS] Test 1: mcpServers root object with URL parsed');

// Test 2: Key-value snippet
const t2 = `{
  "api-service": {
    "url": "https://api.example.com/mcp",
    "headers": { "Authorization": "Bearer 123" }
  }
}`;
const r2 = parseMcpJsonString(t2);
assert.strictEqual(r2.name, 'api-service');
assert.strictEqual(r2.config.url, 'https://api.example.com/mcp');
console.log('[PASS] Test 2: Key-value snippet parsed');

// Test 3: Raw server object without key
const t3 = `{
  "command": "npx",
  "args": ["-y", "@company/cool-mcp", "--port", "3000"]
}`;
const r3 = parseMcpJsonString(t3);
assert.strictEqual(r3.name, 'cool-mcp');
assert.strictEqual(r3.config.command, 'npx');
console.log('[PASS] Test 3: Raw server config with auto-naming parsed');

// Test 4: JSONC with comments and trailing commas
const t4 = `// GitHub MCP configuration
{
  /* multi line comment */
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "ghp_123" },
  }
}`;
const r4 = parseMcpJsonString(t4);
assert.strictEqual(r4.name, 'github');
assert.strictEqual(r4.config.env.GITHUB_TOKEN, 'ghp_123');
console.log('[PASS] Test 4: JSONC with comments and trailing comma parsed');

console.log('\n=== 全部复制粘贴解析单元测试圆满通过 ===\n');
