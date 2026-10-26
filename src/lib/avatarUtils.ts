import { AnggotaWiraSatya, AuthUser } from '@/types';

export const DEFAULT_AVATAR_URL = '/default-avatar.png';
export const DEFAULT_COVER_URL = '/default-cover.jpg';

/**
 * Ensures any empty or legacy dummy Unsplash avatar URL is replaced with the official Polri default avatar.
 */
export function getAvatarUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR_URL;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('images.unsplash.com')) {
    return DEFAULT_AVATAR_URL;
  }
  return trimmed;
}

/**
 * Ensures any empty or legacy dummy Unsplash cover URL is replaced with the official Polri default cover.
 */
export function getCoverUrl(primaryUrl?: string | null, secondaryUrl?: string | null): string {
  const candidates = [primaryUrl, secondaryUrl];
  for (const url of candidates) {
    if (!url || typeof url !== 'string') continue;
    const trimmed = url.trim();
    if (
      trimmed &&
      trimmed !== DEFAULT_COVER_URL &&
      !trimmed.includes('images.unsplash.com')
    ) {
      return trimmed;
    }
  }
  return DEFAULT_COVER_URL;
}

export function isCustomAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== DEFAULT_AVATAR_URL &&
    !trimmed.includes('images.unsplash.com')
  );
}

/**
 * Picks the custom (non-default) avatar URL between two sources, falling back to DEFAULT_AVATAR_URL.
 */
export function resolveAvatarUrl(
  primaryUrl?: string | null,
  secondaryUrl?: string | null
): string {
  if (isCustomAvatarUrl(primaryUrl)) return primaryUrl!.trim();
  if (isCustomAvatarUrl(secondaryUrl)) return secondaryUrl!.trim();
  return DEFAULT_AVATAR_URL;
}

const LEADING_RANK_PREFIX_REGEX =
  /^(?:jenderal\s+polisi|komjen\s+pol\.?|irjen\s+pol\.?|brigjen\s+pol\.?|kombes\s+pol\.?|akbp\.?|kompol\.?|akp\.?|iptu\.?|ipda\.?|aiptu\.?|aipda\.?|bripka\.?|brigpol\.?|brigadir\s+polisi|briptu\.?|bripda\.?|abrip\.?|abriptu\.?|abripda\.?|bharaka\.?|bharatu\.?|bharada\.?)\s+/i;

/**
 * Strips any leading Polri rank prefix (e.g. "Kombes Pol. ", "Brigjen Pol. ", "Irjen Pol. ")
 * so the Name field stores ONLY the person's Full Name & Academic Degrees.
 */
export function stripRankFromName(nama?: string | null, _pangkat?: string | null): string {
  if (!nama || typeof nama !== 'string') return '';
  let cleaned = nama.trim();
  while (LEADING_RANK_PREFIX_REGEX.test(cleaned)) {
    cleaned = cleaned.replace(LEADING_RANK_PREFIX_REGEX, '').trim();
  }
  return cleaned;
}

/**
 * Formats a member's rank and full name without duplicating the rank prefix
 * (e.g., avoids "Kombes Pol Kombes Pol. Daniel...").
 */
export function formatMemberDisplayName(
  pangkat?: string | null,
  namaLengkap?: string | null
): string {
  const cleanName = stripRankFromName((namaLengkap || '').replace(/\(.*?\)/g, '').trim());
  const cleanRank = (pangkat || '').trim();
  if (!cleanRank) return cleanName;
  if (!cleanName) return cleanRank;

  return `${cleanRank} ${cleanName}`;
}


/**
 * Strips any redundant " — <Satker>" suffix from a Jabatan string so the Jabatan field
 * only stores the organizational position title (e.g. "Lead Developer").
 */
export function cleanJabatanOnly(jabatan?: string | null): string {
  if (!jabatan || typeof jabatan !== 'string') return '';
  return jabatan.split(' — ')[0].trim();
}

/**
 * Combines a member's Jabatan Organisasi Polri and Satuan Kerja cleanly without duplicating Satker.
 */
export function formatJabatanWithSatker(
  jabatan?: string | null,
  satker?: string | null
): string {
  const cleanJab = cleanJabatanOnly(jabatan);
  const cleanSat = (satker || '').trim();
  if (!cleanJab && !cleanSat) return 'Mabes Polri';
  if (!cleanJab) return cleanSat;
  if (!cleanSat) return cleanJab;
  if (cleanJab.toLowerCase().includes(cleanSat.toLowerCase())) {
    return cleanJab;
  }
  return `${cleanJab} — ${cleanSat}`;
}

