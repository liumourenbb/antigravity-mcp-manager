/**
 * Antigravity MCP Manager - Project Rules Management Component
 * Dedicated to project-level rules governance, inheritance, and workspace rule cards.
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

const ProjectRulesManager = {
  projects: [],
  overview: null,
  selectedProject: null,
  currentRules: null,
  isDirty: false,
  filterKeyword: '',

  async init() {
    this.bindEvents();
    await this.load();
  },

  bindEvents() {
    this.bindSearchAndActionButtons();
    this.bindEditorEvents();
    this.bindModalEvents();
  },

  bindSearchAndActionButtons() {
    const searchInput = document.getElementById('project-rules-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterKeyword = e.target.value.trim().toLowerCase();
        this.renderProjectsList();
      });
    }

    const refreshBtn = document.getElementById('project-rules-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.load());

    const liveRefreshBtn = document.getElementById('project-rules-live-refresh-btn');
    if (liveRefreshBtn) {
      liveRefreshBtn.addEventListener('click', () => {
        showToast('正在从 Antigravity 实时重新获取生效规则...', 'info');
        this.load();
      });
    }

    const copyGlobalBtn = document.getElementById('project-rules-copy-global-btn');
    if (copyGlobalBtn) copyGlobalBtn.addEventListener('click', () => this.copyFromGlobal());

    const batchSyncBtn = document.getElementById('project-rules-batch-sync-btn');
    if (batchSyncBtn) batchSyncBtn.addEventListener('click', () => this.batchSyncGlobal());

    const openFileBtn = document.getElementById('project-rules-open-file-btn');
    if (openFileBtn) openFileBtn.addEventListener('click', () => this.openExternalFile());

    const selectEl = document.getElementById('project-rules-workspace-select');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        this.selectProject(e.target.value, true);
      });
    }
  },

  bindEditorEvents() {
    const saveBtn = document.getElementById('project-rules-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.save());

    const textarea = document.getElementById('project-rules-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.isDirty = true;
        this.updateStatsPreview(textarea.value);
        this.updateSaveButtonState(true);
      });
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          this.save();
        }
      });
    }
  },

  bindModalEvents() {
    const modal = document.getElementById('modalProjectRulesStudio');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeStudioModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = document.getElementById('modalProjectRulesStudio');
        if (m && !m.classList.contains('hidden')) {
          this.closeStudioModal();
        }
      }
    });
  },

  async load() {
    try {
      const res = await api.getProjectRulesOverview();
      if (!res || !res.ok) {
        showToast(res ? res.error : '加载项目规则失败', 'error');
        return;
      }

      this.overview = res;
      this.projects = res.projects || [];
      this.renderStatsHeader();
      this.populateProjectSelect();
      this.renderProjectsList();

      // Auto select current workspace or first project
      const target = this.projects.find(p => p.isCurrent) || this.projects[0];
      if (target) {
        await this.selectProject(target.path);
      }
      await this.checkLiveStatus();
    } catch (err) {
      showToast('获取项目规则概览异常: ' + err.message, 'error');
    }
  },

  async checkLiveStatus() {
    try {
      const res = await api.getAntigravityLiveRules();
      if (!res || !res.ok || !res.live) return;
      const live = res.live;
      const summaryEl = document.getElementById('project-rules-live-summary');
      if (!summaryEl) return;

      const runBadge = live.isAntigravityRunning
        ? '<span class="text-emerald-400 font-semibold">● 进程在线</span>'
        : '<span class="text-neutral-400 font-semibold">○ 离线</span>';

      const ruleText = live.effectiveRule.exists
        ? `<span class="text-purple-300 font-semibold">${escapeHtml(live.effectiveRule.filePath)} (${live.effectiveRule.totalRules}条)</span>`
        : '<span class="text-amber-400 font-semibold">未检测到生效规则</span>';

      summaryEl.innerHTML = `${runBadge} | 活动工程: <span class="text-white">${escapeHtml(live.activeWorkspace)}</span> | 实时生效: ${ruleText}`;
    } catch (e) {
      console.warn('Live rules status check failed:', e);
    }
  },

  renderStatsHeader() {
    const o = this.overview;
    if (!o) return;

    const totalEl = document.getElementById('statProjRulesTotal');
    if (totalEl) totalEl.textContent = o.totalProjects || 0;

    const confEl = document.getElementById('statProjRulesConfigured');
    if (confEl) confEl.textContent = o.configuredProjects || 0;

    const unconfEl = document.getElementById('statProjRulesUnconfigured');
    if (unconfEl) unconfEl.textContent = o.unconfiguredProjects || 0;

    const rateEl = document.getElementById('statProjRulesRate');
    if (rateEl) {
      const rate = o.totalProjects > 0 ? Math.round((o.configuredProjects / o.totalProjects) * 100) : 0;
      rateEl.textContent = `${rate}%`;
    }
  },

  populateProjectSelect() {
    const select = document.getElementById('project-rules-workspace-select');
    if (!select) return;

    select.innerHTML = this.projects.map(p => `
      <option value="${escapeHtml(p.path)}" ${this.selectedProject && this.selectedProject.path === p.path ? 'selected' : ''}>
        ${escapeHtml(p.name)} ${p.isCurrent ? '(当前活动工程)' : ''} [${p.hasRules ? '已配置' : '未配置'}]
      </option>
    `).join('');
  },

  renderProjectsList() {
    const container = document.getElementById('project-rules-grid');
    if (!container) return;

    const filtered = this.projects.filter(p => {
      if (!this.filterKeyword) return true;
      return p.name.toLowerCase().includes(this.filterKeyword) || p.path.toLowerCase().includes(this.filterKeyword);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-neutral-500 text-xs">
          <i data-lucide="folder-search" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          没有找到匹配的工作区工程
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(p => this.renderProjectCard(p)).join('');
    if (window.lucide) lucide.createIcons();
  },

  renderProjectCard(proj) {
    const isSelected = this.selectedProject && pathResolve(this.selectedProject.path) === pathResolve(proj.path);
    const encPath = encodeURIComponent(proj.path);
    const titles = (proj.summaryTitles || []).map(t => `
      <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 truncate max-w-[200px]">
        ${escapeHtml(t)}
      </span>
    `).join('');

    return `
      <div class="fluent-card p-4 flex flex-col justify-between transition-all cursor-pointer ${
        isSelected ? 'border-purple-500/70 bg-[#25222b]' : 'hover:border-neutral-600 bg-[#1e1e21]'
      }" onclick="ProjectRulesManager.selectProject('${encPath}', true)">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <div class="flex items-center space-x-2 truncate">
              <i data-lucide="folder-code" class="w-4 h-4 ${proj.hasRules ? 'text-purple-400' : 'text-neutral-500'} shrink-0"></i>
              <span class="text-xs font-bold text-white truncate">${escapeHtml(proj.name)}</span>
              ${proj.isCurrent ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold shrink-0">当前</span>' : ''}
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
              !proj.hasRules ? 'bg-neutral-800 text-neutral-400'
              : proj.isInherited ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            }">
              ${!proj.hasRules ? '未配置' : proj.isInherited ? `继承上级 (${proj.totalRules}条)` : `专属配置 (${proj.totalRules}条)`}
            </span>
          </div>

          <p class="text-[11px] font-mono text-neutral-400 truncate select-all mb-2.5">${escapeHtml(proj.path)}</p>

          ${proj.hasRules ? `
            <div class="flex flex-wrap gap-1.5 mb-3">
              ${proj.isInherited ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">继承上级</span>' : ''}
              ${titles || '<span class="text-[10px] text-neutral-500">已就绪</span>'}
            </div>
          ` : `
            <div class="p-2.5 rounded-lg bg-neutral-900/60 border border-dashed border-neutral-700/60 text-[11px] text-neutral-400 mb-3">
              该工程尚未创建专属 AGENTS.md，当前自动继承全局规则。
            </div>
          `}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-win-border/40 text-xs">
          <span class="text-[10px] text-neutral-500 font-mono">
            ${proj.hasRules ? `${(proj.size / 1024).toFixed(1)} KB` : '待初始化'}
          </span>
          <div class="flex items-center space-x-1.5" onclick="event.stopPropagation()">
            ${proj.hasRules ? `
              ${proj.isInherited ? `
                <button class="px-2 py-1 text-[11px] font-medium rounded-md bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 transition"
                        onclick="ProjectRulesManager.quickInit('${encPath}')">
                  固化为专属
                </button>
              ` : ''}
              <button class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition"
                      onclick="ProjectRulesManager.selectProject('${encPath}', true)">
                进入编辑
              </button>
            ` : `
              <button class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 transition"
                      onclick="ProjectRulesManager.quickInit('${encPath}')">
                一键初始化
              </button>
              <button class="px-2.5 py-1 text-[11px] font-medium rounded-md bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 transition"
                      onclick="ProjectRulesManager.copyFromGlobalFor('${encPath}')">
                继承全局
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  },

  async selectProject(pathInput, shouldScroll = false) {
    if (this.isDirty && !confirm('当前项目规则有未保存的修改，切换将丢失修改，是否继续？')) {
      return;
    }

    let targetPath = pathInput;
    try {
      if (typeof pathInput === 'string' && pathInput.includes('%')) {
        targetPath = decodeURIComponent(pathInput);
      }
    } catch {}

    const norm = pathResolve(targetPath);
    const proj = this.projects.find(p => pathResolve(p.path) === norm || p.path === targetPath);
    if (!proj) return;

    this.selectedProject = proj;
    this.isDirty = false;

    // Update select dropdown & cards highlight
    this.populateProjectSelect();
    this.renderProjectsList();

    try {
      const res = await api.getRules('workspace', proj.path);
      if (res && res.ok) {
        this.currentRules = res.rules;
        this.renderStudio(res.rules);
        if (shouldScroll) {
          this.openStudioModal();
        }
      }
    } catch (err) {
      showToast('读取项目规则失败: ' + err.message, 'error');
    }
  },

  openStudioModal() {
    const modal = document.getElementById('modalProjectRulesStudio');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    const editorEl = document.getElementById('project-rules-textarea');
    if (editorEl) editorEl.focus();
    if (window.lucide) lucide.createIcons();
  },

  closeStudioModal() {
    if (this.isDirty && !confirm('当前项目规则有未保存的修改，关闭将丢失修改，是否继续？')) {
      return;
    }
    const modal = document.getElementById('modalProjectRulesStudio');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.isDirty = false;
    this.updateSaveButtonState(false);
  },

  renderStudio(rules) {
    const titleEl = document.getElementById('project-rules-studio-title');
    if (titleEl) {
      if (rules.isInherited) {
        titleEl.innerHTML = `<span>${escapeHtml(this.selectedProject.name)} 项目规则工作台</span> <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">继承自父级工作区</span>`;
      } else {
        titleEl.innerHTML = `<span>${escapeHtml(this.selectedProject.name)} 项目专属规则工作台</span> <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">专属配置</span>`;
      }
    }

    const pathEl = document.getElementById('project-rules-studio-path');
    if (pathEl) {
      const displayPath = rules.isInherited ? `${rules.filePath} (来源: ${rules.inheritedFrom})` : rules.filePath;
      pathEl.textContent = displayPath;
      pathEl.title = displayPath;
    }

    const textarea = document.getElementById('project-rules-textarea');
    if (textarea) {
      textarea.value = rules.content || '';
    }

    this.updateStatsPreview(rules.content || '', rules.summary ? rules.summary.totalRules : rules.sections.length);
    this.renderOutline(rules.sections || []);
    this.updateSaveButtonState(false);
  },

  updateStatsPreview(content, totalRulesCount) {
    const charCount = content.length;
    const byteCount = new TextEncoder().encode(content).length;
    const maxBudget = 24000;
    const percent = Math.min(100, Math.round((byteCount / maxBudget) * 100));

    const charsEl = document.getElementById('project-rules-stat-chars');
    if (charsEl) charsEl.textContent = `${charCount.toLocaleString()} 字符 (${byteCount} B)`;

    const countEl = document.getElementById('project-rules-stat-count');
    if (countEl) countEl.textContent = `${totalRulesCount !== undefined ? totalRulesCount : '—'} 条`;

    const budgetBar = document.getElementById('project-rules-budget-bar');
    const budgetText = document.getElementById('project-rules-budget-text');
    if (budgetBar) {
      budgetBar.style.width = `${percent}%`;
      budgetBar.className = percent > 90 ? 'h-full bg-red-500 rounded-full transition-all'
        : percent > 75 ? 'h-full bg-amber-500 rounded-full transition-all'
        : 'h-full bg-purple-500 rounded-full transition-all';
    }
    if (budgetText) {
      budgetText.textContent = `${percent}% (上限 24KB)`;
    }
  },

  renderOutline(sections) {
    const listEl = document.getElementById('project-rules-outline-list');
    if (!listEl) return;

    if (!sections || sections.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-neutral-500 text-xs">
          <i data-lucide="file-question" class="w-6 h-6 mx-auto mb-2 opacity-40"></i>
          本项目暂无独立规则条目
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = sections.map((s, idx) => `
      <div class="group p-2 rounded-lg border border-[#2a2a2d] bg-[#171719] hover:border-purple-500/50 hover:bg-[#1e1e24] cursor-pointer transition-all"
           onclick="ProjectRulesManager.scrollToLine(${s.startLine || 1})">
        <div class="flex items-start justify-between gap-1.5">
          <span class="text-xs font-semibold text-neutral-200 group-hover:text-purple-300 line-clamp-1 transition-colors">
            ${escapeHtml(s.title)}
          </span>
          <span class="text-[10px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono shrink-0">
            #${idx + 1}
          </span>
        </div>
        <div class="mt-0.5 text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
          ${escapeHtml(s.content.replace(/^#+\s+/g, ''))}
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  scrollToLine(lineNum) {
    const textarea = document.getElementById('project-rules-textarea');
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    let charIndex = 0;
    for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
      charIndex += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(charIndex, charIndex + (lines[lineNum - 1] ? lines[lineNum - 1].length : 0));
  },

  async save() {
    if (!this.selectedProject) return;
    const textarea = document.getElementById('project-rules-textarea');
    if (!textarea) return;
    const content = textarea.value;

    try {
      const res = await api.saveRules('workspace', this.selectedProject.path, content);
      if (res && res.ok) {
        showToast(`已成功保存【${this.selectedProject.name}】项目规则，快照已生成`, 'success');
        this.isDirty = false;
        this.updateSaveButtonState(false);
        await this.load();
      } else {
        showToast(res ? res.error : '保存项目规则失败', 'error');
      }
    } catch (err) {
      showToast('保存异常: ' + err.message, 'error');
    }
  },

  async copyFromGlobal() {
    if (!this.selectedProject) return;
    if (this.currentRules && this.currentRules.exists && !confirm('此操作将用全局系统规则覆盖当前项目的规则，是否继续？')) {
      return;
    }
    await this.copyFromGlobalFor(this.selectedProject.path);
  },

  async copyFromGlobalFor(pathInput) {
    let projectPath = pathInput;
    try {
      if (typeof pathInput === 'string' && pathInput.includes('%')) {
        projectPath = decodeURIComponent(pathInput);
      }
    } catch {}
    try {
      const res = await api.copyGlobalRulesToProject(projectPath);
      if (res && res.ok) {
        showToast('已成功将全局规则继承导入到项目专属规则！', 'success');
        await this.load();
      } else {
        showToast(res ? res.error : '导入失败', 'error');
      }
    } catch (err) {
      showToast('导入全局规则异常: ' + err.message, 'error');
    }
  },

  async batchSyncGlobal() {
    const targets = this.projects.filter(p => !p.hasRules || p.isInherited);
    const count = targets.length;
    if (!confirm(`确定要将全局系统规则一键同步写入 ${count} 个项目吗？\n（已有项目专属规则的工程将自动安全跳过）`)) {
      return;
    }
    try {
      const res = await api.batchSyncGlobalRules(null, false);
      if (res && res.ok) {
        showToast(`批量同步成功！已写入 ${res.result.synced} 个工程，保留 ${res.result.skipped} 个已有工程`, 'success');
        await this.load();
      } else {
        showToast(res ? res.error : '批量同步失败', 'error');
      }
    } catch (err) {
      showToast('批量同步异常: ' + err.message, 'error');
    }
  },

  async quickInit(pathInput) {
    let projectPath = pathInput;
    try {
      if (typeof pathInput === 'string' && pathInput.includes('%')) {
        projectPath = decodeURIComponent(pathInput);
      }
    } catch {}
    try {
      const res = await api.initProjectRules(projectPath, 'rule-7-concise');
      if (res && res.ok) {
        showToast('项目规则初始化成功（已内置代码精简80行红线规范）！', 'success');
        await this.load();
      } else {
        showToast(res ? res.error : '初始化失败', 'error');
      }
    } catch (err) {
      showToast('初始化异常: ' + err.message, 'error');
    }
  },

  async openExternalFile() {
    if (!this.selectedProject) return;
    const res = await api.openRulesFile('workspace', this.selectedProject.path);
    if (!res || !res.ok) {
      showToast(res ? res.error : '无法打开项目规则文件', 'error');
    }
  },

  updateSaveButtonState(isDirty) {
    const saveBtn = document.getElementById('project-rules-save-btn');
    if (!saveBtn) return;
    if (isDirty) {
      saveBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm flex items-center gap-1.5 transition-all animate-pulse';
      saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> 保存项目规则 (已变更)';
    } else {
      saveBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-[#252528] text-neutral-300 hover:bg-[#303034] flex items-center gap-1.5 transition-all';
      saveBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-purple-400"></i> 已是最新';
    }
    if (window.lucide) lucide.createIcons();
  }
};

window.ProjectRulesManager = ProjectRulesManager;

