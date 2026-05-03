const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
['./uploads', './data'].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d); });

// ── DATABASE ──────────────────────────────────────────────
const db = new Database('./data/jksnj.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    kata TEXT NOT NULL,
    jawatan TEXT,
    peranan TEXT
  );
  CREATE TABLE IF NOT EXISTS kes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS laporan (
    id TEXT PRIMARY KEY,
    kes_id TEXT,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS borang_submissions (
    id TEXT PRIMARY KEY,
    borang TEXT,
    no_borang TEXT,
    nama TEXT,
    kes_id TEXT,
    data TEXT,
    fail TEXT,
    tarikh DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_nama TEXT
  );
`);

// Seed default users if none exist
if (db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0) {
  const ins = db.prepare('INSERT INTO users VALUES (?,?,?,?,?)');
  ins.run('admin',  'Admin JKSNJ',                bcrypt.hashSync('jksnj2025', 10), 'Pentadbir Sistem', 'admin');
  ins.run('daftar', 'Nor Aziah bt Abd Rahman',    bcrypt.hashSync('daftar123', 10), 'Pendaftar Kanan',  'pendaftar');
  ins.run('hakam1', 'Ustaz Razali bin Mohamad',   bcrypt.hashSync('hakam123',  10), 'Panel Hakam',      'hakam');
  console.log('✅ Akaun lalai telah dibuat.');
}

// Seed sample data if kes table is empty
if (db.prepare('SELECT COUNT(*) as c FROM kes').get().c === 0) {
  const insKes = db.prepare('INSERT INTO kes (id, data) VALUES (?,?)');
  [
    {id:'JHR-2025-001',noSaman:'10004-046-0012-2025',mahkamah:'MRS Johor Bahru',suami:'Ahmad Faizal bin Yusof',kpSuami:'820514-01-5678',isteri:'Siti Norzila binti Hassan',kpIsteri:'850621-01-2345',hakamSuami:'Razali bin Mohamad',hakamIsteri:'Hamidah binti Othman',tarikhLantik:'2025-01-15',tarikhTamat:'2025-02-14',status:'Aktif',jenis:'Hakam Qarabah',keputusan:''},
    {id:'JHR-2025-002',noSaman:'10004-046-0008-2025',mahkamah:'MRS Kluang',suami:'Mohd Hafiz bin Azmi',kpSuami:'790302-07-4321',isteri:'Rosnani binti Daud',kpIsteri:'820811-07-9876',hakamSuami:'Ustaz Shahril Nizam',hakamIsteri:'Zainab binti Kamal',tarikhLantik:'2025-01-22',tarikhTamat:'2025-02-21',status:'Tangguh',jenis:'Panel Mahkamah',keputusan:''},
    {id:'JHR-2024-047',noSaman:'10004-046-0091-2024',mahkamah:'MRS Muar',suami:'Zulkifli bin Ramli',kpSuami:'760415-06-1234',isteri:'Faridah binti Amin',kpIsteri:'800920-06-5678',hakamSuami:'Hj Fadzil bin Taib',hakamIsteri:'Hajah Ramlah binti Ismail',tarikhLantik:'2024-11-10',tarikhTamat:'2024-12-09',status:'Selesai',jenis:'Panel Mahkamah',keputusan:'Talaq'},
  ].forEach(k => insKes.run(k.id, JSON.stringify(k)));

  const insLap = db.prepare('INSERT INTO laporan (id, kes_id, data) VALUES (?,?,?)');
  [
    {id:'L-2025-001',kes:'JHR-2025-001',noSaman:'10004-046-0012-2025',mahkamah:'MRS Johor Bahru',hakamSuami:'Razali bin Mohamad',hakamIsteri:'Hamidah binti Othman',tarikhMajlis:'2025-02-05',tempat:'MRS Johor Bahru',sesi:'Sesi 1 – Pertemuan Awal',latar:'Majlis pertama telah diadakan.',isu:'Masalah komunikasi dan kewangan.',punca:'Belum dapat ditentukan.',cadangan:'',catatan:'',status:'Draf',fail:''},
    {id:'L-2024-047',kes:'JHR-2024-047',noSaman:'10004-046-0091-2024',mahkamah:'MRS Muar',hakamSuami:'Hj Fadzil bin Taib',hakamIsteri:'Hajah Ramlah binti Ismail',tarikhMajlis:'2024-12-05',tempat:'MRS Muar',sesi:'Laporan Akhir Majlis Tahkim',latar:'Tiga sesi tahkim diadakan.',isu:'Keganasan rumah tangga.',punca:'Shiqaq berpunca dari suami.',cadangan:'Talaq',catatan:'Pihak-pihak bersetuju.',status:'Lengkap',fail:''},
  ].forEach(l => insLap.run(l.id, l.kes, JSON.stringify(l)));

  console.log('✅ Data contoh telah dimuatkan.');
}

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'jksnj-portal-hakam-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Sila log masuk terlebih dahulu.' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.user?.peranan !== 'admin') return res.status(403).json({ error: 'Hanya Pentadbir dibenarkan.' });
  next();
}
function requireEdit(req, res, next) {
  if (req.session.user?.peranan === 'hakam') return res.status(403).json({ error: 'Panel Hakam tidak dibenarkan mengubah rekod.' });
  next();
}

// ── FILE UPLOAD ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

// ── AUTH ROUTES ───────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { id, kata } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user || !bcrypt.compareSync(kata, user.kata)) {
    return res.status(401).json({ error: 'ID pengguna atau kata laluan salah.' });
  }
  req.session.user = { id: user.id, nama: user.nama, jawatan: user.jawatan, peranan: user.peranan };
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Tidak log masuk.' });
  res.json({ user: req.session.user });
});

// ── KES ROUTES ────────────────────────────────────────────
app.get('/api/kes', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT data FROM kes ORDER BY created_at DESC').all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

app.post('/api/kes', requireAuth, requireEdit, (req, res) => {
  const d = req.body;
  if (!d.id || !d.suami || !d.isteri) return res.status(400).json({ error: 'Medan wajib tidak lengkap.' });
  if (db.prepare('SELECT id FROM kes WHERE id = ?').get(d.id)) return res.status(409).json({ error: 'Nombor kes sudah wujud.' });
  db.prepare('INSERT INTO kes (id, data) VALUES (?,?)').run(d.id, JSON.stringify(d));
  res.json({ ok: true });
});

app.put('/api/kes/:id', requireAuth, requireEdit, (req, res) => {
  db.prepare('UPDATE kes SET data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(req.body), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/kes/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM kes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── LAPORAN ROUTES ────────────────────────────────────────
app.get('/api/laporan', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT data FROM laporan ORDER BY created_at DESC').all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

app.post('/api/laporan', requireAuth, requireEdit, upload.single('fail'), (req, res) => {
  const d = JSON.parse(req.body.data || '{}');
  if (!d.kes || !d.sesi) return res.status(400).json({ error: 'No. Kes dan Sesi wajib diisi.' });
  if (req.file) d.fail = req.file.filename;
  const id = d.id || ('L-' + Date.now().toString().slice(-6));
  d.id = id;
  db.prepare('INSERT INTO laporan (id, kes_id, data) VALUES (?,?,?)').run(id, d.kes, JSON.stringify(d));
  res.json({ ok: true, id });
});

app.put('/api/laporan/:id', requireAuth, requireEdit, upload.single('fail'), (req, res) => {
  const d = JSON.parse(req.body.data || '{}');
  if (req.file) d.fail = req.file.filename;
  db.prepare('UPDATE laporan SET data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(d), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/laporan/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM laporan WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── BORANG ROUTES ─────────────────────────────────────────
app.get('/api/borang', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM borang_submissions ORDER BY tarikh DESC').all();
  res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data || '{}') })));
});

app.post('/api/borang', requireAuth, upload.single('fail'), (req, res) => {
  const sub = JSON.parse(req.body.submission || '{}');
  const id = 'SUB-' + Date.now().toString().slice(-6);
  db.prepare('INSERT INTO borang_submissions (id,borang,no_borang,nama,kes_id,data,fail,user_nama) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, sub.borang, sub.noBorang, sub.nama, sub.kes || '', JSON.stringify(sub.data || {}), req.file?.filename || '', sub.user);
  res.json({ ok: true, id });
});

app.delete('/api/borang/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM borang_submissions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Portal Hakam JKSNJ                          ║`);
  console.log(`║  http://localhost:${PORT}                       ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  console.log(`  Akaun ujian:`);
  console.log(`  admin   / jksnj2025  (Pentadbir)`);
  console.log(`  daftar  / daftar123  (Pendaftar)`);
  console.log(`  hakam1  / hakam123   (Panel Hakam)\n`);
});
