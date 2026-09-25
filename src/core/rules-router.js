import {
  PRESET_RULES,
  loadRules,
  saveRules,
  appendPresetToRules,
  listModularRules,
  getProjectRulesOverview,
  initProjectRules,
  copyGlobalRulesToProject,
  batchSyncGlobalRules,
  getAntigravityLiveRules
} from './rules.js';

/**
 * Handles query routes for rules.
 */
async function handleQueryRulesRoutes(pathname, parsedUrl, sendJson) {
  // 1. GET /api/rules/projects (Aggregated project rules overview)
  if (pathname === '/api/rules/projects') {
    const overview = getProjectRulesOverview();
    sendJson(200, { ok: true, ...overview });
    return true;
  }

  // 2. GET /api/rules
  if (pathname === '/api/rules') {
    const scope = parsedUrl.searchParams.get('scope') || 'global';
    const projectDir = parsedUrl.searchParams.get('projectDir') || null;
    const data = loadRules(scope, projectDir);
    sendJson(200, { ok: true, rules: data });
    return true;
  }

  // 3. GET /api/rules/presets
  if (pathname === '/api/rules/presets') {
    sendJson(200, { ok: true, presets: PRESET_RULES });
    return true;
  }

  // 4. GET /api/rules/modular
  if (pathname === '/api/rules/modular') {
    const scope = parsedUrl.searchParams.get('scope') || 'global';
    const projectDir = parsedUrl.searchParams.get('projectDir') || null;
    const files = listModularRules(scope, projectDir);
    sendJson(200, { ok: true, files });
    return true;
  }

  // 5. GET /api/rules/live (Live Antigravity rules status)
  if (pathname === '/api/rules/live') {
    const live = getAntigravityLiveRules();
    sendJson(200, { ok: true, live });
    return true;
  }

  return false;
}

/**
 * Handles mutating action routes for rules.
 */
async function handleActionRulesRoutes(pathname, req, parseJsonBody, sendJson, sendError) {
  // 1. POST /api/rules/save
  if (pathname === '/api/rules/save') {
    const body = await parseJsonBody(req);
    const scope = body.scope || 'global';
    const projectDir = body.projectDir || null;
    const content = body.content ?? '';
    const result = saveRules(scope, projectDir, content);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 2. POST /api/rules/apply-preset
  if (pathname === '/api/rules/apply-preset') {
    const body = await parseJsonBody(req);
    const { scope = 'global', projectDir = null, presetId } = body;
    if (!presetId) {
      sendError(400, 'Missing presetId');
      return true;
    }
    const result = appendPresetToRules(scope, projectDir, presetId);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 3. POST /api/rules/init-project
  if (pathname === '/api/rules/init-project') {
    const body = await parseJsonBody(req);
    const { projectDir, templateId } = body;
    const result = initProjectRules(projectDir, templateId);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 4. POST /api/rules/copy-global
  if (pathname === '/api/rules/copy-global') {
    const body = await parseJsonBody(req);
    const { projectDir } = body;
    const result = copyGlobalRulesToProject(projectDir);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 5. POST /api/rules/batch-sync-global
  if (pathname === '/api/rules/batch-sync-global') {
    const body = await parseJsonBody(req);
    const { projectPaths = null, overwriteExisting = false } = body;
    const result = batchSyncGlobalRules(projectPaths, overwriteExisting);
    sendJson(200, { ok: true, result });
    return true;
  }

  return false;
}

/**
 * Handles HTTP requests for /api/rules/* endpoints.
 */
export async function handleRulesHttpRoutes(req, res, parsedUrl, parseJsonBody, sendJson, sendError) {
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  if (method === 'GET') {
    const handled = await handleQueryRulesRoutes(pathname, parsedUrl, sendJson);
    if (handled) return true;
  } else if (method === 'POST') {
    const handled = await handleActionRulesRoutes(pathname, req, parseJsonBody, sendJson, sendError);
    if (handled) return true;
  }

  return false;
}
