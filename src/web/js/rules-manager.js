/**
 * Antigravity MCP Manager - Rules Manager Component
 * Compliant with Rule 7: Single responsibility, all methods <= 80 lines.
 */

const RulesManager = {
  scope: 'global',
  data: null,
  presets: [],
  isDirty: false,

  async init() {
    this.bindEvents();
    await this.loadPresets();
    await this.load();
  },

  bindEvents() {
    // Scope switcher
    document.querySelectorAll('[data-rules-scope]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextScope = e.currentTarget.getAttribute('data-rules-scope');
        this.switchScope(nextScope);
      });
    });

    // Save button
    const saveBtn = document.getElementById('rules-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.save());
    }

    // Reload / Discard button
    const reloadBtn = document.getElementById('rules-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.load());
    }

    // Open file button
    const openBtn = document.getElementById('rules-open-file-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openFile());
    }

    // Open presets modal
    const presetsBtn = document.getElementById('rules-open-presets-btn');
    if (presetsBtn) {
      presetsBtn.addEventListener('click', () => this.showPresetsModal());
    }

    // Live refresh button
    const liveRefreshBtn = document.getElementById('rules-live-refresh-btn');
    if (liveRefreshBtn) {
      liveRefreshBtn.addEventListener('click', () => {
        showToast('正在从 Antigravity 实时重新获取生效规则...', 'info');
        this.load();
      });
    }

    // Textarea dirty state listener
    const textarea = document.getElementById('rules-editor-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.isDirty = true;
        this.updateStatsPreview(textarea.value);
        this.updateSaveButtonState(true);
      });
      // Keyboard shortcut: Ctrl+S to save
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          this.save();
        }
      });
    }
  },

  async switchScope(nextScope) {
    if (this.isDirty && !confirm('当前规则有未保存的修改，切换将丢失修改，是否继续？')) {
      return;
    }
    this.scope = nextScope;
    this.isDirty = false;
    this.updateScopeButtons();
    await this.load();
  },

  updateScopeButtons() {
    document.querySelectorAll('[data-rules-scope]').forEach(btn => {
      const scopeVal = btn.getAttribute('data-rules-scope');
      if (scopeVal === this.scope) {
        btn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow-sm transition-all';
      } else {
        btn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-[#252528] text-neutral-400 hover:text-neutral-200 transition-all';
      }
    });
  },

  async loadPresets() {
    try {
      const res = await api.getPresetRules();
      if (res && res.presets) {
        this.presets = res.presets;
      }
    } catch (err) {
      console.warn('Failed to load rule presets:', err);
    }
  },

  async load() {
    try {
      const projectDir = this.scope === 'workspace' ? currentWorkspace : null;
      const res = await api.getRules(this.scope, projectDir);
      if (!res || !res.ok) {
        showToast(res ? res.error : '加载规则失败', 'error');
        return;
      }

      this.data = res.rules;
      this.isDirty = false;
      this.render();
      this.updateSaveButtonState(false);
      await this.checkLiveStatus();
    } catch (err) {
      showToast('获取规则失败: ' + err.message, 'error');
    }
  },

  async checkLiveStatus() {
    try {
      const res = await api.getAntigravityLiveRules();
      if (!res || !res.ok || !res.live) return;
      const live = res.live;
      const summaryEl = document.getElementById('rules-live-summary');
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

  render() {
    const d = this.data;
    if (!d) return;

    // 1. File path and scope indicator
    const pathEl = document.getElementById('rules-file-path');
    if (pathEl) {
      pathEl.textContent = d.filePath;
      pathEl.title = d.filePath;
    }

    const scopeBadge = document.getElementById('rules-scope-badge');
    if (scopeBadge) {
      scopeBadge.textContent = this.scope === 'global' ? '全局系统规则' : '当前工作区规则';
    }

    // 2. Editor content
    const textarea = document.getElementById('rules-editor-textarea');
    if (textarea) {
      textarea.value = d.content || '';
    }

    // 3. Stats & Budget
    this.updateStatsPreview(d.content || '', d.summary ? d.summary.totalRules : d.sections.length);

    // 4. Render Outline
    this.renderOutline(d.sections || []);
  },

  updateStatsPreview(content, totalRulesCount) {
    const charCount = content.length;
    const byteCount = new TextEncoder().encode(content).length;
    const maxBudget = 24000;
    const percent = Math.min(100, Math.round((byteCount / maxBudget) * 100));

    const charsEl = document.getElementById('rules-stat-chars');
    if (charsEl) charsEl.textContent = `${charCount.toLocaleString()} 字符 (${byteCount} B)`;

    const countEl = document.getElementById('rules-stat-count');
    if (countEl) countEl.textContent = `${totalRulesCount !== undefined ? totalRulesCount : '—'} 条`;

    const budgetBar = document.getElementById('rules-budget-bar');
    const budgetText = document.getElementById('rules-budget-text');
    if (budgetBar) {
      budgetBar.style.width = `${percent}%`;
      budgetBar.className = percent > 90 ? 'h-full bg-red-500 rounded-full transition-all duration-300'
        : percent > 75 ? 'h-full bg-amber-500 rounded-full transition-all duration-300'
        : 'h-full bg-blue-500 rounded-full transition-all duration-300';
    }
    if (budgetText) {
      budgetText.textContent = `${percent}% (上限 24KB)`;
    }
  },

  renderOutline(sections) {
    const listEl = document.getElementById('rules-outline-list');
    if (!listEl) return;

    if (!sections || sections.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-neutral-500 text-xs">
          <i data-lucide="file-question" class="w-6 h-6 mx-auto mb-2 opacity-40"></i>
          暂无解析到的规则条目
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = sections.map((s, idx) => `
      <div class="group p-2.5 rounded-lg border border-[#2a2a2d] bg-[#1a1a1c] hover:border-blue-500/40 hover:bg-[#202024] cursor-pointer transition-all"
           onclick="RulesManager.scrollToLine(${s.startLine || 1})">
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-semibold text-neutral-200 group-hover:text-blue-400 line-clamp-1 transition-colors">
            ${escapeHtml(s.title)}
          </span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 flex-shrink-0 font-mono">
            #${idx + 1}
          </span>
        </div>
        <div class="mt-1 text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
          ${escapeHtml(s.content.replace(/^#+\s+/g, ''))}
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  scrollToLine(lineNum) {
    const textarea = document.getElementById('rules-editor-textarea');
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
    const textarea = document.getElementById('rules-editor-textarea');
    if (!textarea) return;
    const content = textarea.value;
    const projectDir = this.scope === 'workspace' ? currentWorkspace : null;

    try {
      const res = await api.saveRules(this.scope, projectDir, content);
      if (res && res.ok) {
        showToast('规则已成功保存，并在云端/本地创建了快照备份', 'success');
        this.isDirty = false;
        this.updateSaveButtonState(false);
        await this.load();
      } else {
        showToast(res ? res.error : '保存失败', 'error');
      }
    } catch (err) {
      showToast('保存规则异常: ' + err.message, 'error');
    }
  },

  updateSaveButtonState(isDirty) {
    const saveBtn = document.getElementById('rules-save-btn');
    if (!saveBtn) return;
    if (isDirty) {
      saveBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 transition-all animate-pulse';
      saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> 保存修改 (已变更)';
    } else {
      saveBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-[#252528] text-neutral-300 hover:bg-[#303034] flex items-center gap-1.5 transition-all';
      saveBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> 已是最新';
    }
    if (window.lucide) lucide.createIcons();
  },

  async openFile() {
    const projectDir = this.scope === 'workspace' ? currentWorkspace : null;
    const res = await api.openRulesFile(this.scope, projectDir);
    if (!res || !res.ok) {
      showToast(res ? res.error : '无法打开文件', 'error');
    }
  },

  showPresetsModal() {
    const modal = document.getElementById('rules-presets-modal');
    const container = document.getElementById('rules-presets-container');
    if (!modal || !container) return;

    container.innerHTML = this.presets.map(p => `
      <div class="p-4 rounded-xl border border-[#2e2e32] bg-[#1a1a1d] hover:border-blue-500/50 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-semibold text-white">${escapeHtml(p.name)}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              ${escapeHtml(p.category)}
            </span>
          </div>
          <p class="text-xs text-neutral-400 leading-relaxed mb-3">${escapeHtml(p.description)}</p>
          <pre class="p-2.5 rounded-lg bg-[#141416] border border-[#252528] text-[11px] text-neutral-300 font-mono overflow-x-auto max-h-32 mb-3 leading-snug">${escapeHtml(p.content)}</pre>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#26262a]">
          <button class="px-3 py-1 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  onclick="RulesManager.copyPresetContent('${p.id}')">
            复制规则
          </button>
          <button class="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  onclick="RulesManager.applyPreset('${p.id}')">
            追加至当前规则
          </button>
        </div>
      </div>
    `).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  },

  closePresetsModal() {
    const modal = document.getElementById('rules-presets-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async applyPreset(presetId) {
    const projectDir = this.scope === 'workspace' ? currentWorkspace : null;
    try {
      const res = await api.applyPresetRule(this.scope, projectDir, presetId);
      if (res && res.ok) {
        showToast('规则已成功追加并保存快照备份！', 'success');
        this.closePresetsModal();
        await this.load();
      } else {
        showToast(res ? res.error : '追加失败', 'error');
      }
    } catch (err) {
      showToast('应用预设异常: ' + err.message, 'error');
    }
  },

  async copyPresetContent(presetId) {
    const p = this.presets.find(item => item.id === presetId);
    if (!p) return;
    const ok = await api.writeClipboard(p.content);
    if (ok) {
      showToast('规则内容已成功复制到剪贴板', 'success');
    } else {
      showToast('复制失败', 'error');
    }
  }
};
