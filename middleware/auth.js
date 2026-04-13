const { get, run } = require('../db/database');

async function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!user || user.isDisabled) { req.session.destroy(); return res.redirect('/login?error=disabled'); }
  req.user = user;
  await run('UPDATE users SET isOnline = 1, lastSeen = datetime("now") WHERE id = ?', [user.id]);
  next();
}

function requireTunnelMaster(req, res, next) {
  if (!req.user || req.user.role !== 'tunnelmaster') return res.status(403).send('Forbidden');
  next();
}

module.exports = { requireAuth, requireTunnelMaster };
