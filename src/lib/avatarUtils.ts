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
 * Strips any redundant " — <Satker>" or trailing duplicate "(<Satker>)" suffix from a Jabatan string
 * so the Jabatan field only stores the organizational position title.
 */
export function cleanJabatanOnly(jabatan?: string | null): string {
  if (!jabatan || typeof jabatan !== 'string') return '';
  let base = jabatan.split(' — ')[0].trim();
  const parenMatch = base.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const mainPart = parenMatch[1].trim();
    const insideParen = parenMatch[2].trim();
    if (
      insideParen &&
      mainPart.toLowerCase().includes(insideParen.toLowerCase())
    ) {
      base = mainPart;
    }
  }
  return base;
}

/**
 * Combines a member's Jabatan Organisasi Polri and Satuan Kerja cleanly without duplicating Satker.
 */
export function formatJabatanWithSatker(
  jabatan?: string | null,
  satker?: string | null
): string {
  const cleanJab = cleanJabatanOnly(jabatan);
  const cleanSat = (satker || '').split(' / ')[0].trim();
  if (!cleanJab && !cleanSat) return 'Mabes Polri';
  if (!cleanJab) return cleanSat;
  if (!cleanSat) return cleanJab;
  const jabLower = cleanJab.toLowerCase();
  const satLower = cleanSat.toLowerCase();
  if (jabLower.includes(satLower)) {
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
  const trimmed = dateStr.trim();
  const fullMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (fullMatch) {
    const year = parseInt(fullMatch[1], 10);
    const monthIdx = parseInt(fullMatch[2], 10) - 1;
    const day = parseInt(fullMatch[3], 10);
    if (monthIdx >= 0 && monthIdx <= 11 && !Number.isNaN(day) && !Number.isNaN(year)) {
      return `${day} ${NAMA_BULAN_ID[monthIdx]} ${year}`;
    }
  }
  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const monthIdx = parseInt(ymMatch[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx <= 11 && !Number.isNaN(year)) {
      return `${NAMA_BULAN_ID[monthIdx]} ${year}`;
    }
  }
  return trimmed;
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
 * Supports full date (YYYY-MM-DD), month-year (YYYY-MM or "Mei 1974"), or year-only (YYYY).
 */
export function calculateRetirement58(
  tanggalLahirInput?: string | null,
  nrpFallback?: string | null,
  referenceDate: Date = new Date()
): Retirement58Calculation {
  let rawDate = deriveBirthDateFromNrp(nrpFallback);
  if (tanggalLahirInput && tanggalLahirInput.trim()) {
    const t = tanggalLahirInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      rawDate = t.slice(0, 10);
    } else if (/^\d{4}-\d{2}$/.test(t)) {
      rawDate = `${t}-01`;
    } else if (/^\d{4}$/.test(t)) {
      rawDate = `${t}-01-01`;
    } else {
      const yearMatch = t.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        const yr = yearMatch[1];
        const lower = t.toLowerCase();
        const mIdx = NAMA_BULAN_ID.findIndex((b) => lower.includes(b.toLowerCase()));
        const mm = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '01';
        rawDate = `${yr}-${mm}-01`;
      }
    }
  }

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
  let existing = members.find(
    (m) => m.nrp === currentUser.nrp || (currentUser.oldNrp && m.nrp === currentUser.oldNrp) || (m.oldNrp && m.oldNrp === currentUser.nrp)
  );
  if (!existing && typeof window !== 'undefined') {
    try {
      const rawOv = localStorage.getItem('ws96_member_overrides_v1');
      if (rawOv) {
        const parsedOv = JSON.parse(rawOv) || {};
        existing =
          parsedOv[currentUser.nrp] ||
          (currentUser.oldNrp ? parsedOv[currentUser.oldNrp] : undefined) ||
          parsedOv['98010710'];
        if (existing && existing.nrp !== currentUser.nrp && existing.oldNrp !== currentUser.nrp && currentUser.role !== 'SUPERADMIN') {
          existing = undefined;
        }
      }
    } catch {
      // ignore
    }
  }
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
 * Returns true if the given NRP, role, or record metadata belongs to a behind-the-scenes
 * Superadmin account (e.g. NRP 98010710 / Eko Agung / role SUPERADMIN).
 * Superadmin accounts can log in, post on the feed, comment, and administer the platform,
 * but are NEVER counted or detected as active users/alumni in directories, Menu User,
 * statistics, recaps (Hunian, Kesehatan, Usaha, Wilayah), Tour of Duty, or iuran lists.
 */
export function isSuperadminAccount(
  nrp?: string | null,
  role?: string | null,
  extra?: {
    oldNrp?: string | null;
    id?: string | null;
    profileId?: string | null;
    nama?: string | null;
  }
): boolean {
  const cleanNrp = (nrp || '').trim();
  const cleanRole = (role || '').trim().toUpperCase();
  const cleanOldNrp = (extra?.oldNrp || '').trim();
  const cleanId = (extra?.id || '').trim();
  const cleanProfileId = (extra?.profileId || '').trim();
  const cleanNama = (extra?.nama || '').trim().toLowerCase();

  if (
    cleanNrp === '98010710' ||
    cleanRole === 'SUPERADMIN' ||
    cleanOldNrp === '98010710' ||
    cleanId === 'ws-98010710' ||
    cleanId === 'u-98010710' ||
    cleanId === 'reg-98010710' ||
    cleanProfileId === 'ws-98010710' ||
    cleanNama.includes('eko agung')
  ) {
    return true;
  }

  if (typeof window !== 'undefined' && cleanNrp) {
    try {
      const roleMapRaw = localStorage.getItem('ws96_role_map');
      if (roleMapRaw) {
        const parsed = JSON.parse(roleMapRaw);
        if (
          parsed &&
          (parsed[cleanNrp] === 'SUPERADMIN' || (cleanOldNrp && parsed[cleanOldNrp] === 'SUPERADMIN'))
        ) {
          return true;
        }
      }
      const rawAuth = localStorage.getItem('ws96_auth_user');
      if (rawAuth) {
        const authObj = JSON.parse(rawAuth);
        if (
          authObj &&
          (authObj.role === 'SUPERADMIN' || authObj.nrp === '98010710' || authObj.oldNrp === '98010710') &&
          (authObj.nrp === cleanNrp || authObj.oldNrp === cleanNrp)
        ) {
          return true;
        }
      }
      const rawImp = localStorage.getItem('ws96_impersonator_user');
      if (rawImp) {
        const impObj = JSON.parse(rawImp);
        if (
          impObj &&
          (impObj.role === 'SUPERADMIN' || impObj.nrp === '98010710' || impObj.oldNrp === '98010710') &&
          (impObj.nrp === cleanNrp || impObj.oldNrp === cleanNrp)
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function isSuperadminObject(obj?: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  const nrp = typeof rec.nrp === 'string' ? rec.nrp : typeof rec.perwiraNrp === 'string' ? rec.perwiraNrp : undefined;
  const role = typeof rec.role === 'string' ? rec.role : undefined;
  const oldNrp = typeof rec.oldNrp === 'string' ? rec.oldNrp : undefined;
  const id = typeof rec.id === 'string' ? rec.id : undefined;
  const profileId = typeof rec.profileId === 'string' ? rec.profileId : undefined;
  const nama =
    typeof rec.namaLengkap === 'string'
      ? rec.namaLengkap
      : typeof rec.nama === 'string'
      ? rec.nama
      : typeof rec.name === 'string'
      ? rec.name
      : typeof rec.namaPerwira === 'string'
      ? rec.namaPerwira
      : undefined;
  return isSuperadminAccount(nrp, role, { oldNrp, id, profileId, nama });
}

const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/**
 * Converts raw ISO timestamps (`2026-10-26T07:40:00.000Z`) or `YYYY-MM-DD` strings
 * into natural, human-friendly Indonesian text (`Baru saja`, `25 menit lalu`, `Kemarin, 14.20`, `15 Okt 2026`).
 */
export function formatHumanTimestamp(raw?: string | null): string {
  if (!raw) return 'Baru saja';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Baru saja';

  // Pure HH:mm time string (e.g. "08:15")
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(':', '.')} WIB`;
  }

  // Date-only string YYYY-MM-DD (e.g. "2026-10-15")
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIdx = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const monthName = INDONESIAN_MONTHS_SHORT[monthIdx] || dateOnlyMatch[2];
    return `${day} ${monthName} ${year}`;
  }

  // Only parse if it looks like an ISO timestamp or date string
  if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed;
  }

  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) {
    return trimmed;
  }

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - dt.getTime()) / 1000);

  if (diffSec >= 0 && diffSec < 60) {
    return 'Baru saja';
  }
  if (diffSec >= 60 && diffSec < 3600) {
    return `${Math.floor(diffSec / 60)} menit lalu`;
  }
  if (diffSec >= 3600 && diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)} jam lalu`;
  }

  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');

  if (diffSec >= 86400 && diffSec < 172800) {
    return `Kemarin, ${hh}.${mm}`;
  }
  if (diffSec >= 172800 && diffSec < 7 * 86400) {
    return `${Math.floor(diffSec / 86400)} hari lalu`;
  }

  const day = dt.getDate();
  const monthName = INDONESIAN_MONTHS_SHORT[dt.getMonth()] || '';
  const year = dt.getFullYear();

  if (year === now.getFullYear()) {
    return `${day} ${monthName}, ${hh}.${mm}`;
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Formats an array of upper-case / technical chronic disease strings into natural human Indonesian.
 * Example:
 *   ['PENYAKIT JANTUNG (Sejak Mei 2023)', 'HIPERTENSI (TEKANAN DARAH TINGGI) (Sejak 2021)']
 *   -> includeSince=false: 'Penyakit Jantung & Hipertensi'
 *   -> includeSince=true:  'Penyakit Jantung (sejak Mei 2023), Hipertensi (sejak 2021)'
 */
export function formatHumanDiseaseList(
  rawList?: string[] | null,
  options?: { includeSince?: boolean; maxItems?: number }
): string {
  if (!Array.isArray(rawList) || rawList.length === 0) return '';
  const includeSince = Boolean(options?.includeSince);
  const maxItems = options?.maxItems || rawList.length;

  const formatted = rawList
    .map((item) => {
      const str = String(item || '').trim();
      if (!str || str === 'TIDAK ADA') return '';

      const sinceMatch = str.match(/\(\s*sejak\s+([^)]+)\)/i);
      const sinceVal = sinceMatch ? sinceMatch[1].trim() : '';

      // Strip all parenthetical notes so double parentheses like "(TEKANAN DARAH TINGGI) (Sejak 2021)" are removed
      const baseRaw = str.replace(/\([^)]*\)/g, '').trim();
      if (!baseRaw) return '';

      const baseTitle = baseRaw
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bGerd\b/g, 'GERD')
        .replace(/\bHnp\b/g, 'HNP');

      if (includeSince && sinceVal) {
        return `${baseTitle} (sejak ${sinceVal})`;
      }
      return baseTitle;
    })
    .filter(Boolean)
    .slice(0, maxItems);

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2 && !includeSince) {
    return `${formatted[0]} & ${formatted[1]}`;
  }
  return formatted.join(', ');
}

/**
 * Formats blood type and rhesus cleanly as e.g. "O+", "A+", "B-", "AB+".
 */
export function formatBloodTypeWithRhesus(
  golonganDarah?: string | null,
  rhesusDarah?: string | null
): string {
  const gol = (golonganDarah || 'O').replace(/[^A-Za-z]/g, '').toUpperCase() || 'O';
  const rhesusRaw = (rhesusDarah || '').toUpperCase();
  const sign = rhesusRaw.includes('NEGATIF') || rhesusRaw.includes('-') ? '-' : '+';
  return `${gol}${sign}`;
}

/**
 * Combines Satker and Polda without duplicating when Satker already contains Polda or both are Mabes Polri.
 */
export function formatSatkerWithPolda(
  satker?: string | null,
  polda?: string | null
): string {
  const cleanSat = (satker || '').split(' / ')[0].trim();
  const cleanPol = (polda || '').trim();
  if (!cleanSat && !cleanPol) return 'Mabes Polri';
  if (!cleanSat) return cleanPol;
  if (!cleanPol) return cleanSat;
  if (cleanSat.toLowerCase().includes(cleanPol.toLowerCase())) {
    return cleanSat;
  }
  if (cleanPol.toLowerCase().includes(cleanSat.toLowerCase())) {
    return cleanSat;
  }
  return `${cleanSat} (${cleanPol})`;
}

const HUMAN_ENUM_MAP: Record<string, string> = {
  // Kesehatan
  'SANGAT BAIK': 'Sangat Baik',
  'BAIK': 'Sehat & Bugar',
  'CUKUP BAIK': 'Cukup Baik',
  'PERLU PERHATIAN KHUSUS': 'Perlu Perhatian Khusus',
  'PERLU_PERHATIAN_KHUSUS': 'Perlu Perhatian Khusus',
  'SAKIT': 'Dalam Perawatan / Pemulihan',
  'ADA': 'Ada Riwayat',
  'TIDAK ADA': 'Tidak Ada',
  'TIDAK_ADA': 'Tidak Ada',
  'TERKONTROL': 'Terkontrol Stabil',
  'TERAPI_RUTIN': 'Rawat Jalan / Obat Rutin',
  'TERAPI RUTIN': 'Rawat Jalan / Obat Rutin',
  'PEMULIHAN': 'Masa Pemulihan',
  'ATENSI_KHUSUS': 'Perlu Atensi Khusus',
  'ATENSI KHUSUS': 'Perlu Atensi Khusus',
  'RIWAYAT_SEMBUH': 'Riwayat Lama (Sembuh)',
  'RIWAYAT SEMBUH': 'Riwayat Lama (Sembuh)',
  '< 6 BULAN': 'Kurang dari 6 Bulan Lalu',
  '6-12 BULAN': '6 – 12 Bulan Lalu',
  '> 1 TAHUN': 'Lebih dari 1 Tahun Lalu',
  'BELUM PERNAH': 'Belum Pernah',
  'DITANGGUNG BPJS/ASURANSI': 'Ditanggung BPJS / Asuransi',
  'BIAYA PRIBADI': 'Biaya Mandiri',
  'CAMPURAN': 'BPJS & Biaya Mandiri',
  // Hunian & Keluarga
  'MILIK PRIBADI': 'Milik Pribadi',
  'MILIK_PRIBADI': 'Milik Pribadi',
  'RUMAH_PRIBADI_LUNAS': 'Rumah Pribadi (Lunas)',
  'RUMAH_PRIBADI_KPR': 'Rumah Pribadi (KPR)',
  'RUMAH KELUARGA': 'Rumah Keluarga',
  'RUMAH_KELUARGA': 'Rumah Keluarga',
  'DINAS': 'Rumah Dinas Polri',
  'SEWA/KONTRAK': 'Sewa / Kontrak',
  'SEWA_KONTRAK': 'Sewa / Kontrak',
  'MENIKAH': 'Menikah',
  'BELUM MENIKAH': 'Belum Menikah',
  'BELUM_MENIKAH': 'Belum Menikah',
  'DUDA/JANDA': 'Duda / Janda',
  'DUDA_JANDA': 'Duda / Janda',
  'PELAJAR': 'Pelajar / Mahasiswa',
  'BEKERJA': 'Sudah Bekerja',
  'BELUM BEKERJA': 'Siap Kerja / Mencari Pekerjaan',
  'BELUM_BEKERJA': 'Siap Kerja / Mencari Pekerjaan',
  'TNI_POLRI': 'TNI / Polri',
  'PNS_ASN': 'PNS / ASN',
  'S1_SARJANA': 'S1 (Sarjana)',
  'S2_MAGISTER': 'S2 (Magister)',
  'S3_DOKTOR': 'S3 (Doktor)',
  '< 5.000.000': '< Rp 5 Juta / Tahun',
  '5.000.000 S.D. 25.000.000': 'Rp 5 – 25 Juta / Tahun',
  '25.000.000 S.D. 50.000.000': 'Rp 25 – 50 Juta / Tahun',
  '> 25.000.000': '> Rp 25 Juta / Tahun',
  '> 50.000.000': '> Rp 50 Juta / Tahun',
  // Purna Tugas & Usaha
  'SUDAH JALAN': 'Sudah Berjalan Aktif',
  'SUDAH_JALAN': 'Sudah Berjalan Aktif',
  'DALAM PERSIAPAN': 'Dalam Persiapan',
  'PERSIAPAN': 'Dalam Persiapan',
  'MASIH RENCANA': 'Tahap Perencanaan',
  'BARU IDE': 'Tahap Perencanaan',
  'USAHA BERSAMA LETING': 'Usaha Bersama Leting',
  'USAHA BERSAMA / YAYASAN': 'Usaha Bersama / Yayasan',
  'YAYASAN / SOSIAL LETING': 'Yayasan & Sosial Leting',
  'KOPERASI / INVESTASI BERSAMA': 'Koperasi & Investasi Bersama',
  'USAHA PRIBADI / MANDIRI': 'Usaha Pribadi / Mandiri',
  'USAHA SENDIRI': 'Usaha Mandiri',
  'PROFESIONAL / KONSULTAN': 'Profesional / Konsultan',
  'SOSIAL / KEAGAMAAN': 'Kegiatan Sosial & Keagamaan',
  'ISTIRAHAT / KELUARGA': 'Menikmati Masa Purna bersama Keluarga',
  'DANA PENSIUN': 'Dana Pensiun Polri',
  'USAHA': 'Hasil Usaha',
  'INVESTASI': 'Investasi & Dividen',
  'SANGAT SIAP': 'Sangat Siap',
  'SIAP': 'Siap',
  'CUKUP SIAP': 'Cukup Siap',
  'BELUM SIAP': 'Perlu Persiapan',
  'OPTIMIS': 'Optimis',
  'TENANG': 'Tenang & Mantap',
  'BIASASAJA': 'Biasa Saja',
  'BIASA SAJA': 'Biasa Saja',
  'KHAWATIR': 'Perlu Pendampingan',
  'SANGAT CUKUP': 'Sangat Cukup',
  'CUKUP': 'Cukup',
  'KURANG': 'Perlu Penguatan Finansial',
  'SANGAT MENDUKUNG': 'Sangat Mendukung',
  'MENDUKUNG': 'Mendukung',
  // Lowongan
  'FULL_TIME': 'Penuh Waktu (Full-Time)',
  'FULL-TIME': 'Penuh Waktu (Full-Time)',
  'PART_TIME': 'Paruh Waktu (Part-Time)',
  'PART-TIME': 'Paruh Waktu (Part-Time)',
  'MAGANG': 'Magang / Internship',
  'MITRA_PENGELOLA': 'Mitra Pengelola',
  'MITRA-PENGELOLA': 'Mitra Pengelola',
  'PUTRA_PUTRI_ALMARHUM_LETING': 'Prioritas Putra-Putri Almarhum Leting',
  'PUTRA_PUTRI_LETING': 'Putra-Putri Leting WS96',
  'KELUARGA_BESAR_WS96': 'Keluarga Besar WS96',
  // Role & Kedinasan
  'SUPERADMIN': 'Administrator Utama',
  'KETUA': 'Ketua Angkatan',
  'SEKRETARIAT': 'Sekretaris',
  'SEKRETARIS': 'Sekretaris',
  'BENDAHARA': 'Bendahara',
  'ANGGOTA': 'Anggota',
  'AKTIF': 'Aktif Berdinas',
  'PURNA_TUGAS': 'Purna Tugas',
  'ALMARHUM': 'In Memoriam (Almarhum)',
  'PTDH': 'PTDH',
  'MABES': 'Mabes Polri',
  'POLDA': 'Kewilayahan (Polda)',
  'KEMEN/LEMBAGA': 'Penugasan Luar Struktur',
};

/**
 * Converts raw upper-case or underscore enum codes into clean, human-friendly Indonesian labels.
 */
export function formatHumanEnum(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (HUMAN_ENUM_MAP[upper]) {
    return HUMAN_ENUM_MAP[upper];
  }
  // If comma-separated list of enums
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((part) => formatHumanEnum(part.trim()))
      .filter(Boolean)
      .join(', ');
  }
  // Fallback: if all-caps or contains underscores, convert to Title Case
  if (trimmed === upper || trimmed.includes('_')) {
    return trimmed
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bPolri\b/gi, 'Polri')
      .replace(/\bBpjs\b/gi, 'BPJS')
      .replace(/\bMcu\b/gi, 'MCU')
      .replace(/\bWs96\b/gi, 'WS96')
      .replace(/\bPtdh\b/gi, 'PTDH');
  }
  return trimmed;
}