export const RETIREMENT_AGE_POLRI = 60;

const NAMA_BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Extracts a default YYYY-MM-DD birth date from a Polri 8-digit NRP (first 4 digits = YYMM) if valid.
 * E.g. 98010710 -> 1998-01-01 (if 98010710) or 74090001 -> 1974-09-01.
 */
export function deriveBirthDateFromNrp(nrp?: string | null): string {
  const digits = (nrp || '').replace(/[^0-9]/g, '');
  if (digits === '98010710') return '1998-01-01';
  if (digits.length >= 4) {
    const yy = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    if (!Number.isNaN(yy) && !Number.isNaN(mm) && mm >= 1 && mm <= 12) {
      const fullYear = yy >= 40 ? 1900 + yy : 2000 + yy;
      return `${fullYear}-${String(mm).padStart(2, '0')}-01`;
    }
  }
  return '1974-01-01';
}

export function formatTanggalIndonesia(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day) || Number.isNaN(year)) {
    return dateStr;
  }
  return `${day} ${NAMA_BULAN_ID[monthIdx]} ${year}`;
}

export interface Retirement58Calculation {
  tanggalLahir: string;
  formattedTanggalLahir: string;
  usiaTahun: number;
  usiaBulan: number;
  usiaLabel: string;
  tahunPurnaTugas: number;
  tanggalPensiun58: string;
  formattedTanggalPensiun: string;
  sisaTahunDinas: number;
  sisaBulanDinas: number;
  totalBulanSisaDinas: number;
  sisaMasaDinasLabel: string;
  sisaMasaDinasShort: string;
  isPurnaTugas: boolean;
  persentaseMasaBakti: number;
}

/**
 * Calculates exact age and retirement countdown at BUP Polri (58 Years Old) from tanggalLahir (or NRP fallback).
 */
export function calculateRetirement58(
  tanggalLahirInput?: string | null,
  nrpFallback?: string | null,
  referenceDate: Date = new Date()
): Retirement58Calculation {
  const rawDate =
    tanggalLahirInput && /^\d{4}-\d{2}-\d{2}/.test(tanggalLahirInput.trim())
      ? tanggalLahirInput.trim().slice(0, 10)
      : deriveBirthDateFromNrp(nrpFallback);

  const parts = rawDate.split('-');
  const birthYear = parseInt(parts[0], 10) || 1974;
  const birthMonth = Math.min(12, Math.max(1, parseInt(parts[1], 10) || 1));
  const birthDay = Math.min(31, Math.max(1, parseInt(parts[2], 10) || 1));

  const nowYear = referenceDate.getFullYear();
  const nowMonth = referenceDate.getMonth() + 1;
  const nowDay = referenceDate.getDate();

  let totalMonthsLived = (nowYear - birthYear) * 12 + (nowMonth - birthMonth);
  if (nowDay < birthDay) {
    totalMonthsLived -= 1;
  }
  totalMonthsLived = Math.max(0, totalMonthsLived);

  const usiaTahun = Math.floor(totalMonthsLived / 12);
  const usiaBulan = totalMonthsLived % 12;
  const usiaLabel =
    usiaBulan > 0 ? `${usiaTahun} Tahun ${usiaBulan} Bulan` : `${usiaTahun} Tahun`;

  const tahunPurnaTugas = birthYear + RETIREMENT_AGE_POLRI;
  const tanggalPensiun58 = `${tahunPurnaTugas}-${String(birthMonth).padStart(2, '0')}-${String(
    birthDay
  ).padStart(2, '0')}`;

  const totalMonthsAt58 = RETIREMENT_AGE_POLRI * 12;
  const totalBulanSisaDinas = Math.max(0, totalMonthsAt58 - totalMonthsLived);
  const isPurnaTugas = totalMonthsLived >= totalMonthsAt58;

  const sisaTahunDinas = Math.floor(totalBulanSisaDinas / 12);
  const sisaBulanDinas = totalBulanSisaDinas % 12;

  let sisaMasaDinasLabel = '';
  let sisaMasaDinasShort = '';
  if (isPurnaTugas) {
    sisaMasaDinasLabel = `Memasuki Masa Purna Tugas (Usia ≥ ${RETIREMENT_AGE_POLRI} Thn)`;
    sisaMasaDinasShort = `Purna Tugas (${RETIREMENT_AGE_POLRI} Thn)`;
  } else if (sisaTahunDinas > 0 && sisaBulanDinas > 0) {
    sisaMasaDinasLabel = `${sisaTahunDinas} Tahun ${sisaBulanDinas} Bulan Lagi`;
    sisaMasaDinasShort = `${sisaTahunDinas} Thn ${sisaBulanDinas} Bln Lagi`;
  } else if (sisaTahunDinas > 0) {
    sisaMasaDinasLabel = `${sisaTahunDinas} Tahun Lagi`;
    sisaMasaDinasShort = `${sisaTahunDinas} Thn Lagi`;
  } else {
    sisaMasaDinasLabel = `${sisaBulanDinas} Bulan Lagi`;
    sisaMasaDinasShort = `${sisaBulanDinas} Bln Lagi`;
  }

  const persentaseMasaBakti = Math.min(
    100,
    Math.max(5, Math.round((totalMonthsLived / totalMonthsAt58) * 100))
  );

  return {
    tanggalLahir: rawDate,
    formattedTanggalLahir: formatTanggalIndonesia(rawDate),
    usiaTahun,
    usiaBulan,
    usiaLabel,
    tahunPurnaTugas,
    tanggalPensiun58,
    formattedTanggalPensiun: formatTanggalIndonesia(tanggalPensiun58),
    sisaTahunDinas,
    sisaBulanDinas,
    totalBulanSisaDinas,
    sisaMasaDinasLabel,
    sisaMasaDinasShort,
    isPurnaTugas,
    persentaseMasaBakti,
  };
}

