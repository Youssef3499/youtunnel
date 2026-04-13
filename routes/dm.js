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
const upload = multer({ storage, limits:{fileSize:50*1024*1024} });
const fk = mt=>mt.startsWith('image/')?'image':mt.startsWith('audio/')?'audio':mt.startsWith('video/')?'video':'file';

async function getOrCreateDM(u1,u2) {
  const [a,b]=[u1,u2].sort();
  let dm=await get('SELECT * FROM direct_messages WHERE user1=? AND user2=?',[a,b]);
  if (!dm) { const id=uuidv4(); await run('INSERT INTO direct_messages (id,user1,user2) VALUES (?,?,?)',[id,a,b]); dm=await get('SELECT * FROM direct_messages WHERE id=?',[id]); }
  return dm;
}

router.get('/:userId', requireAuth, async (req,res) => {
  const target=await get('SELECT * FROM users WHERE id=?',[req.params.userId]);
  if (!target) return res.redirect('/chat');
  const dm=await getOrCreateDM(req.user.id,target.id);
  res.redirect(`/dm/conversation/${dm.id}`);
});

router.get('/conversation/:dmId', requireAuth, async (req,res) => {
  const dm=await get('SELECT * FROM direct_messages WHERE id=?',[req.params.dmId]);
  if (!dm||(dm.user1!==req.user.id&&dm.user2!==req.user.id)) return res.redirect('/chat');
  const otherId=dm.user1===req.user.id?dm.user2:dm.user1;
  const other=await get('SELECT * FROM users WHERE id=?',[otherId]);
  if (!other) return res.redirect('/chat');
  const rawMsgs=await all(`SELECT m.*,u.fakeUsername,u.username,u.profileImage FROM messages m JOIN users u ON u.id=m.userId WHERE m.dmId=? ORDER BY m.createdAt ASC`,[dm.id]);
  const messages=[];
  for (const m of rawMsgs) {
    const dels=await all('SELECT userId FROM message_deletions WHERE messageId=?',[m.id]);
    messages.push({...m,alias:m.fakeUsername||m.username,deletedForUsers:dels.map(r=>r.userId)});
  }
  const allUsers=(await all('SELECT * FROM users WHERE id!=? AND isDisabled=0',[req.user.id])).map(u=>({...u,alias:u.fakeUsername||u.username}));
  const groups=await all(`SELECT g.* FROM groups_table g JOIN group_members gm ON gm.groupId=g.id AND gm.userId=? AND gm.isHidden=0`,[req.user.id]);
  res.render('dm',{currentUser:{...req.user,alias:req.user.fakeUsername||req.user.username},other:{...other,alias:other.fakeUsername||other.username},dm,messages,allUsers,groups,ownUserId:req.user.id,appName:'YouTunnel'});
});

router.post('/conversation/:dmId/send', requireAuth, async (req,res) => {
  const dm=await get('SELECT * FROM direct_messages WHERE id=?',[req.params.dmId]);
  if (!dm||(dm.user1!==req.user.id&&dm.user2!==req.user.id)) return res.status(403).send('Forbidden');
  const {text}=req.body;
  if (text?.trim()) await run('INSERT INTO messages (id,dmId,userId,text) VALUES (?,?,?,?)',[uuidv4(),dm.id,req.user.id,text.trim()]);
  res.redirect(`/dm/conversation/${dm.id}`);
});

router.post('/conversation/:dmId/upload', requireAuth, upload.single('sharedFile'), async (req,res) => {
  const dm=await get('SELECT * FROM direct_messages WHERE id=?',[req.params.dmId]);
  if (!dm||(dm.user1!==req.user.id&&dm.user2!==req.user.id)) return res.status(403).send('Forbidden');
  if (req.file) {
    const fileUrl='/uploads/'+req.file.filename;
    await run('INSERT INTO messages (id,dmId,userId,text,fileUrl,fileName,fileKind) VALUES (?,?,?,?,?,?,?)',[uuidv4(),dm.id,req.user.id,req.body.caption||null,fileUrl,req.file.originalname,fk(req.file.mimetype)]);
  }
  res.redirect(`/dm/conversation/${dm.id}`);
});

module.exports = router;