/**
 * Dynamically synchronizes Milestone Dana Sosial campaigns with active KasTransactions
 * so that `collectedAmount`, `disbursedAmount`, and `donorCount` never show Rp 0 (0%)
 * when there are real or simulation transactions in the ledger.
 */
export function syncCampaignsWithTransactions<
  TCampaign extends {
    id: string;
    title: string;
    category?: string;
    targetAmount: number;
    collectedAmount: number;
    disbursedAmount?: number;
    donorCount: number;
  },
  TTrx extends {
    id: string;
    jenis: string;
    kategori: string;
    nominal: number;
    keterangan?: string;
    nrpTerkait?: string;
    pihakTerkait?: string;
  }
>(campaigns: TCampaign[], transactions: TTrx[]): TCampaign[] {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return campaigns;
  if (!Array.isArray(transactions) || transactions.length === 0) return campaigns;

  let totalMasuk = 0;
  const masukDonors = new Set<string>();
  const keluarByCampaignId: Record<string, { amount: number; count: number }> = {};

  for (const trx of transactions) {
    const nom = Number(trx.nominal || 0);
    if (!nom || nom <= 0) continue;
    const kat = String(trx.kategori || '').toUpperCase();
    const ket = String(trx.keterangan || '').toLowerCase();

    if (trx.jenis === 'MASUK') {
      totalMasuk += nom;
      if (trx.nrpTerkait || trx.pihakTerkait) {
        masukDonors.add(String(trx.nrpTerkait || trx.pihakTerkait));
      } else {
        masukDonors.add(trx.id);
      }
    } else if (trx.jenis === 'KELUAR') {
      let targetCmpId = '';
      if (
        kat.includes('YATIM') ||
        kat.includes('PENDIDIKAN') ||
        ket.includes('yatim') ||
        ket.includes('pendidikan') ||
        ket.includes('putra-putri') ||
        ket.includes('almarhum')
      ) {
        targetCmpId = 'cmp-anak-yatim';
      } else if (
        kat.includes('SAKIT') ||
        kat.includes('KESEHATAN') ||
        ket.includes('sakit') ||
        ket.includes('medis') ||
        ket.includes('kesehatan') ||
        ket.includes('rawat')
      ) {
        targetCmpId = 'cmp-anggota-sakit';
      } else if (
        kat.includes('DUKA') ||
        kat.includes('MD') ||
        ket.includes('duka') ||
        ket.includes('wafat') ||
        ket.includes('meninggal')
      ) {
        targetCmpId = 'cmp-anggota-md';
      } else {
        targetCmpId = 'cmp-event-baksos';
      }
      const prev = keluarByCampaignId[targetCmpId] || { amount: 0, count: 0 };
      keluarByCampaignId[targetCmpId] = {
        amount: prev.amount + nom,
        count: prev.count + 1,
      };
    }
  }

  // Distribute totalMasuk across campaigns so each campaign covers at least its disbursedAmount
  // and any remaining surplus is allocated proportionally across primary social milestones.
  const totalDisbursedMapped = Object.values(keluarByCampaignId).reduce(
    (acc, v) => acc + v.amount,
    0
  );
  const surplusMasuk = Math.max(0, totalMasuk - totalDisbursedMapped);
  const weights: Record<string, number> = {
    'cmp-anak-yatim': 0.4,
    'cmp-anggota-sakit': 0.35,
    'cmp-anggota-md': 0.25,
    'cmp-event-baksos': 0.0,
  };

  return campaigns.map((cmp) => {
    const keluarInfo = keluarByCampaignId[cmp.id] || { amount: 0, count: 0 };
    const weight = weights[cmp.id] ?? 1 / Math.max(1, campaigns.length);
    const derivedCollected = Math.round(keluarInfo.amount + surplusMasuk * weight);
    const derivedDisbursed = keluarInfo.amount;
    const derivedDonors = Math.max(
      cmp.donorCount || 0,
      derivedCollected > 0 ? Math.max(1, masukDonors.size) : 0
    );

    return {
      ...cmp,
      collectedAmount: Math.max(cmp.collectedAmount || 0, derivedCollected),
      disbursedAmount: Math.max(cmp.disbursedAmount || 0, derivedDisbursed),
      donorCount: derivedDonors,
    };
  });
}




