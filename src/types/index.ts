export type UserRole = 'SUPERADMIN' | 'KETUA' | 'SEKRETARIAT' | 'BENDAHARA' | 'ANGGOTA';

export type UserAccountStatus = 
  | 'PENDING_VERIFIKASI'
  | 'DISETUJUI_BELUM_PASSWORD'
  | 'AKTIF'
  | 'DITOLAK';

export type MfaMethod = 'BIOMETRIC' | 'GOOGLE_AUTH' | 'TOTP' | 'EMAIL_OTP' | 'PIN';

export type StatusKedinasan = 'AKTIF' | 'PURNA_TUGAS' | 'PTDH' | 'ALMARHUM';

export interface ActiveAdcSession {
  adcNrp: string;
  adcNama: string;
  adcPangkat: string;
  adcNoHp?: string;
  pimpinanNrp: string;
  pimpinanNama: string;
  pimpinanPangkat: string;
  loginAt: string;
}

export interface PendingRegistration {
  id: string;
  nrp: string;
  nama: string;
  pangkat: string;
  satker: string;
  polda: string;
  noHp: string;
  email: string;
  secondaryEmail?: string;
  alasanDaftar?: string;
  status: UserAccountStatus;
  password?: string;
  isPasswordResetRequest?: boolean;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface AuthUser {
  id: string;
  nrp: string;
  oldNrp?: string;
  nama: string;
  pangkat: string;
  email: string;
  secondaryEmail?: string;
  noHp?: string;
  role: UserRole;
  profileId: string;
  mfaEnabled: boolean;
  mfaMethod: MfaMethod;
  fotoUrl?: string;
  coverUrl?: string;
  bio?: string;
  satker?: string;
  polda?: string;
  kodeSatker?: string;
  jabatanTerakhir?: string;
  statusKedinasan?: StatusKedinasan;
  tanggalLahir?: string;
  tempatLahir?: string;
  golonganDarah?: string;
  rhesusDarah?: 'Rh+' | 'Rh-';
  tinggiBadan?: number;
  beratBadan?: number;
  ukuranBaju?: string;
  ukuranJaket?: string;
  ukuranCelana?: string;
  ukuranSepatu?: string;
  ukuranTutupKepala?: string;
  kompi?: string;
  pleton?: string;
  status?: UserAccountStatus;
  password?: string;
  isAdcAccount?: boolean;
  adcOfNrp?: string;
  adcOfNama?: string;
  adcOfPangkat?: string;
  activeAdcSession?: ActiveAdcSession;
  updatedAt?: string;
}

export interface Anak {
  id: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  tempatLahir: string;
  tanggalLahir: string;
  status: 'PELAJAR' | 'BEKERJA' | 'BELUM BEKERJA';
  institusi?: string;
  biayaPendidikanTahunan?: '< 5.000.000' | '5.000.000 S.D. 25.000.000' | '> 25.000.000';
}

export interface RiwayatPenyakitItem {
  id: string;
  namaPenyakit: string;
  sejakKapan?: string;
  statusPenyakit?: 'TERKONTROL' | 'TERAPI_RUTIN' | 'PEMULIHAN' | 'ATENSI_KHUSUS' | 'RIWAYAT_SEMBUH';
  terapiObat?: string;
}

export interface RiwayatJabatanItem {
  id: string;
  jabatan: string;
  satker: string;
  polda: string;
  pangkatSaatMenjabat?: string;
  tmtMulai?: string;
  statusJabatan?: 'SAAT_INI' | 'SEBELUMNYA';
}

export interface AsuransiDetailItem {
  id: string;
  namaMerek: string;
  jenisAsuransi: 'JAMINAN DINAS / NEGARA' | 'ASURANSI KESEHATAN' | 'ASURANSI JIWA' | 'ASURANSI HARI TUA';
  statusKepesertaan?: 'AKTIF' | 'NON_AKTIF';
}

export interface AdcPersonel {
  id: string;
  nama: string;
  nrp?: string;
  pangkat: string;
  jabatan?: string;
  tanggalLahir?: string;
  noHp: string;
  email?: string;
  password?: string;
}

export interface TanggunganLain {
  jumlah: number;
  rincian: string;
  masaTanggungan?: '< 5 TAHUN' | '5-10 TAHUN' | '> 10 TAHUN';
  masaTanggunganTahun?: number;
  adaSakitKhusus?: boolean;
  rincianSakitKhusus?: string;
  kondisiKesehatan?: string;
}

export interface LowonganUsahaItem {
  id: string;
  posisi: string;
  tipePekerjaan?: 'FULL_TIME' | 'KONTRAK' | 'MAGANG' | 'MITRA_PENGELOLA';
  kuota?: string;
  prioritasPelamar?: 'PUTRA_PUTRI_ALMARHUM_LETING' | 'PUTRA_PUTRI_LETING' | 'KELUARGA_BESAR_UMUM';
  kualifikasi?: string;
  statusLowongan?: 'BUKA' | 'TUTUP';
}

export interface AnggotaWiraSatya {
  id: string;
  // Modul 1: Identitas & Kedinasan
  nrp: string;
  oldNrp?: string;
  namaLengkap: string;
  pangkat: string;
  jabatanTerakhir: string;
  jabatan?: string;
  riwayatJabatan?: RiwayatJabatanItem[];
  satuanKerja: string;
  satker?: string;
  kodeSatker?: string;
  statusKedinasan?: StatusKedinasan;
  statusDinas?: StatusKedinasan;
  keteranganStatus?: string;
  tipeSatker?: 'MABES' | 'POLDA' | 'POLRES/TA/BES' | 'KEMEN/LEMBAGA' | 'PURNA TUGAS' | 'POLSEK';
  satkerMabes?: string;
  subSatker?: string;
  namaPolres?: string;
  namaPolsek?: string;
  jenisAnggota?: 'ANGGOTA POLRI' | 'ALUMNI AKPOL 1996' | 'ASN / PNS POLRI' | 'PURNAWIRAWAN POLRI';
  polda: string;
  pendidikanTerakhir: string;
  tmtPangkat?: string;
  dikbangPolri?: string;
  tandaKehormatan?: string;
  agama?: string;
  sukuBangsa?: string;
  nomorKtp?: string;
  tempatLahir: string;
  tanggalLahir: string;
  usia: number;
  jenisKelamin: 'LAKI-LAKI' | 'PEREMPUAN';
  noHp: string;
  email?: string;
  secondaryEmail?: string;
  kontakAdc?: string;
  noHpAdc?: string;
  namaAdc?: string;
  nrpAdc?: string;
  pangkatAdc?: string;
  daftarAdc?: AdcPersonel[];
  fotoUrl?: string;
  coverUrl?: string;
  bio?: string;
  catatanMedis?: string;
  golonganDarah?: string;
  rhesusDarah?: 'Rh+' | 'Rh-';
  tinggiBadan?: number;
  beratBadan?: number;
  kondisiMata?: string;
  frekuensiOlahraga?: string;
  olahragaFavorit?: string;
  faskesRujukan?: string;
  alergiObatMakanan?: string;
  ukuranBaju?: string;
  ukuranJaket?: string;
  ukuranCelana?: string;
  ukuranSepatu?: string;
  ukuranTutupKepala?: string;
  catatanAparel?: string;
  kompi?: string;
  pleton?: string;
  alamatTempatTinggal: string;
  kotaDomisili?: string;
  provinsiDomisili?: string;
  statusTempatTinggal: 'MILIK PRIBADI' | 'RUMAH KELUARGA' | 'DINAS' | 'SEWA/KONTRAK';
  biayaSewaTempatTinggal?: string;
  detailSewaTempatTinggal?: string;

