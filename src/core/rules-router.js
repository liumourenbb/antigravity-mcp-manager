import {
  PRESET_RULES,
  loadRules,
  saveRules,
  appendPresetToRules,
  listModularRules
} from './rules.js';

/**
 * Handles HTTP requests for /api/rules/* endpoints.
 * @param {object} req - HTTP request
 * @param {object} res - HTTP response
 * @param {URL} parsedUrl - Parsed URL
 * @param {Function} parseJsonBody - Body parser helper
 * @param {Function} sendJson - Response helper
 * @param {Function} sendError - Error responder helper
 * @returns {Promise<boolean>} True if handled
 */
export async function handleRulesHttpRoutes(req, res, parsedUrl, parseJsonBody, sendJson, sendError) {
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. GET /api/rules
  if (pathname === '/api/rules' && method === 'GET') {
    const scope = parsedUrl.searchParams.get('scope') || 'global';
    const projectDir = parsedUrl.searchParams.get('projectDir') || null;
    const data = loadRules(scope, projectDir);
    sendJson(200, { ok: true, rules: data });
    return true;
  }

  // 2. POST /api/rules/save
  if (pathname === '/api/rules/save' && method === 'POST') {
    const body = await parseJsonBody(req);
    const scope = body.scope || 'global';
    const projectDir = body.projectDir || null;
    const content = body.content ?? '';
    const result = saveRules(scope, projectDir, content);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 3. GET /api/rules/presets
  if (pathname === '/api/rules/presets' && method === 'GET') {
    sendJson(200, { ok: true, presets: PRESET_RULES });
    return true;
  }

  // 4. POST /api/rules/apply-preset
  if (pathname === '/api/rules/apply-preset' && method === 'POST') {
    const body = await parseJsonBody(req);
    const scope = body.scope || 'global';
    const projectDir = body.projectDir || null;
    const presetId = body.presetId;
    if (!presetId) {
      sendError(400, 'Missing presetId');
      return true;
    }
    const result = appendPresetToRules(scope, projectDir, presetId);
    sendJson(200, { ok: true, result });
    return true;
  }

  // 5. GET /api/rules/modular
  if (pathname === '/api/rules/modular' && method === 'GET') {
    const scope = parsedUrl.searchParams.get('scope') || 'global';
    const projectDir = parsedUrl.searchParams.get('projectDir') || null;
    const files = listModularRules(scope, projectDir);
    sendJson(200, { ok: true, files });
    return true;
  }

  return false;
}
