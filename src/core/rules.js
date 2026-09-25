import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { PATHS, ensureDir, getDefaultWorkspaceDir } from './paths.js';
import { createBackup } from './backup.js';
import { listAntigravityProjects } from './workspaces.js';

export const PRESET_RULES = [
  {
    id: 'full-user-rules',
    name: '全套项目准则合集 (1~8条完整版)',
    category: '综合规范',
    description: '包含独立思考求真、直陈异议、闭环验证、备份隔离、中文偏好、操作留痕、80行防膨胀及打包确认等全套规范。',
    content: `# 项目规则 (Project Rules)

1. 保持独立思考与求真核实：严审前提漏洞与逻辑缺陷，严格区分事实、推测与观点，核实数据与结论来源，拒绝盲从迎合；
2. 直陈异议与盲点提示：有不同意见直接指出并给出依据、风险及替代方案，主动提示遗漏的变量、潜在成本与偏差；
3. 任务闭环与严格验证：任务完成后必须进行严格验证（如测试、构建或结果校验）；若未完全完成，必须生成结构化报告明确【要干什么（目标）】、【干了什么（进展）】和【还有什么没干（待办交接）】，以便无缝续接；
4. 数据库安全与云端备份隔离：对数据库执行任何高危/变更操作（如 UPDATE、DELETE、DROP、TRUNCATE、结构变更或批量修改等）前必须先进行数据备份；备份数据必须上传/保存在 Google Drive（谷歌云端硬盘）上，严禁保存在会话相关目录或临时工件目录中（防止清理/删除会话时连带删除备份）；
5. 语言与思考偏好：内部思考分析（Reasoning / Thinking）与最终回答均尽量使用中文；
6. 服务器操作留痕与日志规范：对服务器执行任何操作（如 SSH 远程命令、服务启停、配置修改、部署更新等）时必须记录操作日志，明确记录【输入了什么命令】、【干了什么事情（操作意图与事项）】以及执行结果，若涉及密码/密钥等敏感信息必须主动脱敏；
7. 代码精简与架构防膨胀规范：
   - 单方法 80 行红线：单方法严格限制在 80 行以内（含签名与空行），超限严禁直接平铺，必须抽取为独立方法或外部组件；
   - 杜绝制造“上帝类”：新增业务链路或外部 RPC/第三方调用须建立独立 Manager 或 Helper，严禁堆砌在既有 Service 中；VO/DTO/Query 等领域模型必须独立建 .java 文件，禁止声明复杂内部类；
   - 最小改动拆分（新增外置、原位路由）：扩展老方法时原位改动控制在 1~3 行——分支扩充采用 Strategy/Handler 替代无限 if-else，繁杂校验与组装等旁支封装为 Helper 注入调用，多源汇聚与通用事务下沉至独立 Manager。
8. 构建与打包确认红线 (Strict Packaging Authorization)：
   - 任何涉及构建、编译二进制可执行文件（如 npm run build:win、生成 windows11.exe）及发布上传（GitHub Release、压缩包等）的高耗时与输出变更操作，必须提前向用户陈述并获得用户明确授权确认（“确认”或“yes”）后方可执行，严禁私自自动触发。`
  },
  {
    id: 'packaging-confirmation',
    name: '构建与打包确认红线（授权确认）',
    category: '安全与风控',
    description: '任何打包编译二进制 exe 及上传 Release 操作必须提前获得用户明确授权确认。',
    content: `### 构建与打包确认红线规范
- 任何涉及构建、编译二进制可执行文件（如 npm run build:win、生成 windows11.exe）及发布上传（GitHub Release、压缩包等）的高耗时与输出变更操作，必须提前向用户陈述并获得用户明确授权确认（“确认”或“yes”）后方可执行，严禁私自自动触发。`
  },
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
 * Traverses upwards from projectDir to find any inherited workspace rules file.
 */
export function findWorkspaceRulesFile(projectDir) {
  if (!projectDir) return null;
  let curr = path.resolve(projectDir);
  const root = path.parse(curr).root;

  while (true) {
    const candidates = [
      path.join(curr, 'AGENTS.md'),
      path.join(curr, 'GEMINI.md')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    if (fs.existsSync(path.join(curr, '.git')) || curr === root) break;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
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
 * Synchronizes secondary global file ~/.gemini/GEMINI.md while preserving context7 preamble.
 */
function syncSecondaryGlobalFile(content) {
  try {
    const geminiMd = path.join(os.homedir(), '.gemini', 'GEMINI.md');
    let context7Part = '';
    if (fs.existsSync(geminiMd)) {
      const existing = fs.readFileSync(geminiMd, 'utf8');
      const match = existing.match(/^([\s\S]*?<!-- context7 -->[\s\S]*?<!-- context7 -->)/);
      if (match) {
        context7Part = match[1].trim() + '\n';
      }
    }
    const cleanContent = content ? '\n' + content : '';
    fs.writeFileSync(geminiMd, (context7Part + cleanContent).trimEnd() + '\n', 'utf8');
  } catch (err) {
    console.warn('[rules] Failed to sync secondary GEMINI.md:', err.message);
  }
}

/**
 * Loads rules info and parsed structure for global or project scope.
 */
export function loadRules(scope = 'global', projectDir = null) {
  const localPath = resolveRulesPath(scope, projectDir);
  let targetPath = localPath;
  let isInherited = false;
  let inheritedFrom = null;

  if (!fs.existsSync(targetPath) && scope === 'workspace' && projectDir) {
    const parentRules = findWorkspaceRulesFile(projectDir);
    if (parentRules) {
      targetPath = parentRules;
      isInherited = true;
      inheritedFrom = parentRules;
    } else if (fs.existsSync(PATHS.globalRulesFile)) {
      targetPath = PATHS.globalRulesFile;
      isInherited = true;
      inheritedFrom = '全局系统规则';
    }
  }

  const exists = fs.existsSync(targetPath);
  if (!exists) {
    return {
      scope,
      filePath: localPath,
      exists: false,
      isInherited: false,
      inheritedFrom: null,
      size: 0,
      updatedAt: null,
      content: '',
      sections: [],
      summary: { totalRules: 0, charCount: 0 }
    };
  }

  const stat = fs.statSync(targetPath);
  const content = fs.readFileSync(targetPath, 'utf8');
  const sections = parseRuleSections(content);

  return {
    scope,
    filePath: localPath,
    resolvedPath: targetPath,
    exists: true,
    isInherited,
    inheritedFrom,
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

  if (scope === 'global') {
    syncSecondaryGlobalFile(content);
  }

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
    newContent = `# 项目规则 (Project Rules)\n\n${preset.content}\n`;
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

/**
 * Gets aggregated project rules overview across all detected Antigravity projects.
 */
export function getProjectRulesOverview() {
  const projects = listAntigravityProjects();
  const list = projects.map(proj => {
    const rules = loadRules('workspace', proj.path);
    return {
      id: proj.id,
      name: proj.name,
      path: proj.path,
      source: proj.source,
      isCurrent: proj.isCurrent,
      hasRules: rules.exists,
      isInherited: rules.isInherited || false,
      inheritedFrom: rules.inheritedFrom || null,
      filePath: rules.filePath,
      resolvedPath: rules.resolvedPath || rules.filePath,
      size: rules.size,
      updatedAt: rules.updatedAt,
      totalRules: rules.summary.totalRules,
      charCount: rules.summary.charCount,
      isOverBudget: rules.summary.isOverBudget,
      summaryTitles: rules.sections.slice(0, 3).map(s => s.title)
    };
  });

  return {
    totalProjects: list.length,
    configuredProjects: list.filter(p => p.hasRules && !p.isInherited).length,
    inheritedProjects: list.filter(p => p.hasRules && p.isInherited).length,
    unconfiguredProjects: list.filter(p => !p.hasRules).length,
    overBudgetProjects: list.filter(p => p.isOverBudget).length,
    projects: list
  };
}

/**
 * Initializes a default rules file (AGENTS.md) for a workspace project.
 */
export function initProjectRules(projectDir, templateId = 'default') {
  if (!projectDir || !fs.existsSync(projectDir)) {
    throw new Error('Project directory does not exist');
  }

  const preset = PRESET_RULES.find(p => p.id === templateId) || PRESET_RULES[0];
  const initialContent = `# ${path.basename(projectDir)} 项目规则 (Project Rules)\n\n${preset.content}\n`;
  return saveRules('workspace', projectDir, initialContent);
}

/**
 * Resolves source rules content for inheriting or copying.
 * Falls back to workspace parent rules or full preset if global rules are empty.
 */
export function resolveSyncSourceContent(referenceDir = null) {
  const globalRules = loadRules('global');
  if (globalRules.exists && globalRules.content) {
    return globalRules.content;
  }
  const parentFile = findWorkspaceRulesFile(referenceDir || getDefaultWorkspaceDir());
  if (parentFile && fs.existsSync(parentFile)) {
    return fs.readFileSync(parentFile, 'utf8');
  }
  const preset = PRESET_RULES.find(p => p.id === 'full-user-rules') || PRESET_RULES[0];
  return preset.content;
}

/**
 * Copies source rules into a target workspace project.
 */
export function copyGlobalRulesToProject(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) {
    throw new Error('Project directory does not exist');
  }

  const sourceContent = resolveSyncSourceContent(projectDir);
  const projectName = path.basename(projectDir);
  const header = `# ${projectName} 项目规则 (Project Rules)\n\n`;
  const content = sourceContent.startsWith('#')
    ? header + sourceContent.replace(/^#\s+[^\n]+\n+/, '')
    : header + sourceContent;

  return saveRules('workspace', projectDir, content);
}

/**
 * Batch copies rules to multiple workspace projects.
 */
export function batchSyncGlobalRules(projectPaths = null, overwriteExisting = false) {
  const allProjects = listAntigravityProjects();
  const targetPaths = projectPaths && projectPaths.length > 0
    ? projectPaths
    : allProjects.map(p => p.path);

  const results = [];
  for (const pPath of targetPaths) {
    if (!fs.existsSync(pPath)) continue;
    const current = loadRules('workspace', pPath);
    if (current.exists && !current.isInherited && !overwriteExisting) {
      results.push({ path: pPath, name: path.basename(pPath), status: 'skipped', reason: '已有专属规则' });
      continue;
    }
    copyGlobalRulesToProject(pPath);
    results.push({ path: pPath, name: path.basename(pPath), status: 'synced' });
  }

  return {
    total: results.length,
    synced: results.filter(r => r.status === 'synced').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    details: results
  };
}

/**
 * Checks whether Antigravity desktop application is currently running.
 */
function isAntigravityRunning() {
  if (process.platform === 'win32') {
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500
      });
      return out.includes('Antigravity.exe');
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Gets real-time Antigravity effective rules state.
 * Directly inspects active workspace and live rule inheritance tree.
 */
export function getAntigravityLiveRules() {
  const activeWorkspace = getDefaultWorkspaceDir();
  const running = isAntigravityRunning();
  const activeRules = loadRules('workspace', activeWorkspace);
  const globalRules = loadRules('global');

  return {
    isAntigravityRunning: running,
    activeWorkspace,
    effectiveRule: {
      scope: 'workspace',
      filePath: activeRules.resolvedPath || activeRules.filePath,
      exists: activeRules.exists,
      isInherited: activeRules.isInherited,
      inheritedFrom: activeRules.inheritedFrom,
      size: activeRules.size,
      updatedAt: activeRules.updatedAt,
      totalRules: activeRules.summary.totalRules,
      charCount: activeRules.summary.charCount,
      sections: activeRules.sections,
      content: activeRules.content
    },
    globalRulesState: {
      exists: globalRules.exists,
      isDeleted: !globalRules.exists || globalRules.content.length === 0,
      charCount: globalRules.summary.charCount
    },
    timestamp: new Date().toISOString()
  };
}
