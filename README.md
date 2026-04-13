# YouTunnel 🔴

Private invite-only secure communication tunnel.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open in browser
```
http://localhost:3000
```

---

## Default TunnelMaster Login

| Field      | Value                    |
|------------|--------------------------|
| Username   | `tunnelmaster`           |
| Password   | `TunnelMaster2024!`      |
| Server Key | `TUNNEL-MASTER-KEY-2024` |

**Change these immediately after first login via Admin Panel → Reset Password / Update Key.**

---

## Features

- ⚡ **TunnelMaster** — supreme owner account, full control
- 🛡 **Group Admins** — per-group admin control
- 💬 **Real-time group chat** via Socket.IO
- 📩 **Direct messages** between any users
- 📎 **File sharing** — images, audio, video, documents (up to 50MB)
- 🗑 **Message deletion** — for me / for everyone (5-min rule)
- 👤 **User profiles** — fake display name, bio, avatar
- 🟢 **Online presence** — green dot indicators + last seen
- 📊 **Analytics dashboard** — charts, user stats, date filters
- 🔒 **Invite-only** — TunnelMaster creates all accounts
- 🎨 **Dark premium UI** — cinematic tunnel aesthetic

---

## Folder Structure

```
youtunnel/
├── server.js           # Main server + Socket.IO
├── db/
│   └── database.js     # SQLite schema + seed
├── middleware/
│   └── auth.js         # Session & role guards
├── routes/
│   ├── auth.js         # Login / logout / terms
│   ├── chat.js         # Group chat + uploads
│   ├── groups.js       # Group management
│   ├── dm.js           # Direct messages
│   └── admin.js        # Admin panel + analytics
├── views/
│   ├── login.ejs
│   ├── logout.ejs
│   ├── terms.ejs
│   ├── chat.ejs
│   ├── dm.ejs
│   ├── admin.ejs
│   └── partials/
│       ├── header.ejs
│       └── footer.ejs
├── public/
│   ├── css/style.css
│   ├── js/chat.js
│   └── uploads/        # Auto-created for file uploads
└── youtunnel.db        # Auto-created SQLite database
```

---

## How to Create Users

1. Login as TunnelMaster
2. Go to **Admin Panel**
3. Use **Create User Account** form
4. Share the username + password + server key with the member privately

---

## Notes

- Database is SQLite — stored in `youtunnel.db` (auto-created)
- Uploaded files stored in `public/uploads/`
- All sessions persist 7 days
- All destructive actions are logged in the `events` table
- For production: use a proper session store (e.g. connect-sqlite3) and set `NODE_ENV=production`
"# youtunnel" 
