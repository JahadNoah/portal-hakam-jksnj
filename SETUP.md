# Portal Hakam JKSNJ — Setup Guide

## Keperluan / Requirements
- Node.js versi 18 ke atas: https://nodejs.org

## Cara Setup (Pertama Kali)

1. Buka terminal/command prompt di folder ini
2. Jalankan:
   ```
   npm install
   ```
3. Mulakan pelayan:
   ```
   npm start
   ```
4. Buka pelayar (browser) ke: **http://localhost:3000**

## Akaun Ujian

| ID Pengguna | Kata Laluan | Peranan |
|---|---|---|
| admin | jksnj2025 | Pentadbir (boleh padam) |
| daftar | daftar123 | Pendaftar (boleh edit) |
| hakam1 | hakam123 | Panel Hakam (baca sahaja) |

## Struktur Fail

```
System Salman/
├── server.js          ← Pelayan utama
├── package.json       ← Konfigurasi projek
├── public/
│   └── index.html     ← Antaramuka pengguna
├── data/
│   └── jksnj.db      ← Pangkalan data (dibuat otomatik)
└── uploads/           ← Fail lampiran yang dimuat naik
```

## Data & Backup

Semua data disimpan di `data/jksnj.db`. Untuk backup, salin fail ini ke tempat selamat.

## Tukar Kata Laluan

Buat masa ini, tukar kata laluan terus dalam `server.js` di bahagian "Seed default users".
(Pengurusan pengguna melalui UI akan ditambah kemudian)

## Untuk Jaringan Pejabat (LAN)

Untuk benarkan komputer lain dalam pejabat mengakses sistem:
1. Cari IP komputer pelayan (jalankan `ipconfig` atau `ifconfig`)
2. Pengguna lain buka: `http://<IP-komputer>:3000`
3. Pastikan firewall benarkan port 3000
