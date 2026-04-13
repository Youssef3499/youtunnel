const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { get, run } = require('../db/database');

router.get('/terms', (req, res) => res.render('terms', { layout: false }));

router.post('/terms/accept', async (req, res) => {
  if (req.session.userId) await run('UPDATE users SET termsAccepted = 1 WHERE id = ?', [req.session.userId]);
  res.redirect('/chat');
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/chat');
  res.render('login', { error: req.query.error || null });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, serverKey } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username?.trim().toLowerCase()]);
    if (!user) return res.render('login', { error: 'Invalid credentials' });
    if (user.isDisabled) return res.render('login', { error: 'Account disabled' });
    if (user.serverKey !== serverKey?.trim()) return res.render('login', { error: 'Invalid server key' });
    if (!bcrypt.compareSync(password, user.password)) return res.render('login', { error: 'Invalid credentials' });
    req.session.userId = user.id;
    await run('INSERT INTO events (id, type, userId) VALUES (?, ?, ?)', [uuidv4(), 'login', user.id]);
    await run('UPDATE users SET isOnline = 1, lastSeen = datetime("now") WHERE id = ?', [user.id]);
    if (!user.termsAccepted) return res.redirect('/terms');
    res.redirect('/chat?welcome=1');
  } catch(e) { console.error(e); res.render('login', { error: 'Server error' }); }
});

router.get('/logout', async (req, res) => {
  if (req.session.userId) {
    await run('UPDATE users SET isOnline = 0, lastSeen = datetime("now") WHERE id = ?', [req.session.userId]);
    await run('INSERT INTO events (id, type, userId) VALUES (?, ?, ?)', [uuidv4(), 'logout', req.session.userId]);
  }
  req.session.destroy();
  res.render('logout');
});

module.exports = router;
