const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req,file,cb)=>{ const d=path.join(__dirname,'../public/uploads'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req,file,cb)=>cb(null,uuidv4()+path.extname(file.originalname))
});
const upload = multer({ storage });

async function isGA(userId, groupId) {
  const user = await get('SELECT role FROM users WHERE id=?',[userId]);
  if (user?.role==='tunnelmaster') return true;
  const g = await get('SELECT createdBy FROM groups_table WHERE id=?',[groupId]);
  if (g?.createdBy===userId) return true;
  const m = await get('SELECT isAdmin FROM group_members WHERE groupId=? AND userId=?',[groupId,userId]);
  return m?.isAdmin===1;
}

async function sysMsg(groupId, text) {
  await run('INSERT INTO messages (id,groupId,userId,text,isSystem) VALUES (?,?,?,?,1)',[uuidv4(),groupId,'system',text]);
}

router.post('/create', requireAuth, upload.single('groupImage'), async (req,res) => {
  if (req.user.role!=='tunnelmaster') return res.status(403).send('Forbidden');
  const {name,bio} = req.body;
  if (!name?.trim()) return res.redirect('/admin');
  const id=uuidv4(), image=req.file?'/uploads/'+req.file.filename:null;
  await run('INSERT INTO groups_table (id,name,bio,image,createdBy) VALUES (?,?,?,?,?)',[id,name.trim(),bio||null,image,req.user.id]);
  await run('INSERT INTO group_members (groupId,userId,isAdmin) VALUES (?,?,1)',[id,req.user.id]);
  res.redirect(`/chat?group=${id}`);
});

router.post('/:groupId/edit', requireAuth, upload.single('groupImage'), async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  const {name,bio}=req.body;
  const image=req.file?'/uploads/'+req.file.filename:null;
  if (image) await run('UPDATE groups_table SET name=?,bio=?,image=? WHERE id=?',[name,bio,image,groupId]);
  else await run('UPDATE groups_table SET name=?,bio=? WHERE id=?',[name,bio,groupId]);
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/add-member', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  const {userId}=req.body;
  const target=await get('SELECT * FROM users WHERE id=?',[userId]);
  if (!target) return res.redirect(`/chat?group=${groupId}`);
  await run('INSERT OR IGNORE INTO group_members (groupId,userId,isAdmin) VALUES (?,?,0)',[groupId,userId]);
  await sysMsg(groupId,`${target.fakeUsername||target.username} was added to the group.`);
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/remove-member', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  const {userId}=req.body;
  const target=await get('SELECT * FROM users WHERE id=?',[userId]);
  if (!target) return res.redirect(`/chat?group=${groupId}`);
  if (target.role==='tunnelmaster'&&req.user.role!=='tunnelmaster') return res.status(403).send('Cannot remove TunnelMaster');
  await run('DELETE FROM group_members WHERE groupId=? AND userId=?',[groupId,userId]);
  await sysMsg(groupId,`${target.fakeUsername||target.username} was removed from the group.`);
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/set-admin', requireAuth, async (req,res) => {
  if (req.user.role!=='tunnelmaster') return res.status(403).send('Forbidden');
  const {groupId}=req.params; const {userId}=req.body;
  await run('UPDATE group_members SET isAdmin=1 WHERE groupId=? AND userId=?',[groupId,userId]);
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/toggle-pause', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  const group=await get('SELECT * FROM groups_table WHERE id=?',[groupId]);
  const ns=group.chatPaused?0:1;
  await run('UPDATE groups_table SET chatPaused=? WHERE id=?',[ns,groupId]);
  await sysMsg(groupId,ns?'Chat has been paused.':'Chat has been resumed.');
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/toggle-close', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  const group=await get('SELECT * FROM groups_table WHERE id=?',[groupId]);
  const ns=group.isClosed?0:1;
  await run('UPDATE groups_table SET isClosed=? WHERE id=?',[ns,groupId]);
  await sysMsg(groupId,ns?'This group has been closed.':'This group has been reopened.');
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/clear-chat', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (!await isGA(req.user.id,groupId)) return res.status(403).send('Forbidden');
  await run('DELETE FROM messages WHERE groupId=?',[groupId]);
  await sysMsg(groupId,'All messages were cleared by an admin.');
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/:groupId/delete', requireAuth, async (req,res) => {
  if (req.user.role!=='tunnelmaster') return res.status(403).send('Forbidden');
  const {groupId}=req.params;
  await run('DELETE FROM messages WHERE groupId=?',[groupId]);
  await run('DELETE FROM group_members WHERE groupId=?',[groupId]);
  await run('DELETE FROM groups_table WHERE id=?',[groupId]);
  res.redirect('/chat');
});

router.post('/:groupId/leave', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  if (req.user.role==='tunnelmaster') return res.redirect(`/chat?group=${groupId}`);
  await run('DELETE FROM group_members WHERE groupId=? AND userId=?',[groupId,req.user.id]);
  const name=req.user.fakeUsername||req.user.username;
  await sysMsg(groupId,`${name} left the group.`);
  res.redirect('/chat');
});

router.post('/:groupId/hide', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  await run('UPDATE group_members SET isHidden=1 WHERE groupId=? AND userId=?',[groupId,req.user.id]);
  res.redirect('/chat');
});

module.exports = router;

router.post('/:groupId/unhide', requireAuth, async (req,res) => {
  const {groupId}=req.params;
  await run('UPDATE group_members SET isHidden=0 WHERE groupId=? AND userId=?',[groupId,req.user.id]);
  res.redirect(`/chat?group=${groupId}`);
});
