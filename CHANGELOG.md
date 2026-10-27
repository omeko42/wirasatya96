# Riwayat Perubahan / Changelog - Wira Satya 96 (WS96) - Paguyuban Alumni Akpol 1996

> 🌐 **Daftar Isi / Sections:** [**🇮🇩 Bagian I: Bahasa Indonesia**](#-bagian-i-riwayat-perubahan--evolusi-platform-bahasa-indonesia) &nbsp;|&nbsp; [**🇬🇧 Part II: English Version**](#-part-ii-platform-changelog--release-history-english)

---

## 🇮🇩 Bagian I: Riwayat Perubahan & Evolusi Platform (Bahasa Indonesia)

Seluruh tonggak pencapaian arsitektur, rilis fitur, dan penyempurnaan rekayasa pada portal **Wira Satya 96 (WS96)** — **Paguyuban Alumni Akademi Kepolisian (Akpol) Tahun 1996 Batalyon Wira Satya** — didokumentasikan di dalam berkas ini.

### [v2.5.0] - Oktober 2026 (Rilis Enterprise UI/UX Overhaul, Anev 6 Sub-Tab, Bursa Loker & FormWizard 5 Kategori)
#### Ditambahkan (*Added*)
- **Formulir Mandiri `Data Diri` 5 Kategori dengan Simpan Parsial (`FormWizard.tsx`)**:
  - Restrukturisasi formulir pembaruan biodata menjadi 5 kategori (*1. Kedinasan & Identitas*, *2. Domisili & Keluarga Inti*, *3. Purna Tugas & Usaha*, *4. Kesehatan, Fisik & Asuransi*, *5. Aparel & Perlengkapan*) dengan indikator persentase kelengkapan (`33 kolom utama`) dan tombol **`Simpan`** parsial di setiap sub-bagian *accordion*.
  - Fitur input berulang (*repeatable cards*) **`+ Tambah Jabatan`** untuk mencatat riwayat multi-jabatan/satker serta **`+ Tambah Asuransi`** untuk mencatat daftar merek asuransi kesehatan.
  - Pilihan terstruktur **Kompi A–D** dan **Pleton 1–4** dengan status *default* `Belum Dipilih` bagi personel yang belum memperbarui formasi batalyon.
- **Dasbor `Anev & Statistik` 6 Sub-Tab, Bursa Lowongan Kerja & Keluarga Almarhum (`ExecutiveDashboard.tsx`)**:
  - Penambahan **Sub-Tab 6: Keluarga Almarhum (12 In Memoriam)** lengkap dengan informasi Istri/Ahli Waris, tombol pintas **`WA Keluarga`**, serta status kesiapan kerja/pendidikan putra-putri (*Siap Kerja* / *Pelajar*).
  - Pemisahan kategori **Usaha Pribadi Anggota** dan **Usaha Bersama Leting** pada Sub-Tab 3, terintegrasi dengan **Bursa Lowongan Kerja Putra-Putri Leting & Almarhum** beserta tombol lamar langsung.
  - Saringan interaktif kekuatan batalyon berdasarkan **Kompi A–D** dan **Pleton 1–4** pada Sub-Tab 4 (*Sebaran Wilayah & Kompi/Pleton*).
- **Lencana Verifikasi Meta (`MetaVerifiedBadge.tsx`) & 3 Persona Simulasi `AKUN CONTOH`**:
  - Lencana verifikasi bergaya Meta dengan pembeda warna wewenang (*Hitam*: Superadmin/Teknis, *Merah*: Ketua, *Emas*: Sekretaris/Bendahara) disertai *tooltip* interaktif.
  - Penambahan 3 akun simulasi komprehensif (`AKUN CONTOH_1`, `AKUN CONTOH_2`, `AKUN CONTOH_3`) sehingga total direktori mencakup **264 profil personel** (`250 Aktif`, `1 Purna Tugas`, `1 PTDH`, `12 Almarhum`).

### [v2.0.0] - Oktober 2026 (Rilis Produksi Cloud Terpadu — Tahap 4)
#### Ditambahkan (*Added*)
- **Sinkronisasi Cloud Real-Time & Penyimpanan Media Terpusat (`cloudSync.ts`)**:
  - Integrasi penuh dengan **Supabase PostgreSQL (`public.ws96_app_state`)** dan **Supabase Realtime WebSockets (`postgres_changes`)** sehingga perubahan profil, riwayat jabatan, transaksi Buku Kas, dan kiriman berita langsung tampil serentak di seluruh HP maupun komputer anggota.
  - Penyimpanan foto profil, gambar sampul, dan media kegiatan pada **Supabase Storage Bucket (`ws96-media`)** dengan *fallback* otomatis.
- **Direktori Terverifikasi 261 Personel, 38 Polda & 28 Fungsi Kepolisian (*Tour of Duty*)**:
  - Pemutakhiran basis data **261 alumni Batalyon Wira Satya 1996** (`src/data/akpol1996Alumni.ts`) lintas **Mabes Polri**, **38 Polda Jajaran**, dan **Luar Struktur** (*BNN, BIN, KPK, Kementerian/Lembaga*).
  - Pemetaan ke dalam **28 Kategori Fungsi Kepolisian** beserta rekapitulasi kategori jabatan dan fitur pintar **Rekan Satu Wilayah**.
- **Transparansi Keuangan Dua Kamar (*Dana Sosial & Dana Investasi*) & Menu Anev Pengurus**:
  - Pemisahan transparan antara **Program Solidaritas Dana Sosial** (*Santunan Anak Yatim, Besuk Rekan Sakit, Tali Asih Duka Cita, Baksos*) dan **Portofolio Dana Investasi & Buku Kas**, dilengkapi fitur unduh laporan **CSV (Excel)** sekali klik.
  - Menu **Anev & Statistik Pengurus** (*khusus Ketua, Wakil Ketua, Sekretaris/Admin, dan Bendahara*) yang mencakup 5 tab strategis: *Kesehatan, Hunian & Purna Tugas, Katalog Usaha, Sebaran Wilayah, serta Pendidikan & Pensiun*.
- **Mode Pendamping (*Ajudan / ADC*) & Keamanan Multi-Faktor (MFA)**:
  - Fitur delegasi akun **Ajudan (`WS96@<NRP_ADC>`)** untuk membantu pembaruan biodata dan jabatan pimpinan dengan penguncian otomatis dari menu keuangan (`Dana Sosial & Kas`).
  - Dukungan **WebAuthn / FIDO2 Biometric Passkey** (*Sidik Jari / Wajah*), **TOTP 2FA**, **PIN Keamanan 6-Angka**, **OTP Email**, **Kelola Gawai Terpercaya**, serta **Captcha Hybrid (PoW + SVG)**.

#### Diperbaiki & Dioptimalkan (*Fixed & Optimized*)
- **Ergonomi Tampilan Layar HP (*Mobile-First Beranda*)**:
  - Menyederhanakan kartu samping (*Atensi Kesehatan* & *Dana Sosial*) pada layar HP menjadi *header* akordeon ringkas yang baru membuka detail saat disentuh.
  - Menata urutan tampilan bawah pada menu Beranda di HP agar selalu menampilkan kartu semboyan **`#SELALUBAHAGIA`** diikuti identitas resmi **`BATALYON WIRA SATYA 1996`** di posisi paling bawah.
- **Sinkronisasi Otomatis Hak Akses Pengurus Inti**:
  - Memastikan peran kepengurusan (`KETUA`, `SEKRETARIS`, `BENDAHARA`, `ADMIN`) pada *seed* direktori selalu tersinkronisasi dengan *state* penyimpanan awan sehingga menu **Anev** dan tombol kelola **Bendahara** tampil konsisten di seluruh perangkat.

### [v1.0.0 - Tahap Historis 1–3] - Pra-2025 s/d Awal 2026
- **Tahap 1**: Buku saku cetak fisik dan rekapitulasi file Excel statis yang cepat usang saat terjadi mutasi jabatan.
- **Tahap 2**: Komunikasi mengandalkan grup WhatsApp tunggal di mana pengumuman penting pengurus dan kabar kesehatan rekan sering tertumpuk percakapan harian.
- **Tahap 3**: Prototipe awal berbasis penyimpanan peramban lokal (*single-device localStorage*) sebelum ditingkatkan menjadi arsitektur *cloud real-time* **Wira Satya 96 (WS96) v2.0**.

---

## 🇬🇧 Part II: Platform Changelog & Release History (English)

### [v2.5.0] - 2026-10 (Enterprise UI/UX Overhaul, 6-Sub-Tab Anev, Family Job Board & 5-Category FormWizard)
#### Added
- **5-Category Self-Service `Data Diri` FormWizard with Per-Section Partial Save (`FormWizard.tsx`)**: Organized profile maintenance into 5 structured categories with a 33-field completeness indicator, independent per-section `Simpan` buttons, repeatable multi-position history cards (`+ Tambah Jabatan`), repeatable health insurance lists (`+ Tambah Asuransi`), and `Kompi A–D / Pleton 1–4` selection.
- **6-Sub-Tab Executive `Anev & Statistik` Dashboard & Family Job Board (`ExecutiveDashboard.tsx`)**: Added Sub-Tab 6 (*Keluarga Almarhum / 12 In Memoriam*) with surviving spouse/guardian details and one-click `WA Keluarga` contact, separated personal vs. joint cohort businesses (*Usaha Pribadi* & *Usaha Bersama Leting*) integrated with a Family Job Board (*Bursa Lowongan Kerja Putra-Putri Leting*), and added interactive `Kompi A–D / Pleton 1–4` strength filtering.
- **Meta-Style Verification Badges (`MetaVerifiedBadge.tsx`) & 3 End-to-End Sample Personas (`AKUN CONTOH_1..3`)**: Added role-colored verification badges (*Black*: Superadmin, *Red*: Ketua, *Gold*: Sekretaris/Bendahara) and 3 comprehensive simulation accounts (`AKUN CONTOH_1`, `AKUN CONTOH_2`, `AKUN CONTOH_3`) across the 264-personnel directory.

### [v2.0.0] - 2026-10 (Current Cloud Production Release — Stage 4)
#### Added
- **Real-Time Cloud State & Media Synchronization (`cloudSync.ts`)**: Full integration with **Supabase PostgreSQL (`public.ws96_app_state`)**, **Supabase Realtime WebSockets**, and **Supabase Storage (`ws96-media`)** for instant multi-device state and photo synchronization across smartphones and desktops.
- **Verified 261-Personnel Directory, 38-Polda Mapping & 28 Polri Functions**: Comprehensive assignment directory covering Mabes Polri, 38 Regional Police Commands (*Polda*), External Agencies (*Luar Struktur*), and all 28 Police Functional Categories (*Tour of Duty*).
- **Dual-Chamber Financial Ledger & Executive Anev Dashboard**: Transparent separation of voluntary social solidarity milestones (*Dana Sosial*) and battalion investments (*Dana Investasi*), one-click CSV (Excel) export, and a 5-tab **Anev & Statistik** dashboard for board leadership.
- **Delegated Aide-de-Camp (`ADC`) Mode & Multi-Factor Security Suite**: Dedicated `WS96@<NRP_ADC>` companion login with strict financial lockout, alongside **WebAuthn Biometric Passkeys**, **TOTP 2FA**, **6-Digit Security PIN**, **Email OTP**, and **Trusted Device Revocation**.

#### Fixed & Optimized
- **Mobile-First Ergonomics & Accordion Cards**: Implemented collapsible header-only accordion cards on mobile viewports (*Atensi Kesehatan* & *Dana Sosial*) and anchored the `#SELALUBAHAGIA` motto card and `BATALYON WIRA SATYA 1996` footer at the bottom of the mobile home layout.
- **Canonical Board Role Reconciliation**: Ensured canonical executive roles (`KETUA`, `SEKRETARIS`, `BENDAHARA`, `ADMIN`) automatically reconcile across cached and cloud-persisted states so board menus (`Anev` and treasury controls) remain consistently accessible.
