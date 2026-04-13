const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../db/database');
const { requireAuth, requireTunnelMaster } = require('../middleware/auth');

router.use(requireAuth, requireTunnelMaster);

router.get('/', async (req,res) => {
  try {
    const range=req.query.range||'all';
    let df='';
    if (range==='today') df=`AND createdAt >= date('now')`;
    else if (range==='yesterday') df=`AND createdAt >= date('now','-1 day') AND createdAt < date('now')`;
    else if (range==='7days') df=`AND createdAt >= date('now','-7 days')`;
    else if (range==='30days') df=`AND createdAt >= date('now','-30 days')`;

    const users=await all('SELECT * FROM users ORDER BY createdAt DESC');
    const groups=await all('SELECT * FROM groups_table ORDER BY createdAt DESC');
    const allUsers=[];
    for (const u of users) {
      const mc=(await get(`SELECT COUNT(*) as c FROM messages WHERE userId=? AND isSystem=0 ${df}`,[u.id]))?.c||0;
      const fc=(await get(`SELECT COUNT(*) as c FROM messages WHERE userId=? AND fileUrl IS NOT NULL ${df}`,[u.id]))?.c||0;
      const ic=(await get(`SELECT COUNT(*) as c FROM messages WHERE userId=? AND fileKind='image' ${df}`,[u.id]))?.c||0;
      const ac=(await get(`SELECT COUNT(*) as c FROM messages WHERE userId=? AND fileKind='audio' ${df}`,[u.id]))?.c||0;
      const vc=(await get(`SELECT COUNT(*) as c FROM messages WHERE userId=? AND fileKind='video' ${df}`,[u.id]))?.c||0;
      const gc=(await get(`SELECT COUNT(*) as c FROM group_members WHERE userId=?`,[u.id]))?.c||0;
      allUsers.push({...u,alias:u.fakeUsername||u.username,messageCount:mc,fileCount:fc,imageCount:ic,audioCount:ac,videoCount:vc,groupCount:gc});
    }
    const total=allUsers.reduce((s,u)=>s+u.messageCount+u.fileCount,0);
    allUsers.forEach(u=>u.participation=total>0?Math.round(((u.messageCount+u.fileCount)/total)*100):0);

    const activityByDay=await all(`SELECT date(createdAt) as day,COUNT(*) as count FROM messages WHERE isSystem=0 ${df} GROUP BY day ORDER BY day ASC LIMIT 30`);
    const msgByUser=allUsers.map(u=>({name:u.alias,count:u.messageCount})).filter(u=>u.count>0).sort((a,b)=>b.count-a.count).slice(0,10);
    const filesByUser=allUsers.map(u=>({name:u.alias,count:u.fileCount})).filter(u=>u.count>0).sort((a,b)=>b.count-a.count).slice(0,10);
    const mostActiveGroups=await all(`SELECT g.name,COUNT(m.id) as count FROM groups_table g LEFT JOIN messages m ON m.groupId=g.id AND m.isSystem=0 GROUP BY g.id ORDER BY count DESC LIMIT 10`);

    res.render('admin',{currentUser:{...req.user,alias:req.user.fakeUsername||req.user.username},users:allUsers,groups,range,chartData:{activityByDay,messagesByUser:msgByUser,filesByUser,mostActiveGroups},appName:'YouTunnel',success:req.query.success||null});
  } catch(e){console.error(e);res.status(500).send('Error');}
});

router.post('/users/create', async (req,res) => {
  const {username,password,serverKey,role,fakeUsername}=req.body;
  if (!username||!password||!serverKey) return res.redirect('/admin?error=missing');
  const existing=await get('SELECT id FROM users WHERE username=?',[username.trim().toLowerCase()]);
  if (existing) return res.redirect('/admin?error=exists');
  const hash=bcrypt.hashSync(password,12);
  await run('INSERT INTO users (id,username,fakeUsername,password,role,serverKey) VALUES (?,?,?,?,?,?)',[uuidv4(),username.trim().toLowerCase(),fakeUsername||null,hash,role||'user',serverKey.trim()]);
  res.redirect('/admin?success=created');
});

router.post('/users/:id/toggle-disable', async (req,res) => {
  const target=await get('SELECT * FROM users WHERE id=?',[req.params.id]);
  if (!target||target.role==='tunnelmaster') return res.redirect('/admin');
  await run('UPDATE users SET isDisabled=? WHERE id=?',[target.isDisabled?0:1,target.id]);
  res.redirect('/admin');
});

router.post('/users/:id/reset-password', async (req,res) => {
  const {newPassword}=req.body;
  if (!newPassword) return res.redirect('/admin');
  await run('UPDATE users SET password=? WHERE id=?',[bcrypt.hashSync(newPassword,12),req.params.id]);
  res.redirect('/admin?success=reset');
});

router.post('/users/:id/update-key', async (req,res) => {
  const {serverKey}=req.body;
  if (!serverKey) return res.redirect('/admin');
  await run('UPDATE users SET serverKey=? WHERE id=?',[serverKey.trim(),req.params.id]);
  res.redirect('/admin?success=keyupdated');
});

module.exports = router;
