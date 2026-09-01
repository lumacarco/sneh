const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const store = require('./lib/store');
const { scoreMessage, youtubeId } = require('./lib/ai');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'mla-sneh-dev-secret-cambia-in-produzione';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 14 }
});

app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

io.engine.use(sessionMiddleware);

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpe?g|png|gif|webp|mp4|webm|mov|pdf|txt|zip|mp3|ogg)$/i.test(file.originalname);
    cb(ok ? null : new Error('Tipo file non permesso'), ok);
  }
});

function publicUser(u) {
  return { id: u.id, name: u.name, points: u.points || 0, color: u.color };
}

function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Non sei loggato' });
  next();
}

function findUser(id) {
  return store.load('users').find((u) => u.id === id);
}

function enrichMessage(m, meId) {
  const u = findUser(m.user_id) || { name: 'sconosciuto', points: 0, color: '#888' };
  return {
    ...m,
    name: u.name,
    points: u.points || 0,
    color: u.color,
    mine: m.user_id === meId
  };
}

app.get('/api/me', (req, res) => {
  const u = findUser(req.session.userId);
  if (!u) return res.json({ ok: false });
  res.json({ ok: true, user: publicUser(u) });
});

app.post('/api/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const password = req.body.password || '';
  if (name.length < 2 || name.length > 24) return res.status(400).json({ ok: false, error: 'Nickname 2-24 caratteri' });
  if (password.length < 4) return res.status(400).json({ ok: false, error: 'Password minimo 4 caratteri' });
  const users = store.load('users');
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ ok: false, error: 'Nickname già usato' });
  }
  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    pass: await bcrypt.hash(password, 10),
    points: 10,
    created: new Date().toISOString(),
    color: `hsl(${Math.floor(Math.random() * 360)} 80% 70%)`
  };
  users.push(user);
  store.save('users', users);
  req.session.userId = user.id;
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/login', async (req, res) => {
  const name = (req.body.name || '').trim();
  const password = req.body.password || '';
  const user = store.load('users').find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.pass))) {
    return res.status(401).json({ ok: false, error: 'Credenziali non valide' });
  }
  req.session.userId = user.id;
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/messages', requireUser, (req, res) => {
  const list = store.load('messages').slice(-200).map((m) => enrichMessage(m, req.session.userId));
  res.json({ ok: true, messages: list, me: publicUser(findUser(req.session.userId)) });
});

app.post('/api/upload', requireUser, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Nessun file' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  let type = 'file';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) type = 'image';
  else if (['.mp4', '.webm', '.mov'].includes(ext)) type = 'video';
  res.json({
    ok: true,
    file: { name: req.file.originalname, src: '/uploads/' + req.file.filename, ext: ext.slice(1), size: req.file.size },
    type
  });
});

app.get('/api/trips', requireUser, (_req, res) => {
  const trips = store.load('trips').sort((a, b) => b.created.localeCompare(a.created));
  res.json({ ok: true, trips });
});

app.get('/api/trips/:id', requireUser, (req, res) => {
  const trip = store.load('trips').find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ ok: false, error: 'Viaggio non trovato' });
  res.json({ ok: true, trip });
});

app.post('/api/trips', requireUser, upload.single('cover'), (req, res) => {
  const me = findUser(req.session.userId);
  const title = (req.body.title || '').trim();
  const place = (req.body.place || '').trim();
  if (!title || !place) return res.status(400).json({ ok: false, error: 'Titolo e luogo obbligatori' });
  const trip = {
    id: crypto.randomBytes(8).toString('hex'),
    title,
    kind: req.body.kind || 'gita',
    place,
    date_start: req.body.date_start || '',
    date_end: req.body.date_end || '',
    meeting: (req.body.meeting || '').trim(),
    difficulty: req.body.difficulty || 'media',
    max_people: Number(req.body.max_people || 0),
    itinerary: (req.body.itinerary || '').trim(),
    notes: (req.body.notes || '').trim(),
    cover: req.file ? '/uploads/' + req.file.filename : null,
    author_id: me.id,
    author: me.name,
    participants: [{ id: me.id, name: me.name }],
    created: new Date().toISOString()
  };
  const trips = store.load('trips');
  trips.push(trip);
  store.save('trips', trips);
  res.json({ ok: true, trip });
});

app.post('/api/trips/:id/join', requireUser, (req, res) => {
  const me = findUser(req.session.userId);
  const trips = store.load('trips');
  const trip = trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ ok: false, error: 'Non trovato' });
  if (trip.max_people && trip.participants.length >= trip.max_people) {
    return res.status(400).json({ ok: false, error: 'Posti esauriti' });
  }
  if (!trip.participants.some((p) => p.id === me.id)) {
    trip.participants.push({ id: me.id, name: me.name });
  }
  store.save('trips', trips);
  io.emit('trip:update', trip);
  res.json({ ok: true, trip });
});

app.post('/api/trips/:id/leave', requireUser, (req, res) => {
  const trips = store.load('trips');
  const trip = trips.find((t) => t.id === req.params.id);
  if (!trip) return res.status(404).json({ ok: false, error: 'Non trovato' });
  trip.participants = trip.participants.filter((p) => p.id !== req.session.userId);
  store.save('trips', trips);
  io.emit('trip:update', trip);
  res.json({ ok: true, trip });
});

function persistMessage(raw, user) {
  const ai = scoreMessage(raw.text || `[${raw.type || 'text'}]`);
  const yt = youtubeId(raw.text);
  const msg = {
    id: crypto.randomBytes(8).toString('hex'),
    user_id: user.id,
    text: raw.text || '',
    file: raw.file || null,
    type: raw.trip ? 'trip' : (yt ? 'youtube' : (raw.type || 'text')),
    yt,
    trip: raw.trip || null,
    ai,
    created: new Date().toISOString()
  };
  const messages = store.load('messages');
  messages.push(msg);
  store.save('messages', messages.slice(-400));
  const users = store.load('users');
  const u = users.find((x) => x.id === user.id);
  if (u) { u.points = (u.points || 0) + ai.score; store.save('users', users); }
  return { msg, points: u ? u.points : 0 };
}

io.on('connection', (socket) => {
  const uid = socket.request.session?.userId;
  if (!uid) return socket.disconnect(true);
  const user = findUser(uid);
  if (!user) return socket.disconnect(true);

  socket.emit('ready', { me: publicUser(user) });
  socket.broadcast.emit('presence', { name: user.name, online: true });

  socket.on('chat:message', (payload = {}) => {
    const fresh = findUser(uid);
    const { msg, points } = persistMessage(payload, fresh);
    const packed = enrichMessage(msg, null);
    packed.points = points;
    io.emit('chat:message', packed);
    io.emit('points', { id: fresh.id, points });
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('presence', { name: user.name, online: false });
  });
});

app.get('/health', (_req, res) => res.json({ ok: true, app: 'MLA & SNEH' }));

server.listen(PORT, () => {
  console.log(`MLA & SNEH ready → http://localhost:${PORT}`);
});