  // Modul 2: Data Keluarga & Tanggungan
  statusPerkawinan: 'MENIKAH' | 'BELUM MENIKAH' | 'DUDA/JANDA';
  namaIstri?: string;
  pekerjaanIstri?: string;
  tempatLahirIstri?: string;
  tanggalLahirIstri?: string;
  usiaIstri?: number;
  kontakIstri?: string;
  jumlahAnak: number;
  daftarAnak: Anak[];
  tanggunganLain?: TanggunganLain;

  // Modul 3: Persiapan Purna Tugas & Usaha
  tahunPurnaTugas: number;
  sisaTahunDinas: number;
  alamatPurnaTugas: string;
  statusRumahPurnaTugas: 'MILIK PRIBADI' | 'RUMAH KELUARGA' | 'DINAS' | 'SEWA/KONTRAK';
  detailSewaPurnaTugas?: string;
  biayaSewaTahunan?: string;
  sudahPembekalan: 'SUDAH' | 'BELUM';
  rencanaAktivitas: ('USAHA BERSAMA / YAYASAN' | 'USAHA SENDIRI' | 'BEKERJA KEMBALI' | 'BERTANI/BERKEBUN' | 'MENGURUS KELUARGA' | string)[];
  kategoriUsaha?: string;
  namaUsahaYayasan?: string;
  peranUsahaYayasan?: string;
  jenisUsaha?: string;
  lokasiUsaha?: string;
  bidangKeahlianPensiun?: string;
  statusUsaha?: 'SUDAH JALAN' | 'DALAM PERSIAPAN' | 'MASIH RENCANA';
  bukaLowonganKerja?: 'YA' | 'TIDAK';
  daftarLowonganUsaha?: LowonganUsahaItem[];
  kebutuhanPembekalan?: ('MODAL' | 'PELATIHAN' | 'PENDAMPINGAN' | 'TIDAK PERLU')[];
  sumberPenghasilanPasca: ('DANA PENSIUN' | 'USAHA' | 'INVESTASI')[];
  kecukupanDanaPensiun: 'SANGAT CUKUP' | 'CUKUP' | 'KURANG';
  kesiapanPensiun: 'SANGAT SIAP' | 'SIAP' | 'KURANG SIAP' | 'BELUM SIAP';
  perasaanPensiun: 'TENANG' | 'OPTIMIS' | 'CEMAS' | 'RAGU';
  dukunganKeluarga: 'SANGAT MENDUKUNG' | 'MENDUKUNG' | 'KURANG MENDUKUNG';

