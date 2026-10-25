// Turns the Home Assistant app options into Yuvomi environment variables.
//
// stdout: shell `export` lines, evaluated by run.sh
// stderr: log output, shown in the app log
//
// Paths can be overridden through HA_* variables so the script can be tested
// outside of Home Assistant.

import { createHash, randomBytes } from 'node:crypto';
import {
  chownSync, existsSync, mkdirSync, openSync, readFileSync, readSync,
  closeSync, readdirSync, lstatSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.HA_DATA_DIR || '/data';
const CONFIG_DIR = process.env.HA_CONFIG_DIR || '/config';
const OPTIONS_FILE = path.join(DATA_DIR, 'options.json');
const STATE_DIR = path.join(DATA_DIR, '.ha');
const DB_PATH = path.join(DATA_DIR, 'yuvomi.db');
const LEGACY_DB_PATH = path.join(DATA_DIR, 'oikos.db');
const MODULES_DIR = path.join(CONFIG_DIR, 'modules');
const KEY_EXPORT_FILE = path.join(CONFIG_DIR, 'db_encryption_key.txt');
const SUPERVISOR_URL = process.env.HA_SUPERVISOR_URL || 'http://supervisor';

// Values the app manages itself. env_vars must not override them, because a
// wrong DB_PATH or key silently starts an empty instance or locks the data.
const MANAGED = new Set([
  'PORT', 'DB_PATH', 'BACKUP_DIR', 'MODULES_DIR', 'SESSION_SECRET',
  'DB_ENCRYPTION_KEY', 'DOCUMENT_STORAGE_LOCAL_PATH', 'NODE_ENV',
]);

const log = (msg) => process.stderr.write(`[yuvomi-ha] ${msg}\n`);
const fail = (msg) => {
  log(`ERROR: ${msg}`);
  process.exit(1);
};

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function readOptions() {
  try {
    return JSON.parse(readFileSync(OPTIONS_FILE, 'utf8'));
  } catch (err) {
    fail(`Cannot read ${OPTIONS_FILE}: ${err.message}`);
  }
}

function readSecret(file) {
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8').trim();
}

function writeSecret(file, value) {
  writeFileSync(file, `${value}\n`, { mode: 0o600 });
}

// SQLite writes a fixed, readable header. An encrypted file does not have it.
function isEncryptedDatabase(file) {
  if (!existsSync(file)) return false;
  const header = Buffer.alloc(16);
  const fd = openSync(file, 'r');
  try {
    const read = readSync(fd, header, 0, 16, 0);
    if (read < 16) return false;
  } finally {
    closeSync(fd);
  }
  return header.toString('latin1') !== 'SQLite format 3\u0000';
}

function nodeUser() {
  try {
    const line = readFileSync('/etc/passwd', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('node:'));
    if (line) {
      const [, , uid, gid] = line.split(':');
      return { uid: Number(uid), gid: Number(gid) };
    }
  } catch { /* fall through */ }
  return null;
}

function chownRecursive(target, owner) {
  chownSync(target, owner.uid, owner.gid);
  const stat = lstatSync(target);
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(target)) {
    const child = path.join(target, entry);
    if (lstatSync(child).isSymbolicLink()) continue;
    chownRecursive(child, owner);
  }
}

function prepareDir(dir, owner) {
  mkdirSync(dir, { recursive: true });
  if (owner && process.getuid?.() === 0) chownRecursive(dir, owner);
}

function sessionSecret() {
  const file = path.join(STATE_DIR, 'session_secret');
  let secret = readSecret(file);
  if (!secret) {
    secret = randomBytes(48).toString('base64url');
    writeSecret(file, secret);
    log('Generated a new session secret.');
  }
  return secret;
}

