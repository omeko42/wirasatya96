# CLAUDE.md — SOP Mastering Engineering, UI/UX, Security & Anti-Bloat

Dokumen ini adalah **Standar Operasional Prosedur (SOP) Wajib** bagi seluruh AI Coding Agent (Antigravity, Claude Code, Cursor) pada repositori **Wira Satya 96 / Platform Paguyuban Leting**.

---

## 1. Empat Prinsip Inti Anti-Bloat (Karpathy Skills Standard)

1. **Think Before Coding (Pikirkan Sebelum Menulis Kode)**
   - Pahami alur data (`serverStore`, `localStorage`, `Supabase Cloud`), struktur komponen yang sudah ada, dan efek samping perubahan sebelum menyentuh file.
2. **Simplicity First — NO BLOAT (Sederhana & Tanpa Beban)**
   - Dilarang menambah *library* eksternal baru apabila fitur dapat diselesaikan dengan HTML5, Tailwind CSS, Vanilla TypeScript, atau Web API bawaan browser (seperti `Web Audio API`, `Canvas API`, `IntersectionObserver`).
   - Dilarang membuat abstraksi berlapis-lapis, *wrapper* kosong, atau kode muter-muter yang tidak diminta.
3. **Surgical Changes (Perubahan Presisi & Bedah Mikro)**
   - Ubah hanya baris kode yang relevan dengan tugas. Jangan menghapus fitur, state, atau komentar dokumentasi penting yang sudah berjalan.
4. **Goal-Driven Execution (Eksekusi Berorientasi Hasil)**
   - Setiap perubahan harus langsung terverifikasi pada UI/UX nyata, lolos kompilasi TypeScript, dan memenuhi kriteria *Stop Conditions*.

---

## 2. Anatomi 6 Pilar SOP Eksekusi (Role hingga Output)

Setiap pengerjaan fitur/perbaikan wajib mengikuti 6 pilar terstruktur:
1. **ROLE**: Bertindak sebagai *Principal Full-Stack & UI/UX Security Engineer*.
2. **TASK**: Definisikan secara spesifik komponen/endpoint mana yang dibangun atau diperbaiki.
3. **CONTEXT**: Perhatikan batasan nyata proyek (Next.js 14 App Router, TypeScript, Tailwind CSS, sinkronisasi `serverStore` + `localStorage`, pengguna mayoritas alumni/perwira di perangkat HP & PC).
4. **REASONING**: Uji dampak performa, keamanan, dan *edge-case* (layar sempit `375px`, *offline/online sync*, pencegahan *race condition*).
5. **STOP CONDITIONS**: Hanya berhenti ketika:
   - Seluruh skenario pengguna berjalan mulus tanpa error konsol/kompilasi.
   - Tampilan responsif di `375px` (HP) maupun `1280px+` (PC).
   - Tidak ada *code bloat* atau *AI slop*.
6. **OUTPUT**: Kode bersih, siap produksi, disertai tautan langsung ke file/baris kode yang diubah.

---

## 3. Aturan Anti-Slop (Kode, UI, dan Copywriting)

1. **Anti-Slop UI (`Taste Skill` & `Impeccable`)**:
   - Hindari klise AI seperti tombol gradasi ungu generik yang tidak sesuai identitas brand. Gunakan palet resmi aplikasi (`Maroon/Crimson #991b1b`, `Slate #0f172a`, `Gold/Amber #d97706`, `Emerald #059669`).
   - Pastikan margin, padding, dan rasio kontras warna selalu presisi mengikuti *4px grid*.
2. **Anti-Slop Code (`miqdadbadjuber/anti-slop` & `avoid-ai-writing`)**:
   - Dilarang menulis komentar kode basa-basi (misal: `// Ini adalah fungsi untuk...` pada kode yang sudah jelas). Tulis komentar hanya untuk menjelaskan *mengapa* (alasan arsitektur/keamanan).
3. **Anti-Slop Copywriting (`Humanizer`, `Stop-Slop`, `No-AI-Slop`)**:
   - Gunakan Bahasa Indonesia yang lugas, natural, berwibawa, dan langsung ke inti (*to the point*). Hindari terjemahan kaku atau kalimat pembuka bertele-tele.

---

## 4. Lima Keputusan UI agar "Feel Expensive" (Standar Linear)

1. **Density Reads as Competence (Kepadatan Informasi yang Rapi)**:
   - Teks tabel/daftar `12px–13px`, tinggi baris rapat (`32px–36px`), `letter-spacing: -0.01em`, sehingga pengguna melihat lebih banyak data dalam satu layar tanpa banyak *scroll*.
2. **Borders, Not Heavy Shadows (Garis Tepi Halus, Bukan Bayangan Tebal)**:
   - Gunakan `1px solid` border halus dan perbedaan tingkat warna latar (*surface elevation*) dibanding *drop shadow* kabur yang berlebihan.
3. **One Brand Color, Everything Else Neutral (Satu Warna Aksen Utama)**:
   - Gunakan warna aksen utama (`#991b1b` / `#b91c1c`) hanya untuk tombol CTA utama dan indikator tab/baris aktif. Gunakan warna semantik (`Emerald`, `Amber`, `Red`) secara terukur untuk status/ikon, dan sisanya gunakan *neutral slate/grey*.
4. **The UI Answers First (Respons Instan di Bawah 150ms)**:
   - Feedback *hover* dalam `80ms`, transisi maksimal `150ms` (`cubic-bezier(0.22, 1, 0.36, 1)`), tanpa *bounce/overshoot* lambat.
