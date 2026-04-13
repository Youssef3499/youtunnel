const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { const d = path.join(__dirname,'../public/uploads'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50*1024*1024 } });

function fileKind(mt='') { return mt.startsWith('image/')?'image':mt.startsWith('audio/')?'audio':mt.startsWith('video/')?'video':'file'; }
function enrich(u) { return {...u, alias: u.fakeUsername||u.username}; }

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = enrich(req.user);
    const groupId = req.query.group;
    const groups = await all(`SELECT g.*, gm.isAdmin, gm.isHidden FROM groups_table g JOIN group_members gm ON gm.groupId=g.id AND gm.userId=? WHERE gm.isHidden=0 ORDER BY g.createdAt DESC`, [user.id]);
    let selectedGroup=null, messages=[], members=[];
    if (groupId) {
      const mem = await get('SELECT * FROM group_members WHERE groupId=? AND userId=?',[groupId,user.id]);
      if (mem && !mem.isHidden) selectedGroup = await get('SELECT * FROM groups_table WHERE id=?',[groupId]);
      if (selectedGroup) {
        const rawMsgs = await all(`SELECT m.*,u.fakeUsername,u.username,u.profileImage FROM messages m JOIN users u ON u.id=m.userId WHERE m.groupId=? AND m.isSystem=0 ORDER BY m.createdAt ASC`,[groupId]);
        const sysMsgs = await all(`SELECT * FROM messages WHERE groupId=? AND isSystem=1 ORDER BY createdAt ASC`,[groupId]);
        const allMsgs = [...rawMsgs.map(m=>({...m,alias:m.fakeUsername||m.username})),...sysMsgs].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
        for (const m of allMsgs) { const dels = await all('SELECT userId FROM message_deletions WHERE messageId=?',[m.id]); m.deletedForUsers=dels.map(r=>r.userId); }
        messages = allMsgs;
        members = (await all(`SELECT u.*,gm.isAdmin FROM users u JOIN group_members gm ON gm.userId=u.id AND gm.groupId=? WHERE gm.isHidden=0`,[groupId])).map(enrich);
      }
    }
    const allUsers = (await all('SELECT * FROM users WHERE id!=? AND isDisabled=0',[user.id])).map(enrich);
    const hiddenGroupsList = await all(`SELECT g.* FROM groups_table g JOIN group_members gm ON gm.groupId=g.id AND gm.userId=? WHERE gm.isHidden=1`,[user.id]);
    res.render('chat', { currentUser:user, groups, selectedGroup, messages, users:members, allUsers, hiddenGroupsList, ownUserId:user.id, appName:'YouTunnel', welcome:req.query.welcome==='1' });
  } catch(e) { console.error(e); res.status(500).send('Server error'); }
});

router.post('/upload', requireAuth, upload.single('sharedFile'), async (req, res) => {
  const { groupId, caption } = req.body;
  if (!groupId || !req.file) return res.redirect(`/chat?group=${groupId}`);
  const mem = await get('SELECT * FROM group_members WHERE groupId=? AND userId=?',[groupId,req.user.id]);
  const group = await get('SELECT * FROM groups_table WHERE id=?',[groupId]);
  if (!mem||!group||group.chatPaused||group.isClosed) return res.redirect(`/chat?group=${groupId}`);
  const id=uuidv4(), fileUrl='/uploads/'+req.file.filename, fk=fileKind(req.file.mimetype);
  await run('INSERT INTO messages (id,groupId,userId,text,fileUrl,fileName,fileKind) VALUES (?,?,?,?,?,?,?)',[id,groupId,req.user.id,caption||null,fileUrl,req.file.originalname,fk]);
  await run('INSERT INTO events (id,type,userId,groupId,meta) VALUES (?,?,?,?,?)',[uuidv4(),'file_upload',req.user.id,groupId,JSON.stringify({fileKind:fk})]);
  res.redirect(`/chat?group=${groupId}`);
});

router.post('/profile', requireAuth, upload.single('profileImage'), async (req, res) => {
  const { fakeUsername, bio } = req.body;
  const profileImage = req.file ? '/uploads/'+req.file.filename : null;
  await run('UPDATE users SET fakeUsername=?, bio=?, profileImage=COALESCE(?,profileImage) WHERE id=?',[fakeUsername||null,bio||null,profileImage,req.user.id]);
  res.redirect('/chat');
});

module.exports = router;