function encryptionKey(options) {
  const generatedFile = path.join(STATE_DIR, 'db_encryption_key');
  const hashFile = path.join(STATE_DIR, 'db_encryption_key.sha256');
  const dbFile = existsSync(DB_PATH) ? DB_PATH : LEGACY_DB_PATH;
  const encrypted = isEncryptedDatabase(dbFile);
  const usedHash = readSecret(hashFile);

  if (!options.encrypt_database) {
    if (encrypted) {
      fail(
        'The database is encrypted, but "encrypt_database" is off. Turn it back on '
        + '(with the same key). Yuvomi cannot decrypt an existing database by '
        + 'switching the option off.',
      );
    }
    return '';
  }

  const ownKey = String(options.encryption_key || '').trim();
  if (ownKey && ownKey.startsWith('REPLACE_WITH_')) {
    fail('"encryption_key" is still a placeholder. Enter a real key or leave it empty to generate one.');
  }
  if (ownKey && ownKey.length < 16) {
    fail('"encryption_key" must be at least 16 characters long.');
  }

  let key = ownKey || readSecret(generatedFile);

  if (encrypted && usedHash && key && sha256(key) !== usedHash) {
    fail(
      'The encryption key differs from the one this database was encrypted with. '
      + 'Yuvomi would not be able to open it. Restore the previous key. '
      + (ownKey ? 'If you replaced a generated key, clear "encryption_key" again.' : ''),
    );
  }

  if (!key) {
    if (encrypted) {
      fail('The database is encrypted, but no key is available. Enter it as "encryption_key".');
    }
    key = randomBytes(32).toString('hex');
    writeSecret(generatedFile, key);
    log('Generated a new database encryption key.');
  }

  if (!ownKey) {
    // Give the person a copy they can reach through Samba or the file editor.
    try {
      writeFileSync(
        KEY_EXPORT_FILE,
        '# Yuvomi database encryption key. Keep a copy outside Home Assistant.\n'
        + '# Without this key the database cannot be opened again.\n'
        + `${key}\n`,
        { mode: 0o600 },
      );
    } catch (err) {
      log(`Warning: could not write ${KEY_EXPORT_FILE}: ${err.message}`);
    }
  }

  writeSecret(hashFile, sha256(key));
  return key;
}

async function homeAssistantLocation() {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${SUPERVISOR_URL}/core/api/config`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    if (typeof cfg.latitude !== 'number' || typeof cfg.longitude !== 'number') return null;
    return {
      WEATHER_LAT: String(cfg.latitude),
      WEATHER_LON: String(cfg.longitude),
      WEATHER_CITY: cfg.location_name || '',
      WEATHER_UNITS: cfg.unit_system?.temperature === '°F' ? 'imperial' : 'metric',
    };
  } catch (err) {
    log(`Could not read the Home Assistant location (${err.message}); weather stays unconfigured.`);
    return null;
  }
}

async function main() {
  const options = readOptions();
  const owner = nodeUser();

  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });

  const env = {
    NODE_ENV: 'production',
    PORT: '3000',
    DB_PATH,
    BACKUP_DIR: options.backup_dir,
    MODULES_DIR,
    DOCUMENT_STORAGE_LOCAL_ENABLED: options.local_documents ? 'true' : 'false',
    DOCUMENT_STORAGE_LOCAL_PATH: options.documents_dir,
    SESSION_SECURE: options.behind_https_proxy ? 'true' : 'false',
    TRUST_PROXY: options.behind_https_proxy ? '1' : 'loopback',
    LOG_LEVEL: options.log_level || 'info',
    MODULES_ALLOW_WEB_INSTALL: options.modules_allow_web_install ? 'true' : 'false',
    SESSION_SECRET: sessionSecret(),
    DB_ENCRYPTION_KEY: encryptionKey(options),
  };

  const baseUrl = String(options.base_url || '').trim().replace(/\/+$/, '');
  if (baseUrl) {
    if (!/^https?:\/\/[^/\s]+/.test(baseUrl)) fail('"base_url" must start with http:// or https://');
    env.BASE_URL = baseUrl;
  }

  const custom = {};
  for (const { name, value } of options.env_vars || []) {
    if (MANAGED.has(name)) {
      log(`Ignoring env_vars entry ${name}: this value is managed by the app.`);
      continue;
    }
    custom[name] = value;
  }

  if (options.use_home_assistant_location && !custom.WEATHER_LAT && !custom.OPENWEATHER_API_KEY) {
    const location = await homeAssistantLocation();
    if (location) {
      Object.assign(env, location);
      log(`Using the Home Assistant location for weather (${location.WEATHER_CITY || 'home'}).`);
    }
  }

  Object.assign(env, custom);

  prepareDir(options.backup_dir, owner);
  prepareDir(MODULES_DIR, owner);
  if (options.local_documents) prepareDir(options.documents_dir, owner);

  log(`Database encryption: ${env.DB_ENCRYPTION_KEY ? 'on' : 'off'}`);
  log(`Backups: ${env.BACKUP_DIR}, modules: ${MODULES_DIR}`
    + (options.local_documents ? `, documents: ${options.documents_dir}` : ''));

  for (const [key, value] of Object.entries(env)) {
    process.stdout.write(`export ${key}=${shellQuote(value)}\n`);
  }
}

main().catch((err) => fail(err.stack || err.message));
