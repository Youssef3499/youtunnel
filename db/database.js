const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'youtunnel.db');
const _db = new sqlite3.Database(dbPath, err => {
  if (err) console.error('[DB] Open error:', err);
  else console.log('[DB] SQLite connected');
});

_db.run('PRAGMA journal_mode = WAL');
_db.run('PRAGMA foreign_keys = ON');

_db.serialize(() => {
  _db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, fakeUsername TEXT, bio TEXT, profileImage TEXT, role TEXT NOT NULL DEFAULT 'user', isDisabled INTEGER DEFAULT 0, serverKey TEXT NOT NULL, termsAccepted INTEGER DEFAULT 0, lastSeen TEXT, isOnline INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')))`);
  _db.run(`CREATE TABLE IF NOT EXISTS groups_table (id TEXT PRIMARY KEY, name TEXT NOT NULL, bio TEXT, image TEXT, createdBy TEXT NOT NULL, chatPaused INTEGER DEFAULT 0, isClosed INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')))`);
  _db.run(`CREATE TABLE IF NOT EXISTS group_members (groupId TEXT NOT NULL, userId TEXT NOT NULL, isAdmin INTEGER DEFAULT 0, isHidden INTEGER DEFAULT 0, joinedAt TEXT DEFAULT (datetime('now')), PRIMARY KEY (groupId, userId))`);
  _db.run(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, groupId TEXT, dmId TEXT, userId TEXT NOT NULL, text TEXT, fileUrl TEXT, fileName TEXT, fileKind TEXT, isSystem INTEGER DEFAULT 0, isDeletedForEveryone INTEGER DEFAULT 0, deletedBy TEXT, deletedAt TEXT, createdAt TEXT DEFAULT (datetime('now')))`);
  _db.run(`CREATE TABLE IF NOT EXISTS message_deletions (messageId TEXT NOT NULL, userId TEXT NOT NULL, PRIMARY KEY (messageId, userId))`);
  _db.run(`CREATE TABLE IF NOT EXISTS direct_messages (id TEXT PRIMARY KEY, user1 TEXT NOT NULL, user2 TEXT NOT NULL, createdAt TEXT DEFAULT (datetime('now')), UNIQUE(user1, user2))`);
  _db.run(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT NOT NULL, userId TEXT, groupId TEXT, meta TEXT, createdAt TEXT DEFAULT (datetime('now')))`);

  _db.get('SELECT id FROM users WHERE role = ?', ['tunnelmaster'], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('TunnelMaster2024!', 12);
      _db.run(`INSERT INTO users (id, username, fakeUsername, password, role, serverKey, termsAccepted) VALUES (?, 'tunnelmaster', 'TunnelMaster', ?, 'tunnelmaster', 'TUNNEL-MASTER-KEY-2024', 1)`, [uuidv4(), hash],
        () => console.log('[DB] TunnelMaster created: tunnelmaster / TunnelMaster2024! / key: TUNNEL-MASTER-KEY-2024'));
    }
  });
  _db.run(`UPDATE users SET isOnline = 0`);
});

const run = (sql, p=[]) => new Promise((res,rej) => _db.run(sql, p, function(e){ e?rej(e):res({lastID:this.lastID,changes:this.changes}); }));
const get = (sql, p=[]) => new Promise((res,rej) => _db.get(sql, p, (e,r) => e?rej(e):res(r||null)));
const all = (sql, p=[]) => new Promise((res,rej) => _db.all(sql, p, (e,r) => e?rej(e):res(r||[])));

module.exports = { run, get, all, _db };