5. **4px Grid & Tabular Alignment (Kesejajaran Presisi)**:
   - Gunakan kelipatan `4px`, ikon `16px` sejajar tengah dengan teks, label rata kiri, dan seluruh angka/nominal/NRP menggunakan `font-variant-numeric: tabular-nums` (`tabular-nums`).

---

## 5. Lima Standar Membedakan PC vs HP (`375px` Mobile Standard)

1. **Tabel menjadi Kartu di Bawah `640px` (`< 640px: Cards`)**:
   - Jangan menyembunyikan kolom status/aksi penting di balik *horizontal swipe* pada layar HP. Ubah baris tabel menjadi susunan kartu ringkas di layar `< 640px`.
2. **Angka KPI Besar Satu Baris (`white-space: nowrap`)**:
   - Gunakan `.ws96-kpi-nowrap` (`white-space: nowrap; font-variant-numeric: tabular-nums`) dan ukuran font responsif agar tanda `+` atau `Rp` tidak pernah terpotong sendirian di baris atas.
3. **Input Minimal `16px` di HP & Keyboard yang Tepat**:
   - Pada layar `< 640px`, ukuran font `<input>`, `<select>`, dan `<textarea>` wajib `16px` agar Safari iOS tidak melakukan *auto-zoom* yang merusak layout. Gunakan `inputMode="numeric"` untuk input NRP, OTP, PIN, dan nominal uang.
4. **Target Sentuh `44px` Khusus Layar Sentuh (`@media (pointer: coarse)`)**:
   - Terapkan `min-height: 44px` hanya pada perangkat layar sentuh (`pointer: coarse`) agar ramah ibu jari, sementara pada mouse PC (`pointer: fine`) tetap rapat dan padat.
5. **Safe-Area pada Bilah Bawah (`env(safe-area-inset-bottom)`)**:
   - Setiap *fixed bottom bar* atau navigasi bawah wajib memiliki `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))` dan ruang kosong di bawah konten agar baris terakhir tidak tertutup *home indicator* HP.

---

## 6. Standar Komponen UI/UX Modern

- **Sign In / Sign Up & Aktivasi**: Perpindahan tab/kartu tanpa *reload* halaman, dilengkapi *password visibility toggle*.
- **Password Form Premium**: Dilengkapi *Dynamic Strength Progress Bar* (`Lemah` -> `Sedang` -> `Kuat`) dan *5-Point Live Requirement Checklist* (`6+ Karakter`, `A-Z`, `a-z`, `0-9`, `@#$`) yang menyala hijau (`✓`) secara *real-time*.
- **Input OTP / PIN 6-Digit Premium**: Menampilkan 6 kotak digit terpisah dengan *active focus ring*, fitur *One-Tap Auto-Fill / Paste*, perubahan warna hijau *emerald* saat lengkap/valid, dan animasi *horizontal error shake* (`.ws96-error-shake`) saat kode salah.
- **Sidebar & Apple-Style Dock Navigation**: Mendukung *active state* yang jelas, *dynamic notification badge*, *accordion sub-menu*, dan *Spotlight Search* cepat.
- **Dashboard Bento Grid ("Bento Skyline")**: Mengatur ulang kartu Hero KPI, Grafik, Daftar Transaksi/Iuran, dan Agenda secara proporsional di 5 breakpoint tanpa ruang kosong mati (*zero dead space*).
- **Delete & Logout Micro-interactions**: Konfirmasi penghapusan dua langkah (mencegah salah klik) dan transisi keluar sesi yang halus.

---

## 7. Standar Keamanan Aplikasi & Protokol Server

1. **Validasi Tipe Token & Input Ketat (Mitigasi Pola `CVE-2026-114509`)**:
   - Jangan pernah mempercayai tipe input JSON dari client. Selalu pastikan `typeof token === 'string'` dan `typeof targetId === 'string'` sebelum memproses autentikasi (mencegah *type-juggling* array/object bypass).
   - Gunakan jalur autentikasi tunggal yang konsisten dan matikan *legacy route/guard* yang tidak terpakai.
2. **4 Lapis Keamanan Upload File & MIME (`src/lib/mediaSecurity.ts`)**:
   - **Lapis 1 (Inspeksi Magic Bytes Isi File)**: Periksa *binary signature* (`FF D8 FF` JPEG, `89 50 4E 47` PNG, `52 49 46 46` WebP, `25 50 44 46` PDF) dan tolak file yang menyisipkan tag eksekusi (`<?php`, `<script`, `#!/`) meskipun bernama `foto.jpg`.
   - **Lapis 2 (Nama File Acak/Hash Server)**: Jangan pernah menyimpan nama file asli kiriman user; gunakan generator terenkripsi `WS-<hash_enkripsi>-<YYYYMMDD-HHmmss>.<ext>`.
   - **Lapis 3 (Re-encoding & Isolasi Storage)**: Re-encode gambar melalui Canvas ke WebP/JPEG ringan (`<= 6–14 KB`) untuk menghancurkan *payload* tersembunyi sekaligus menghemat storage.
   - **Lapis 4 (Sajikan Terkontrol)**: Sajikan media melalui *data stream* / *controller* terverifikasi.
3. **Standar Isolasi Port Jaringan**:
   - Akses publik hanya melalui **Port 443 (HTTPS)** (otomatis *redirect* **Port 80**).
   - Aplikasi internal (**Port 3000/8080**), Database PostgreSQL (**Port 5432**), dan Redis Cache (**Port 6379**) wajib berada di jaringan privat/internal dan tidak diekspos langsung ke internet publik.
