import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, spawn } from 'node:child_process';
import { getServers, toggleServer, deleteServer, maskSensitiveServer } from '../src/core/config.js';
import { testServerConnection } from '../src/core/diagnostics.js';
import { getServerTools } from '../src/core/tools.js';
import { cleanStaleJetBrainsBridges, scanJetBrainsBridges } from '../src/core/jetbrains.js';
import { listBackups, restoreBackup } from '../src/core/backup.js';
import { startServer } from '../src/server.js';
import { PATHS } from '../src/core/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const command = args[0] || 'list';

// ANSI colors for terminal
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function printHelp() {
  console.log(`
${C.bold}${C.cyan}Antigravity MCP Manager (${C.green}agy-mcp${C.cyan})${C.reset}
Unified Model Context Protocol manager for Google Antigravity.

${C.bold}USAGE:${C.reset}
  agy-mcp <command> [options]

${C.bold}COMMANDS:${C.reset}
  ${C.green}desktop${C.reset}             Launch as standalone Desktop GUI Application (No browser)
  ${C.green}ui${C.reset}                  Launch the interactive Web Dashboard (Browser)
  ${C.green}list${C.reset}                List all configured MCP servers across scopes (default)
  ${C.green}enable <name>${C.reset}       Enable an MCP server
  ${C.green}disable <name>${C.reset}      Disable an MCP server (retains config, sets disabled: true)
  ${C.green}test <name>${C.reset}         Test connection and latency of an MCP server
  ${C.green}tools <name>${C.reset}        Show cached tool schemas exposed by a server
  ${C.green}clean-jetbrains${C.reset}    Diagnose and clean stale IntelliJ IDEA companion bridges
  ${C.green}backups${C.reset}             List automatic configuration backups
  ${C.green}restore <backupId>${C.reset}  Restore configuration from a previous backup

${C.bold}OPTIONS:${C.reset}
  --scope=<global|workspace|other|all>  Filter by scope (default: all)
  --port=<number>                       Web UI port (default: 3210)
  --no-open                             Do not automatically open browser on UI start
  -h, --help                            Show this help message

${C.bold}EXAMPLES:${C.reset}
  agy-mcp desktop
  agy-mcp ui
  agy-mcp list --scope=global
  agy-mcp disable postgres
  agy-mcp test context7
  agy-mcp tools yunxiao
  agy-mcp clean-jetbrains
`);
}