/**
 * Finds the current user's profile in the directory or constructs a valid profile object from AuthUser
 * so that "Lihat Profil" always works and preserves any custom uploaded photo/cover.
 */
export function getOrBuildUserProfile(
  currentUser: AuthUser,
  members: AnggotaWiraSatya[]
): AnggotaWiraSatya {
  const existing = members.find(
    (m) => m.nrp === currentUser.nrp || (currentUser.oldNrp && m.nrp === currentUser.oldNrp) || (m.oldNrp && m.oldNrp === currentUser.nrp)
  );
  if (existing) {
    const userTime = currentUser.updatedAt ? new Date(currentUser.updatedAt).getTime() : 0;
    const memberTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const preferUser = userTime > memberTime;
    const effectiveBirth =
      (preferUser && currentUser.tanggalLahir ? currentUser.tanggalLahir : existing.tanggalLahir) ||
      currentUser.tanggalLahir;
    const calc = calculateRetirement58(effectiveBirth, existing.nrp);
    const rawJab =
      cleanJabatanOnly(
        preferUser && currentUser.jabatanTerakhir ? currentUser.jabatanTerakhir : existing.jabatanTerakhir
      ) || existing.jabatanTerakhir;
    return {
      ...existing,
      namaLengkap:
        preferUser && currentUser.nama
          ? stripRankFromName(currentUser.nama) || currentUser.nama
          : existing.namaLengkap,
      pangkat:
        preferUser && currentUser.pangkat
          ? currentUser.pangkat
          : existing.pangkat || currentUser.pangkat,
      satuanKerja:
        preferUser && currentUser.satker
          ? currentUser.satker
          : existing.satuanKerja || currentUser.satker || 'Mabes Polri',
      polda:
        preferUser && currentUser.polda
          ? currentUser.polda
          : existing.polda || currentUser.polda || 'MABES POLRI',
      statusKedinasan:
        (preferUser && currentUser.statusKedinasan
          ? currentUser.statusKedinasan
          : existing.statusKedinasan || existing.statusDinas || currentUser.statusKedinasan) || 'AKTIF',
      statusDinas:
        (preferUser && currentUser.statusKedinasan
          ? currentUser.statusKedinasan
          : existing.statusDinas || existing.statusKedinasan || currentUser.statusKedinasan) || 'AKTIF',
      email:
        preferUser && currentUser.email
          ? currentUser.email
          : existing.email || currentUser.email,
      secondaryEmail:
        preferUser && currentUser.secondaryEmail !== undefined
          ? currentUser.secondaryEmail
          : existing.secondaryEmail ?? currentUser.secondaryEmail,
      noHp:
        preferUser && currentUser.noHp
          ? currentUser.noHp
          : existing.noHp || currentUser.noHp || '',
      bio:
        preferUser && currentUser.bio !== undefined
          ? currentUser.bio
          : existing.bio ?? currentUser.bio,
      golonganDarah: existing.golonganDarah || currentUser.golonganDarah,
      ukuranBaju: existing.ukuranBaju || currentUser.ukuranBaju,
      ukuranCelana: existing.ukuranCelana || currentUser.ukuranCelana,
      ukuranSepatu: existing.ukuranSepatu || currentUser.ukuranSepatu,
      kompi: existing.kompi || currentUser.kompi || 'KOMPI A',
      pleton: existing.pleton || currentUser.pleton || 'PLETON 1',
      tanggalLahir: calc.tanggalLahir,
      usia: calc.usiaTahun,
      tahunPurnaTugas: calc.tahunPurnaTugas,
      sisaTahunDinas: calc.sisaTahunDinas,
      jabatanTerakhir: rawJab === 'Lead Developer' ? 'Staf' : rawJab,
      fotoUrl: resolveAvatarUrl(existing.fotoUrl, currentUser.fotoUrl),
      coverUrl:
        existing.coverUrl && existing.coverUrl !== DEFAULT_COVER_URL
          ? existing.coverUrl
          : currentUser.coverUrl || existing.coverUrl,
    };
  }

  const calc = calculateRetirement58(undefined, currentUser.nrp);

  return {
    id: currentUser.profileId || `ws-${currentUser.nrp}`,
    nrp: currentUser.nrp,
    namaLengkap: currentUser.nama.replace(/\(.*?\)/g, '').trim(),
    pangkat: currentUser.pangkat || 'Kombes Pol',
    jabatanTerakhir:
      currentUser.role === 'SUPERADMIN'
        ? 'Staf'
        : `Perwira ${currentUser.satker || 'Polri'}`,
    satuanKerja: currentUser.satker || 'Mabes Polri',
    tipeSatker:
      !currentUser.polda || currentUser.polda.toUpperCase().includes('MABES')
        ? 'MABES'
        : 'POLDA',
    satkerMabes: 'BARESKRIM POLRI',
    subSatker: currentUser.satker || '',
    jenisAnggota: 'ANGGOTA POLRI',
    polda: currentUser.polda || 'MABES POLRI',
    pendidikanTerakhir:
      currentUser.nrp === '98010710' || currentUser.role === 'SUPERADMIN'
        ? 'S1 Teknik Informatika'
        : 'Akpol / Perguruan Tinggi Ilmu Kepolisian',
    tempatLahir: 'Jakarta',
    tanggalLahir: calc.tanggalLahir,
    usia: calc.usiaTahun,
    jenisKelamin: 'LAKI-LAKI',
    noHp: '',
    email: currentUser.email || `${currentUser.nrp}@polri.go.id`,
    fotoUrl: resolveAvatarUrl(currentUser.fotoUrl),
    coverUrl: currentUser.coverUrl,
    alamatTempatTinggal: currentUser.polda || 'Jakarta',
    statusTempatTinggal: 'MILIK PRIBADI',
    statusPerkawinan: 'MENIKAH',
    namaIstri: '',
    jumlahAnak: 0,
    daftarAnak: [],
    tahunPurnaTugas: calc.tahunPurnaTugas,
    sisaTahunDinas: calc.sisaTahunDinas,
    alamatPurnaTugas: currentUser.polda || 'Jakarta',
    statusRumahPurnaTugas: 'MILIK PRIBADI',
    sudahPembekalan: 'SUDAH',
    rencanaAktivitas: ['USAHA SENDIRI'],
    sumberPenghasilanPasca: ['DANA PENSIUN'],
    kecukupanDanaPensiun: 'CUKUP',
    kesiapanPensiun: 'SIAP',
    perasaanPensiun: 'OPTIMIS',
    dukunganKeluarga: 'SANGAT MENDUKUNG',
    adaPenyakitKronis: 'TIDAK ADA',
    kondisiKesehatan: 'SANGAT BAIK',
    daftarPenyakit: [],
    asuransiAktif: ['BPJS'],
    rutinMcu: 'YA',
    mcuTerakhir: '< 6 BULAN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const PANGKAT_ORDER_LIST = [
  'jenderal polisi',
  'komjen pol',
  'irjen pol',
  'brigjen pol',
  'kombes pol',
  'akbp',
  'kompol',
  'akp',
  'iptu',
  'ipda',
  'aiptu',
  'aipda',
  'bripka',
  'brigpol',
  'briptu',
  'bripda',
  'abrip',
  'abriptu',
  'abripda',
  'bharaka',
  'bharatu',
  'bharada',
  'pembina / asn polri',
  'penata / asn polri',
  'pengatur / asn polri',
  'asn / pns polri',
];

/**
 * Returns numeric rank order (0 = Jenderal Polisi -> 21 = Bharada -> 25 = ASN).
 */
export function getPangkatRankOrder(pangkat?: string | null): number {
  const norm = (pangkat || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const idx = PANGKAT_ORDER_LIST.indexOf(norm);
  if (idx >= 0) return idx;
  for (let i = 0; i < PANGKAT_ORDER_LIST.length; i++) {
    if (norm.startsWith(PANGKAT_ORDER_LIST[i])) return i;
  }
  return 99;
}

/**
 * Returns numeric Satker level order:
 * 1 = Mabes (Mabes Polri & penugasan tingkat pusat)
 * 2 = Polda
 * 3 = Polres / Polresta / Polrestabes / Polres Metro
 * 4 = Polsek
 */
export function getLevelSatkerOrder(
  satker?: string | null,
  polda?: string | null,
  tipeSatker?: string | null
): number {
  const s = `${satker || ''} ${polda || ''} ${tipeSatker || ''}`.toUpperCase();
  if (s.includes('POLSEK')) return 4;
  if (
    s.includes('POLRES') ||
    s.includes('POLRESTA') ||
    s.includes('POLRESTABES') ||
    tipeSatker === 'POLRES/TA/BES'
  ) {
    return 3;
  }
  const p = (polda || '').toUpperCase().trim();
  if (
    p === 'MABES POLRI' ||
    p === 'MABES' ||
    p === 'KEMEN/LEMBAGA' ||
    tipeSatker === 'MABES' ||
    (tipeSatker === 'KEMEN/LEMBAGA' && !p.startsWith('POLDA '))
  ) {
    return 1;
  }
  return 2; // Polda
}

/**
 * Returns numeric Role rank order:
 * 1 = SUPERADMIN -> 2 = KETUA -> 3 = SEKRETARIAT -> 4 = BENDAHARA -> 5 = ANGGOTA
 */
export function getRoleRankOrder(role?: string | null): number {
  switch ((role || '').toUpperCase()) {
    case 'SUPERADMIN':
      return 1;
    case 'KETUA':
      return 2;
    case 'SEKRETARIAT':
      return 3;
    case 'BENDAHARA':
      return 4;
    case 'ANGGOTA':
    default:
      return 5;
  }
}

/**
 * Detects whether a member/officer is AKTIF, PURNA_TUGAS, PTDH, or ALMARHUM from explicit status or jabatan text.
 */
export function detectStatusKedinasan(
  explicitStatus?: 'AKTIF' | 'PURNA_TUGAS' | 'PTDH' | 'ALMARHUM' | string | null,
  jabatan?: string | null,
  jenisAnggota?: string | null
): 'AKTIF' | 'PURNA_TUGAS' | 'PTDH' | 'ALMARHUM' {
  if (
    explicitStatus === 'ALMARHUM' ||
    explicitStatus === 'PURNA_TUGAS' ||
    explicitStatus === 'PTDH' ||
    explicitStatus === 'AKTIF'
  ) {
    return explicitStatus;
  }
  const j = (jabatan || '').toLowerCase();
  if (j.includes('almarhum') || j.includes('wafat') || j.includes('gugur')) {
    return 'ALMARHUM';
  }
  if (j.includes('ptdh') || j.includes('pemberhentian tidak dengan hormat')) {
    return 'PTDH';
  }
  if (
    j.includes('purna bhakti') ||
    j.includes('purna tugas') ||
    j.includes('pensiun') ||
    jenisAnggota === 'PURNAWIRAWAN POLRI'
  ) {
    return 'PURNA_TUGAS';
  }
  return 'AKTIF';
}

/**
 * Returns numeric Status Kedinasan order (Aktif -> Purna Tugas -> PTDH -> Almarhum):
 * 1 = AKTIF
 * 2 = PURNA_TUGAS
 * 3 = PTDH
 * 4 = ALMARHUM
 */
export function getStatusKedinasanOrder(status?: string | null): number {
  switch ((status || '').toUpperCase()) {
    case 'PURNA_TUGAS':
      return 2;
    case 'PTDH':
      return 3;
    case 'ALMARHUM':
      return 4;
    case 'AKTIF':
    default:
      return 1;
  }
}

/**
 * Strips "Almarhum (Eks ...)" or "Purna Bhakti Polri (Eks ...)" wrappers so the pure Jabatan title is returned.
 */
export function extractCleanJabatanTitle(jabatan?: string | null): string {
  if (!jabatan) return '';
  let s = jabatan.trim();
  const eksMatch = s.match(/^(?:almarhum|purna\s+bhakti(?:\s+polri)?|purna\s+tugas)\s*\((?:wafat[^/]*\/\s*)?(?:eks\s+)?([^)]+)\)/i);
  if (eksMatch && eksMatch[1]) {
    return eksMatch[1].trim();
  }
  s = s.replace(/^almarhum\s*[-–•:]\s*/i, '').trim();
  return s;
}

/**
 * Reads active ADC session metadata from localStorage (`ws96_adc_session`) if currently logged in as an ADC.
 */
export function getActiveAdcSessionFromStorage(): {
  adcNrp: string;
  adcNama: string;
  adcPangkat: string;
  adcNoHp?: string;
  pimpinanNrp: string;
  pimpinanNama: string;
  pimpinanPangkat: string;
  loginAt: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ws96_adc_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.adcNrp && parsed.pimpinanNrp) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Appends an ADC login or data-modification entry to `ws96_audit_logs_v1` AND sends it to `/api/users`
 * so every ADC login or data change is permanently recorded under the ADC's own NRP & Identity.
 */
export function recordAdcActivityToAuditLog(params: {
  action: 'LOGIN_ADC' | 'AKTIVITAS_ADC';
  details: string;
  adcSession?: {
    adcNrp: string;
    adcNama: string;
    adcPangkat: string;
    pimpinanNrp: string;
    pimpinanNama: string;
    pimpinanPangkat: string;
  } | null;
}): void {
  if (typeof window === 'undefined') return;
  const session = params.adcSession || getActiveAdcSessionFromStorage();
  if (!session) return;

  const entry = {
    id: `audit-adc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action: params.action,
    actorNrp: session.adcNrp,
    actorName: `${session.adcPangkat} ${session.adcNama} (ADC)`,
    actorNama: `${session.adcPangkat} ${session.adcNama} (ADC)`,
    actorRole: 'ADC' as const,
    targetNrp: session.pimpinanNrp,
    targetNama: session.pimpinanNama,
    targetName: session.pimpinanNama,
    targetPangkat: session.pimpinanPangkat,
    targetRole: 'ANGGOTA' as const,
    reason: params.details,
    details: `[ADC NRP ${session.adcNrp} • ${session.adcPangkat} ${session.adcNama}] ${params.details}`,
  };

  try {
    const raw = localStorage.getItem('ws96_audit_logs_v1');
    const existing = raw ? JSON.parse(raw) : [];
    const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, 300);
    localStorage.setItem('ws96_audit_logs_v1', JSON.stringify(next));
  } catch {
    // ignore
  }

  fetch('/api/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'RECORD_AUDIT_LOG',
      auditEntry: entry,
    }),
  }).catch(() => {});
}

/**
 * Returns true if the given NRP or role belongs to a behind-the-scenes Superadmin account
 * (e.g. NRP 98010710 / role SUPERADMIN). Superadmin accounts can log in, post on the feed,
 * comment, and administer the platform, but are NEVER counted as Akpol 1996 alumni in
 * directories, statistics, recaps (Hunian, Kesehatan, Usaha, Wilayah), or iuran lists.
 */
export function isSuperadminAccount(nrp?: string | null, role?: string | null): boolean {
  const cleanNrp = (nrp || '').trim();
  const cleanRole = (role || '').trim().toUpperCase();
  if (cleanNrp === '98010710' || cleanRole === 'SUPERADMIN') {
    return true;
  }
  if (typeof window !== 'undefined' && cleanNrp) {
    try {
      const roleMapRaw = localStorage.getItem('ws96_role_map');
      if (roleMapRaw) {
        const parsed = JSON.parse(roleMapRaw);
        if (parsed && parsed[cleanNrp] === 'SUPERADMIN') {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}


