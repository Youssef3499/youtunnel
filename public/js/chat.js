const socket = io();

// Join relevant room
const groupId = window.YT_GROUP_ID || '';
const dmId = window.YT_DM_ID || '';
const userId = window.YT_USER_ID || '';

if (groupId) socket.emit('join-group', groupId);
if (dmId) socket.emit('join-dm', dmId);
if (userId) socket.emit('user-online', userId);

// Scroll to bottom
function scrollBottom() {
  const list = document.getElementById('messageList');
  if (list) list.scrollTop = list.scrollHeight;
}
scrollBottom();

// Send message via socket
const form = document.getElementById('messageForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('textInput');
    const text = input.value.trim();
    if (!text) return;
    if (groupId) {
      socket.emit('group-message', { groupId, userId, text });
    } else if (dmId) {
      socket.emit('dm-message', { dmId, userId, text });
    }
    input.value = '';
  });
}

// Receive group messages
socket.on('group-message', (msg) => {
  if (msg.groupId !== groupId) return;
  appendMessage(msg);
  scrollBottom();
});

// Receive DM messages
socket.on('dm-message', (msg) => {
  if (msg.dmId !== dmId) return;
  appendMessage(msg);
  scrollBottom();
});

// System messages
socket.on('system-message', (msg) => {
  if (msg.groupId !== groupId) return;
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = msg.text;
  document.getElementById('messageList')?.appendChild(el);
  scrollBottom();
});

// Online status updates
socket.on('user-status', ({ userId: uid, isOnline }) => {
  document.querySelectorAll(`[data-user-id="${uid}"] .online-dot`).forEach(dot => {
    dot.className = `online-dot ${isOnline ? 'online' : 'offline'}`;
  });
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function appendMessage(msg) {
  const list = document.getElementById('messageList');
  if (!list) return;
  const isMine = msg.userId === userId;
  const alias = escapeHtml(msg.alias || msg.fakeUsername || 'User');
  const text = escapeHtml(msg.text || '');
  const time = new Date(msg.createdAt || Date.now()).toLocaleString();
  const avatarHtml = msg.profileImage
    ? `<img src="${escapeHtml(msg.profileImage)}" class="chat-avatar" alt="avatar"/>`
    : `<div class="chat-avatar chat-avatar-ph">${alias[0].toUpperCase()}</div>`;

  const el = document.createElement('div');
  el.className = `message-card${isMine ? ' mine' : ''}`;
  el.dataset.id = msg.id || '';
  el.innerHTML = `
    <div class="message-top">
      <div class="msg-author">${avatarHtml}<strong>${alias}</strong></div>
      <small class="msg-time">${time}</small>
    </div>
    ${text ? `<p class="msg-text">${text}</p>` : ''}
  `;
  list.appendChild(el);
}