  // Modul 4: Riwayat Kesehatan
  adaPenyakitKronis: 'ADA' | 'TIDAK ADA';
  kondisiKesehatan: 'SANGAT BAIK' | 'BAIK' | 'CUKUP' | 'PERLU PERHATIAN KHUSUS' | 'SAKIT';
  daftarPenyakit?: string[];
  riwayatPenyakitDetail?: RiwayatPenyakitItem[];
  lamaMenderita?: string;
  kondisiSaatIni?: string;
  penangananPengobatan?: string;
  biayaPengobatanDitanggung?: 'DITANGGUNG BPJS/ASURANSI' | '5.000.000 S.D. 10.000.000' | 'DI ATAS 10.000.000';
  asuransiAktif: ('ASURANSI KESEHATAN' | 'ASURANSI JIWA' | 'BPJS' | 'TIDAK ADA')[];
  daftarAsuransiDetail?: AsuransiDetailItem[];
  rutinMcu: 'YA' | 'TIDAK';
  mcuTerakhir?: '< 6 BULAN' | '6-12 BULAN' | '> 1 TAHUN';
  waktuMcuTerakhir?: string;
  sejakKapanUsaha?: string;
  sejakKapanSewa?: string;
  kebutuhanPersiapanKesehatan?: string[];
  harapanLayananKesehatan?: string;
  harapanDukunganLeting?: string;
  kesehatanLainLain?: string;