async function main() {
  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  switch (command) {
    case 'desktop':
    case 'app': {
      console.log(`${C.dim}Launching Antigravity MCP Manager Desktop App...${C.reset}`);
      const standaloneExe = path.join(__dirname, '..', 'dist', 'Antigravity-MCP-Manager', 'Antigravity-MCP-Manager.exe');
      if (fs.existsSync(standaloneExe) && process.platform === 'win32') {
        const child = spawn('cmd.exe', ['/c', 'start', '""', standaloneExe], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        console.log(`${C.bold}${C.green}✔ Standalone Windows 11 Desktop Application launched successfully.${C.reset}`);
        break;
      }

      const directExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
      const electronBin = fs.existsSync(directExe) 
        ? directExe 
        : path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
      const projectRoot = path.join(__dirname, '..');

      if (fs.existsSync(directExe) || fs.existsSync(electronBin)) {
        if (process.platform === 'win32') {
          // Use cmd.exe /c start "" to break out of console job and launch top-level desktop window
          const child = spawn('cmd.exe', ['/c', 'start', '""', electronBin, projectRoot], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          });
          child.unref();
        } else {
          const child = spawn(electronBin, [projectRoot], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
        console.log(`${C.bold}${C.green}✔ Standalone Desktop Application launched successfully.${C.reset}`);
      } else {
        // Fallback: Standalone App window via Edge/Chrome app mode (Zero browser frame, no URL/tabs)
        console.log(`${C.dim}Starting background backend service...${C.reset}`);
        const { url } = await startServer({ port: 3210 });
        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const appBin = fs.existsSync(edgePath) ? edgePath : (fs.existsSync(chromePath) ? chromePath : null);

        if (appBin) {
          const appChild = spawn(appBin, [`--app=${url}`, `--window-size=1280,850`], {
            detached: true,
            stdio: 'ignore',
          });
          appChild.unref();
          console.log(`${C.bold}${C.green}✔ Standalone App window launched successfully.${C.reset}`);
        } else {
          console.log(`${C.green}✔ Server running at ${url}${C.reset}`);
        }
      }
      break;
    }

    case 'ui': {
      let port = 3210;
      const portArg = args.find(a => a.startsWith('--port='));
      if (portArg) port = parseInt(portArg.split('=')[1], 10) || 3210;
      const noOpen = args.includes('--no-open');

      console.log(`${C.dim}Starting Antigravity MCP Manager Web Console...${C.reset}`);
      const { url } = await startServer({ port });
      console.log(`\n${C.bold}${C.green}✔ Web Dashboard ready:${C.reset} ${C.bold}${C.cyan}${url}${C.reset}`);
      console.log(`${C.dim}Press Ctrl+C to stop.${C.reset}\n`);

      if (!noOpen) {
        if (process.platform === 'win32') {
          exec(`start ${url}`);
        } else if (process.platform === 'darwin') {
          exec(`open ${url}`);
        } else {
          exec(`xdg-open ${url}`);
        }
      }
      break;
    }

    case 'list': {
      let scope = 'all';
      const scopeArg = args.find(a => a.startsWith('--scope='));
      if (scopeArg) scope = scopeArg.split('=')[1];

      const servers = getServers(scope);
      if (servers.length === 0) {
        console.log(`${C.yellow}No MCP servers configured.${C.reset}`);
        return;
      }

      console.log(`\n${C.bold}Configured MCP Servers (${servers.length} total):${C.reset}\n`);
      
      const rows = servers.map(s => {
        const status = s.disabled 
          ? `${C.dim}${C.red}DISABLED${C.reset}` 
          : `${C.green}ENABLED ${C.reset}`;
        const scopeStr = s.scope === 'workspace' 
          ? `${C.magenta}workspace${C.reset}` 
          : s.scope === 'other'
          ? `${C.dim}pool     ${C.reset}`
          : `${C.blue}global   ${C.reset}`;
        const typeStr = s.type === 'http' ? `${C.yellow}http ${C.reset}` : `${C.cyan}stdio${C.reset}`;
        const detail = s.type === 'http' 
          ? s.url 
          : `${s.command} ${(s.args || []).slice(0, 3).join(' ')}${(s.args || []).length > 3 ? '...' : ''}`;
        
        return {
          Name: s.name,
          Scope: scopeStr,
          Type: typeStr,
          Status: status,
          Detail: detail.slice(0, 55),
        };
      });

      console.table(rows);
      console.log(`\n${C.dim}Tip: Run "agy-mcp ui" to launch the visual dashboard.${C.reset}\n`);
      break;
    }

    case 'enable': {
      const name = args[1];
      if (!name) {
        console.error(`${C.red}Error: Please specify the server name to enable.${C.reset}`);
        process.exit(1);
      }
      toggleServer(name, true);
      console.log(`${C.green}✔ Enabled server "${name}" successfully.${C.reset}`);
      break;
    }

    case 'disable': {
      const name = args[1];
      if (!name) {
        console.error(`${C.red}Error: Please specify the server name to disable.${C.reset}`);
        process.exit(1);
      }
      toggleServer(name, false);
      console.log(`${C.yellow}✔ Disabled server "${name}" (retained in config with disabled: true).${C.reset}`);
      break;
    }

    case 'test': {
      const name = args[1];
      if (!name) {
        console.error(`${C.red}Error: Please specify the server name to test.${C.reset}`);
        process.exit(1);
      }
      const servers = getServers('all');
      const target = servers.find(s => s.name === name);
      if (!target) {
        console.error(`${C.red}Error: Server "${name}" not found.${C.reset}`);
        process.exit(1);
      }
      console.log(`${C.dim}Testing connection to "${name}" (${target.type})...${C.reset}`);
      const res = await testServerConnection(target, 6000);
      if (res.ok) {
        console.log(`${C.green}✔ [SUCCESS] ${res.message}${C.reset}`);
      } else {
        console.log(`${C.red}✖ [FAILED] ${res.message}${C.reset}`);
        if (res.details) console.log(res.details);
      }
      break;
    }

    case 'tools': {
      const name = args[1];
      if (!name) {
        console.error(`${C.red}Error: Please specify the server name.${C.reset}`);
        process.exit(1);
      }
      const info = getServerTools(name);
      if (!info.tools || info.tools.length === 0) {
        console.log(`${C.yellow}${info.message || 'No tool schemas cached for this server.'}${C.reset}`);
        return;
      }
      console.log(`\n${C.bold}Tools exposed by "${name}" (${info.tools.length} tools):${C.reset}\n`);
      for (const t of info.tools) {
        console.log(`  ${C.green}• ${C.bold}${t.name}${C.reset} - ${t.description.split('\n')[0]}`);
      }
      console.log('');
      break;
    }

    case 'clean-jetbrains': {
      console.log(`${C.dim}Scanning for IntelliJ IDEA companion bridges...${C.reset}`);
      const res = await cleanStaleJetBrainsBridges();
      if (res.removed.length === 0) {
        console.log(`${C.green}✔ No stale JetBrains bridges found. All configured bridges are active.${C.reset}`);
      } else {
        console.log(`${C.green}✔ Removed ${res.removed.length} stale bridge(s):${C.reset}`);
        res.removed.forEach(r => console.log(`   - ${r}`));
      }
      break;
    }

    case 'backups': {
      const backups = listBackups();
      if (backups.length === 0) {
        console.log(`${C.yellow}No backups found.${C.reset}`);
        return;
      }
      console.log(`\n${C.bold}Configuration Backups (${backups.length}):${C.reset}\n`);
      for (const b of backups.slice(0, 15)) {
        console.log(`  ${C.cyan}${b.id}${C.reset} (${b.timestamp.replace('T', ' ').slice(0, 19)}) - ${b.reason}`);
      }
      console.log(`\n${C.dim}To restore: agy-mcp restore <backupId>${C.reset}\n`);
      break;
    }

    case 'restore': {
      const id = args[1];
      if (!id) {
        console.error(`${C.red}Error: Please provide backup ID.${C.reset}`);
        process.exit(1);
      }
      restoreBackup(id, PATHS.globalConfig);
      console.log(`${C.green}✔ Restored configuration from backup "${id}" successfully.${C.reset}`);
      break;
    }

    default: {
      console.error(`${C.red}Unknown command: "${command}"${C.reset}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(`${C.red}Fatal Error:${C.reset}`, err.message);
  process.exit(1);
});
