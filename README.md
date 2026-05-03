# Portal Hakam JKSNJ

A web-based case management system for Jabatan Kehakiman Syariah Negeri Johor, supporting the arbitration process (*Hakam*) under **Kaedah-Kaedah Hakam (Negeri Johor) 2022**.

---

## Quick Start

```bash
# 1. Install dependencies (run once)
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

**Demo accounts:**

| Username | Password  | Role              |
|----------|-----------|-------------------|
| admin    | jksnj2025 | Pentadbir (Admin) |
| daftar   | daftar123 | Pendaftar         |
| hakam1   | hakam123  | Panel Hakam       |

---

## What This System Does

The portal manages the full lifecycle of a *kes hakam* (arbitration case):

1. **Rekod Kes** — Register and track arbitration cases, assigned Hakam, and case status
2. **Laporan Tahkim** — Submit Borang 7 (arbitration session reports) with file attachments
3. **Borang 1–9** — Fill and print all statutory forms under Jadual Pertama
4. **Aliran Prosedur** — Visual step-by-step procedural flowchart
5. **Etika & Kaedah** — Reference for Hakam ethics and rules

---

## Project Structure

```
System Salman/
│
├── server.js           ← Backend: Express server + all API routes
├── package.json        ← Node.js project config & dependencies
│
├── public/
│   └── index.html      ← Frontend: single-page app (HTML + CSS + JS)
│
├── data/
│   └── jksnj.db        ← SQLite database (auto-created on first run)
│
├── uploads/            ← Uploaded files/attachments (auto-created)
│
├── README.md           ← This file
└── SETUP.md            ← End-user setup guide (for JKSNJ staff)
```

---

## How the Backend Works

### Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Server   | Node.js + Express.js               |
| Database | SQLite via `better-sqlite3`        |
| Auth     | Session-based (`express-session`) + bcrypt password hashing |
| Uploads  | `multer` (disk storage, `uploads/` folder) |

Everything lives in **`server.js`** — one file, no separate folders. Easy to read and modify.

---

### Authentication Flow

```
Browser                          server.js
  │                                  │
  ├─ POST /api/auth/login ─────────► │  bcrypt.compareSync(password, hash)
  │                                  │  → creates session cookie
  │◄──── { user: {...} } ───────────┤
  │                                  │
  ├─ GET /api/kes ──────────────────►│  checks req.session.user
  │◄──── [ ...cases ] ──────────────┤
```

- Passwords are **hashed with bcrypt** — plaintext passwords are never stored
- Session lasts **8 hours**, stored server-side (browser gets only a session ID cookie)
- Every protected route checks `req.session.user` before responding

---

### Database Schema

Four tables in `data/jksnj.db`:

```sql
users
  id TEXT PRIMARY KEY        -- login username
  nama TEXT                  -- full name
  kata TEXT                  -- bcrypt hashed password
  jawatan TEXT               -- job title
  peranan TEXT               -- role: admin | pendaftar | hakam

kes
  id TEXT PRIMARY KEY        -- e.g. JHR-2025-001
  data TEXT                  -- full case object stored as JSON
  created_at, updated_at

laporan
  id TEXT PRIMARY KEY        -- e.g. L-2025-001
  kes_id TEXT                -- foreign key to kes.id
  data TEXT                  -- full report object as JSON
  created_at, updated_at

borang_submissions
  id TEXT PRIMARY KEY        -- e.g. SUB-123456
  borang TEXT                -- B1, B2, ... B9
  no_borang TEXT             -- "Borang 1", "Borang 2", etc.
  nama TEXT                  -- form name
  kes_id TEXT                -- linked case (optional)
  data TEXT                  -- form field values as JSON
  fail TEXT                  -- uploaded filename (if any)
  tarikh DATETIME
  user_nama TEXT             -- who submitted it
```

> **Why JSON in columns?** Keeps the schema flexible. Case fields and form fields can change without a database migration — the data is just a JSON blob.

---

### API Endpoints

All routes require a valid session except `/api/auth/login`.

#### Auth
| Method | Route              | Description            |
|--------|--------------------|------------------------|
| POST   | `/api/auth/login`  | Login, creates session |
| POST   | `/api/auth/logout` | Destroys session       |
| GET    | `/api/auth/me`     | Returns current user   |

#### Kes (Cases)
| Method | Route          | Who can use     |
|--------|----------------|-----------------|
| GET    | `/api/kes`     | All roles       |
| POST   | `/api/kes`     | admin, pendaftar|
| PUT    | `/api/kes/:id` | admin, pendaftar|
| DELETE | `/api/kes/:id` | admin only      |

#### Laporan (Reports)
| Method | Route              | Who can use      | Supports file upload |
|--------|--------------------|------------------|----------------------|
| GET    | `/api/laporan`     | All roles        | —                    |
| POST   | `/api/laporan`     | admin, pendaftar | ✅ multipart/form-data |
| PUT    | `/api/laporan/:id` | admin, pendaftar | ✅ multipart/form-data |
| DELETE | `/api/laporan/:id` | admin only       | —                    |

#### Borang Submissions
| Method | Route        | Who can use | Supports file upload |
|--------|--------------|-------------|----------------------|
| GET    | `/api/borang`| All roles   | —                    |
| POST   | `/api/borang`| All roles   | ✅ multipart/form-data |

---

### File Upload

When submitting Laporan or Borang with an attachment:

```
Client sends:  multipart/form-data
  - field "data"       → JSON string of the form data
  - field "fail"       → the file itself

Server stores file to:  uploads/<timestamp>-<random>.<ext>
Database stores:        the filename only (not the full path)
Access URL:             http://localhost:3000/uploads/<filename>
```

**Accepted formats:** PDF, DOC, DOCX, JPG, JPEG, PNG  
**Max size:** 10 MB

---

### Role Permissions Summary

| Action                  | admin | pendaftar | hakam |
|-------------------------|:-----:|:---------:|:-----:|
| View everything         | ✅    | ✅        | ✅    |
| Add/edit kes            | ✅    | ✅        | ❌    |
| Add/edit laporan        | ✅    | ✅        | ❌    |
| Submit borang           | ✅    | ✅        | ✅    |
| Delete any record       | ✅    | ❌        | ❌    |

Permissions are enforced **on the server**, not just the UI.

---

### How the Frontend Connects to the Backend

The frontend (`public/index.html`) is a single HTML file. It:

1. Calls `fetch('/api/auth/me')` on page load — if a session exists, skips login
2. After login, calls `/api/kes`, `/api/laporan`, `/api/borang` to load all data into `STATE`
3. All CRUD buttons call `fetch()` to the API, then update `STATE` and re-render locally
4. File uploads use `FormData` — the JSON data goes as a field named `"data"`, the file as `"fail"`

No page reloads. No framework. Just vanilla JS + the browser's native `fetch` API.

---

## Backup & Data

All data is in one file: **`data/jksnj.db`**

To back up: copy that file somewhere safe.  
To restore: replace the file and restart the server.

---

## Known Limitations (Demo Version)

- No user management UI — to add/change users, edit `server.js` and restart
- Borang 1–9 field specs pending — input fields will be updated once official requirements are confirmed
- No HTTPS — suitable for local/LAN use only; requires SSL setup before internet deployment
- Uploads folder not backed up automatically — include it in any backup routine
