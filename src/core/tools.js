import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';

/**
 * Reads all cached tools and instructions for a given MCP server.
 * @param {string} serverName
 * @returns {{tools: Array<object>, instructions: string|null, cachePath: string|null}}
 */
export function getServerTools(serverName) {
  // Check primary antigravity mcp cache
  const searchDirs = [
    path.join(PATHS.antigravityMcpDir, serverName),
    path.join(PATHS.antigravityCliDir, 'mcp', serverName),
  ];

  let targetDir = null;
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      targetDir = dir;
      break;
    }
  }

  if (!targetDir) {
    return {
      tools: [],
      instructions: null,
      cachePath: null,
      message: 'No cached tool schemas found for this server in Antigravity.',
    };
  }

  let instructions = null;
  const tools = [];

  const files = fs.readdirSync(targetDir);
  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    if (file === 'instructions.md') {
      try {
        instructions = fs.readFileSync(fullPath, 'utf8');
      } catch {}
    } else if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const schema = JSON.parse(content);
        if (schema && schema.name) {
          tools.push({
            name: schema.name,
            description: schema.description || '',
            parameters: schema.parameters || {},
            required: schema.parameters?.required || [],
            propertiesCount: Object.keys(schema.parameters?.properties || {}).length,
          });
        }
      } catch (err) {
        console.error(`Failed to parse tool schema ${file}:`, err.message);
      }
    }
  }

  // Sort tools alphabetically
  tools.sort((a, b) => a.name.localeCompare(b.name));

  return {
    serverName,
    tools,
    instructions,
    cachePath: targetDir,
    toolsCount: tools.length,
  };
}
