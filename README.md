# 🧠 MoodTracker

Aplikasi web untuk mencatat emosi harian secara berkala guna melihat pola kesehatan mental dari waktu ke waktu.

---

## 📋 Deskripsi

MoodTracker memungkinkan pengguna mencatat mood setiap jam dalam sehari. Data yang terkumpul divisualisasikan dalam bentuk kalender warna (Pixel Mood) dan statistik bulanan, sehingga pengguna dapat memahami pola emosi mereka secara lebih mendalam.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 😊 **Pemilihan Mood Per Jam** | Input mood setiap jam dengan 8 pilihan emosi + catatan opsional |
| 🔒 **Lock Per Jam** | Mood yang sudah diinput di jam lampau tidak bisa diubah |
| 📅 **Kalender Pixel Mood** | Setiap hari tampil sebagai kotak berwarna berdasarkan rata-rata mood |
| 📊 **Statistik Bulanan** | Distribusi mood, hari tercatat, total entry, streak, dan mood terbanyak |

---

## 🛠️ Teknologi yang Digunakan

### Frontend
- **HTML5** — Struktur halaman
- **CSS3** — Styling dengan CSS Variables, Flexbox, Grid
- **Vanilla JavaScript (ES6+)** — Logika aplikasi, DOM manipulation

### Backend / Database
- **Firebase Firestore** — NoSQL cloud database untuk menyimpan data mood
- **Firebase SDK v10** — Diload via CDN (ES Modules), tanpa npm

### Tools
- **Laragon** — Local development server

---

## 📁 Struktur Proyek

```
MoodTracker/
├── index.html        # Struktur halaman utama
├── style.css         # Styling dan tema visual
├── app.js            # Logika aplikasi + integrasi Firebase
└── README.md         # Dokumentasi proyek
```

---

## 🗄️ Struktur Data Firestore

Semua mood disimpan dalam collection `moods/` dengan Document ID berformat `YYYY-MM-DD_HH`.

```
moods/
  ├── 2026-10-29_08   ← mood jam 08:00
  ├── 2026-10-29_13   ← mood jam 13:00
  └── 2026-10-29_20   ← mood jam 20:00
```

Struktur tiap dokumen:

```json
{
  "moodId": "happy",
  "note":   "Hari ini sangat produktif",
  "date":   "2026-10-29",
  "hour":   8,
  "id":     "2026-10-29_08"
}
```

---

## ⚙️ Cara Instalasi & Menjalankan

### 1. Clone / Download Proyek
```
Letakkan folder MoodTracker di dalam direktori web server.
Contoh Laragon: C:\laragon\www\MoodTracker\
```

### 2. Setup Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com)
2. Buat project baru
3. Pilih **Web** `</>` → Register app → Copy `firebaseConfig`
4. Buka **Firestore Database** → Create database → pilih **Test mode**
5. Buka tab **Rules** → ganti dengan:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /moods/{docId} {
      allow read, write: if true;
    }
  }
}
```

6. Klik **Publish**

### 3. Isi Firebase Config di `app.js`

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### 4. Jalankan via Local Server

Buka browser dan akses:
```
http://localhost/MoodTracker
```

> ⚠️ **Penting:** Harus dibuka via HTTP server (Laragon, XAMPP, dll), bukan langsung double-click file `.html`, karena Firebase SDK menggunakan ES Modules yang membutuhkan protokol HTTP.

---

## 🧠 Logika & Algoritma

### Input Mood Per Jam
- Satu dokumen Firestore mewakili satu slot jam (`YYYY-MM-DD_HH`)
- Setiap jam hanya bisa diisi **satu kali**
- Selama masih di jam yang sama, mood **bisa diubah**
- Setelah jam berganti, entry **terkunci permanen**

### Warna Pixel Kalender (Rata-rata Mood)
```
Contoh: jam 08 = Senang (index 1), jam 14 = Sedih (index 4)
avg index = round((1 + 4) / 2) = 2
Warna pixel = MOODS[2].color = warna "Penuh Cinta" (pink)
```

### Mood Dominan (detail klik pixel)
- Hitung frekuensi tiap `moodId` dalam satu hari
- Tampilkan mood dengan jumlah kemunculan terbanyak

### Streak
- Loop mundur dari hari ini ke belakang
- Hitung berapa hari berturut-turut yang punya minimal 1 entry
- Berhenti saat menemukan hari yang kosong

### Sistem Cache
Untuk mengurangi request ke Firestore:
- `dayCache` — menyimpan data per hari yang sudah pernah di-fetch
- `monthCache` — menyimpan data per bulan untuk kalender & statistik
- Saat data baru disimpan, cache bulan di-invalidate agar data kalender ikut diperbarui

---

## 😊 Daftar Mood

| Emoji | ID | Nama | Warna |
|---|---|---|---|
| 🤩 | great | Luar Biasa | Kuning |
| 😊 | happy | Senang | Hijau |
| 🥰 | love | Penuh Cinta | Pink |
| 😐 | meh | Biasa Saja | Abu |
| 😢 | sad | Sedih | Biru |
| 😰 | anxious | Cemas | Ungu muda |
| 😠 | angry | Marah | Oranye |
| 🤯 | rad | Overwhelmed | Merah muda |

---

## 📱 Tampilan

Aplikasi dirancang **mobile-first** dengan lebar maksimal mengikuti layar ponsel. Terdiri dari 3 halaman utama yang diakses via bottom navigation:

- **Mood** — Input mood jam ini + log mood hari ini
- **Kalender** — Pixel grid warna per bulan
- **Statistik** — Grafik distribusi, streak, dan mood terbanyak

---

## 👨‍💻 Informasi Proyek

| | |
|---|---|
| **Nama Proyek** | MoodTracker |
| **Tipe** | Tugas UTS |
| **Platform** | Web Mobile |
| **Database** | Firebase Firestore |
| **Build** | HTML + CSS + JavaScript (Vanilla) |