  createdAt: string;
  updatedAt: string;
}

export const DAFTAR_PANGKAT_POLRI = [
  // Perwira Tinggi (PATI)
  'Jenderal Polisi',
  'Komjen Pol',
  'Irjen Pol',
  'Brigjen Pol',
  // Perwira Menengah (PAMEN)
  'Kombes Pol',
  'AKBP',
  'Kompol',
  // Perwira Pertama (PAMA)
  'AKP',
  'Iptu',
  'Ipda',
  // Bintara (Pendukung Staf / ADC / Operator)
  'Aiptu',
  'Aipda',
  'Bripka',
  'Brigpol',
  'Briptu',
  'Bripda',
  // Tamtama (ADC / Pengawal / Staf Pendukung)
  'Abrip',
  'Abriptu',
  'Abripda',
  'Bharaka',
  'Bharatu',
  'Bharada',
  // ASN / PNS Polri (ADC / Staf Kesekretariatan & Administrasi)
  'Pembina / ASN Polri',
  'Penata / ASN Polri',
  'Pengatur / ASN Polri',
  'ASN / PNS Polri',
] as const;

// Modul Kebendaharaan & Portofolio Aset Paguyuban Wira Satya 1996
export type TransactionType = 'MASUK' | 'KELUAR';

export type TransactionCategory = 
  | 'IURAN_WAJIB_BULANAN' 
  | 'SUMBANGAN_SUKARELA' 
  | 'SANTUNAN_KESEHATAN' 
  | 'SANTUNAN_DUKA_CITA' 
  | 'BANTUAN_PENDIDIKAN_ANAK' 
  | 'OPERASIONAL_PAGUYUBAN' 
  | 'KEGIATAN_REUNI_LETING'
  | 'PEMBELIAN_ASET_INVESTASI'
  | 'PENCAIRAN_ASET_INVESTASI';

export type AssetCategory =
  | 'SURAT_BERHARGA'
  | 'VALUTA_ASING'
  | 'CRYPTO'
  | 'LOGAM_MULIA_ASET';

export interface AssetPortfolioItem {
  id: string;
  kodeAset: string;
  namaAset: string;
  kategori: AssetCategory;
  satuan: string; // 'Unit/Lembar' | 'USD' | 'SGD' | 'EUR' | 'BTC' | 'ETH' | 'USDT' | 'Gram'
  jumlahUnit: number;
  nilaiPerolehanIdr: number;
  estimasiNilaiIdr: number;
  kustodianLokasi: string; // Bank / Sekuritas / Wallet / Brankas
  lokasiPenyimpanan?: string;
  nomorSeriAtauWallet?: string;
  tanggalPerolehan: string;
  keterangan?: string;
  dicatatOleh: string;
  updatedAt: string;
}

export interface KasTransaction {
  id: string;
  tanggal: string;
  jenis: TransactionType;
  kategori: TransactionCategory;
  nominal: number;
  keterangan: string;
  pihakTerkait?: string;
  nrpTerkait?: string;
  dicatatOleh: string;
  nomorReferensi: string;
  createdAt: string;
}

export interface IuranAnggota {
  id: string;
  nrp: string;
  namaLengkap: string;
  pangkat: string;
  polda: string;
  tahun: number;
  totalTagihan: number; // misal Rp 3.000.000 / tahun (250.000/bln)
  totalTerbayar: number;
  status: 'LUNAS' | 'SEBAGIAN' | 'BELUM_BAYAR';
  bulanTerbayar: number[]; // Array bulan 1-12
  terakhirBayar?: string;
}

export interface FinanceSummary {
  saldoUtama: number;
  kasSosialKesehatan: number;
  kasDukaCita: number;
  danaAbadiInvestasi: number;
  totalValuasiAset?: number;
  totalPemasukanBulanIni: number;
  totalPengeluaranBulanIni: number;
  persentaseIuranTerkumpul: number;
}

// ==============================================================
// MODUL FEED SILATURAHMI & POSTING LETING 96 (LINKEDIN STYLE)
// ==============================================================
export interface PostComment {
  id: string;
  authorName: string;
  authorPangkat: string;
  authorAvatar: string;
  authorNrp?: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  likesCount?: number;
  likedBy?: string[];
  replies?: PostComment[];
}

export interface FeedPost {
  id: string;
  authorName: string;
  authorPangkat: string;
  authorJabatan: string;
  authorSatker?: string;
  authorPolda?: string;
  authorAvatar: string;
  authorNrp?: string;
  badgeLabel?: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  likesCount: number;
  isLiked?: boolean;
  likedBy?: string[];
  repostsCount: number;
  isReposted?: boolean;
  repostedBy?: string[];
  comments: PostComment[];
  impressionsCount?: number;
  category?: 'MOTIVASI' | 'KENAIKAN_PANGKAT' | 'BAKSOS' | 'REUNI' | 'KABAR_LETING' | 'UMUM';
  pinned?: boolean;
  isPinned?: boolean;
  userReaction?: ReactionType | null;
  reactionsByNrp?: Record<string, ReactionType>;
  reactionCounts?: {
    like: number;
    celebrate: number;
    support: number;
    love: number;
    insightful: number;
    funny: number;
  };
}

export type ReactionType = 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny';

// ==============================================================
// MODUL RIWAYAT JABATAN & PENUGASAN INTERNAL LETING 96
// ==============================================================
export type FungsiPolri =
  | 'WASUM'
  | 'RENA'
  | 'OPS'
  | 'LEMDIKLAT'
  | 'RESERSE'
  | 'INTELKAM'
  | 'HARKAM'
  | 'BRIMOB'
  | 'SLOG'
  | 'SAHLI'
  | 'LANTAS'
  | 'DENSUS'
  | 'HUMAS'
  | 'PROPAM'
  | 'HUKUM'
  | 'HUBINTER'
  | 'TIK'
  | 'SDM'
  | 'TASPIDKOR'
  | 'KEU'
  | 'DOKKES'
  | 'LITBANG'
  | 'SEJARAH'
  | 'SETUM'
  | 'YANMA'
  | 'SPRIPIM'
  | 'KEWILAYAHAN'
  | 'LUAR_STRUKTUR';

export interface RiwayatJabatanLeting {
  id: string;
  perwiraNrp: string;
  namaPerwira: string;
  pangkat: string;
  avatarUrl: string;
  jabatan: string;
  satker: string;
  polda: string;
  fungsiPolri: FungsiPolri;
  tahunMulai: number;
  tahunSelesai?: number;
  isCurrent: boolean;
  statusKedinasan?: StatusKedinasan;
  uraianTugas: string;
  prestasiOperasional?: string;
  dasarTR?: string;
}

// ==============================================================
// MODUL PESAN & OBROLAN LETING 96 (MESSAGING)
// ==============================================================
export interface ChatMessage {
  id: string;
  senderNrp: string;
  senderName: string;
  senderPangkat?: string;
  senderAvatar?: string;
  receiverNrp: string;
  receiverName?: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  timestamp: string;
  createdAt: string;
  isRead: boolean;
}

// ==============================================================
// MODUL AUDIT LOG MANAJEMEN USER & VERIFIKASI
// ==============================================================
export type UserAuditAction =
  | 'HAPUS_USER'
  | 'PULIHKAN_USER'
  | 'TAMBAH_USER'
  | 'EDIT_USER'
  | 'UBAH_ROLE'
  | 'VERIFIKASI_PENDAFTAR'
  | 'LOGIN_ADC'
  | 'AKTIVITAS_ADC'
  | 'RESET_PASSWORD'
  | 'PERMINTAAN_RESET_PASSWORD';

export interface UserAuditLog {
  id: string;
  timestamp: string;
  action: UserAuditAction;
  actorName: string;
  actorNama?: string;
  actorNrp?: string;
  actorRole: UserRole | 'ADC';
  targetNrp: string;
  targetNama: string;
  targetName?: string;
  targetPangkat?: string;
  targetRole?: UserRole | 'ADC';
  reason?: string;
  details?: string;
  snapshotUser?: AuthUser;
}

