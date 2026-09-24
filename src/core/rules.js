import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ensureDir } from './paths.js';
import { createBackup } from './backup.js';

export const PRESET_RULES = [
  {
    id: 'rule-7-concise',
    name: '代码精简与架构防膨胀规范（80行红线）',
    category: '架构与代码质量',
    description: '单方法严格80行红线、杜绝上帝类、最小改动拆分、新增外置原位路由。',
    content: `### 代码精简与架构防膨胀规范
- 单方法 80 行红线：单方法严格限制在 80 行以内（含签名与空行），超限严禁直接平铺，必须抽取为独立方法或外部组件；
- 杜绝制造“上帝类”：新增业务链路或外部 RPC/第三方调用须建立独立 Manager 或 Helper，严禁堆砌在既有 Service 中；VO/DTO/Query 等领域模型必须独立建文件，禁止声明复杂内部类；
- 最小改动拆分（新增外置、原位路由）：扩展老方法时原位改动控制在 1~3 行——分支扩充采用 Strategy/Handler 替代无限 if-else，繁杂校验与组装等旁支封装为 Helper 注入调用，多源汇聚与通用事务下沉至独立 Manager。`
  },
  {
    id: 'critical-thinking',
    name: '独立思考与盲点求真核实准则',
    category: '思维与决策',
    description: '严审前提漏洞、直陈异议与盲点提示、拒绝迎合、区分事实与推测。',
    content: `### 独立思考与求真核实准则
1. 保持独立思考与求真核实：严审前提漏洞与逻辑缺陷，严格区分事实、推测与观点，核实数据与结论来源，拒绝盲从迎合；
2. 直陈异议与盲点提示：有不同意见直接指出并给出依据、风险及替代方案，主动提示遗漏的变量、潜在成本与偏差；
3. 任务闭环与严格验证：任务完成后必须进行严格验证（如测试、构建或结果校验）；若未完全完成，必须生成结构化报告明确【要干什么（目标）】、【干了什么（进展）】和【还有什么没干（待办交接）】，以便无缝续接。`
  },
  {
    id: 'prod-safety-backup',
    name: '数据库与云端备份隔离红线',
    category: '安全与风控',
    description: '高危数据变更操作前强制备份与隔离，严禁将备份保存于临时会话目录。',
    content: `### 数据库安全与云端备份隔离规范
- 对数据库执行任何高危/变更操作（如 UPDATE、DELETE、DROP、TRUNCATE、结构变更或批量修改等）前必须先进行数据备份；
- 备份数据必须上传/保存在独立持久化存储或云端硬盘（如 Google Drive）上，严禁保存在会话相关目录或临时工件目录中（防止清理/删除会话时连带删除备份）。`
  },
  {
    id: 'audit-logging',
    name: '服务器操作留痕与日志审计规范',
    category: '运维与合规',
    description: '远程命令及服务启停必须明确记录意图与结果，敏感信息强制主动脱敏。',
    content: `### 服务器操作留痕与日志规范
- 对服务器执行任何操作（如 SSH 远程命令、服务启停、配置修改、部署更新等）时必须记录操作日志；
- 明确记录【输入了什么命令】、【干了什么事情（操作意图与事项）】以及执行结果；
- 若涉及密码、密钥、访问令牌等敏感凭证信息，必须主动进行星号（******）脱敏。`
  },
  {
    id: 'tdd-verification',
    name: '测试驱动与交付闭环规范',
    category: '测试与交付',
    description: '交付前必须运行严格自动化验证，包括单元测试、Lint 与基线扫描。',
    content: `### 自动化测试与交付验证规范
- 任何功能开发或重构完成后，必须编写或执行自动化测试用例，确保 100% 验证通过；
- 提交前主动进行代码规范扫描与 Lint 检查，杜绝未经自测的代码直接合入；
- 每次任务输出须附带可复现的验证命令及输出摘要。`
  }
];

/**
 * Resolves the rules file path for given scope and project directory.
 */
export function resolveRulesPath(scope = 'global', projectDir = null) {
  if (scope === 'workspace' && projectDir) {
    const dir = path.resolve(projectDir);
    const geminiPath = path.join(dir, 'GEMINI.md');
    if (fs.existsSync(geminiPath)) return geminiPath;
    return path.join(dir, 'AGENTS.md');
  }
  return PATHS.globalRulesFile;
}

/**
 * Parses markdown text into discrete rule items.
 */
export function parseRuleSections(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    const listNumMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (headerMatch || listNumMatch) {
      if (current) sections.push(current);
      const title = headerMatch ? headerMatch[2].trim() : listNumMatch[2].trim();
      current = {
        id: `rule-${sections.length + 1}`,
        type: headerMatch ? 'header' : 'item',
        title: title.length > 60 ? title.slice(0, 57) + '...' : title,
        rawTitle: title,
        startLine: i + 1,
        lines: [line]
      };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) sections.push(current);

  return sections.map(s => ({
    id: s.id,
    type: s.type,
    title: s.title,
    startLine: s.startLine,
    content: s.lines.join('\n').trim(),
    charCount: s.lines.join('\n').trim().length
  }));
}

/**
 * Loads rules info and parsed structure for global or project scope.
 */
export function loadRules(scope = 'global', projectDir = null) {
  const filePath = resolveRulesPath(scope, projectDir);
  const exists = fs.existsSync(filePath);

  if (!exists) {
    return {
      scope,
      filePath,
      exists: false,
      size: 0,
      updatedAt: null,
      content: '',
      sections: [],
      summary: { totalRules: 0, charCount: 0 }
    };
  }

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const sections = parseRuleSections(content);

  return {
    scope,
    filePath,
    exists: true,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    content,
    sections,
    summary: {
      totalRules: sections.length,
      charCount: content.length,
      isOverBudget: stat.size > 24000
    }
  };
}

/**
 * Saves rules content to file with safety backup.
 */
export function saveRules(scope = 'global', projectDir = null, content = '') {
  const filePath = resolveRulesPath(scope, projectDir);
  ensureDir(path.dirname(filePath));

  if (fs.existsSync(filePath)) {
    createBackup(filePath, `${scope}-rules`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  const stat = fs.statSync(filePath);

  return {
    ok: true,
    scope,
    filePath,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    sections: parseRuleSections(content)
  };
}

/**
 * Appends a preset rule into the target rules file.
 */
export function appendPresetToRules(scope = 'global', projectDir = null, presetId = '') {
  const preset = PRESET_RULES.find(p => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset rule "${presetId}" not found`);
  }

  const current = loadRules(scope, projectDir);
  let newContent = current.content ? current.content.trimEnd() : '';

  if (newContent.length > 0) {
    newContent += '\n\n' + preset.content + '\n';
  } else {
    newContent = `# 用户规则 (User Rules)\n\n${preset.content}\n`;
  }

  return saveRules(scope, projectDir, newContent);
}

/**
 * Lists modular rules from .agents/rules or ~/.gemini/config/rules.
 */
export function listModularRules(scope = 'global', projectDir = null) {
  const targetDir = scope === 'workspace' && projectDir
    ? path.join(path.resolve(projectDir), '.agents', 'rules')
    : PATHS.globalRulesDir;

  if (!fs.existsSync(targetDir)) return [];

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const fullPath = path.join(targetDir, file);
    const stat = fs.statSync(fullPath);
    return {
      fileName: file,
      filePath: fullPath,
      size: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  });
}
