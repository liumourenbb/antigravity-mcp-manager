import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS, ensureDir } from './paths.js';

/**
 * Creates a timestamped backup of the given file.
 * @param {string} filePath
 * @param {string} [reason='auto-backup']
 * @returns {string|null} Path to backup file
 */
export function createBackup(filePath, reason = 'auto-backup') {
  if (!fs.existsSync(filePath)) return null;
  
  ensureDir(PATHS.backupsDir);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const baseName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  const backupFileName = `${baseName}.${timestamp}.${hash}.bak`;
  const backupFilePath = path.join(PATHS.backupsDir, backupFileName);
  
  fs.writeFileSync(backupFilePath, content, 'utf8');
  
  // Also save metadata
  const metaFilePath = `${backupFilePath}.meta.json`;
  fs.writeFileSync(metaFilePath, JSON.stringify({
    originalPath: filePath,
    timestamp: new Date().toISOString(),
    reason,
    hash,
    size: content.length,
  }, null, 2), 'utf8');
  
  // Prune older backups if more than 50
  pruneBackups(baseName, 50);
  
  return backupFilePath;
}

/**
 * Lists all available backups for a given file base name.
 * @param {string} [targetFileName='mcp_config.json']
 * @returns {Array<object>}
 */
export function listBackups(targetFileName = 'mcp_config.json') {
  if (!fs.existsSync(PATHS.backupsDir)) return [];
  
  const files = fs.readdirSync(PATHS.backupsDir);
  const backups = [];
  
  for (const file of files) {
    if (file.startsWith(targetFileName) && file.endsWith('.bak')) {
      const filePath = path.join(PATHS.backupsDir, file);
      const metaPath = `${filePath}.meta.json`;
      let meta = {};
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {}
      }
      
      const stats = fs.statSync(filePath);
      backups.push({
        id: file,
        filename: file,
        filePath,
        timestamp: meta.timestamp || stats.mtime.toISOString(),
        reason: meta.reason || 'manual',
        size: stats.size,
        hash: meta.hash || '',
      });
    }
  }
  
  // Sort descending by timestamp
  return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Restores a specific backup file.
 * Automatically makes a safety backup of current state before restoring!
 * @param {string} backupId
 * @param {string} targetFilePath
 * @returns {boolean}
 */
export function restoreBackup(backupId, targetFilePath) {
  const backupFilePath = path.join(PATHS.backupsDir, backupId);
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup not found: ${backupId}`);
  }
  
  // Create safety backup of current target
  if (fs.existsSync(targetFilePath)) {
    createBackup(targetFilePath, 'pre-restore-safety-snapshot');
  }
  
  const backupContent = fs.readFileSync(backupFilePath, 'utf8');
  // Validate that backup is valid JSON before restoring
  JSON.parse(backupContent);
  
  fs.writeFileSync(targetFilePath, backupContent, 'utf8');
  return true;
}

/**
 * Gets content of a backup for diffing.
 * @param {string} backupId
 * @returns {string}
 */
export function getBackupContent(backupId) {
  const backupFilePath = path.join(PATHS.backupsDir, backupId);
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup not found: ${backupId}`);
  }
  return fs.readFileSync(backupFilePath, 'utf8');
}

/**
 * Prunes older backups to keep directory clean.
 */
function pruneBackups(baseName, maxCount = 50) {
  const backups = listBackups(baseName);
  if (backups.length > maxCount) {
    const toDelete = backups.slice(maxCount);
    for (const b of toDelete) {
      try {
        fs.unlinkSync(b.filePath);
        if (fs.existsSync(`${b.filePath}.meta.json`)) {
          fs.unlinkSync(`${b.filePath}.meta.json`);
        }
      } catch {}
    }
  }
}
