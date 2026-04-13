const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('./db/database');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const sessionMiddleware = session({
  secret: 'youtunnel-secret-2024-xK9mP',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*24*60*60*1000, httpOnly: true }
});
app.use(sessionMiddleware);
io.use((socket,next) => sessionMiddleware(socket.request,{},next));

// Routes
app.use('/', require('./routes/auth'));
app.use('/chat', require('./routes/chat'));
app.use('/groups', require('./routes/groups'));
app.use('/dm', require('./routes/dm'));
app.use('/admin', require('./routes/admin'));

// Profile update
const uploadStorage = multer.diskStorage({
  destination:(req,file,cb)=>{ const d=path.join(__dirname,'public/uploads'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename:(req,file,cb)=>cb(null,uuidv4()+path.extname(file.originalname))
});
const upload = multer({storage:uploadStorage});
const { requireAuth } = require('./middleware/auth');

app.post('/profile', requireAuth, upload.single('profileImage'), async (req,res) => {
  const { fakeUsername, bio } = req.body;
  const profileImage = req.file ? '/uploads/'+req.file.filename : null;
  await run('UPDATE users SET fakeUsername=?,bio=?,profileImage=COALESCE(?,profileImage) WHERE id=?',[fakeUsername||null,bio||null,profileImage,req.user.id]);
  res.redirect('/chat');
});

// Message delete
app.post('/messages/:id/delete', requireAuth, async (req,res) => {
  const message = await get('SELECT * FROM messages WHERE id=?',[req.params.id]);
  if (!message) return res.status(404).send('Not found');
  const { action } = req.body;
  const isOwner = message.userId===req.user.id;
  const isTM = req.user.role==='tunnelmaster';
  if (action==='deleteForMe'&&(isOwner||isTM)) {
    await run('INSERT OR IGNORE INTO message_deletions (messageId,userId) VALUES (?,?)',[message.id,req.user.id]);
  } else if (action==='deleteForEveryone'&&(isOwner||isTM)) {
    const fiveMin=(Date.now()-new Date(message.createdAt).getTime())>5*60*1000;
    if (!fiveMin||isTM) await run('UPDATE messages SET isDeletedForEveryone=1,deletedBy=?,deletedAt=datetime("now") WHERE id=?',[req.user.id,message.id]);
  }
  if (message.groupId) return res.redirect(`/chat?group=${message.groupId}`);
  if (message.dmId) return res.redirect(`/dm/conversation/${message.dmId}`);
  res.redirect('/chat');
});

app.get('/', (req,res) => res.redirect(req.session.userId?'/chat':'/login'));

// Socket.IO
io.on('connection', socket => {
  const sess = socket.request.session;

  socket.on('user-online', async uid => {
    socket.userId = uid;
    await run('UPDATE users SET isOnline=1,lastSeen=datetime("now") WHERE id=?',[uid]);
    io.emit('user-status',{userId:uid,isOnline:true});
  });

  socket.on('join-group', groupId => socket.join(`group:${groupId}`));
  socket.on('join-dm', dmId => socket.join(`dm:${dmId}`));

  socket.on('group-message', async data => {
    const {groupId,userId:uid,text}=data;
    if (!text?.trim()||!groupId) return;
    const mem=await get('SELECT * FROM group_members WHERE groupId=? AND userId=?',[groupId,uid]);
    const group=await get('SELECT * FROM groups_table WHERE id=?',[groupId]);
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    if (!mem||!group||group.chatPaused||group.isClosed||!user||user.isDisabled) return;
    const id=uuidv4(), createdAt=new Date().toISOString();
    await run('INSERT INTO messages (id,groupId,userId,text,createdAt) VALUES (?,?,?,?,?)',[id,groupId,uid,text.trim(),createdAt]);
    // Unhide group for members
    await run('UPDATE group_members SET isHidden=0 WHERE groupId=? AND isHidden=1',[groupId]);
    io.to(`group:${groupId}`).emit('group-message',{id,groupId,userId:uid,text:text.trim(),createdAt,alias:user.fakeUsername||user.username,profileImage:user.profileImage||null});
  });

  socket.on('dm-message', async data => {
    const {dmId,userId:uid,text}=data;
    if (!text?.trim()||!dmId) return;
    const dm=await get('SELECT * FROM direct_messages WHERE id=?',[dmId]);
    if (!dm||(dm.user1!==uid&&dm.user2!==uid)) return;
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    if (!user) return;
    const id=uuidv4(), createdAt=new Date().toISOString();
    await run('INSERT INTO messages (id,dmId,userId,text,createdAt) VALUES (?,?,?,?,?)',[id,dmId,uid,text.trim(),createdAt]);
    io.to(`dm:${dmId}`).emit('dm-message',{id,dmId,userId:uid,text:text.trim(),createdAt,alias:user.fakeUsername||user.username,profileImage:user.profileImage||null});
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      await run('UPDATE users SET isOnline=0,lastSeen=datetime("now") WHERE id=?',[socket.userId]);
      io.emit('user-status',{userId:socket.userId,isOnline:false});
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🔴 YouTunnel running → http://localhost:${PORT}`);
  console.log(`📱 Phone access → http://YOUR-PC-IP:${PORT}`);
  console.log('─────────────────────────────────────────');
  console.log('  Username:   tunnelmaster');
  console.log('  Password:   TunnelMaster2024!');
  console.log('  Server Key: TUNNEL-MASTER-KEY-2024');
  console.log('─────────────────────────────────────────\n');
});