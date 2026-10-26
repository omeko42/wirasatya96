import fs from 'fs';
import path from 'path';
import { 
  AnggotaWiraSatya, 
  AuthUser, 
  KasTransaction, 
  IuranAnggota, 
  FinanceSummary, 
  ChatMessage, 
  PendingRegistration,
  UserAccountStatus,
  MfaMethod,
  AssetPortfolioItem,
  FeedPost,
  PostComment,
  ReactionType,
  UserAuditLog,
  UserRole,
  StatusKedinasan,
} from '@/types';
import { INITIAL_MEMBERS } from '@/data/mockData';
import { PRESET_USERS } from '@/data/mockUsers';
import { INITIAL_TRANSACTIONS, INITIAL_IURAN_LIST, INITIAL_FINANCE_SUMMARY, INITIAL_ASSETS } from '@/data/mockFinance';
import { INITIAL_FEED_POSTS } from '@/data/mockPosts';
import {
  AKPOL_1996_IURAN,
  AKPOL_1996_MEMBERS,
  AKPOL_1996_REGISTRATIONS,
  AKPOL_1996_USERS,
  NON_AKTIF_IURAN_NRPS,
  PURGED_NON_1996_BASE_NAMES,
} from '@/data/akpol1996Alumni';
import { calculateRetirement58, stripRankFromName } from '@/lib/avatarUtils';
import {
  SupabaseRecordRow,
  fetchAllSupabaseRecords,
  upsertSupabaseBatch,
  deleteSupabaseRecord,
  checkSupabaseTableStatus,
} from '@/lib/supabaseCloud';

export interface FinanceCategoryOption {
  code: string;
  label: string;
}

export type CampaignCategory =
  | 'ANAK_YATIM'
  | 'ANGGOTA_SAKIT'
  | 'ANGGOTA_MD'
  | 'EVENT_BAKSOS'
  | 'LAINNYA';

export interface FundraisingCampaign {
  id: string;
  title: string;
  category: CampaignCategory;
  targetAmount: number;
  collectedAmount: number;
  disbursedAmount: number;
  donorCount: number;
  description: string;
  status: 'AKTIF' | 'TERCAPAI' | 'SELESAI';
  deadline?: string;
  updatedAt: string;
}

export interface InvestmentParticipant {
  id: string;
  nrp: string;
  namaLengkap: string;
  pangkat: string;
  polda: string;
  namaProgram: string;
  nominalPenyertaan: number;
  estimasiNilaiSaatIni: number;
  tanggalBergabung: string;
  statusPartisipasi: 'AKTIF' | 'CAIR';
  catatan: string;
}

export interface FinanceConfig {
  iuranWajibPerBulan: number; // legacy compatibility
  tahunBuku: number; // default 2026
  subKategoriMasuk: FinanceCategoryOption[];
  subKategoriKeluar: FinanceCategoryOption[];
  campaigns?: FundraisingCampaign[];
  investmentParticipants?: InvestmentParticipant[];
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_CAMPAIGNS: FundraisingCampaign[] = [
  {
    id: 'cmp-anak-yatim',
    title: 'Santunan & Beasiswa Anak Yatim Keluarga Besar WS96',
    category: 'ANAK_YATIM',
    targetAmount: 100000000,
    collectedAmount: 0,
    disbursedAmount: 0,
    donorCount: 0,
    description:
      'Program dana sosial sukarela untuk santunan berkala dan dukungan biaya pendidikan putra-putri rekan leting Wira Satya 96 yang telah mendahului (Almarhum).',
    status: 'AKTIF',
    deadline: '2026-12-31',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cmp-anggota-sakit',
    title: 'Dana Solidaritas Besuk & Bantuan Medis Anggota Sakit',
    category: 'ANGGOTA_SAKIT',
    targetAmount: 75000000,
    collectedAmount: 0,
    disbursedAmount: 0,
    donorCount: 0,
    description:
      'Gotong royong dana sosial untuk besuk, pendampingan rawat inap, dan tali asih pemulihan medis rekan-rekan Batalyon Wira Satya 96 yang sedang sakit.',
    status: 'AKTIF',
    deadline: '2026-12-31',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cmp-anggota-md',
    title: 'Dana Duka & Tali Asih Keluarga Besar WS96',
    category: 'ANGGOTA_MD',
    targetAmount: 100000000,
    collectedAmount: 0,
    disbursedAmount: 0,
    donorCount: 0,
    description:
      'Dana duka kehormatan untuk tali asih, karangan bunga, dan santunan keluarga rekan Wira Satya 96 yang berpulang.',
    status: 'AKTIF',
    deadline: '2026-12-31',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cmp-event-baksos',
    title: 'Milestone Baksos & Kegiatan Silaturahmi Leting WS96',
    category: 'EVENT_BAKSOS',
    targetAmount: 150000000,
    collectedAmount: 0,
    disbursedAmount: 0,
    donorCount: 0,
    description:
      'Penggalangan dana sukarela (milestone event) untuk kegiatan Bakti Sosial, Reuni, dan acara kebersamaan Batalyon Wira Satya 96.',
    status: 'AKTIF',
    deadline: '2026-12-31',
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  iuranWajibPerBulan: 0,
  tahunBuku: 2026,
  subKategoriMasuk: [
    { code: 'DANA_SOSIAL_YATIM', label: 'Donasi Sosial: Santunan Anak Yatim' },
    { code: 'DANA_SOSIAL_SAKIT', label: 'Donasi Sosial: Bantuan Anggota Sakit' },
    { code: 'DANA_SOSIAL_MD', label: 'Donasi Sosial: Dana Duka' },
    { code: 'DONASI_MILESTONE_EVENT', label: 'Penggalangan Dana Event / Milestone Baksos' },
    { code: 'SUMBANGAN_SUKARELA', label: 'Kas Sukarela Leting' },
    { code: 'DANA_INVESTASI_ANGGOTA', label: 'Penyertaan Dana Investasi' },
    { code: 'PENCAIRAN_ASET_INVESTASI', label: 'Bagi Hasil / Pencairan Investasi' },
    { code: 'PEMASUKAN_LAINNYA', label: 'Penerimaan Kas Lainnya' },
  ],
  subKategoriKeluar: [
    { code: 'BANTUAN_PENDIDIKAN_ANAK', label: 'Penyaluran Santunan Anak Yatim & Pendidikan' },
    { code: 'SANTUNAN_KESEHATAN', label: 'Penyaluran Bantuan Anggota Sakit / Medis' },
    { code: 'SANTUNAN_DUKA_CITA', label: 'Penyaluran Dana Duka' },
    { code: 'KEGIATAN_REUNI_LETING', label: 'Penyaluran Dana Event / Baksos / Reuni' },
    { code: 'PEMBELIAN_ASET_INVESTASI', label: 'Penempatan Dana Investasi & Pembelian Aset' },
    { code: 'OPERASIONAL_PAGUYUBAN', label: 'Pengeluaran Operasional Paguyuban' },
    { code: 'PENGELUARAN_LAINNYA', label: 'Pengeluaran Kas Lainnya' },
  ],
  campaigns: DEFAULT_CAMPAIGNS,
  investmentParticipants: [],
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistem Default Kebendaharaan WS96',
};

// Global server memory + local disk database (.data/local_db.json)
export interface LocalDatabaseSchema {
  members: AnggotaWiraSatya[];
  users: AuthUser[];
  transactions: KasTransaction[];
  assets: AssetPortfolioItem[];
  iuranList: IuranAnggota[];
  financeSummary: FinanceSummary;
  financeConfig: FinanceConfig;
  activeSession: AuthUser | null;
  messages: ChatMessage[];
  registrations: PendingRegistration[];
  posts: FeedPost[];
  deletedNrps?: string[];
  auditLogs?: string[] | UserAuditLog[];
}

type GlobalStore = Omit<LocalDatabaseSchema, 'auditLogs'> & {
  auditLogs?: UserAuditLog[];
};

const INITIAL_MESSAGES: ChatMessage[] = [];

const INITIAL_REGISTRATIONS: PendingRegistration[] = [
  {
    id: 'reg-98010710',
    nrp: '98010710',
    nama: 'Eko Agung',
    pangkat: 'Briptu',
    satker: 'Bareskrim Polri',
    polda: 'MABES POLRI',
    noHp: '081200000000',
    email: '98010710@polri.go.id',
    secondaryEmail: 'superadmin@example.com',
    alasanDaftar: 'Personel Bareskrim Polri (S1 Teknik Informatika) — Lead Developer & Superadmin Sistem Informasi Portal Wira Satya 96.',
    password: 'WS96@98010710',
    status: 'AKTIF',
    createdAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'Sistem Otentikasi Bareskrim Polri (Dev Lead)',
  },
  ...AKPOL_1996_REGISTRATIONS,
];

const PURGED_DUMMY_NRPS = new Set(['980107102', '980107103', '980107104', '980107105', '980107106']);

const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'local_db.json');
const TMP_DB_PATH = '/tmp/ws96_local_db.json';

function getReadableDbPath(): string {
  if (process.env.VERCEL && fs.existsSync(TMP_DB_PATH)) {
    return TMP_DB_PATH;
  }
  return LOCAL_DB_PATH;
}

function getWritableDbPath(): string {
  if (process.env.VERCEL) {
    return TMP_DB_PATH;
  }
  return LOCAL_DB_PATH;
}

function cleanSatkerRoleSuffix(satker?: string, _nrp?: string): string {
  let cleaned = (satker || '').trim();
  if (
    cleaned.includes(' / Ketua') ||
    cleaned.includes(' / Sekretaris') ||
    cleaned.includes(' / Sekretariat') ||
    cleaned.includes(' / Kesekretariatan') ||
    cleaned.includes(' / Bendahara')
  ) {
    cleaned = cleaned.split(' / ')[0].trim();
  }
  return cleaned || 'Mabes Polri';
}

function cleanStatusWrapperFromJabatan(jabatan?: string, fallbackJabatan?: string): string {
  const raw = (jabatan || '').trim();
  if (raw.startsWith('Almarhum (') || raw.startsWith('Purna Bhakti Polri (')) {
    if (fallbackJabatan && !fallbackJabatan.startsWith('Almarhum (') && !fallbackJabatan.startsWith('Purna Bhakti Polri (')) {
      return fallbackJabatan;
    }
    const inner = raw
      .replace(/^Almarhum\s*\((?:[^/]*\/\s*)?(?:Eks\s+)?/i, '')
      .replace(/^Purna Bhakti Polri\s*\((?:Eks\s+)?/i, '')
      .replace(/\)$/, '')
      .trim();
    if (inner === 'Dirreskrimsus Polda Jabar') return 'Dirreskrimsus Polda Jawa Barat';
    return inner || fallbackJabatan || raw;
  }
  return raw || fallbackJabatan || '';
}

function resolveBestFotoUrl(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.trim() && c.trim() !== '/default-avatar.png') {
      return c.trim();
    }
  }
  for (const c of candidates) {
    if (c && c.trim()) {
      return c.trim();
    }
  }
  return '/default-avatar.png';
}

function migrateOfficialEmail(nrp: string, currentEmail?: string): string {
  const cleanNrp = (nrp || '').trim();
  if (cleanNrp === '98010710') {
    return '98010710@polri.go.id';
  }
  if (!currentEmail || !currentEmail.trim()) {
    return `${cleanNrp}@polri.go.id`;
  }
  const trimmed = currentEmail.trim();
  if (
    trimmed.toLowerCase().endsWith('@wirasatya96.id') ||
    trimmed.toLowerCase().endsWith('@wirasatya96.polri.go.id')
  ) {
    if (/^eko\d*@wirasatya96(\.polri\.go)?\.id$/i.test(trimmed) && cleanNrp) {
      return `${cleanNrp}@polri.go.id`;
    }
    return trimmed.replace(/@wirasatya96(\.polri\.go)?\.id$/i, '@polri.go.id');
  }
  return trimmed;
}

export function readDb(): GlobalStore {
  const defaultStore: GlobalStore = {
    members: [...INITIAL_MEMBERS],
    users: [...PRESET_USERS],
    transactions: [...INITIAL_TRANSACTIONS],
    assets: [...INITIAL_ASSETS],
    iuranList: [...INITIAL_IURAN_LIST],
    financeSummary: { ...INITIAL_FINANCE_SUMMARY },
    financeConfig: { ...DEFAULT_FINANCE_CONFIG },
    activeSession: null,
    messages: [...INITIAL_MESSAGES],
    registrations: [...INITIAL_REGISTRATIONS],
    posts: [...INITIAL_FEED_POSTS],
    deletedNrps: [],
    auditLogs: [],
  };

  try {
    const dbPathToRead = getReadableDbPath();
    if (fs.existsSync(dbPathToRead)) {
      const raw = fs.readFileSync(dbPathToRead, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<GlobalStore> & { iuran?: IuranAnggota[] };
      const deletedSet = new Set<string>(
        Array.isArray(parsed.deletedNrps) ? parsed.deletedNrps.map((n) => String(n).trim()).filter(Boolean) : []
      );
      const isDeletedItem = (nrp?: string, oldNrp?: string) =>
        Boolean(
          (nrp && (deletedSet.has(nrp.trim()) || PURGED_DUMMY_NRPS.has(nrp.trim()))) ||
            (oldNrp && (deletedSet.has(oldNrp.trim()) || PURGED_DUMMY_NRPS.has(oldNrp.trim())))
        );
      const isPurgedNon1996 = (rawName?: string) => {
        const bn = (stripRankFromName(rawName || '') || rawName || '').split(',')[0].trim().toLowerCase();
        return Boolean(bn && PURGED_NON_1996_BASE_NAMES.has(bn));
      };

      const loadedFinanceConfig: FinanceConfig = {
        ...DEFAULT_FINANCE_CONFIG,
        ...(parsed.financeConfig || {}),
        iuranWajibPerBulan:
          Number(parsed.financeConfig?.iuranWajibPerBulan) || DEFAULT_FINANCE_CONFIG.iuranWajibPerBulan,
        tahunBuku: Number(parsed.financeConfig?.tahunBuku) || DEFAULT_FINANCE_CONFIG.tahunBuku,
        subKategoriMasuk:
          Array.isArray(parsed.financeConfig?.subKategoriMasuk) && parsed.financeConfig!.subKategoriMasuk.length > 0
            ? parsed.financeConfig!.subKategoriMasuk
            : [...DEFAULT_FINANCE_CONFIG.subKategoriMasuk],
        subKategoriKeluar:
          Array.isArray(parsed.financeConfig?.subKategoriKeluar) && parsed.financeConfig!.subKategoriKeluar.length > 0
            ? parsed.financeConfig!.subKategoriKeluar
            : [...DEFAULT_FINANCE_CONFIG.subKategoriKeluar],
      };

      const rawMembersSource =
        Array.isArray(parsed.members) && parsed.members.length >= 10 ? parsed.members : defaultStore.members;
      const loadedMembers = rawMembersSource.filter(
        (m) => !isDeletedItem(m.nrp, m.oldNrp) && !isPurgedNon1996(m.namaLengkap)
      );

      const rawUsersSource =
        Array.isArray(parsed.users) && parsed.users.length >= 10 ? parsed.users : defaultStore.users;
      const loadedUsers = rawUsersSource.filter(
        (u) => !isDeletedItem(u.nrp, u.oldNrp) && !isPurgedNon1996(u.nama)
      );

      const rawIuranSource = Array.isArray(parsed.iuranList)
        ? parsed.iuranList
        : Array.isArray(parsed.iuran)
        ? parsed.iuran
        : [];
      const loadedIuran = (rawIuranSource.length >= 10 ? rawIuranSource : defaultStore.iuranList).filter(
        (i) =>
          !isDeletedItem(i.nrp) &&
          !isPurgedNon1996(i.namaLengkap) &&
          i.nrp !== '98010710' &&
          !PURGED_DUMMY_NRPS.has(i.nrp)
      );
      const rawRegsSource =
        Array.isArray(parsed.registrations) && parsed.registrations.length >= 10
          ? parsed.registrations
          : defaultStore.registrations;
      const loadedRegs = rawRegsSource.filter(
        (r) => !isDeletedItem(r.nrp) && !isPurgedNon1996(r.nama)
      );

      // Build reference lookup for all 275 AKPOL 1996 alumni (by nrp, oldNrp, id, and stripped base name)
      const akpolRefMap = new Map<string, AuthUser>();
      AKPOL_1996_USERS.forEach((u) => {
        akpolRefMap.set(u.nrp, u);
        if (u.oldNrp) akpolRefMap.set(u.oldNrp, u);
        if (u.id) akpolRefMap.set(u.id, u);
        const baseName = stripRankFromName(u.nama).split(',')[0].trim().toLowerCase();
        if (baseName) akpolRefMap.set(`name:${baseName}`, u);
      });

      const akpolMemberRefMap = new Map<string, AnggotaWiraSatya>();
      AKPOL_1996_MEMBERS.forEach((m) => {
        akpolMemberRefMap.set(m.nrp, m);
        if (m.oldNrp) akpolMemberRefMap.set(m.oldNrp, m);
        if (m.id) akpolMemberRefMap.set(m.id, m);
        const baseName = stripRankFromName(m.namaLengkap).split(',')[0].trim().toLowerCase();
        if (baseName) akpolMemberRefMap.set(`name:${baseName}`, m);
      });

      const annualTagihan = (loadedFinanceConfig.iuranWajibPerBulan || 250000) * 12;

      const getBasePersonName = (raw?: string) =>
        (stripRankFromName(raw || '') || raw || '')
          .split(',')[0]
          .trim()
          .toLowerCase();

      loadedUsers.forEach((u) => {
        u.nama = stripRankFromName(u.nama) || u.nama;
        const uBaseName = getBasePersonName(u.nama);
        const baseNameKey = `name:${uBaseName}`;
        const byNameRef = uBaseName ? akpolRefMap.get(baseNameKey) : undefined;
        const byNrpOrIdRef =
          akpolRefMap.get(u.nrp) ||
          (u.oldNrp ? akpolRefMap.get(u.oldNrp) : undefined) ||
          (u.id ? akpolRefMap.get(u.id) : undefined);

        // Match by person baseName first so a custom NRP or stale oldNrp never overwrites another officer
        const ref =
          byNameRef ||
          (byNrpOrIdRef && (!uBaseName || getBasePersonName(byNrpOrIdRef.nama) === uBaseName)
            ? byNrpOrIdRef
            : undefined);

        if (ref) {
          // Heal id/oldNrp if this person's canonical alumni slot shifted
          if (!u.isAdcAccount && ref.id) {
            u.id = ref.id;
            u.profileId = ref.profileId || ref.id.replace(/^u-/, 'ws-');
          }
          if ((/^74090\d{3}$/.test(u.nrp) || u.id === 'u-74090217' || u.id === 'u-74090226' || u.id === 'u-74090237') && ref.nrp !== u.nrp) {
            u.oldNrp = ref.oldNrp || u.oldNrp || u.nrp;
            u.nrp = ref.nrp;
          } else if (ref.oldNrp) {
            u.oldNrp = ref.oldNrp;
          }
          u.nama = stripRankFromName(ref.nama) || u.nama;
          u.pangkat = u.pangkat || ref.pangkat;
          u.satker = u.satker || ref.satker;
          u.polda = u.polda || ref.polda;
          if (ref.jabatanTerakhir) {
            u.jabatanTerakhir = cleanStatusWrapperFromJabatan(
              u.id === 'u-74090217' || u.id === 'u-74090226' || u.id === 'u-74090237' ? ref.jabatanTerakhir : (u.jabatanTerakhir || ref.jabatanTerakhir),
              ref.jabatanTerakhir
            );
          }
          if (ref.statusKedinasan && ref.statusKedinasan !== 'AKTIF') {
            u.statusKedinasan = ref.statusKedinasan;
          } else {
            u.statusKedinasan = u.statusKedinasan || ref.statusKedinasan || 'AKTIF';
          }
          if (ref.tanggalLahir && !u.tanggalLahir) u.tanggalLahir = ref.tanggalLahir;
          if (ref.tempatLahir && !u.tempatLahir) u.tempatLahir = ref.tempatLahir;
        } else {
          u.jabatanTerakhir = cleanStatusWrapperFromJabatan(u.jabatanTerakhir);
          u.statusKedinasan = u.statusKedinasan || 'AKTIF';
        }

        u.email = migrateOfficialEmail(u.nrp, u.email);
        u.satker = cleanSatkerRoleSuffix(u.satker, u.nrp);
        u.status = 'AKTIF';
        if (!u.password || u.password === 'WiraSatya96!') {
          u.password = `WS96@${u.nrp}`;
        }
        if (u.nrp === '98010710') {
          if (!u.nama || u.nama === 'Eko Agung') u.nama = 'Eko Agung';
          u.pangkat = u.pangkat || 'Briptu';
          if (!u.satker || u.satker.includes('Tim IT Developer')) u.satker = 'Bareskrim Polri';
          u.polda = u.polda || 'MABES POLRI';
          u.email = '98010710@polri.go.id';
          u.secondaryEmail = u.secondaryEmail || 'superadmin@example.com';
          u.status = 'AKTIF';
          if (!u.bio) {
            u.bio =
              'Personel Bareskrim Polri (S1 Teknik Informatika) yang bertugas sebagai Lead Developer & Superadmin Sistem Informasi Portal Wira Satya 96.';
          }
        }
      });

      // Deduplicate loadedUsers by nrp and baseName (collapsing any duplicate records such as Hadi Wicaksono)
      const dedupedLoadedUsers: AuthUser[] = [];
      const seenLoadedUserNrps = new Set<string>();
      const seenLoadedUserNames = new Map<string, number>();
      for (const u of loadedUsers) {
        const cleanNrp = (u.nrp || '').trim();
        if (!cleanNrp) continue;
        const bName = getBasePersonName(u.nama);
        if (!u.isAdcAccount && bName && seenLoadedUserNames.has(bName)) {
          const existingIdx = seenLoadedUserNames.get(bName)!;
          const prev = dedupedLoadedUsers[existingIdx];
          // Prefer non-ANGGOTA role and non-dummy NRP when merging duplicates
          dedupedLoadedUsers[existingIdx] = {
            ...prev,
            ...u,
            id: prev.id,
            profileId: prev.profileId,
            oldNrp: prev.oldNrp || u.oldNrp,
            nrp: !/^74090\d{3}$/.test(u.nrp) ? u.nrp : prev.nrp,
            role: u.role && u.role !== 'ANGGOTA' ? u.role : prev.role,
            satker: u.satker && u.satker !== 'Polri' ? u.satker : prev.satker,
            polda: u.polda || prev.polda,
            jabatanTerakhir: u.jabatanTerakhir || prev.jabatanTerakhir,
            fotoUrl: resolveBestFotoUrl(prev.fotoUrl, u.fotoUrl),
          };
          seenLoadedUserNrps.add(dedupedLoadedUsers[existingIdx].nrp);
          continue;
        }
        if (seenLoadedUserNrps.has(cleanNrp)) continue;
        const newIdx = dedupedLoadedUsers.length;
        dedupedLoadedUsers.push(u);
        seenLoadedUserNrps.add(cleanNrp);
        if (!u.isAdcAccount && bName) seenLoadedUserNames.set(bName, newIdx);
      }
      loadedUsers.length = 0;
      loadedUsers.push(...dedupedLoadedUsers);

      // Ensure any officer in AKPOL_1996_USERS not yet in loadedUsers (and not deleted) is automatically added
      const existingUserKeys = new Set<string>();
      loadedUsers.forEach((u) => {
        existingUserKeys.add(u.nrp);
        if (u.oldNrp) existingUserKeys.add(u.oldNrp);
        if (u.id) existingUserKeys.add(u.id);
        const bn = getBasePersonName(u.nama);
        if (bn) existingUserKeys.add(`name:${bn}`);
      });
      AKPOL_1996_USERS.forEach((au) => {
        if (isDeletedItem(au.nrp, au.oldNrp)) return;
        const bn = getBasePersonName(au.nama);
        if (
          !existingUserKeys.has(au.nrp) &&
          !(bn && existingUserKeys.has(`name:${bn}`))
        ) {
          loadedUsers.push({
            ...au,
            password: au.password || `WS96@${au.nrp}`,
            status: 'AKTIF',
            statusKedinasan: au.statusKedinasan || 'AKTIF',
          });
          existingUserKeys.add(au.nrp);
          if (au.oldNrp) existingUserKeys.add(au.oldNrp);
          if (au.id) existingUserKeys.add(au.id);
          if (bn) existingUserKeys.add(`name:${bn}`);
        }
      });

      const userByNrpMap = new Map(loadedUsers.map((u) => [u.nrp, u]));

      loadedMembers.forEach((m) => {
        m.namaLengkap = stripRankFromName(m.namaLengkap) || m.namaLengkap;
        const mBaseName = getBasePersonName(m.namaLengkap);
        const baseNameKey = `name:${mBaseName}`;
        const byNameMemberRef = mBaseName ? akpolMemberRefMap.get(baseNameKey) : undefined;
        const byNrpOrIdMemberRef =
          akpolMemberRefMap.get(m.nrp) ||
          (m.oldNrp ? akpolMemberRefMap.get(m.oldNrp) : undefined) ||
          (m.id ? akpolMemberRefMap.get(m.id) : undefined);

        const memberRef =
          byNameMemberRef ||
          (byNrpOrIdMemberRef && (!mBaseName || getBasePersonName(byNrpOrIdMemberRef.namaLengkap) === mBaseName)
            ? byNrpOrIdMemberRef
            : undefined);

        if (memberRef) {
          if (memberRef.id) {
            m.id = memberRef.id;
          }
          if ((/^74090\d{3}$/.test(m.nrp) || m.id === 'ws-74090217' || m.id === 'ws-74090226' || m.id === 'ws-74090237') && memberRef.nrp !== m.nrp) {
            m.oldNrp = memberRef.oldNrp || m.oldNrp || m.nrp;
            m.nrp = memberRef.nrp;
          } else if (memberRef.oldNrp) {
            m.oldNrp = memberRef.oldNrp;
          }
          m.namaLengkap = stripRankFromName(memberRef.namaLengkap) || m.namaLengkap;
          m.pangkat = m.pangkat || memberRef.pangkat;
          m.jabatanTerakhir = cleanStatusWrapperFromJabatan(
            m.jabatanTerakhir || memberRef.jabatanTerakhir,
            memberRef.jabatanTerakhir
          );
          if (memberRef.statusKedinasan && memberRef.statusKedinasan !== 'AKTIF') {
            m.statusKedinasan = memberRef.statusKedinasan;
            m.statusDinas = memberRef.statusKedinasan;
          } else {
            const resolvedStatus: StatusKedinasan =
              m.statusKedinasan || m.statusDinas || memberRef.statusKedinasan || 'AKTIF';
            m.statusKedinasan = resolvedStatus;
            m.statusDinas = resolvedStatus;
          }
          m.satuanKerja = m.satuanKerja || memberRef.satuanKerja;
          m.polda = m.polda || memberRef.polda;
          if (memberRef.tipeSatker && !m.tipeSatker) m.tipeSatker = memberRef.tipeSatker;
          if (memberRef.tempatLahir && memberRef.tempatLahir !== 'Jakarta' && (!m.tempatLahir || m.tempatLahir === 'Jakarta')) {
            m.tempatLahir = memberRef.tempatLahir;
          }
          if (memberRef.tanggalLahir && (!m.tanggalLahir || m.tanggalLahir.endsWith('-09-01') || m.tanggalLahir === '1974-01-01')) {
            m.tanggalLahir = memberRef.tanggalLahir;
          }
          if (!m.golonganDarah && memberRef.golonganDarah) m.golonganDarah = memberRef.golonganDarah;
          if (!m.ukuranBaju && memberRef.ukuranBaju) m.ukuranBaju = memberRef.ukuranBaju;
          if (!m.ukuranCelana && memberRef.ukuranCelana) m.ukuranCelana = memberRef.ukuranCelana;
          if (!m.ukuranSepatu && memberRef.ukuranSepatu) m.ukuranSepatu = memberRef.ukuranSepatu;
          if (!m.kompi && memberRef.kompi) m.kompi = memberRef.kompi;
          if (!m.pleton && memberRef.pleton) m.pleton = memberRef.pleton;
          // Purge any legacy placeholder Ny. names if present
          if (m.namaIstri && m.namaIstri.startsWith('Ny. ') && m.kontakIstri?.endsWith('-1996')) {
            m.namaIstri = '';
            m.kontakIstri = '';
            m.daftarAnak = [];
            m.jumlahAnak = 0;
          }
        } else {
          m.jabatanTerakhir = cleanStatusWrapperFromJabatan(m.jabatanTerakhir);
          const resolvedStatus: StatusKedinasan = m.statusKedinasan || m.statusDinas || 'AKTIF';
          m.statusKedinasan = resolvedStatus;
          m.statusDinas = resolvedStatus;
        }

        // Always recalculate BUP 60 Tahun retirement fields from tanggalLahir
        const calcBup60 = calculateRetirement58(m.tanggalLahir, m.nrp);
        m.tanggalLahir = calcBup60.tanggalLahir;
        m.usia = calcBup60.usiaTahun;
        m.tahunPurnaTugas = calcBup60.tahunPurnaTugas;
        m.sisaTahunDinas = calcBup60.sisaTahunDinas;

        m.email = migrateOfficialEmail(m.nrp, m.email);
        m.satuanKerja = cleanSatkerRoleSuffix(m.satuanKerja, m.nrp);
        if (m.nrp === '98010710') {
          if (!m.namaLengkap || m.namaLengkap === 'Eko Agung') {
            m.namaLengkap = 'Eko Agung';
          }
          m.pangkat = m.pangkat || 'Briptu';
          if (
            !m.jabatanTerakhir ||
            m.jabatanTerakhir.includes('Superadmin / Lead Developer') ||
            m.jabatanTerakhir === 'Bareskrim Polri' ||
            m.jabatanTerakhir === 'Lead Developer — Bareskrim Polri' ||
            m.jabatanTerakhir === 'Lead Developer'
          ) {
            m.jabatanTerakhir = 'Staf';
          }
          m.satuanKerja = m.satuanKerja || 'Bareskrim Polri';
          m.polda = m.polda || 'MABES POLRI';
          if (!m.pendidikanTerakhir || m.pendidikanTerakhir === 'S1 Teknik Informatika / Kepolisian') {
            m.pendidikanTerakhir = 'S1 Teknik Informatika';
          }
          m.email = '98010710@polri.go.id';
          m.secondaryEmail = m.secondaryEmail || 'superadmin@example.com';
          if (!m.bio) {
            m.bio =
              'Personel Bareskrim Polri (S1 Teknik Informatika) yang bertugas sebagai Lead Developer & Superadmin Sistem Informasi Portal Wira Satya 96.';
          }
        } else if (
          m.jabatanTerakhir &&
          (m.jabatanTerakhir.includes('Ketua Batalyon') ||
            m.jabatanTerakhir.includes('Sekretaris Batalyon') ||
            m.jabatanTerakhir.includes('Sekretariat Batalyon') ||
            m.jabatanTerakhir.includes('Bendahara Batalyon'))
        ) {
          m.jabatanTerakhir =
            memberRef?.jabatanTerakhir || `Perwira ${m.satuanKerja || 'Polri'}`;
        }
        const matchedUser = userByNrpMap.get(m.nrp);
        if (matchedUser) {
          const syncedFoto = resolveBestFotoUrl(m.fotoUrl, matchedUser.fotoUrl);
          m.fotoUrl = syncedFoto;
          matchedUser.fotoUrl = syncedFoto;
          const syncedCover = m.coverUrl || matchedUser.coverUrl;
          if (syncedCover) {
            m.coverUrl = syncedCover;
            matchedUser.coverUrl = syncedCover;
          }
          matchedUser.statusKedinasan = m.statusKedinasan || matchedUser.statusKedinasan || 'AKTIF';
          matchedUser.jabatanTerakhir = m.jabatanTerakhir || matchedUser.jabatanTerakhir;
        }
      });

      // Deduplicate loadedMembers by nrp and baseName
      const dedupedLoadedMembers: AnggotaWiraSatya[] = [];
      const seenLoadedMemberNrps = new Set<string>();
      const seenLoadedMemberNames = new Map<string, number>();
      for (const m of loadedMembers) {
        const cleanNrp = (m.nrp || '').trim();
        if (!cleanNrp) continue;
        const bName = getBasePersonName(m.namaLengkap);
        if (bName && seenLoadedMemberNames.has(bName)) {
          const existingIdx = seenLoadedMemberNames.get(bName)!;
          const prev = dedupedLoadedMembers[existingIdx];
          dedupedLoadedMembers[existingIdx] = {
            ...prev,
            ...m,
            id: prev.id,
            oldNrp: prev.oldNrp || m.oldNrp,
            nrp: !/^74090\d{3}$/.test(m.nrp) ? m.nrp : prev.nrp,
            satuanKerja: m.satuanKerja && m.satuanKerja !== 'Polri' ? m.satuanKerja : prev.satuanKerja,
            polda: m.polda || prev.polda,
            jabatanTerakhir: m.jabatanTerakhir || prev.jabatanTerakhir,
            fotoUrl: resolveBestFotoUrl(prev.fotoUrl, m.fotoUrl),
          };
          seenLoadedMemberNrps.add(dedupedLoadedMembers[existingIdx].nrp);
          continue;
        }
        if (seenLoadedMemberNrps.has(cleanNrp)) continue;
        const newIdx = dedupedLoadedMembers.length;
        dedupedLoadedMembers.push(m);
        seenLoadedMemberNrps.add(cleanNrp);
        if (bName) seenLoadedMemberNames.set(bName, newIdx);
      }
      loadedMembers.length = 0;
      loadedMembers.push(...dedupedLoadedMembers);

      // Ensure any officer in AKPOL_1996_MEMBERS not yet in loadedMembers (and not deleted) is automatically added
      const existingMemberKeys = new Set<string>();
      loadedMembers.forEach((m) => {
        existingMemberKeys.add(m.nrp);
        if (m.oldNrp) existingMemberKeys.add(m.oldNrp);
        if (m.id) existingMemberKeys.add(m.id);
        const bn = getBasePersonName(m.namaLengkap);
        if (bn) existingMemberKeys.add(`name:${bn}`);
      });
      AKPOL_1996_MEMBERS.forEach((am) => {
        if (isDeletedItem(am.nrp, am.oldNrp)) return;
        const bn = getBasePersonName(am.namaLengkap);
        if (
          !existingMemberKeys.has(am.nrp) &&
          !(bn && existingMemberKeys.has(`name:${bn}`))
        ) {
          loadedMembers.push({
            ...am,
            statusKedinasan: am.statusKedinasan || 'AKTIF',
            statusDinas: am.statusKedinasan || 'AKTIF',
          });
          existingMemberKeys.add(am.nrp);
          if (am.oldNrp) existingMemberKeys.add(am.oldNrp);
          if (am.id) existingMemberKeys.add(am.id);
          if (bn) existingMemberKeys.add(`name:${bn}`);
        }
      });

      loadedRegs.forEach((r) => {
        r.nama = stripRankFromName(r.nama) || r.nama;
        const baseNameKey = `name:${stripRankFromName(r.nama).split(',')[0].trim().toLowerCase()}`;
        const ref =
          akpolRefMap.get(baseNameKey) ||
          akpolRefMap.get(r.nrp);
        if (ref) {
          if (ref.id) {
            r.id = ref.id.replace(/^u-/, 'reg-');
          }
          if (/^74090\d{3}$/.test(r.nrp) && ref.nrp !== r.nrp) {
            r.nrp = ref.nrp;
          }
          r.nama = stripRankFromName(ref.nama) || r.nama;
          r.pangkat = ref.pangkat || r.pangkat;
          r.satker = ref.satker || r.satker;
          r.polda = ref.polda || r.polda;
        }
        r.email = migrateOfficialEmail(r.nrp, r.email);
        r.satker = cleanSatkerRoleSuffix(r.satker, r.nrp);
        if (r.status !== 'PENDING_VERIFIKASI' && r.status !== 'DITOLAK') {
          r.status = 'AKTIF';
          if (!r.password || r.password === 'WiraSatya96!') {
            r.password = `WS96@${r.nrp}`;
          }
        }
        if (r.nrp === '98010710') {
          if (!r.nama || r.nama === 'Eko Agung') r.nama = 'Eko Agung';
          if (!r.satker || r.satker.includes('Tim IT Developer')) r.satker = 'Bareskrim Polri';
          r.email = '98010710@polri.go.id';
          r.secondaryEmail = r.secondaryEmail || 'superadmin@example.com';
          r.status = 'AKTIF';
        }
      });

      // Ensure any officer in AKPOL_1996_REGISTRATIONS not yet in loadedRegs (and not deleted) is automatically added
      const existingRegKeys = new Set<string>();
      loadedRegs.forEach((r) => {
        existingRegKeys.add(r.nrp);
        if (r.id) existingRegKeys.add(r.id);
        const bn = stripRankFromName(r.nama).split(',')[0].trim().toLowerCase();
        if (bn) existingRegKeys.add(`name:${bn}`);
      });
      AKPOL_1996_REGISTRATIONS.forEach((ar) => {
        if (isDeletedItem(ar.nrp)) return;
        const bn = stripRankFromName(ar.nama).split(',')[0].trim().toLowerCase();
        if (
          !existingRegKeys.has(ar.nrp) &&
          !(bn && existingRegKeys.has(`name:${bn}`))
        ) {
          loadedRegs.push({
            ...ar,
            password: ar.password || `WS96@${ar.nrp}`,
            status: 'AKTIF',
          });
          existingRegKeys.add(ar.nrp);
          if (ar.id) existingRegKeys.add(ar.id);
          if (bn) existingRegKeys.add(`name:${bn}`);
        }
      });

      const exemptIuranNrps = new Set<string>(NON_AKTIF_IURAN_NRPS);
      loadedMembers.forEach((m) => {
        const st = m.statusKedinasan || m.statusDinas || 'AKTIF';
        if (st !== 'AKTIF') {
          if (m.nrp) exemptIuranNrps.add(m.nrp);
          if (m.oldNrp) exemptIuranNrps.add(m.oldNrp);
        }
      });
      loadedUsers.forEach((u) => {
        const st = u.statusKedinasan || 'AKTIF';
        if (st !== 'AKTIF' || u.isAdcAccount || u.role === 'SUPERADMIN' || u.nrp === '98010710') {
          if (u.nrp) exemptIuranNrps.add(u.nrp);
          if (u.oldNrp) exemptIuranNrps.add(u.oldNrp);
        }
      });

      loadedIuran.forEach((i) => {
        i.namaLengkap = stripRankFromName(i.namaLengkap) || i.namaLengkap;
        const baseNameKey = `name:${stripRankFromName(i.namaLengkap).split(',')[0].trim().toLowerCase()}`;
        const ref =
          akpolRefMap.get(baseNameKey) ||
          akpolRefMap.get(i.nrp);
        if (ref) {
          if (ref.id) {
            i.id = ref.id.replace(/^u-/, 'iur-');
          }
          if (/^74090\d{3}$/.test(i.nrp) && ref.nrp !== i.nrp) {
            i.nrp = ref.nrp;
          }
          i.namaLengkap = stripRankFromName(ref.nama) || i.namaLengkap;
          i.pangkat = ref.pangkat || i.pangkat;
          i.polda = ref.polda || i.polda;
        }
        i.totalTagihan = annualTagihan;
        if (i.totalTerbayar >= annualTagihan) {
          i.status = 'LUNAS';
        } else if (i.totalTerbayar > 0) {
          i.status = 'SEBAGIAN';
        } else {
          i.status = 'BELUM_BAYAR';
        }
      });

      const activeLoadedIuran = loadedIuran.filter((i) => !exemptIuranNrps.has(i.nrp));
      loadedIuran.length = 0;
      loadedIuran.push(...activeLoadedIuran);

      // Ensure any active officer in AKPOL_1996_IURAN not yet in loadedIuran (and not deleted) is automatically added
      const existingIuranKeys = new Set<string>();
      loadedIuran.forEach((i) => {
        existingIuranKeys.add(i.nrp);
        if (i.id) existingIuranKeys.add(i.id);
        const bn = stripRankFromName(i.namaLengkap).split(',')[0].trim().toLowerCase();
        if (bn) existingIuranKeys.add(`name:${bn}`);
      });
      AKPOL_1996_IURAN.forEach((ai) => {
        if (isDeletedItem(ai.nrp) || exemptIuranNrps.has(ai.nrp)) return;
        const bn = stripRankFromName(ai.namaLengkap).split(',')[0].trim().toLowerCase();
        if (
          !existingIuranKeys.has(ai.nrp) &&
          !(bn && existingIuranKeys.has(`name:${bn}`))
        ) {
          loadedIuran.push({
            ...ai,
            tahun: loadedFinanceConfig.tahunBuku || 2026,
            totalTagihan: annualTagihan,
          });
          existingIuranKeys.add(ai.nrp);
          if (ai.id) existingIuranKeys.add(ai.id);
          if (bn) existingIuranKeys.add(`name:${bn}`);
        }
      });

      const activeSession = parsed.activeSession || defaultStore.activeSession;
      if (activeSession) {
        activeSession.nama = stripRankFromName(activeSession.nama) || activeSession.nama;
        activeSession.email = migrateOfficialEmail(activeSession.nrp, activeSession.email);
        activeSession.satker = cleanSatkerRoleSuffix(activeSession.satker, activeSession.nrp);
        if (activeSession.nrp === '98010710') {
          if (!activeSession.nama || activeSession.nama === 'Eko Agung') {
            activeSession.nama = 'Eko Agung';
          }
          if (!activeSession.satker || activeSession.satker.includes('Tim IT Developer')) {
            activeSession.satker = 'Bareskrim Polri';
          }
          activeSession.email = '98010710@polri.go.id';
          activeSession.secondaryEmail = activeSession.secondaryEmail || 'superadmin@example.com';
          activeSession.status = 'AKTIF';
          if (!activeSession.bio) {
            activeSession.bio =
              'Personel Bareskrim Polri (S1 Teknik Informatika) yang bertugas sebagai Lead Developer & Superadmin Sistem Informasi Portal Wira Satya 96.';
          }
        }
        const ref = akpolRefMap.get(activeSession.nrp);
        if (ref) {
          activeSession.pangkat = ref.pangkat;
          activeSession.nama = stripRankFromName(ref.nama) || activeSession.nama;
        }
        const matchedUser = userByNrpMap.get(activeSession.nrp);
        if (matchedUser) {
          activeSession.role = matchedUser.role;
          activeSession.fotoUrl = resolveBestFotoUrl(activeSession.fotoUrl, matchedUser.fotoUrl);
          if (matchedUser.coverUrl || activeSession.coverUrl) {
            activeSession.coverUrl = activeSession.coverUrl || matchedUser.coverUrl;
          }
        }
      }

      // Clean up consecutive duplicate EDIT_USER spam logs generated by background syncs
      const rawAuditLogs: UserAuditLog[] = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [];
      const cleanedAuditLogs: UserAuditLog[] = [];
      const seenEditSignatures = new Set<string>();
      for (const log of rawAuditLogs) {
        if (!log) continue;
        if (log.action === 'EDIT_USER') {
          const sig = `${log.action}|${log.targetNrp}|${log.targetNama || ''}|${log.details || ''}`;
          if (seenEditSignatures.has(sig)) continue;
          seenEditSignatures.add(sig);
        }
        cleanedAuditLogs.push(log);
      }

      return {
        members: loadedMembers,
        users: loadedUsers,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : defaultStore.transactions,
        assets: Array.isArray(parsed.assets) ? parsed.assets : defaultStore.assets,
        iuranList: loadedIuran,
        financeSummary: parsed.financeSummary
          ? { ...defaultStore.financeSummary, ...parsed.financeSummary }
          : defaultStore.financeSummary,
        financeConfig: loadedFinanceConfig,
        activeSession,
        messages: Array.isArray(parsed.messages) ? parsed.messages : defaultStore.messages,
        registrations: loadedRegs,
        posts: Array.isArray(parsed.posts) ? parsed.posts : defaultStore.posts,
        deletedNrps: Array.from(deletedSet),
        auditLogs: cleanedAuditLogs,
      };
    }
  } catch {
    // Fallback to in-memory defaultStore
  }
  return defaultStore;
}

function loadInitialStore(): GlobalStore {
  return readDb();
}

let isInitialBoot = true;
let lastSupabaseSyncAt = 0;
// Baseline timestamp dari .data/local_db.json yang sudah terbundel agar cold-start serverless
// tidak pernah mengunduh ulang 955 baris penuh dari Supabase (hanya delta > baseline).
const BASELINE_LOCAL_DB_SYNC_ISO = '2026-10-26T05:15:00.000Z';
let lastSupabaseSyncIso: string | undefined = BASELINE_LOCAL_DB_SYNC_ISO;
const SUPABASE_SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown to prevent Supabase Egress bloat
// Default ke Mode Lokalan JSON Mandiri (.data/local_db.json & /tmp/ws96_local_db.json) agar 0 Byte Egress
// ke project Supabase lama yang sudah over-quota (118%). Set NEXT_PUBLIC_CLOUD_SYNC_AUTO=true jika pindah ke project baru.
const LOCAL_JSON_PRIMARY_MODE = process.env.NEXT_PUBLIC_CLOUD_SYNC_AUTO !== 'true';
let activeSyncPromise: Promise<{ synced: boolean; seeded?: boolean; rowCount?: number }> | null = null;
const lastCloudSnapshotMap = new Map<string, string>();
const pendingCloudPromises: Promise<unknown>[] = [];

function stripEmptyJsonFields<T>(obj: T, extraOptions?: { stripUserInlineImages?: boolean; stripAuditSnapshotMedia?: boolean }): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (
      extraOptions?.stripUserInlineImages &&
      (k === 'fotoUrl' || k === 'coverUrl') &&
      typeof v === 'string' &&
      (v.startsWith('data:image/') || v.includes('ui-avatars.com'))
    ) {
      continue;
    }
    if (extraOptions?.stripAuditSnapshotMedia && k === 'snapshotUser' && typeof v === 'object' && v !== null) {
      const snap = { ...(v as Record<string, unknown>) };
      delete snap.fotoUrl;
      delete snap.coverUrl;
      delete snap.bio;
      out[k] = snap;
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

function getCompactRegistrations(regs: PendingRegistration[]): PendingRegistration[] {
  return (regs || []).filter((r) => {
    const rec = r as unknown as Record<string, unknown>;
    const bukti = String(rec.buktiBayarUrl || '');
    const catatan = String(rec.catatanAdmin || '');
    const statusStr = String(r.status || '');
    const hasCustomBukti = Boolean(bukti && bukti !== '/bukti-dummy-verified.jpg');
    const hasCustomNote = Boolean(catatan && !catatan.includes('Otomatis Terverifikasi'));
    return (statusStr !== 'DISETUJUI' && statusStr !== 'AKTIF') || hasCustomBukti || hasCustomNote;
  });
}

function buildCloudSnapshotMap(
  store: GlobalStore
): Map<string, { collection: string; record_id: string; payload: unknown; json: string }> {
  const map = new Map<string, { collection: string; record_id: string; payload: unknown; json: string }>();
  const addEntry = (collection: string, recordId: string, payload: unknown) => {
    const cleanId = String(recordId || '').trim();
    if (!cleanId) return;
    const key = `${collection}:${cleanId}`;
    const json = JSON.stringify(payload);
    map.set(key, { collection, record_id: cleanId, payload, json });
  };

  const memberNrpsWithFoto = new Set(
    (store.members || []).filter((m) => Boolean(m.fotoUrl)).map((m) => m.nrp)
  );
  (store.members || []).forEach((m) => addEntry('members', m.nrp, stripEmptyJsonFields(m)));
  (store.users || []).forEach((u) =>
    addEntry(
      'users',
      u.nrp,
      stripEmptyJsonFields(u, { stripUserInlineImages: memberNrpsWithFoto.has(u.nrp) })
    )
  );
  (store.posts || []).forEach((p) => addEntry('posts', p.id, stripEmptyJsonFields(p)));
  (store.transactions || []).forEach((t) => addEntry('transactions', t.id, stripEmptyJsonFields(t)));
  (store.iuranList || []).forEach((i) => addEntry('iuran', i.nrp, stripEmptyJsonFields(i)));
  (store.messages || []).forEach((msg) => addEntry('messages', msg.id, stripEmptyJsonFields(msg)));
  (store.assets || []).forEach((ast) => addEntry('assets', ast.id, stripEmptyJsonFields(ast)));
  (store.auditLogs || [])
    .slice(0, 50)
    .forEach((log) =>
      addEntry('audit_logs', log.id, stripEmptyJsonFields(log, { stripAuditSnapshotMedia: true }))
    );

  addEntry('meta', 'financeSummary', store.financeSummary);
  addEntry('meta', 'financeConfig', store.financeConfig);
  addEntry('meta', 'deletedNrps', store.deletedNrps || []);
  addEntry('meta', 'registrations', getCompactRegistrations(store.registrations || []));

  return map;
}

function writeDiskSnapshotOnly(store: GlobalStore) {
  try {
    const targetDbPath = getWritableDbPath();
    const dir = path.dirname(targetDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const memberNrpsWithFoto = new Set(
      (store.members || []).filter((m) => Boolean(m.fotoUrl)).map((m) => m.nrp)
    );
    const compactStore = {
      members: (store.members || []).map((m) => stripEmptyJsonFields(m)),
      users: (store.users || []).map((u) =>
        stripEmptyJsonFields(u, { stripUserInlineImages: memberNrpsWithFoto.has(u.nrp) })
      ),
      transactions: (store.transactions || []).map((t) => stripEmptyJsonFields(t)),
      assets: (store.assets || []).map((a) => stripEmptyJsonFields(a)),
      iuranList: (store.iuranList || []).map((i) => stripEmptyJsonFields(i)),
      financeSummary: store.financeSummary,
      financeConfig: store.financeConfig,
      activeSession: store.activeSession
        ? stripEmptyJsonFields(store.activeSession, { stripUserInlineImages: true })
        : null,
      messages: (store.messages || []).slice(-200).map((m) => stripEmptyJsonFields(m)),
      registrations: getCompactRegistrations(store.registrations || []),
      posts: (store.posts || []).map((p) => stripEmptyJsonFields(p)),
      deletedNrps: store.deletedNrps || [],
      auditLogs: (store.auditLogs || [])
        .slice(0, 50)
        .map((l) => stripEmptyJsonFields(l, { stripAuditSnapshotMedia: true })),
    };
    // Write minified JSON (no indentation whitespace bloat)
    fs.writeFileSync(targetDbPath, JSON.stringify(compactStore), 'utf-8');
  } catch {
    // Ignore write errors in read-only serverless environments
  }
}

function persistLocalStore(store: GlobalStore) {
  writeDiskSnapshotOnly(store);

  if (LOCAL_JSON_PRIMARY_MODE) {
    return;
  }

  const currentMap = buildCloudSnapshotMap(store);
  if (isInitialBoot) {
    currentMap.forEach((val, key) => {
      lastCloudSnapshotMap.set(key, val.json);
    });
    return;
  }

  const changedRows: SupabaseRecordRow[] = [];
  const deletedKeys: Array<{ collection: string; record_id: string }> = [];

  currentMap.forEach((val, key) => {
    const prevJson = lastCloudSnapshotMap.get(key);
    if (prevJson !== val.json) {
      changedRows.push({
        collection: val.collection,
        record_id: val.record_id,
        payload: val.payload,
      });
      lastCloudSnapshotMap.set(key, val.json);
    }
  });

  Array.from(lastCloudSnapshotMap.keys()).forEach((key) => {
    if (!currentMap.has(key)) {
      lastCloudSnapshotMap.delete(key);
      const sepIdx = key.indexOf(':');
      if (sepIdx > 0) {
        deletedKeys.push({
          collection: key.slice(0, sepIdx),
          record_id: key.slice(sepIdx + 1),
        });
      }
    }
  });

  if (changedRows.length > 0) {
    const p = upsertSupabaseBatch(changedRows).catch(() => false);
    pendingCloudPromises.push(p);
  }

  for (const del of deletedKeys) {
    const p = deleteSupabaseRecord(del.collection, del.record_id).catch(() => false);
    pendingCloudPromises.push(p);
  }
}

const globalStore: GlobalStore = loadInitialStore();
persistLocalStore(globalStore);
isInitialBoot = false;

async function flushCloudWrites(): Promise<void> {
  if (pendingCloudPromises.length === 0) return;
  const batch = pendingCloudPromises.splice(0, pendingCloudPromises.length);
  await Promise.allSettled(batch);
}

async function syncFromSupabaseCloud(
  force = false
): Promise<{ synced: boolean; seeded?: boolean; rowCount?: number }> {
  if (LOCAL_JSON_PRIMARY_MODE && !force) {
    return { synced: true, rowCount: (globalStore.members || []).length };
  }

  await flushCloudWrites();

  if (!force && lastSupabaseSyncAt > 0 && Date.now() - lastSupabaseSyncAt < SUPABASE_SYNC_COOLDOWN_MS) {
    return { synced: true, rowCount: lastCloudSnapshotMap.size };
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const sinceIso = !force && lastSupabaseSyncIso ? lastSupabaseSyncIso : undefined;
      const syncStartedIso = new Date().toISOString();
      const rows = await fetchAllSupabaseRecords(sinceIso);
      if (rows === null) {
        return { synced: false };
      }

      // Jika seluruh tabel di Supabase masih kosong pada full sync pertama (0 baris), lakukan Initial Seed otomatis!
      if (!sinceIso && rows.length === 0) {
        const snapshotMap = buildCloudSnapshotMap(globalStore);
        const seedRows: SupabaseRecordRow[] = [];
        snapshotMap.forEach((v, k) => {
          seedRows.push({
            collection: v.collection,
            record_id: v.record_id,
            payload: v.payload,
          });
          lastCloudSnapshotMap.set(k, v.json);
        });
        const ok = await upsertSupabaseBatch(seedRows);
        if (ok) {
          lastSupabaseSyncAt = Date.now();
          lastSupabaseSyncIso = syncStartedIso;
        }
        return { synced: ok, seeded: ok, rowCount: seedRows.length };
      }

      // Jika delta sync menghasilkan 0 perubahan baru di Supabase, langsung selesai (0 KB overhead!)
      if (sinceIso && rows.length === 0) {
        lastSupabaseSyncAt = Date.now();
        lastSupabaseSyncIso = syncStartedIso;
        return { synced: true, rowCount: 0 };
      }

      // Hydrate globalStore dari baris-baris yang tersimpan di 9 tabel Supabase
      const cloudMembers: AnggotaWiraSatya[] = [];
      const cloudUsers: AuthUser[] = [];
      const cloudPosts: FeedPost[] = [];
      const cloudTransactions: KasTransaction[] = [];
      const cloudIuran: IuranAnggota[] = [];
      const cloudMessages: ChatMessage[] = [];
      const cloudAssets: AssetPortfolioItem[] = [];
      const cloudAuditLogs: UserAuditLog[] = [];

      for (const r of rows) {
        if (!r || !r.collection || !r.record_id) continue;
        if (r.collection === 'members' && r.payload) {
          cloudMembers.push(r.payload as AnggotaWiraSatya);
        } else if (r.collection === 'users' && r.payload) {
          cloudUsers.push(r.payload as AuthUser);
        } else if (r.collection === 'posts' && r.payload) {
          cloudPosts.push(r.payload as FeedPost);
        } else if (r.collection === 'transactions' && r.payload) {
          cloudTransactions.push(r.payload as KasTransaction);
        } else if (r.collection === 'iuran' && r.payload) {
          cloudIuran.push(r.payload as IuranAnggota);
        } else if (r.collection === 'messages' && r.payload) {
          cloudMessages.push(r.payload as ChatMessage);
        } else if (r.collection === 'assets' && r.payload) {
          cloudAssets.push(r.payload as AssetPortfolioItem);
        } else if (r.collection === 'audit_logs' && r.payload) {
          cloudAuditLogs.push(r.payload as UserAuditLog);
        } else if (r.collection === 'meta') {
          if (r.record_id === 'deletedNrps' && Array.isArray(r.payload)) {
            globalStore.deletedNrps = r.payload as string[];
          } else if (r.record_id === 'financeSummary' && r.payload) {
            globalStore.financeSummary = {
              ...globalStore.financeSummary,
              ...(r.payload as FinanceSummary),
            };
          } else if (r.record_id === 'financeConfig' && r.payload) {
            globalStore.financeConfig = {
              ...globalStore.financeConfig,
              ...(r.payload as FinanceConfig),
            };
          } else if (r.record_id === 'auditLogs' && Array.isArray(r.payload) && cloudAuditLogs.length === 0) {
            globalStore.auditLogs = (r.payload as UserAuditLog[]).slice(0, 50);
          } else if (r.record_id === 'assets' && Array.isArray(r.payload) && cloudAssets.length === 0) {
            globalStore.assets = r.payload as AssetPortfolioItem[];
          } else if (r.record_id === 'registrations' && Array.isArray(r.payload)) {
            const incomingRegs = r.payload as PendingRegistration[];
            const regByNrp = new Map<string, PendingRegistration>();
            (globalStore.registrations || []).forEach((reg) => {
              if (reg?.nrp) regByNrp.set(reg.nrp, reg);
            });
            incomingRegs.forEach((reg) => {
              if (reg?.nrp) regByNrp.set(reg.nrp, { ...(regByNrp.get(reg.nrp) || {}), ...reg });
            });
            globalStore.registrations = Array.from(regByNrp.values());
          }
        }
      }

      if (cloudAssets.length > 0) {
        const byId = new Map((globalStore.assets || []).map((a) => [a.id, a]));
        cloudAssets.forEach((a) => {
          if (a?.id) byId.set(a.id, a);
        });
        globalStore.assets = Array.from(byId.values());
      }

      if (cloudAuditLogs.length > 0) {
        const byId = new Map((globalStore.auditLogs || []).map((l) => [l.id, l]));
        cloudAuditLogs.forEach((l) => {
          if (l?.id) byId.set(l.id, l);
        });
        globalStore.auditLogs = Array.from(byId.values())
          .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
          .slice(0, 50);
      }

      const deletedSet = new Set(globalStore.deletedNrps || []);

      if (cloudMembers.length > 0) {
        const byNrp = new Map<string, AnggotaWiraSatya>();
        globalStore.members.forEach((m) => {
          if (!deletedSet.has(m.nrp)) byNrp.set(m.nrp, m);
        });
        cloudMembers.forEach((cm) => {
          if (cm && cm.nrp && !deletedSet.has(cm.nrp)) {
            const oldKey = cm.oldNrp && cm.oldNrp !== cm.nrp ? cm.oldNrp : undefined;
            const prevEntry = byNrp.get(cm.nrp) || (oldKey ? byNrp.get(oldKey) : undefined);
            if (oldKey && byNrp.has(oldKey)) {
              byNrp.delete(oldKey);
            }
            byNrp.set(cm.nrp, { ...(prevEntry || {}), ...cm });
          }
        });
        globalStore.members = Array.from(byNrp.values());
      }

      if (cloudUsers.length > 0) {
        const byNrp = new Map<string, AuthUser>();
        globalStore.users.forEach((u) => {
          if (!deletedSet.has(u.nrp)) byNrp.set(u.nrp, u);
        });
        cloudUsers.forEach((cu) => {
          if (cu && cu.nrp && !deletedSet.has(cu.nrp)) {
            const oldKey = cu.oldNrp && cu.oldNrp !== cu.nrp ? cu.oldNrp : undefined;
            const prevEntry = byNrp.get(cu.nrp) || (oldKey ? byNrp.get(oldKey) : undefined);
            if (oldKey && byNrp.has(oldKey)) {
              byNrp.delete(oldKey);
            }
            const resolvedRole =
              cu.role && cu.role !== 'ANGGOTA'
                ? cu.role
                : prevEntry?.role && prevEntry.role !== 'ANGGOTA'
                  ? prevEntry.role
                  : cu.role || prevEntry?.role || 'ANGGOTA';
            byNrp.set(cu.nrp, { ...(prevEntry || {}), ...cu, role: resolvedRole });
          }
        });
        globalStore.users = Array.from(byNrp.values());
      }

      if (!sinceIso) {
        globalStore.posts = cloudPosts;
        globalStore.transactions = cloudTransactions;
        globalStore.messages = cloudMessages;
      } else {
        if (cloudPosts.length > 0) {
          const byId = new Map((globalStore.posts || []).map((p) => [p.id, p]));
          cloudPosts.forEach((p) => {
            if (p?.id) byId.set(p.id, p);
          });
          globalStore.posts = Array.from(byId.values());
        }
        if (cloudTransactions.length > 0) {
          const byId = new Map((globalStore.transactions || []).map((t) => [t.id, t]));
          cloudTransactions.forEach((t) => {
            if (t?.id) byId.set(t.id, t);
          });
          globalStore.transactions = Array.from(byId.values());
        }
        if (cloudMessages.length > 0) {
          const byId = new Map((globalStore.messages || []).map((m) => [m.id, m]));
          cloudMessages.forEach((m) => {
            if (m?.id) byId.set(m.id, m);
          });
          globalStore.messages = Array.from(byId.values());
        }
      }

      if (cloudIuran.length > 0) {
        const byNrp = new Map<string, IuranAnggota>();
        globalStore.iuranList.forEach((i) => {
          if (!deletedSet.has(i.nrp)) byNrp.set(i.nrp, i);
        });
        cloudIuran.forEach((ci) => {
          if (ci && ci.nrp && !deletedSet.has(ci.nrp)) {
            byNrp.set(ci.nrp, { ...(byNrp.get(ci.nrp) || {}), ...ci });
          }
        });
        globalStore.iuranList = Array.from(byNrp.values());
      }

      const refreshedMap = buildCloudSnapshotMap(globalStore);
      lastCloudSnapshotMap.clear();
      refreshedMap.forEach((v, k) => {
        lastCloudSnapshotMap.set(k, v.json);
      });
      writeDiskSnapshotOnly(globalStore);
      lastSupabaseSyncAt = Date.now();
      lastSupabaseSyncIso = syncStartedIso;

      return { synced: true, rowCount: rows.length };
    } catch {
      return { synced: false };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export type AuditLogInput = Partial<UserAuditLog> & {
  action: UserAuditLog['action'];
  targetNrp: string;
};

export const serverStore = {
  ensureSynced: (force = false) => syncFromSupabaseCloud(force),
  flushCloud: () => flushCloudWrites(),
  checkCloudStatus: () => checkSupabaseTableStatus(),

  compactAndCleanJunkData: async (): Promise<{
    beforeBytes: number;
    afterBytes: number;
    beforeKb: number;
    afterKb: number;
    purgedAuditLogs: number;
    purgedStaticRegs: number;
  }> => {
    let beforeBytes = 0;
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        beforeBytes = fs.statSync(LOCAL_DB_PATH).size;
      }
    } catch {
      // ignore
    }

    const prevAuditCount = (globalStore.auditLogs || []).length;
    globalStore.auditLogs = (globalStore.auditLogs || [])
      .slice(0, 50)
      .map((l) => stripEmptyJsonFields(l, { stripAuditSnapshotMedia: true }));
    const purgedAuditLogs = Math.max(0, prevAuditCount - globalStore.auditLogs.length);

    const prevRegCount = (globalStore.registrations || []).length;
    const compactRegs = getCompactRegistrations(globalStore.registrations || []);
    const purgedStaticRegs = Math.max(0, prevRegCount - compactRegs.length);

    // Ensure members & users are deduplicated
    serverStore.getMembers();
    serverStore.getUsers();

    writeDiskSnapshotOnly(globalStore);

    let afterBytes = 0;
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        afterBytes = fs.statSync(LOCAL_DB_PATH).size;
      }
    } catch {
      // ignore
    }

    return {
      beforeBytes,
      afterBytes,
      beforeKb: Math.round((beforeBytes / 1024) * 10) / 10,
      afterKb: Math.round((afterBytes / 1024) * 10) / 10,
      purgedAuditLogs,
      purgedStaticRegs,
    };
  },

  getStorageStatsKb: (): { localDbKb: number; lastSyncAt: number; syncCooldownMinutes: number } => {
    let bytes = 0;
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        bytes = fs.statSync(LOCAL_DB_PATH).size;
      }
    } catch {
      // ignore
    }
    return {
      localDbKb: Math.round((bytes / 1024) * 10) / 10,
      lastSyncAt: lastSupabaseSyncAt,
      syncCooldownMinutes: Math.round(SUPABASE_SYNC_COOLDOWN_MS / 60000),
    };
  },

  getDeletedNrps: (): string[] => globalStore.deletedNrps || [],

  getAuditLogs: (): UserAuditLog[] => {
    if (!Array.isArray(globalStore.auditLogs)) {
      globalStore.auditLogs = [];
    }
    return globalStore.auditLogs;
  },

  addAuditLog: (entry: AuditLogInput): UserAuditLog => {
    if (!Array.isArray(globalStore.auditLogs)) {
      globalStore.auditLogs = [];
    }
    const resolvedActorName = entry.actorName || entry.actorNama || 'Superadmin';
    const rawTargetNama = entry.targetNama || entry.targetName || `Personel ${entry.targetNrp}`;
    const resolvedTargetNama = stripRankFromName(rawTargetNama) || rawTargetNama;
    const leanSnapshot = entry.snapshotUser
      ? stripEmptyJsonFields(entry.snapshotUser, { stripUserInlineImages: true })
      : undefined;
    const newEntry: UserAuditLog = {
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      action: entry.action,
      actorName: resolvedActorName,
      actorNama: entry.actorNama || resolvedActorName,
      actorNrp: entry.actorNrp,
      actorRole: entry.actorRole || 'SUPERADMIN',
      targetNrp: entry.targetNrp,
      targetNama: resolvedTargetNama,
      targetName: resolvedTargetNama,
      targetPangkat: entry.targetPangkat,
      targetRole: entry.targetRole,
      reason: entry.reason,
      details: entry.details,
      snapshotUser: leanSnapshot,
    };
    globalStore.auditLogs = [
      newEntry,
      ...globalStore.auditLogs.filter((l) => l.id !== newEntry.id),
    ].slice(0, 50);
    persistLocalStore(globalStore);
    return newEntry;
  },

  recordAuditLog: (entry: AuditLogInput): UserAuditLog => {
    return serverStore.addAuditLog(entry);
  },

  getMembers: () => {
    const deletedSet = new Set(globalStore.deletedNrps || []);
    // Fast deduplication and purge by nrp and baseName
    const seenNrps = new Set<string>();
    const seenNames = new Set<string>();
    globalStore.members = globalStore.members.filter((m) => {
      const cleanNrp = (m.nrp || '').trim();
      const cleanOldNrp = (m.oldNrp || '').trim();
      if (
        !cleanNrp ||
        deletedSet.has(cleanNrp) ||
        PURGED_DUMMY_NRPS.has(cleanNrp) ||
        (cleanOldNrp && (deletedSet.has(cleanOldNrp) || PURGED_DUMMY_NRPS.has(cleanOldNrp)))
      ) {
        return false;
      }
      const bName = (stripRankFromName(m.namaLengkap || '') || m.namaLengkap || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) {
        return false;
      }
      if (seenNrps.has(cleanNrp) || (bName && seenNames.has(bName))) {
        return false;
      }
      seenNrps.add(cleanNrp);
      if (bName) seenNames.add(bName);
      return true;
    });
    const userByNrp = new Map(globalStore.users.map((u) => [u.nrp, u]));
    globalStore.members.forEach((m) => {
      const u = userByNrp.get(m.nrp);
      if (u) {
        const bestFoto = resolveBestFotoUrl(m.fotoUrl, u.fotoUrl);
        m.fotoUrl = bestFoto;
        u.fotoUrl = bestFoto;
        const bestCover = m.coverUrl || u.coverUrl;
        if (bestCover) {
          m.coverUrl = bestCover;
          u.coverUrl = bestCover;
        }
        if (m.statusKedinasan || m.statusDinas) {
          u.statusKedinasan = m.statusKedinasan || m.statusDinas;
        } else if (u.statusKedinasan) {
          m.statusKedinasan = u.statusKedinasan;
          m.statusDinas = u.statusKedinasan;
        }
      }
    });
    return globalStore.members;
  },
  
  getMemberById: (idOrNrp: string) => 
    globalStore.members.find(
      (m) => m.id === idOrNrp || m.nrp === idOrNrp || (m.oldNrp && m.oldNrp === idOrNrp)
    ),
  
  saveMember: (member: AnggotaWiraSatya, options?: { isNewCreate?: boolean }) => {
    const annualTagihan = (globalStore.financeConfig?.iuranWajibPerBulan || 250000) * 12;
    const cleanNewNrp = (member.nrp || '').trim();
    const cleanOrigNrp = (member.oldNrp || '').trim();
    const deletedSet = new Set(globalStore.deletedNrps || []);
    if (options?.isNewCreate) {
      deletedSet.delete(cleanNewNrp);
      if (cleanOrigNrp) deletedSet.delete(cleanOrigNrp);
      globalStore.deletedNrps = Array.from(deletedSet);
    } else if (
      deletedSet.has(cleanNewNrp) ||
      (cleanOrigNrp && deletedSet.has(cleanOrigNrp))
    ) {
      // Do not resurrect a tombstoned member from a background PUT sync
      return member;
    }

    const idx = globalStore.members.findIndex(
      (m) =>
        m.id === member.id ||
        m.nrp === cleanNewNrp ||
        (cleanOrigNrp && (m.nrp === cleanOrigNrp || m.oldNrp === cleanOrigNrp)) ||
        (member.namaLengkap &&
          m.namaLengkap.trim().toLowerCase() === member.namaLengkap.trim().toLowerCase())
    );
    const calc58 = calculateRetirement58(member.tanggalLahir, cleanNewNrp);

    if (idx >= 0) {
      const prevMember = globalStore.members[idx];
      const oldNrp = prevMember.nrp;
      const newNrp = cleanNewNrp || prevMember.nrp;
      const preservedOldNrp = prevMember.oldNrp || cleanOrigNrp || (oldNrp !== newNrp ? oldNrp : undefined);
      const uIdx = globalStore.users.findIndex(
        (u) =>
          u.nrp === oldNrp ||
          u.nrp === newNrp ||
          (preservedOldNrp && (u.nrp === preservedOldNrp || u.oldNrp === preservedOldNrp)) ||
          u.profileId === prevMember.id ||
          u.id === `u-${oldNrp}` ||
          (member.namaLengkap && u.nama.trim().toLowerCase() === member.namaLengkap.trim().toLowerCase())
      );
      const existingUser = uIdx >= 0 ? globalStore.users[uIdx] : undefined;
      const syncedFotoUrl = resolveBestFotoUrl(member.fotoUrl, prevMember.fotoUrl, existingUser?.fotoUrl);
      const syncedCoverUrl = member.coverUrl ?? prevMember.coverUrl ?? existingUser?.coverUrl;

      const resolvedStatusKedinasan: StatusKedinasan =
        member.statusKedinasan ||
        member.statusDinas ||
        prevMember.statusKedinasan ||
        prevMember.statusDinas ||
        existingUser?.statusKedinasan ||
        'AKTIF';

      globalStore.members[idx] = {
        ...prevMember,
        ...member,
        nrp: newNrp,
        ...(preservedOldNrp ? { oldNrp: preservedOldNrp } : {}),
        statusKedinasan: resolvedStatusKedinasan,
        statusDinas: resolvedStatusKedinasan,
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        fotoUrl: syncedFotoUrl,
        ...(syncedCoverUrl !== undefined ? { coverUrl: syncedCoverUrl } : {}),
        updatedAt: new Date().toISOString(),
      };
      const savedMember = globalStore.members[idx];
      // Also sync nrp/name/pangkat/jabatan/statusKedinasan/tanggalLahir/fotoUrl/coverUrl/bio/email/secondaryEmail to user if exists
      if (uIdx >= 0) {
        globalStore.users[uIdx].nrp = newNrp;
        if (preservedOldNrp) globalStore.users[uIdx].oldNrp = preservedOldNrp;
        globalStore.users[uIdx].nama = savedMember.namaLengkap;
        globalStore.users[uIdx].pangkat = savedMember.pangkat;
        globalStore.users[uIdx].satker = cleanSatkerRoleSuffix(savedMember.satuanKerja, savedMember.nrp);
        globalStore.users[uIdx].polda = savedMember.polda;
        globalStore.users[uIdx].jabatanTerakhir = savedMember.jabatanTerakhir;
        globalStore.users[uIdx].statusKedinasan = resolvedStatusKedinasan;
        globalStore.users[uIdx].tanggalLahir = savedMember.tanggalLahir;
        globalStore.users[uIdx].tempatLahir = savedMember.tempatLahir;
        if (savedMember.noHp !== undefined) globalStore.users[uIdx].noHp = savedMember.noHp;
        if (savedMember.email) {
          globalStore.users[uIdx].email =
            oldNrp !== newNrp && savedMember.email === `${oldNrp}@polri.go.id`
              ? `${newNrp}@polri.go.id`
              : savedMember.email;
        }
        if (savedMember.secondaryEmail !== undefined) globalStore.users[uIdx].secondaryEmail = savedMember.secondaryEmail;
        globalStore.users[uIdx].fotoUrl = syncedFotoUrl;
        if (syncedCoverUrl !== undefined) globalStore.users[uIdx].coverUrl = syncedCoverUrl;
        if (savedMember.bio !== undefined) globalStore.users[uIdx].bio = savedMember.bio;
        globalStore.users[uIdx].updatedAt = savedMember.updatedAt;
      }
      if (
        globalStore.activeSession &&
        (globalStore.activeSession.nrp === oldNrp || globalStore.activeSession.nrp === newNrp)
      ) {
        globalStore.activeSession.nrp = newNrp;
        globalStore.activeSession.nama = savedMember.namaLengkap;
        globalStore.activeSession.pangkat = savedMember.pangkat;
        globalStore.activeSession.satker = cleanSatkerRoleSuffix(savedMember.satuanKerja, savedMember.nrp);
        globalStore.activeSession.polda = savedMember.polda;
        globalStore.activeSession.jabatanTerakhir = savedMember.jabatanTerakhir;
        globalStore.activeSession.statusKedinasan = resolvedStatusKedinasan;
        globalStore.activeSession.tanggalLahir = savedMember.tanggalLahir;
        globalStore.activeSession.tempatLahir = savedMember.tempatLahir;
        if (savedMember.email) globalStore.activeSession.email = savedMember.email;
        if (savedMember.secondaryEmail !== undefined) globalStore.activeSession.secondaryEmail = savedMember.secondaryEmail;
        globalStore.activeSession.fotoUrl = syncedFotoUrl;
        if (syncedCoverUrl !== undefined) globalStore.activeSession.coverUrl = syncedCoverUrl;
        if (savedMember.bio !== undefined) globalStore.activeSession.bio = savedMember.bio;
      }
      const rIdx = globalStore.registrations.findIndex((r) => r.nrp === oldNrp || r.nrp === newNrp);
      if (rIdx >= 0) {
        globalStore.registrations[rIdx].nrp = newNrp;
        globalStore.registrations[rIdx].nama = savedMember.namaLengkap;
        globalStore.registrations[rIdx].pangkat = savedMember.pangkat;
        globalStore.registrations[rIdx].satker = cleanSatkerRoleSuffix(savedMember.satuanKerja, savedMember.nrp);
        globalStore.registrations[rIdx].polda = savedMember.polda;
        if (savedMember.noHp) globalStore.registrations[rIdx].noHp = savedMember.noHp;
      }
      if (resolvedStatusKedinasan !== 'AKTIF' || newNrp === '98010710') {
        globalStore.iuranList = globalStore.iuranList.filter(
          (i) => i.nrp !== oldNrp && i.nrp !== newNrp && (!preservedOldNrp || i.nrp !== preservedOldNrp)
        );
      } else {
        const iIdx = globalStore.iuranList.findIndex(
          (i) => i.nrp === oldNrp || i.nrp === newNrp || (preservedOldNrp && i.nrp === preservedOldNrp)
        );
        if (iIdx >= 0) {
          globalStore.iuranList[iIdx].nrp = newNrp;
          globalStore.iuranList[iIdx].namaLengkap = savedMember.namaLengkap;
          globalStore.iuranList[iIdx].pangkat = savedMember.pangkat;
          globalStore.iuranList[iIdx].polda = savedMember.polda;
        } else {
          globalStore.iuranList.push({
            id: 'iur-' + newNrp,
            nrp: newNrp,
            namaLengkap: savedMember.namaLengkap,
            pangkat: savedMember.pangkat,
            polda: savedMember.polda,
            tahun: globalStore.financeConfig?.tahunBuku || 2026,
            bulanTerbayar: [],
            totalTagihan: annualTagihan,
            totalTerbayar: 0,
            status: 'BELUM_BAYAR',
          });
        }
      }
      if (oldNrp !== newNrp) {
        globalStore.posts.forEach((p) => {
          if (p.authorNrp === oldNrp) p.authorNrp = newNrp;
          p.comments?.forEach((c) => {
            if (c.authorNrp === oldNrp) c.authorNrp = newNrp;
          });
        });
      }
    } else {
      const uIdx = globalStore.users.findIndex((u) => u.nrp === member.nrp);
      const existingUser = uIdx >= 0 ? globalStore.users[uIdx] : undefined;
      const syncedFotoUrl = resolveBestFotoUrl(member.fotoUrl, existingUser?.fotoUrl);
      const syncedCoverUrl = member.coverUrl ?? existingUser?.coverUrl;
      const resolvedStatusKedinasan: StatusKedinasan =
        member.statusKedinasan || member.statusDinas || existingUser?.statusKedinasan || 'AKTIF';
      globalStore.members.unshift({
        ...member,
        statusKedinasan: resolvedStatusKedinasan,
        statusDinas: resolvedStatusKedinasan,
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        fotoUrl: syncedFotoUrl,
        ...(syncedCoverUrl !== undefined ? { coverUrl: syncedCoverUrl } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Ensure user account exists
      if (!globalStore.users.some((u) => u.nrp === member.nrp)) {
        globalStore.users.push({
          id: 'u-' + member.nrp,
          nrp: member.nrp,
          nama: member.namaLengkap,
          pangkat: member.pangkat,
          email: member.email || `${member.nrp}@polri.go.id`,
          secondaryEmail: member.secondaryEmail,
          noHp: member.noHp,
          jabatanTerakhir: member.jabatanTerakhir,
          statusKedinasan: resolvedStatusKedinasan,
          tanggalLahir: calc58.tanggalLahir,
          tempatLahir: member.tempatLahir,
          role: 'ANGGOTA',
          profileId: member.id || 'ws-' + member.nrp,
          mfaEnabled: false,
          mfaMethod: 'PIN',
          password: `WS96@${member.nrp}`,
          status: 'AKTIF',
          satker: cleanSatkerRoleSuffix(member.satuanKerja, member.nrp),
          polda: member.polda,
          fotoUrl: syncedFotoUrl,
          ...(syncedCoverUrl !== undefined ? { coverUrl: syncedCoverUrl } : {}),
        });
      } else if (uIdx >= 0) {
        globalStore.users[uIdx].fotoUrl = syncedFotoUrl;
        globalStore.users[uIdx].jabatanTerakhir = member.jabatanTerakhir;
        globalStore.users[uIdx].statusKedinasan = resolvedStatusKedinasan;
        globalStore.users[uIdx].tanggalLahir = calc58.tanggalLahir;
        globalStore.users[uIdx].tempatLahir = member.tempatLahir;
        if (syncedCoverUrl !== undefined) globalStore.users[uIdx].coverUrl = syncedCoverUrl;
      }
      // Ensure registration entry exists
      if (!globalStore.registrations.some((r) => r.nrp === member.nrp)) {
        globalStore.registrations.unshift({
          id: 'reg-' + member.nrp,
          nrp: member.nrp,
          nama: member.namaLengkap,
          pangkat: member.pangkat,
          satker: cleanSatkerRoleSuffix(member.satuanKerja, member.nrp),
          polda: member.polda,
          noHp: member.noHp || '',
          email: member.email || `${member.nrp}@polri.go.id`,
          secondaryEmail: member.secondaryEmail,
          alasanDaftar: 'Ditambahkan oleh Admin / Kesekretariatan melalui Pendataan',
          password: `WS96@${member.nrp}`,
          status: 'AKTIF',
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'Admin / Kesekretariatan',
        });
      }
      // Ensure iuran entry exists ONLY for AKTIF non-Superadmin alumni
      if (resolvedStatusKedinasan === 'AKTIF' && member.nrp !== '98010710') {
        if (!globalStore.iuranList.some((i) => i.nrp === member.nrp)) {
          globalStore.iuranList.push({
            id: 'iur-' + member.nrp,
            nrp: member.nrp,
            namaLengkap: member.namaLengkap,
            pangkat: member.pangkat,
            polda: member.polda,
            tahun: globalStore.financeConfig?.tahunBuku || 2026,
            bulanTerbayar: [],
            totalTagihan: annualTagihan,
            totalTerbayar: 0,
            status: 'BELUM_BAYAR',
          });
        }
      } else {
        globalStore.iuranList = globalStore.iuranList.filter((i) => i.nrp !== member.nrp);
      }
    }

    // Auto-generate / sync ADC user accounts from member.daftarAdc (login with NRP ADC + Alumni Password)
    const activeParentNrp = (member.nrp || '').trim();
    const prevParentNrp = (member.oldNrp || '').trim();
    const parentUser = globalStore.users.find(
      (u) =>
        !u.isAdcAccount &&
        (u.nrp === activeParentNrp || (prevParentNrp && u.nrp === prevParentNrp))
    );
    const activeAdcNrps = new Set<string>();
    if (Array.isArray(member.daftarAdc)) {
      member.daftarAdc.forEach((adc) => {
        const cleanAdcNrp = (adc.nrp || '').trim();
        if (!cleanAdcNrp || cleanAdcNrp === activeParentNrp) return;
        activeAdcNrps.add(cleanAdcNrp);

        const adcCalc = adc.tanggalLahir
          ? calculateRetirement58(adc.tanggalLahir, cleanAdcNrp)
          : undefined;
        const existingAdcIdx = globalStore.users.findIndex((u) => u.nrp === cleanAdcNrp);
        const resolvedAdcPassword =
          adc.password ||
          parentUser?.password ||
          (existingAdcIdx >= 0 ? globalStore.users[existingAdcIdx].password : undefined) ||
          `WS96@${cleanAdcNrp}`;
        const adcUserPayload: AuthUser = {
          id: existingAdcIdx >= 0 ? globalStore.users[existingAdcIdx].id : `u-adc-${cleanAdcNrp}`,
          nrp: cleanAdcNrp,
          nama: (adc.nama || `ADC ${member.namaLengkap}`).trim(),
          pangkat: adc.pangkat || 'Briptu',
          email: (adc.email || `${cleanAdcNrp}@polri.go.id`).trim(),
          noHp: adc.noHp || '',
          role: 'ANGGOTA',
          profileId: member.id || `ws-${activeParentNrp}`,
          mfaEnabled: false,
          mfaMethod: 'PIN',
          satker: cleanSatkerRoleSuffix(member.satuanKerja, cleanAdcNrp),
          polda: member.polda,
          jabatanTerakhir: adc.jabatan || 'ADC',
          statusKedinasan: 'AKTIF',
          tanggalLahir: adcCalc?.tanggalLahir || adc.tanggalLahir,
          fotoUrl: existingAdcIdx >= 0 ? globalStore.users[existingAdcIdx].fotoUrl || '/default-avatar.png' : '/default-avatar.png',
          isAdcAccount: true,
          adcOfNrp: activeParentNrp,
          adcOfNama: member.namaLengkap,
          adcOfPangkat: member.pangkat,
          password: resolvedAdcPassword,
          status: 'AKTIF',
          updatedAt: new Date().toISOString(),
        };

        if (existingAdcIdx >= 0) {
          globalStore.users[existingAdcIdx] = {
            ...globalStore.users[existingAdcIdx],
            ...adcUserPayload,
          };
        } else {
          globalStore.users.push(adcUserPayload);
        }
      });
    }

    // Remove any obsolete ADC user accounts that were deleted from this member's daftarAdc
    globalStore.users = globalStore.users.filter((u) => {
      if (
        u.isAdcAccount &&
        (u.adcOfNrp === activeParentNrp || (prevParentNrp && u.adcOfNrp === prevParentNrp))
      ) {
        return activeAdcNrps.has(u.nrp);
      }
      return true;
    });

    persistLocalStore(globalStore);
    return member;
  },

  getUsers: () => {
    const deletedSet = new Set(globalStore.deletedNrps || []);
    // Fast deduplication and purge by nrp and baseName (for non-ADC accounts)
    const seenNrps = new Set<string>();
    const seenNames = new Set<string>();
    globalStore.users = globalStore.users.filter((u) => {
      const cleanNrp = (u.nrp || '').trim();
      const cleanOldNrp = (u.oldNrp || '').trim();
      if (
        !cleanNrp ||
        deletedSet.has(cleanNrp) ||
        PURGED_DUMMY_NRPS.has(cleanNrp) ||
        (cleanOldNrp && (deletedSet.has(cleanOldNrp) || PURGED_DUMMY_NRPS.has(cleanOldNrp)))
      ) {
        return false;
      }
      const bName = (stripRankFromName(u.nama || '') || u.nama || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) return false;
      if (seenNrps.has(cleanNrp)) return false;
      if (!u.isAdcAccount && bName && seenNames.has(bName)) return false;
      seenNrps.add(cleanNrp);
      if (!u.isAdcAccount && bName) seenNames.add(bName);
      return true;
    });
    const memberByNrp = new Map(globalStore.members.map((m) => [m.nrp, m]));
    const memberById = new Map(globalStore.members.map((m) => [m.id, m]));
    globalStore.users.forEach((u) => {
      u.satker = cleanSatkerRoleSuffix(u.satker, u.nrp);
      if (!u.password) u.password = `WS96@${u.nrp}`;
      if (!u.status || u.status === 'DISETUJUI_BELUM_PASSWORD') u.status = 'AKTIF';
      const m =
        memberByNrp.get(u.nrp) ||
        (u.oldNrp ? memberByNrp.get(u.oldNrp) : undefined) ||
        (u.profileId ? memberById.get(u.profileId) : undefined) ||
        memberById.get(u.id.replace(/^u-/, 'ws-'));
      if (m && !u.isAdcAccount) {
        const bestFoto = resolveBestFotoUrl(u.fotoUrl, m.fotoUrl);
        u.fotoUrl = bestFoto;
        m.fotoUrl = bestFoto;
        const bestCover = u.coverUrl || m.coverUrl;
        if (bestCover) {
          u.coverUrl = bestCover;
          m.coverUrl = bestCover;
        }
        if (!u.jabatanTerakhir && m.jabatanTerakhir) u.jabatanTerakhir = m.jabatanTerakhir;
        if (!u.statusKedinasan && (m.statusKedinasan || m.statusDinas)) {
          u.statusKedinasan = m.statusKedinasan || m.statusDinas;
        }
        if (!u.tanggalLahir && m.tanggalLahir) u.tanggalLahir = m.tanggalLahir;
        if (!u.tempatLahir && m.tempatLahir) u.tempatLahir = m.tempatLahir;
        if (!u.noHp && m.noHp) u.noHp = m.noHp;
        if (!u.secondaryEmail && m.secondaryEmail) u.secondaryEmail = m.secondaryEmail;
        if (!u.bio && m.bio) u.bio = m.bio;
      }
      if (!u.statusKedinasan) u.statusKedinasan = 'AKTIF';
    });
    return globalStore.users;
  },

  addUser: (user: AuthUser & { noHp?: string }) => {
    const cleanAddNrp = (user.nrp || '').trim();
    if (globalStore.deletedNrps && globalStore.deletedNrps.length > 0) {
      globalStore.deletedNrps = globalStore.deletedNrps.filter(
        (d) => d !== cleanAddNrp && d !== user.oldNrp
      );
    }
    const annualTagihan = (globalStore.financeConfig?.iuranWajibPerBulan || 250000) * 12;
    user.satker = cleanSatkerRoleSuffix(user.satker, user.nrp);
    const calc58 = calculateRetirement58(user.tanggalLahir, user.nrp);
    user.tanggalLahir = calc58.tanggalLahir;
    user.password = user.password || `WS96@${cleanAddNrp}`;
    user.status = 'AKTIF';
    user.statusKedinasan = user.statusKedinasan || 'AKTIF';

    if (user.isAdcAccount && user.adcOfNrp) {
      const parentMember = globalStore.members.find(
        (m) => m.nrp === user.adcOfNrp || (m.oldNrp && m.oldNrp === user.adcOfNrp)
      );
      if (parentMember) {
        user.profileId = parentMember.id;
        user.adcOfNama = user.adcOfNama || parentMember.namaLengkap;
        user.adcOfPangkat = user.adcOfPangkat || parentMember.pangkat;
        user.satker = cleanSatkerRoleSuffix(parentMember.satuanKerja, cleanAddNrp);
        user.polda = parentMember.polda;
        if (!Array.isArray(parentMember.daftarAdc)) {
          parentMember.daftarAdc = [];
        }
        const existingAdcInMember = parentMember.daftarAdc.find((a) => a.nrp === cleanAddNrp);
        if (!existingAdcInMember) {
          parentMember.daftarAdc.push({
            id: `adc-${cleanAddNrp}`,
            nrp: cleanAddNrp,
            nama: user.nama,
            pangkat: user.pangkat || 'Briptu',
            jabatan: user.jabatanTerakhir || 'ADC',
            tanggalLahir: user.tanggalLahir,
            noHp: user.noHp || '',
            email: user.email,
            password: user.password,
          });
        }
      }
    }

    const existingIdx = globalStore.users.findIndex((u) => u.nrp === user.nrp);
    if (existingIdx >= 0) {
      globalStore.users[existingIdx] = { ...globalStore.users[existingIdx], ...user };
    } else {
      globalStore.users.unshift(user);
    }

    // Ensure registration entry exists
    const existingReg = globalStore.registrations.find((r) => r.nrp === user.nrp);
    if (!existingReg) {
      globalStore.registrations.unshift({
        id: 'reg-' + user.nrp,
        nrp: user.nrp,
        nama: user.nama,
        pangkat: user.pangkat,
        satker: user.satker || 'Mabes Polri',
        polda: user.polda || 'MABES POLRI',
        noHp: user.noHp || '',
        email: user.email || `${user.nrp}@polri.go.id`,
        secondaryEmail: user.secondaryEmail,
        alasanDaftar: user.isAdcAccount
          ? `Akun ADC untuk ${user.adcOfPangkat || ''} ${user.adcOfNama || user.adcOfNrp || ''}`.trim()
          : `Ditambahkan oleh Admin / Kesekretariatan (${user.role})`,
        status: 'AKTIF',
        password: user.password,
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'Admin / Kesekretariatan',
      });
    } else {
      if (user.noHp) existingReg.noHp = user.noHp;
      if (user.email) existingReg.email = user.email;
      if (user.secondaryEmail !== undefined) existingReg.secondaryEmail = user.secondaryEmail;
      if (user.password) existingReg.password = user.password;
      existingReg.status = 'AKTIF';
    }

    // Ensure directory member and iuran entry exist for non-ADC personnel
    if (!user.isAdcAccount) {
      const existingMember = globalStore.members.find((m) => m.nrp === user.nrp);
      if (!existingMember) {
        const defaultJabatan =
          user.jabatanTerakhir || (user.satker ? `Perwira ${user.satker}` : 'Perwira Polri');

        globalStore.members.unshift({
          id: 'ws-' + user.nrp,
          nrp: user.nrp,
          namaLengkap: user.nama,
          pangkat: user.pangkat,
          jabatanTerakhir: defaultJabatan,
          satuanKerja: user.satker || 'Polri',
          statusKedinasan: user.statusKedinasan || 'AKTIF',
          statusDinas: user.statusKedinasan || 'AKTIF',
          polda: user.polda || 'MABES POLRI',
          tipeSatker: (user.polda || 'MABES POLRI') === 'MABES POLRI' ? 'MABES' : 'POLDA',
          pendidikanTerakhir: 'Akpol 1996',
          tempatLahir: user.tempatLahir || 'Jakarta',
          tanggalLahir: calc58.tanggalLahir,
          usia: calc58.usiaTahun,
          jenisKelamin: 'LAKI-LAKI',
          noHp: user.noHp || '',
          email: user.email || `${user.nrp}@polri.go.id`,
          secondaryEmail: user.secondaryEmail,
          fotoUrl: user.fotoUrl || '/default-avatar.png',
          alamatTempatTinggal: user.polda || 'Jakarta',
          statusTempatTinggal: 'MILIK PRIBADI',
          statusPerkawinan: 'MENIKAH',
          jumlahAnak: 0,
          daftarAnak: [],
          tahunPurnaTugas: calc58.tahunPurnaTugas,
          sisaTahunDinas: calc58.sisaTahunDinas,
          alamatPurnaTugas: user.polda || 'Jakarta',
          statusRumahPurnaTugas: 'MILIK PRIBADI',
          sudahPembekalan: 'SUDAH',
          rencanaAktivitas: ['USAHA SENDIRI'],
          sumberPenghasilanPasca: ['DANA PENSIUN'],
          kecukupanDanaPensiun: 'CUKUP',
          kesiapanPensiun: 'SIAP',
          perasaanPensiun: 'OPTIMIS',
          dukunganKeluarga: 'SANGAT MENDUKUNG',
          adaPenyakitKronis: 'TIDAK ADA',
          kondisiKesehatan: 'BAIK',
          daftarPenyakit: [],
          asuransiAktif: ['BPJS'],
          rutinMcu: 'YA',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        if (user.noHp) existingMember.noHp = user.noHp;
        if (user.email) existingMember.email = user.email;
        if (user.secondaryEmail !== undefined) existingMember.secondaryEmail = user.secondaryEmail;
        if (user.jabatanTerakhir) existingMember.jabatanTerakhir = user.jabatanTerakhir;
        if (user.statusKedinasan) {
          existingMember.statusKedinasan = user.statusKedinasan;
          existingMember.statusDinas = user.statusKedinasan;
        }
        if (user.tanggalLahir) {
          existingMember.tanggalLahir = calc58.tanggalLahir;
          existingMember.usia = calc58.usiaTahun;
          existingMember.tahunPurnaTugas = calc58.tahunPurnaTugas;
          existingMember.sisaTahunDinas = calc58.sisaTahunDinas;
        }
      }

      // Ensure iuran entry exists ONLY for AKTIF non-Superadmin alumni
      const effectiveAddStatus = user.statusKedinasan || existingMember?.statusKedinasan || existingMember?.statusDinas || 'AKTIF';
      if (effectiveAddStatus === 'AKTIF' && user.role !== 'SUPERADMIN' && user.nrp !== '98010710') {
        const existingIuran = globalStore.iuranList.find((i) => i.nrp === user.nrp);
        if (!existingIuran) {
          globalStore.iuranList.push({
            id: 'iur-' + user.nrp,
            nrp: user.nrp,
            namaLengkap: user.nama,
            pangkat: user.pangkat,
            polda: user.polda || 'MABES POLRI',
            tahun: globalStore.financeConfig?.tahunBuku || 2026,
            bulanTerbayar: [],
            totalTagihan: annualTagihan,
            totalTerbayar: 0,
            status: 'BELUM_BAYAR',
          });
        }
      } else {
        globalStore.iuranList = globalStore.iuranList.filter((i) => i.nrp !== user.nrp);
      }
    }

    persistLocalStore(globalStore);
    return user;
  },

  updateUser: (
    nrp: string,
    updates: Partial<AuthUser> & {
      noHp?: string;
      newNrp?: string;
      originalNrp?: string;
      oldNrp?: string;
      jabatanTerakhir?: string;
      statusKedinasan?: StatusKedinasan;
      tanggalLahir?: string;
      tempatLahir?: string;
    }
  ) => {
    const cleanOldNrp = nrp.trim();
    const cleanOrigNrp = (updates.originalNrp || updates.oldNrp || '').trim();
    const cleanNewNrp = (updates.newNrp || updates.nrp || cleanOldNrp).trim();

    const deletedSet = new Set(globalStore.deletedNrps || []);
    if (
      deletedSet.has(cleanOldNrp) ||
      (cleanOrigNrp && deletedSet.has(cleanOrigNrp)) ||
      deletedSet.has(cleanNewNrp)
    ) {
      return null;
    }

    const getBasePersonName = (raw?: string) =>
      (stripRankFromName(raw || '') || raw || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    const targetBaseName = updates.nama ? getBasePersonName(updates.nama) : '';

    // 1. If updates.nama is present (and not ADC), match by exact person baseName first so stale oldNrp never clobbers another alumnus
    let idx = -1;
    if (targetBaseName && !updates.isAdcAccount) {
      idx = globalStore.users.findIndex(
        (u) => !u.isAdcAccount && getBasePersonName(u.nama) === targetBaseName
      );
    }
    if (idx < 0) {
      idx = globalStore.users.findIndex((u) => u.nrp === cleanOldNrp);
    }
    if (idx < 0 && cleanOrigNrp) {
      idx = globalStore.users.findIndex(
        (u) =>
          (u.nrp === cleanOrigNrp || u.oldNrp === cleanOrigNrp) &&
          (!targetBaseName || getBasePersonName(u.nama) === targetBaseName)
      );
    }
    if (idx < 0 && updates.id) {
      idx = globalStore.users.findIndex(
        (u) => u.id === updates.id && (!targetBaseName || getBasePersonName(u.nama) === targetBaseName)
      );
    }
    if (idx < 0) {
      idx = globalStore.users.findIndex(
        (u) =>
          u.nrp === cleanNewNrp && (!targetBaseName || getBasePersonName(u.nama) === targetBaseName)
      );
    }

    // If serverless instance cold-started and user isn't in globalStore.users yet, upsert!
    if (idx < 0) {
      const fallbackUser: AuthUser = {
        id: updates.id || `u-${cleanOrigNrp || cleanOldNrp}`,
        nrp: cleanNewNrp,
        oldNrp: cleanOrigNrp || cleanOldNrp,
        nama: (updates.nama || `Perwira ${cleanNewNrp}`).trim(),
        pangkat: updates.pangkat || 'Kombes Pol',
        email: updates.email || `${cleanNewNrp}@polri.go.id`,
        secondaryEmail: updates.secondaryEmail,
        noHp: updates.noHp || '',
        jabatanTerakhir: updates.jabatanTerakhir,
        statusKedinasan: updates.statusKedinasan || 'AKTIF',
        tanggalLahir: updates.tanggalLahir,
        tempatLahir: updates.tempatLahir,
        role: updates.role || 'ANGGOTA',
        profileId: updates.profileId || `ws-${cleanOrigNrp || cleanOldNrp}`,
        mfaEnabled: updates.mfaEnabled ?? false,
        mfaMethod: updates.mfaMethod || 'PIN',
        status: 'AKTIF',
        password: updates.password || `WS96@${cleanNewNrp}`,
        satker: cleanSatkerRoleSuffix(updates.satker || 'Mabes Polri', cleanNewNrp),
        polda: updates.polda || 'MABES POLRI',
        fotoUrl: updates.fotoUrl || '/default-avatar.png',
        coverUrl: updates.coverUrl,
      };
      globalStore.users.unshift(fallbackUser);
      idx = 0;
    }

    const existingUserAtIdx = globalStore.users[idx];
    const effectiveOldNrp = existingUserAtIdx.nrp;
    const preservedOldNrp =
      existingUserAtIdx.oldNrp ||
      cleanOrigNrp ||
      (effectiveOldNrp !== cleanNewNrp ? effectiveOldNrp : cleanOldNrp);
    const isNrpChanged = Boolean(
      cleanNewNrp && (cleanNewNrp !== effectiveOldNrp || cleanNewNrp !== cleanOldNrp)
    );

    if (isNrpChanged) {
      const existingBaseName = getBasePersonName(existingUserAtIdx.nama);
      if (existingBaseName && !existingUserAtIdx.isAdcAccount) {
        globalStore.users = globalStore.users.filter(
          (u, i) => i === idx || u.isAdcAccount || getBasePersonName(u.nama) !== existingBaseName
        );
        idx = globalStore.users.indexOf(existingUserAtIdx);
      }
      const collision = globalStore.users.some((u, i) => i !== idx && u.nrp === cleanNewNrp);
      if (collision) {
        return null;
      }
    }

    const {
      newNrp: _ignoredNewNrp,
      originalNrp: _ignoredOriginalNrp,
      oldNrp: _ignoredOldNrp,
      jabatanTerakhir,
      statusKedinasan,
      tanggalLahir,
      tempatLahir,
      ...userUpdates
    } = updates;
    if (userUpdates.satker !== undefined) {
      userUpdates.satker = cleanSatkerRoleSuffix(userUpdates.satker, cleanNewNrp);
    }

    const effectiveBirthInput =
      (tanggalLahir && tanggalLahir.trim()) ||
      existingUserAtIdx.tanggalLahir ||
      undefined;
    const calc58ForUser = effectiveBirthInput
      ? calculateRetirement58(effectiveBirthInput, cleanNewNrp)
      : undefined;

    globalStore.users[idx] = {
      ...existingUserAtIdx,
      ...userUpdates,
      nrp: cleanNewNrp,
      ...(preservedOldNrp ? { oldNrp: preservedOldNrp } : {}),
      ...(jabatanTerakhir !== undefined && jabatanTerakhir.trim()
        ? { jabatanTerakhir: jabatanTerakhir.trim() }
        : {}),
      ...(statusKedinasan !== undefined ? { statusKedinasan } : {}),
      ...(calc58ForUser ? { tanggalLahir: calc58ForUser.tanggalLahir } : {}),
      ...(tempatLahir !== undefined && tempatLahir.trim()
        ? { tempatLahir: tempatLahir.trim() }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    if (
      isNrpChanged &&
      (!userUpdates.email ||
        userUpdates.email === `${cleanOldNrp}@polri.go.id` ||
        userUpdates.email === `${effectiveOldNrp}@polri.go.id` ||
        (preservedOldNrp && userUpdates.email === `${preservedOldNrp}@polri.go.id`))
    ) {
      globalStore.users[idx].email = `${cleanNewNrp}@polri.go.id`;
    }
    if (userUpdates.password) {
      globalStore.users[idx].password = userUpdates.password;
      globalStore.users[idx].status = 'AKTIF';
    }
    if (updates.role) {
      globalStore.users[idx].role = updates.role;
    }
    const updatedUser = globalStore.users[idx];

    // Sync member nrp/name/pangkat/satker/jabatan/statusKedinasan/tanggalLahir/noHp/emails if changed (for non-ADC users)
    let mIdx = updatedUser.isAdcAccount
      ? -1
      : globalStore.members.findIndex(
          (m) =>
            m.nrp === effectiveOldNrp ||
            m.nrp === cleanOldNrp ||
            m.nrp === cleanNewNrp ||
            (preservedOldNrp && (m.nrp === preservedOldNrp || m.oldNrp === preservedOldNrp)) ||
            (updatedUser.profileId && m.id === updatedUser.profileId) ||
            m.id === `ws-${preservedOldNrp || cleanOldNrp}`
        );
    if (mIdx < 0 && !updatedUser.isAdcAccount && updatedUser.nama) {
      const targetNama = updatedUser.nama.trim().toLowerCase();
      mIdx = globalStore.members.findIndex((m) => m.namaLengkap.trim().toLowerCase() === targetNama);
    }

    if (mIdx >= 0) {
      globalStore.members[mIdx].nrp = cleanNewNrp;
      if (preservedOldNrp) globalStore.members[mIdx].oldNrp = preservedOldNrp;
      if (updates.nama) globalStore.members[mIdx].namaLengkap = updates.nama;
      if (updates.pangkat) globalStore.members[mIdx].pangkat = updates.pangkat;
      if (statusKedinasan !== undefined) {
        globalStore.members[mIdx].statusKedinasan = statusKedinasan;
        globalStore.members[mIdx].statusDinas = statusKedinasan;
      }
      if (userUpdates.satker) {
        globalStore.members[mIdx].satuanKerja = userUpdates.satker;
        (globalStore.members[mIdx] as unknown as Record<string, unknown>).satker = userUpdates.satker;
        if (!globalStore.members[mIdx].jabatanTerakhir && !jabatanTerakhir) {
          globalStore.members[mIdx].jabatanTerakhir = `Perwira ${userUpdates.satker}`;
        }
      }
      if (jabatanTerakhir !== undefined && jabatanTerakhir.trim().length > 0) {
        globalStore.members[mIdx].jabatanTerakhir = jabatanTerakhir.trim();
        updatedUser.jabatanTerakhir = jabatanTerakhir.trim();
      } else {
        const currentJabatan = globalStore.members[mIdx].jabatanTerakhir || '';
        if (
          currentJabatan.includes('Ketua Batalyon') ||
          currentJabatan.includes('Sekretaris Batalyon') ||
          currentJabatan.includes('Sekretariat Batalyon') ||
          currentJabatan.includes('Bendahara Batalyon')
        ) {
          const refMember = AKPOL_1996_MEMBERS.find(
            (am) => am.nrp === cleanNewNrp || (preservedOldNrp && am.nrp === preservedOldNrp)
          );
          globalStore.members[mIdx].jabatanTerakhir =
            refMember?.jabatanTerakhir ||
            `Perwira ${globalStore.members[mIdx].satuanKerja || 'Polri'}`;
        }
        if (!updatedUser.jabatanTerakhir) {
          updatedUser.jabatanTerakhir = globalStore.members[mIdx].jabatanTerakhir;
        }
      }
      if (tempatLahir !== undefined && tempatLahir.trim()) {
        globalStore.members[mIdx].tempatLahir = tempatLahir.trim();
        updatedUser.tempatLahir = tempatLahir.trim();
      }
      const birthToUse =
        (tanggalLahir && tanggalLahir.trim()) ||
        globalStore.members[mIdx].tanggalLahir ||
        updatedUser.tanggalLahir;
      if (birthToUse) {
        const calc58 = calculateRetirement58(birthToUse, cleanNewNrp);
        globalStore.members[mIdx].tanggalLahir = calc58.tanggalLahir;
        globalStore.members[mIdx].usia = calc58.usiaTahun;
        globalStore.members[mIdx].tahunPurnaTugas = calc58.tahunPurnaTugas;
        globalStore.members[mIdx].sisaTahunDinas = calc58.sisaTahunDinas;
        updatedUser.tanggalLahir = calc58.tanggalLahir;
      }
      if (updates.polda) globalStore.members[mIdx].polda = updates.polda;
      if (updatedUser.email) globalStore.members[mIdx].email = updatedUser.email;
      if (updates.secondaryEmail !== undefined) globalStore.members[mIdx].secondaryEmail = updates.secondaryEmail;
      if (updates.noHp !== undefined) globalStore.members[mIdx].noHp = updates.noHp;
      globalStore.members[mIdx].updatedAt = new Date().toISOString();
    }

    if (
      globalStore.activeSession &&
      (globalStore.activeSession.nrp === effectiveOldNrp ||
        globalStore.activeSession.nrp === cleanOldNrp ||
        globalStore.activeSession.nrp === cleanNewNrp)
    ) {
      globalStore.activeSession = {
        ...globalStore.activeSession,
        ...updatedUser,
      };
    }

    const rIdx = globalStore.registrations.findIndex(
      (r) =>
        r.nrp === effectiveOldNrp ||
        r.nrp === cleanOldNrp ||
        r.nrp === cleanNewNrp ||
        (preservedOldNrp && r.nrp === preservedOldNrp)
    );
    if (rIdx >= 0) {
      globalStore.registrations[rIdx].nrp = cleanNewNrp;
      if (updates.nama) globalStore.registrations[rIdx].nama = updates.nama;
      if (updates.pangkat) globalStore.registrations[rIdx].pangkat = updates.pangkat;
      if (userUpdates.satker) globalStore.registrations[rIdx].satker = userUpdates.satker;
      if (updates.polda) globalStore.registrations[rIdx].polda = updates.polda;
      if (updatedUser.email) globalStore.registrations[rIdx].email = updatedUser.email;
      if (updates.secondaryEmail !== undefined) globalStore.registrations[rIdx].secondaryEmail = updates.secondaryEmail;
      if (updates.noHp !== undefined) globalStore.registrations[rIdx].noHp = updates.noHp;
      if (userUpdates.password) {
        globalStore.registrations[rIdx].password = userUpdates.password;
        globalStore.registrations[rIdx].status = 'AKTIF';
        globalStore.registrations[rIdx].isPasswordResetRequest = false;
      }
    }

    const effectiveUserStatus: StatusKedinasan =
      updatedUser.statusKedinasan ||
      (mIdx >= 0 ? globalStore.members[mIdx].statusKedinasan || globalStore.members[mIdx].statusDinas : undefined) ||
      'AKTIF';

    if (
      effectiveUserStatus !== 'AKTIF' ||
      updatedUser.isAdcAccount ||
      updatedUser.role === 'SUPERADMIN' ||
      cleanNewNrp === '98010710'
    ) {
      globalStore.iuranList = globalStore.iuranList.filter(
        (i) =>
          i.nrp !== effectiveOldNrp &&
          i.nrp !== cleanOldNrp &&
          i.nrp !== cleanNewNrp &&
          (!preservedOldNrp || i.nrp !== preservedOldNrp)
      );
    } else {
      const iIdx = globalStore.iuranList.findIndex(
        (i) =>
          i.nrp === effectiveOldNrp ||
          i.nrp === cleanOldNrp ||
          i.nrp === cleanNewNrp ||
          (preservedOldNrp && i.nrp === preservedOldNrp)
      );
      if (iIdx >= 0) {
        globalStore.iuranList[iIdx].nrp = cleanNewNrp;
        if (updates.nama) globalStore.iuranList[iIdx].namaLengkap = updates.nama;
        if (updates.pangkat) globalStore.iuranList[iIdx].pangkat = updates.pangkat;
        if (updates.polda) globalStore.iuranList[iIdx].polda = updates.polda;
      }
    }

    if (isNrpChanged) {
      globalStore.posts.forEach((p) => {
        if (
          p.authorNrp === cleanOldNrp ||
          p.authorNrp === effectiveOldNrp ||
          (preservedOldNrp && p.authorNrp === preservedOldNrp)
        ) {
          p.authorNrp = cleanNewNrp;
        }
        p.comments?.forEach((c) => {
          if (
            c.authorNrp === cleanOldNrp ||
            c.authorNrp === effectiveOldNrp ||
            (preservedOldNrp && c.authorNrp === preservedOldNrp)
          ) {
            c.authorNrp = cleanNewNrp;
          }
        });
      });
    }

    // If this user is an Alumni who has generated ADC accounts, propagate the Alumni's password & NRP to all their ADC accounts
    if (!updatedUser.isAdcAccount) {
      globalStore.users.forEach((u) => {
        if (
          u.isAdcAccount &&
          (u.adcOfNrp === cleanOldNrp ||
            u.adcOfNrp === effectiveOldNrp ||
            u.adcOfNrp === cleanNewNrp ||
            (preservedOldNrp && u.adcOfNrp === preservedOldNrp))
        ) {
          u.adcOfNrp = cleanNewNrp;
          u.adcOfNama = updatedUser.nama;
          u.adcOfPangkat = updatedUser.pangkat;
          if (updatedUser.password) {
            u.password = updatedUser.password;
            u.status = 'AKTIF';
          }
        }
      });
    }

    persistLocalStore(globalStore);
    return updatedUser;
  },

  deleteUser: (
    nrp: string,
    meta?: {
      actorName?: string;
      actorNrp?: string;
      actorRole?: UserRole;
      reason?: string;
      snapshotUser?: AuthUser;
    }
  ) => {
    const cleanNrp = (nrp || '').trim();
    if (cleanNrp === '98010710') {
      return { success: false, message: 'Akun Superadmin utama tidak dapat dihapus.' };
    }

    const existingTarget =
      globalStore.users.find(
        (u) => u.nrp === cleanNrp || u.oldNrp === cleanNrp || u.id === `u-${cleanNrp}`
      ) || meta?.snapshotUser;

    const actorRole: UserRole = meta?.actorRole || 'SUPERADMIN';
    if (actorRole === 'BENDAHARA' || actorRole === 'ANGGOTA') {
      return {
        success: false,
        message: 'Akses Ditolak: Role Bendahara dan Anggota tidak memiliki wewenang menghapus pengguna.',
      };
    }
    if (
      actorRole === 'SEKRETARIAT' &&
      existingTarget?.role &&
      existingTarget.role !== 'ANGGOTA'
    ) {
      return {
        success: false,
        message: `Akses Ditolak: Sekretaris hanya berwenang menghapus akun berstatus Anggota (tidak dapat menghapus ${existingTarget.role}).`,
      };
    }
    if (
      actorRole === 'KETUA' &&
      (existingTarget?.role === 'SUPERADMIN' || existingTarget?.role === 'KETUA')
    ) {
      return {
        success: false,
        message: 'Akses Ditolak: Ketua tidak dapat menghapus akun Superadmin atau sesama Ketua.',
      };
    }

    const tombstones = new Set<string>(globalStore.deletedNrps || []);
    tombstones.add(cleanNrp);

    globalStore.users.forEach((u) => {
      if (
        u.nrp === cleanNrp ||
        u.oldNrp === cleanNrp ||
        u.id === `u-${cleanNrp}` ||
        (u.isAdcAccount && u.adcOfNrp === cleanNrp)
      ) {
        if (u.nrp) tombstones.add(u.nrp);
        if (u.oldNrp) tombstones.add(u.oldNrp);
        if (u.id?.startsWith('u-')) tombstones.add(u.id.slice(2));
      }
    });

    globalStore.members.forEach((m) => {
      if (
        m.nrp === cleanNrp ||
        m.oldNrp === cleanNrp ||
        m.id === `ws-${cleanNrp}`
      ) {
        if (m.nrp) tombstones.add(m.nrp);
        if (m.oldNrp) tombstones.add(m.oldNrp);
        if (m.id?.startsWith('ws-')) tombstones.add(m.id.slice(3));
      }
    });

    // Never allow Superadmin 98010710 in tombstones
    tombstones.delete('98010710');
    globalStore.deletedNrps = Array.from(tombstones);

    globalStore.users = globalStore.users.filter(
      (u) =>
        !tombstones.has(u.nrp) &&
        !(u.oldNrp && tombstones.has(u.oldNrp)) &&
        !(u.isAdcAccount && u.adcOfNrp && tombstones.has(u.adcOfNrp))
    );
    globalStore.registrations = globalStore.registrations.filter(
      (r) => !tombstones.has(r.nrp)
    );
    globalStore.members = globalStore.members.filter(
      (m) => !tombstones.has(m.nrp) && !(m.oldNrp && tombstones.has(m.oldNrp))
    );
    globalStore.iuranList = globalStore.iuranList.filter(
      (i) => !tombstones.has(i.nrp)
    );

    const auditEntry = serverStore.addAuditLog({
      action: 'HAPUS_USER',
      actorName: meta?.actorName || 'Superadmin',
      actorNrp: meta?.actorNrp,
      actorRole,
      targetNrp: cleanNrp,
      targetNama: existingTarget?.nama || `Personel NRP ${cleanNrp}`,
      targetPangkat: existingTarget?.pangkat || 'Kombes Pol',
      targetRole: existingTarget?.role || 'ANGGOTA',
      reason: meta?.reason || 'Penghapusan akun melalui Manajemen User',
      details: `Dihapus oleh ${meta?.actorName || actorRole} (${actorRole}). Tombstone aktif: ${Array.from(tombstones).filter((t) => t === cleanNrp || t === existingTarget?.oldNrp).join(', ')}`,
      snapshotUser: existingTarget,
    });

    persistLocalStore(globalStore);
    return {
      success: true,
      deletedNrps: globalStore.deletedNrps,
      auditLog: auditEntry,
      auditLogs: globalStore.auditLogs,
      message: `Pengguna ${existingTarget?.nama || ''} (NRP ${cleanNrp}) berhasil dihapus dan tercatat di Log Audit.`,
    };
  },

  restoreDeletedUser: (
    nrpOrSnapshot: string | Partial<AuthUser>,
    snapshotOrMeta?: Partial<AuthUser> | { actorName?: string; actorNrp?: string; actorRole?: UserRole },
    metaArg?: { actorName?: string; actorNrp?: string; actorRole?: UserRole }
  ) => {
    const isFirstArgString = typeof nrpOrSnapshot === 'string';
    const snapshotUser: Partial<AuthUser> | undefined = isFirstArgString
      ? (snapshotOrMeta as Partial<AuthUser> | undefined)
      : nrpOrSnapshot;
    const meta = isFirstArgString
      ? metaArg
      : (snapshotOrMeta as { actorName?: string; actorNrp?: string; actorRole?: UserRole } | undefined);

    const cleanNrp = (isFirstArgString ? nrpOrSnapshot : snapshotUser?.nrp || '').trim();
    if (!cleanNrp) {
      return { success: false, message: 'NRP pengguna yang akan dipulihkan tidak valid.' };
    }
    const cleanOld = (snapshotUser?.oldNrp || '').trim();
    const tombstones = new Set<string>(globalStore.deletedNrps || []);
    tombstones.delete(cleanNrp);
    if (cleanOld) tombstones.delete(cleanOld);
    globalStore.deletedNrps = Array.from(tombstones);

    // Find canonical reference or use snapshotUser
    const canonicalUser =
      AKPOL_1996_USERS.find((u) => u.nrp === cleanNrp || u.oldNrp === cleanNrp || (cleanOld && u.nrp === cleanOld)) ||
      PRESET_USERS.find((u) => u.nrp === cleanNrp);

    const restoredUserPayload: AuthUser = {
      id: snapshotUser?.id || canonicalUser?.id || `u-${cleanNrp}`,
      profileId: snapshotUser?.profileId || canonicalUser?.profileId || `ws-${cleanNrp}`,
      nrp: cleanNrp,
      oldNrp: snapshotUser?.oldNrp || canonicalUser?.oldNrp,
      nama: stripRankFromName(snapshotUser?.nama || canonicalUser?.nama || `Perwira ${cleanNrp}`),
      pangkat: snapshotUser?.pangkat || canonicalUser?.pangkat || 'Kombes Pol',
      role: (snapshotUser?.role as UserRole) || canonicalUser?.role || 'ANGGOTA',
      email: snapshotUser?.email || canonicalUser?.email || `${cleanNrp}@polri.go.id`,
      secondaryEmail: snapshotUser?.secondaryEmail || canonicalUser?.secondaryEmail,
      noHp: snapshotUser?.noHp || canonicalUser?.noHp || '',
      satker: snapshotUser?.satker || canonicalUser?.satker || 'Mabes Polri',
      polda: snapshotUser?.polda || canonicalUser?.polda || 'MABES POLRI',
      jabatanTerakhir: snapshotUser?.jabatanTerakhir || canonicalUser?.jabatanTerakhir,
      statusKedinasan: snapshotUser?.statusKedinasan || canonicalUser?.statusKedinasan || 'AKTIF',
      tanggalLahir: snapshotUser?.tanggalLahir || canonicalUser?.tanggalLahir,
      tempatLahir: snapshotUser?.tempatLahir || canonicalUser?.tempatLahir,
      fotoUrl: snapshotUser?.fotoUrl || canonicalUser?.fotoUrl || '/default-avatar.png',
      mfaEnabled: snapshotUser?.mfaEnabled ?? false,
      mfaMethod: snapshotUser?.mfaMethod || 'PIN',
      status: 'AKTIF',
      password: snapshotUser?.password || canonicalUser?.password || `WS96@${cleanNrp}`,
      isAdcAccount: snapshotUser?.isAdcAccount,
      adcOfNrp: snapshotUser?.adcOfNrp,
      adcOfNama: snapshotUser?.adcOfNama,
      adcOfPangkat: snapshotUser?.adcOfPangkat,
    };

    const restored = serverStore.addUser(restoredUserPayload);
    const auditEntry = serverStore.addAuditLog({
      action: 'PULIHKAN_USER',
      actorName: meta?.actorName || 'Superadmin',
      actorNrp: meta?.actorNrp,
      actorRole: meta?.actorRole || 'SUPERADMIN',
      targetNrp: restored.nrp,
      targetNama: restored.nama,
      targetPangkat: restored.pangkat,
      targetRole: restored.role,
      reason: 'Pemulihan akun pengguna dari Log Audit (Restore)',
      details: `Akun NRP ${restored.nrp} (${restored.nama}) dipulihkan kembali ke Direktori & Daftar Pengguna.`,
    });

    persistLocalStore(globalStore);
    return {
      success: true,
      data: restored,
      deletedNrps: globalStore.deletedNrps,
      auditLog: auditEntry,
      auditLogs: globalStore.auditLogs,
      message: `Pengguna ${restored.nama} (NRP ${restored.nrp}) berhasil dipulihkan kembali!`,
    };
  },

  getSession: () => globalStore.activeSession,

  setSession: (user: AuthUser | null) => {
    globalStore.activeSession = user;
    persistLocalStore(globalStore);
    return globalStore.activeSession;
  },

  // ==============================================================
  // REGISTRATION & VERIFICATION METHODS
  // ==============================================================
  getRegistrations: () => {
    const deletedSet = new Set(globalStore.deletedNrps || []);
    globalStore.registrations = (globalStore.registrations || []).filter((r) => {
      const cleanNrp = (r.nrp || '').trim();
      if (!cleanNrp || deletedSet.has(cleanNrp) || PURGED_DUMMY_NRPS.has(cleanNrp)) return false;
      const bName = (stripRankFromName(r.nama || '') || r.nama || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) return false;
      return true;
    });
    return globalStore.registrations;
  },

  registerUser: (regData: {
    nrp: string;
    nama: string;
    pangkat: string;
    satker: string;
    polda: string;
    noHp: string;
    email: string;
    secondaryEmail?: string;
    alasanDaftar?: string;
  }): { success: boolean; message: string; registration?: PendingRegistration } => {
    const cleanNrp = regData.nrp.trim();
    
    // Check if already registered in registrations list
    const existingReg = globalStore.registrations.find((r) => r.nrp === cleanNrp);
    if (existingReg) {
      if (existingReg.status === 'PENDING_VERIFIKASI') {
        return { success: false, message: 'NRP ini sudah mendaftar dan sedang menunggu verifikasi Superadmin.' };
      }
      if (existingReg.status === 'DISETUJUI_BELUM_PASSWORD') {
        return { success: false, message: 'Pendaftaran Anda telah disetujui! Silakan masuk untuk membuat kata sandi pertama kali.' };
      }
      if (existingReg.status === 'AKTIF') {
        return { success: false, message: 'NRP ini sudah memiliki akun aktif. Silakan langsung masuk di portal login.' };
      }
    }

    // Check if user already exists in active users
    const existingUser = globalStore.users.find((u) => u.nrp === cleanNrp);
    if (existingUser && existingUser.status === 'AKTIF') {
      return { success: false, message: 'Akun dengan NRP ini sudah terdaftar dan aktif di sistem.' };
    }

    const newReg: PendingRegistration = {
      id: 'reg-' + Date.now(),
      nrp: cleanNrp,
      nama: regData.nama.trim(),
      pangkat: regData.pangkat,
      satker: regData.satker.trim(),
      polda: regData.polda,
      noHp: regData.noHp.trim(),
      email: regData.email.trim() || `${cleanNrp}@polri.go.id`,
      secondaryEmail: regData.secondaryEmail?.trim() || undefined,
      alasanDaftar: regData.alasanDaftar || 'Pendaftaran alumni Wira Satya Akpol 1996',
      status: 'PENDING_VERIFIKASI',
      createdAt: new Date().toISOString(),
    };

    globalStore.registrations.unshift(newReg);
    persistLocalStore(globalStore);
    return {
      success: true,
      message: 'Pendaftaran berhasil diajukan. Akun Anda akan diverifikasi oleh Superadmin / Sekretariat WS96.',
      registration: newReg,
    };
  },

  verifyRegistration: (
    idOrNrp: string, 
    action: 'APPROVE' | 'REJECT', 
    verifierName: string = 'Superadmin',
    assignedRole: AuthUser['role'] = 'ANGGOTA'
  ): { success: boolean; message: string; registration?: PendingRegistration } => {
    const reg = globalStore.registrations.find((r) => r.id === idOrNrp || r.nrp === idOrNrp);
    if (!reg) return { success: false, message: 'Data pendaftaran tidak ditemukan.' };

    if (action === 'APPROVE') {
      const annualTagihan = (globalStore.financeConfig?.iuranWajibPerBulan || 250000) * 12;
      reg.status = 'AKTIF';
      reg.password = reg.password || `WS96@${reg.nrp}`;
      reg.verifiedAt = new Date().toISOString();
      reg.verifiedBy = verifierName;

      // Ensure user entry exists in users
      let user = globalStore.users.find((u) => u.nrp === reg.nrp);
      if (!user) {
        user = {
          id: 'u-' + reg.nrp,
          nrp: reg.nrp,
          nama: reg.nama,
          pangkat: reg.pangkat,
          email: reg.email || `${reg.nrp}@polri.go.id`,
          secondaryEmail: reg.secondaryEmail,
          role: assignedRole,
          profileId: 'ws-' + reg.nrp,
          mfaEnabled: false,
          mfaMethod: 'PIN',
          satker: reg.satker,
          polda: reg.polda,
          statusKedinasan: 'AKTIF',
          fotoUrl: '/default-avatar.png',
          password: reg.password,
          status: 'AKTIF',
        };
        globalStore.users.push(user);
      } else {
        user.status = 'AKTIF';
        user.password = user.password || reg.password || `WS96@${reg.nrp}`;
        user.role = assignedRole || user.role;
        if (!user.fotoUrl) user.fotoUrl = '/default-avatar.png';
      }

      // Also ensure member exists in directory
      const existingMember = globalStore.members.find((m) => m.nrp === reg.nrp);
      if (!existingMember) {
        globalStore.members.unshift({
          id: 'ws-' + reg.nrp,
          namaLengkap: reg.nama,
          nrp: reg.nrp,
          pangkat: reg.pangkat,
          jabatanTerakhir: 'Pamen ' + reg.satker,
          satuanKerja: reg.satker,
          statusKedinasan: 'AKTIF',
          statusDinas: 'AKTIF',
          polda: reg.polda,
          tipeSatker: reg.polda === 'MABES POLRI' ? 'MABES' : 'POLDA',
          pendidikanTerakhir: 'S1 Ilmu Kepolisian / Akpol 1996',
          tempatLahir: 'Jakarta',
          tanggalLahir: '1974-01-01',
          usia: 52,
          jenisKelamin: 'LAKI-LAKI',
          noHp: reg.noHp,
          email: reg.email || `${reg.nrp}@polri.go.id`,
          secondaryEmail: reg.secondaryEmail,
          alamatTempatTinggal: reg.polda,
          statusTempatTinggal: 'MILIK PRIBADI',
          statusPerkawinan: 'MENIKAH',
          jumlahAnak: 0,
          daftarAnak: [],
          tahunPurnaTugas: 2034,
          sisaTahunDinas: 8,
          alamatPurnaTugas: reg.polda,
          statusRumahPurnaTugas: 'MILIK PRIBADI',
          sudahPembekalan: 'SUDAH',
          rencanaAktivitas: ['USAHA SENDIRI'],
          sumberPenghasilanPasca: ['DANA PENSIUN'],
          kecukupanDanaPensiun: 'CUKUP',
          kesiapanPensiun: 'SIAP',
          perasaanPensiun: 'TENANG',
          dukunganKeluarga: 'SANGAT MENDUKUNG',
          adaPenyakitKronis: 'TIDAK ADA',
          kondisiKesehatan: 'SANGAT BAIK',
          asuransiAktif: ['BPJS'],
          rutinMcu: 'YA',
          fotoUrl: '/default-avatar.png',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Also ensure iuran entry exists
      const existingIuran = globalStore.iuranList.find((i) => i.nrp === reg.nrp);
      if (!existingIuran) {
        globalStore.iuranList.push({
          id: 'iur-' + reg.nrp,
          nrp: reg.nrp,
          namaLengkap: reg.nama,
          pangkat: reg.pangkat,
          polda: reg.polda,
          tahun: globalStore.financeConfig?.tahunBuku || 2026,
          bulanTerbayar: [],
          totalTagihan: annualTagihan,
          totalTerbayar: 0,
          status: 'BELUM_BAYAR',
        });
      }

      persistLocalStore(globalStore);
      return {
        success: true,
        message: `Pendaftaran ${reg.nama} berhasil disetujui dan diaktifkan dengan kata sandi standar WS96@${reg.nrp}.`,
        registration: reg,
      };
    } else {
      reg.status = 'DITOLAK';
      reg.verifiedAt = new Date().toISOString();
      reg.verifiedBy = verifierName;
      persistLocalStore(globalStore);
      return {
        success: true,
        message: `Pendaftaran ${reg.nama} telah ditolak.`,
        registration: reg,
      };
    }
  },

  setPassword: (
    nrp: string, 
    newPassword: string, 
    mfaMethod: MfaMethod = 'PIN'
  ): { success: boolean; user?: AuthUser; message: string } => {
    const cleanNrp = nrp.trim();

    // Update in registrations
    const reg = globalStore.registrations.find((r) => r.nrp === cleanNrp);
    if (reg) {
      reg.status = 'AKTIF';
      reg.password = newPassword;
      reg.isPasswordResetRequest = false;
    }

    // Update in users
    let user = globalStore.users.find((u) => u.nrp === cleanNrp);
    if (!user && reg) {
      user = {
        id: 'u-' + reg.nrp,
        nrp: reg.nrp,
        nama: reg.nama,
        pangkat: reg.pangkat,
        email: reg.email || `${reg.nrp}@polri.go.id`,
        secondaryEmail: reg.secondaryEmail,
        role: 'ANGGOTA',
        profileId: 'ws-' + reg.nrp,
        mfaEnabled: mfaMethod !== 'PIN',
        mfaMethod: mfaMethod,
        satker: reg.satker,
        polda: reg.polda,
        statusKedinasan: 'AKTIF',
        fotoUrl: '/default-avatar.png',
        status: 'AKTIF',
        password: newPassword,
      };
      globalStore.users.push(user);
    } else if (user) {
      user.status = 'AKTIF';
      user.password = newPassword;
      user.mfaMethod = mfaMethod;
      user.mfaEnabled = mfaMethod !== 'PIN';
    }

    // Propagate password to any ADC accounts generated by this Alumni
    if (user && !user.isAdcAccount) {
      globalStore.users.forEach((u) => {
        if (u.isAdcAccount && (u.adcOfNrp === cleanNrp || (user!.oldNrp && u.adcOfNrp === user!.oldNrp))) {
          u.password = newPassword;
          u.status = 'AKTIF';
        }
      });
    }

    if (user) {
      globalStore.activeSession = user;
    }

    persistLocalStore(globalStore);
    return {
      success: true,
      user,
      message: 'Kata sandi berhasil disimpan dan akun aktif!',
    };
  },

  // ==============================================================
  // AUTHENTICATION & LOGIN FLOW
  // ==============================================================
  authenticate: (
    identifier: string, 
    passwordInput?: string,
    clientOverride?: Partial<AuthUser> & {
      oldNrp?: string;
      originalNrp?: string;
      newNrp?: string;
      jabatanTerakhir?: string;
      statusKedinasan?: StatusKedinasan;
      tanggalLahir?: string;
      tempatLahir?: string;
    }
  ): {
    success: boolean;
    user?: AuthUser;
    requiresPasswordSetup?: boolean;
    status?: UserAccountStatus;
    nrp?: string;
    nama?: string;
    pangkat?: string;
    message: string;
  } => {
    const cleanId = identifier.trim();

    // If client provides a locally saved override (e.g. after NRP / password / tanggalLahir / ADC edit on another serverless instance), sync it first!
    if (clientOverride && (clientOverride.nrp || clientOverride.newNrp)) {
      const targetNewNrp = (clientOverride.newNrp || clientOverride.nrp || cleanId).trim();
      const targetOldNrp = (clientOverride.oldNrp || clientOverride.originalNrp || targetNewNrp).trim();
      serverStore.updateUser(targetOldNrp, {
        ...clientOverride,
        nrp: targetNewNrp,
        newNrp: targetNewNrp,
        originalNrp: targetOldNrp,
        oldNrp: targetOldNrp,
      });
    }

    // 1. Check registrations for pending/rejected status
    const reg = globalStore.registrations.find(
      (r) =>
        r.nrp === cleanId ||
        r.email.toLowerCase() === cleanId.toLowerCase() ||
        (r.secondaryEmail && r.secondaryEmail.toLowerCase() === cleanId.toLowerCase())
    );

    if (reg) {
      if (reg.status === 'PENDING_VERIFIKASI') {
        return {
          success: false,
          status: 'PENDING_VERIFIKASI',
          message: 'Pendaftaran akun Anda sedang dalam proses verifikasi oleh Superadmin / Sekretariat Wira Satya 96. Harap menunggu konfirmasi.',
        };
      }

      if (reg.status === 'DITOLAK') {
        return {
          success: false,
          status: 'DITOLAK',
          message: 'Permohonan pendaftaran akun Anda ditolak oleh Pengurus Batalyon.',
        };
      }
    }

    // 2. Check registered users list
    let user = globalStore.users.find(
      (u) =>
        u.nrp === cleanId ||
        (u.oldNrp && u.oldNrp === cleanId) ||
        u.id === cleanId ||
        u.email.toLowerCase() === cleanId.toLowerCase() ||
        (u.secondaryEmail && u.secondaryEmail.toLowerCase() === cleanId.toLowerCase()) ||
        u.nama.toLowerCase() === cleanId.toLowerCase()
    );

    // 2B. Check if identifier matches an ADC in any member's daftarAdc (Auto-generated ADC account)
    if (!user) {
      for (const m of globalStore.members) {
        if (Array.isArray(m.daftarAdc)) {
          const matchedAdc = m.daftarAdc.find(
            (adc) =>
              (adc.nrp && adc.nrp.trim() === cleanId) ||
              (adc.email && adc.email.trim().toLowerCase() === cleanId.toLowerCase())
          );
          if (matchedAdc && matchedAdc.nrp) {
            const cleanAdcNrp = matchedAdc.nrp.trim();
            const parentUser = globalStore.users.find(
              (u) => !u.isAdcAccount && (u.nrp === m.nrp || (m.oldNrp && u.nrp === m.oldNrp))
            );
            user = {
              id: `u-adc-${cleanAdcNrp}`,
              nrp: cleanAdcNrp,
              nama: (matchedAdc.nama || `ADC ${m.namaLengkap}`).trim(),
              pangkat: matchedAdc.pangkat || 'Briptu',
              email: (matchedAdc.email || `${cleanAdcNrp}@polri.go.id`).trim(),
              noHp: matchedAdc.noHp || '',
              role: 'ANGGOTA',
              profileId: m.id,
              mfaEnabled: false,
              mfaMethod: 'PIN',
              satker: cleanSatkerRoleSuffix(m.satuanKerja, cleanAdcNrp),
              polda: m.polda,
              jabatanTerakhir: matchedAdc.jabatan || 'ADC',
              statusKedinasan: 'AKTIF',
              tanggalLahir: matchedAdc.tanggalLahir,
              fotoUrl: '/default-avatar.png',
              isAdcAccount: true,
              adcOfNrp: m.nrp,
              adcOfNama: m.namaLengkap,
              adcOfPangkat: m.pangkat,
              password: matchedAdc.password || parentUser?.password || `WS96@${cleanAdcNrp}`,
              status: 'AKTIF',
            };
            globalStore.users.push(user);
            break;
          }
        }
      }
    }

    // Ensure default password is set if missing
    if (user && !user.password) {
      user.password = `WS96@${user.nrp}`;
      user.status = 'AKTIF';
    }

    // 3. Fallback: check directory members if not yet in users table
    if (!user && !reg) {
      const member = globalStore.members.find(
        (m) =>
          m.nrp === cleanId ||
          (m.oldNrp && m.oldNrp === cleanId) ||
          m.id === cleanId ||
          m.namaLengkap.toLowerCase().includes(cleanId.toLowerCase())
      );

      if (member) {
        user = {
          id: `u-${member.nrp}`,
          nrp: member.nrp,
          oldNrp: member.oldNrp,
          nama: member.namaLengkap,
          pangkat: member.pangkat,
          role: 'ANGGOTA',
          profileId: member.id,
          mfaEnabled: false,
          mfaMethod: 'PIN',
          satker: member.satuanKerja,
          jabatanTerakhir: member.jabatanTerakhir,
          statusKedinasan: member.statusKedinasan || member.statusDinas || 'AKTIF',
          polda: member.polda,
          email: `${member.nrp}@polri.go.id`,
          fotoUrl: member.fotoUrl,
          password: `WS96@${member.nrp}`,
          status: 'AKTIF',
        };
        globalStore.users.push(user);
      }
    }

    if (!user) {
      return {
        success: false,
        message: 'NRP / Email dinas tidak terdaftar di sistem Batalyon Wira Satya 96. Silakan lakukan pendaftaran anggota terlebih dahulu.',
      };
    }

    // Password validation for active users (supports custom password, WS96@<NRP>, WS96@<oldNrp>, or parent password for ADC)
    if (passwordInput) {
      const defaultPass = `WS96@${user.nrp}`;
      const oldDefaultPass = user.oldNrp ? `WS96@${user.oldNrp}` : undefined;
      const parentUser =
        user.isAdcAccount && user.adcOfNrp
          ? globalStore.users.find(
              (u) => !u.isAdcAccount && (u.nrp === user!.adcOfNrp || (u.oldNrp && u.oldNrp === user!.adcOfNrp))
            )
          : undefined;
      const parentDefaultPass = user.adcOfNrp ? `WS96@${user.adcOfNrp}` : undefined;

      const isValid =
        user.password === passwordInput ||
        passwordInput === defaultPass ||
        (oldDefaultPass && passwordInput === oldDefaultPass) ||
        (parentUser?.password && passwordInput === parentUser.password) ||
        (parentDefaultPass && passwordInput === parentDefaultPass);

      if (!isValid) {
        return {
          success: false,
          message: 'Kata sandi yang Anda masukkan salah. Silakan coba kembali.',
        };
      }
    }

    user.status = 'AKTIF';
    globalStore.activeSession = user;
    persistLocalStore(globalStore);
    return {
      success: true,
      user,
      message: `Login berhasil sebagai ${user.nama} (${user.role})`,
    };
  },

  // ==============================================================
  // FINANCIAL & ASSET PORTFOLIO METHODS
  // ==============================================================
  getFinanceConfig: (): FinanceConfig => {
    if (!globalStore.financeConfig) {
      globalStore.financeConfig = { ...DEFAULT_FINANCE_CONFIG };
    }
    if (!Array.isArray(globalStore.financeConfig.campaigns)) {
      globalStore.financeConfig.campaigns = DEFAULT_CAMPAIGNS.map((c) => ({ ...c }));
    }
    if (!Array.isArray(globalStore.financeConfig.investmentParticipants)) {
      globalStore.financeConfig.investmentParticipants = [];
    }
    // Migrate legacy default category if IURAN_WAJIB_BULANAN is still the first category
    if (
      Array.isArray(globalStore.financeConfig.subKategoriMasuk) &&
      globalStore.financeConfig.subKategoriMasuk.some((c) => c.code === 'IURAN_WAJIB_BULANAN')
    ) {
      globalStore.financeConfig.subKategoriMasuk = DEFAULT_FINANCE_CONFIG.subKategoriMasuk.map((c) => ({ ...c }));
    }
    return globalStore.financeConfig;
  },

  updateFinanceConfig: (patch: Partial<FinanceConfig>, updatedBy: string): FinanceConfig => {
    if (!globalStore.financeConfig) {
      globalStore.financeConfig = { ...DEFAULT_FINANCE_CONFIG };
    }

    if (patch.iuranWajibPerBulan !== undefined) {
      const nextMonthly = Math.max(0, Number(patch.iuranWajibPerBulan) || 0);
      globalStore.financeConfig.iuranWajibPerBulan = nextMonthly;
      const annualTarget = nextMonthly * 12;

      globalStore.iuranList.forEach((item) => {
        item.totalTagihan = annualTarget;
        if (patch.tahunBuku) {
          item.tahun = Number(patch.tahunBuku);
        }
        if (item.totalTerbayar >= annualTarget && annualTarget > 0) {
          item.status = 'LUNAS';
          item.bulanTerbayar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        } else if (item.totalTerbayar > 0) {
          item.status = 'SEBAGIAN';
          const paidMonths = nextMonthly > 0 ? Math.min(12, Math.floor(item.totalTerbayar / nextMonthly)) : 0;
          item.bulanTerbayar = Array.from({ length: paidMonths }, (_, idx) => idx + 1);
        } else {
          item.status = 'BELUM_BAYAR';
          item.bulanTerbayar = [];
        }
      });
    }

    if (patch.tahunBuku !== undefined) {
      globalStore.financeConfig.tahunBuku = Number(patch.tahunBuku) || 2026;
      globalStore.iuranList.forEach((item) => {
        item.tahun = globalStore.financeConfig.tahunBuku;
      });
    }

    if (Array.isArray(patch.subKategoriMasuk) && patch.subKategoriMasuk.length > 0) {
      globalStore.financeConfig.subKategoriMasuk = patch.subKategoriMasuk;
    }

    if (Array.isArray(patch.subKategoriKeluar) && patch.subKategoriKeluar.length > 0) {
      globalStore.financeConfig.subKategoriKeluar = patch.subKategoriKeluar;
    }

    if (Array.isArray(patch.campaigns)) {
      globalStore.financeConfig.campaigns = patch.campaigns;
    }

    if (Array.isArray(patch.investmentParticipants)) {
      globalStore.financeConfig.investmentParticipants = patch.investmentParticipants;
    }

    globalStore.financeConfig.updatedAt = new Date().toISOString();
    globalStore.financeConfig.updatedBy = updatedBy || globalStore.activeSession?.nama || 'Bendahara';

    persistLocalStore(globalStore);
    return globalStore.financeConfig;
  },

  getFinanceSummary: () => {
    const transactions = globalStore.transactions || [];
    const totalKasMasuk = transactions
      .filter((t) => t.jenis === 'MASUK')
      .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
    const totalKasKeluar = transactions
      .filter((t) => t.jenis === 'KELUAR')
      .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
    const totalValuasiAset = (globalStore.assets || []).reduce(
      (sum, item) => sum + (Number(item.estimasiNilaiIdr) || 0),
      0
    );
    const iuranWajibPerBulan = globalStore.financeConfig?.iuranWajibPerBulan || 250000;

    const exemptIuranNrps = new Set<string>(NON_AKTIF_IURAN_NRPS);
    exemptIuranNrps.add('98010710');
    (globalStore.users || []).forEach((u) => {
      if (
        u.role === 'SUPERADMIN' ||
        u.nrp === '98010710' ||
        u.isAdcAccount ||
        (u.statusKedinasan && u.statusKedinasan !== 'AKTIF')
      ) {
        if (u.nrp) exemptIuranNrps.add(u.nrp);
        if (u.oldNrp) exemptIuranNrps.add(u.oldNrp);
      }
    });
    (globalStore.members || []).forEach((m) => {
      const mStatus = m.statusKedinasan || m.statusDinas || 'AKTIF';
      if (mStatus !== 'AKTIF') {
        if (m.nrp) exemptIuranNrps.add(m.nrp);
        if (m.oldNrp) exemptIuranNrps.add(m.oldNrp);
      }
    });

    globalStore.iuranList = (globalStore.iuranList || []).filter(
      (i) => !exemptIuranNrps.has(i.nrp)
    );
    const iuranList = globalStore.iuranList;
    const totalTargetIuran = iuranList.reduce((s, i) => s + (Number(i.totalTagihan) || 0), 0);
    const totalRealisasiIuran = iuranList.reduce((s, i) => s + (Number(i.totalTerbayar) || 0), 0);
    const persentaseIuranTerkumpul =
      totalTargetIuran > 0 ? Number(((totalRealisasiIuran / totalTargetIuran) * 100).toFixed(1)) : 0;

    const saldoUtama =
      transactions.length > 0 ? totalKasMasuk - totalKasKeluar : globalStore.financeSummary.saldoUtama || 0;

    globalStore.financeSummary = {
      ...globalStore.financeSummary,
      saldoUtama,
      totalValuasiAset,
      danaAbadiInvestasi: totalValuasiAset,
      totalPemasukanBulanIni: totalKasMasuk,
      totalPengeluaranBulanIni: totalKasKeluar,
      persentaseIuranTerkumpul,
    };

    return {
      ...globalStore.financeSummary,
      totalKasMasuk,
      totalKasKeluar,
      totalValuasiAset,
      iuranWajibPerBulan,
    };
  },

  getFinance: () => {
    const summary = serverStore.getFinanceSummary();
    const financeConfig = serverStore.getFinanceConfig();

    return {
      summary,
      transactions: globalStore.transactions,
      assets: globalStore.assets || [],
      iuranList: globalStore.iuranList,
      iuran: globalStore.iuranList,
      financeConfig,
    };
  },

  addTransaction: (trx: Omit<KasTransaction, 'id' | 'createdAt'>) => {
    // Deduplicate if exact same nomorReferensi was just submitted
    if (trx.nomorReferensi) {
      const existing = globalStore.transactions.find((t) => t.nomorReferensi === trx.nomorReferensi);
      if (existing) {
        return existing;
      }
    }

    const newTrx: KasTransaction = {
      ...trx,
      id: 'trx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
    };
    globalStore.transactions.unshift(newTrx);

    // Update balances
    if (newTrx.jenis === 'MASUK') {
      globalStore.financeSummary.saldoUtama += newTrx.nominal;
      globalStore.financeSummary.totalPemasukanBulanIni += newTrx.nominal;
      if (newTrx.kategori === 'SANTUNAN_KESEHATAN' || newTrx.kategori === 'SUMBANGAN_SUKARELA') {
        globalStore.financeSummary.kasSosialKesehatan += newTrx.nominal;
      }
    } else {
      globalStore.financeSummary.saldoUtama -= newTrx.nominal;
      globalStore.financeSummary.totalPengeluaranBulanIni += newTrx.nominal;
      if (newTrx.kategori === 'SANTUNAN_KESEHATAN') {
        globalStore.financeSummary.kasSosialKesehatan -= newTrx.nominal;
      } else if (newTrx.kategori === 'SANTUNAN_DUKA_CITA') {
        globalStore.financeSummary.kasDukaCita -= newTrx.nominal;
      }
    }

    serverStore.getFinanceSummary();
    persistLocalStore(globalStore);
    return newTrx;
  },

  addAsset: (asset: Omit<AssetPortfolioItem, 'id' | 'updatedAt'>) => {
    if (!globalStore.assets) globalStore.assets = [];
    const newAsset: AssetPortfolioItem = {
      ...asset,
      id: 'ast-' + Date.now(),
      updatedAt: new Date().toISOString(),
    };
    globalStore.assets.unshift(newAsset);

    serverStore.getFinanceSummary();
    persistLocalStore(globalStore);
    return newAsset;
  },

  deleteAsset: (id: string) => {
    if (!globalStore.assets) return false;
    const prevLen = globalStore.assets.length;
    globalStore.assets = globalStore.assets.filter((a) => a.id !== id);
    serverStore.getFinanceSummary();
    persistLocalStore(globalStore);
    return globalStore.assets.length < prevLen;
  },

  recordIuranPayment: (nrp: string, nominal: number, pencatat?: string, skipTransaction?: boolean) => {
    const target = globalStore.iuranList.find((i) => i.nrp === nrp);
    if (target) {
      const iuranPerBulan = globalStore.financeConfig?.iuranWajibPerBulan || 250000;
      target.totalTagihan = iuranPerBulan * 12;
      target.totalTerbayar += nominal;
      target.terakhirBayar = new Date().toISOString().split('T')[0];
      if (target.totalTerbayar >= target.totalTagihan) {
        target.status = 'LUNAS';
        target.bulanTerbayar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      } else if (target.totalTerbayar > 0) {
        target.status = 'SEBAGIAN';
        const paidMonths = Math.min(12, Math.floor(target.totalTerbayar / iuranPerBulan));
        target.bulanTerbayar = Array.from({ length: paidMonths }, (_, idx) => idx + 1);
      } else {
        target.status = 'BELUM_BAYAR';
        target.bulanTerbayar = [];
      }

      if (!skipTransaction) {
        // Avoid duplicate cash entry if an identical IURAN_WAJIB_BULANAN transaction was just added for this NRP
        const recentDuplicate = globalStore.transactions.find(
          (t) =>
            t.nrpTerkait === target.nrp &&
            t.kategori === 'IURAN_WAJIB_BULANAN' &&
            t.nominal === nominal &&
            Date.now() - new Date(t.createdAt).getTime() < 5000
        );
        if (!recentDuplicate) {
          serverStore.addTransaction({
            nomorReferensi: 'WS96-IUR-' + Date.now().toString().slice(-4),
            tanggal: new Date().toISOString().split('T')[0],
            jenis: 'MASUK',
            kategori: 'IURAN_WAJIB_BULANAN',
            nominal: nominal,
            keterangan: `Pembayaran Iuran Leting oleh ${target.namaLengkap}`,
            pihakTerkait: target.namaLengkap,
            nrpTerkait: target.nrp,
            dicatatOleh: pencatat || globalStore.activeSession?.nama || 'Bendahara Wira Satya 96',
          });
        }
      }

      serverStore.getFinanceSummary();
      persistLocalStore(globalStore);
      return target;
    }
    return null;
  },

  // ==============================================================
  // MESSAGING METHODS
  // ==============================================================
  getMessages: (user1Nrp?: string, user2Nrp?: string) => {
    if (!user1Nrp && !user2Nrp) {
      return globalStore.messages;
    }
    if (user1Nrp && !user2Nrp) {
      return globalStore.messages.filter(
        (m) => m.senderNrp === user1Nrp || m.receiverNrp === user1Nrp
      );
    }
    return globalStore.messages.filter(
      (m) =>
        (m.senderNrp === user1Nrp && m.receiverNrp === user2Nrp) ||
        (m.senderNrp === user2Nrp && m.receiverNrp === user1Nrp)
    );
  },

  addMessage: (msgData: {
    senderNrp: string;
    senderName: string;
    senderPangkat?: string;
    senderAvatar?: string;
    receiverNrp: string;
    receiverName?: string;
    text: string;
    attachmentUrl?: string;
    attachmentName?: string;
  }): ChatMessage => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      senderNrp: msgData.senderNrp,
      senderName: msgData.senderName,
      senderPangkat: msgData.senderPangkat,
      senderAvatar: msgData.senderAvatar,
      receiverNrp: msgData.receiverNrp,
      receiverName: msgData.receiverName,
      text: msgData.text,
      attachmentUrl: msgData.attachmentUrl,
      attachmentName: msgData.attachmentName,
      timestamp: timeStr,
      createdAt: now.toISOString(),
      isRead: false,
    };

    globalStore.messages.push(newMsg);
    persistLocalStore(globalStore);
    return newMsg;
  },

  markMessagesAsRead: (senderNrp: string, currentReceiverNrp: string) => {
    globalStore.messages.forEach((m) => {
      if (m.senderNrp === senderNrp && m.receiverNrp === currentReceiverNrp) {
        m.isRead = true;
      }
    });
    persistLocalStore(globalStore);
  },

  // ==============================================================
  // FEED POSTS METHODS
  // ==============================================================
  getPosts: () => {
    const rawPosts = globalStore.posts || [];
    const resolveLiveAvatar = (nrp?: string, name?: string, fallback?: string): string | undefined => {
      const cleanNrp = (nrp || '').trim();
      const cleanName = stripRankFromName(name || '').split(',')[0].trim().toLowerCase();
      const matchedMember = (globalStore.members || []).find(
        (m) =>
          (cleanNrp && (m.nrp === cleanNrp || m.oldNrp === cleanNrp)) ||
          (cleanName &&
            stripRankFromName(m.namaLengkap || '').split(',')[0].trim().toLowerCase() === cleanName)
      );
      const matchedUser = (globalStore.users || []).find(
        (u) =>
          (cleanNrp && (u.nrp === cleanNrp || u.oldNrp === cleanNrp)) ||
          (cleanName &&
            stripRankFromName(u.nama || '').split(',')[0].trim().toLowerCase() === cleanName)
      );
      return resolveBestFotoUrl(matchedMember?.fotoUrl, matchedUser?.fotoUrl, fallback) || fallback;
    };

    const enrichComments = (comments?: PostComment[]): PostComment[] => {
      if (!Array.isArray(comments)) return [];
      return comments.map((c) => ({
        ...c,
        authorAvatar: resolveLiveAvatar(c.authorNrp, c.authorName, c.authorAvatar) || c.authorAvatar,
        replies: Array.isArray(c.replies) ? enrichComments(c.replies) : c.replies,
      }));
    };

    return rawPosts.map((p) => ({
      ...p,
      authorAvatar: resolveLiveAvatar(p.authorNrp, p.authorName, p.authorAvatar) || p.authorAvatar,
      comments: enrichComments(p.comments),
    }));
  },

  addPost: (
    postData: Omit<FeedPost, 'id' | 'createdAt' | 'likesCount' | 'repostsCount' | 'comments'> & {
      id?: string;
      createdAt?: string;
    }
  ): FeedPost => {
    if (!globalStore.posts) globalStore.posts = [];
    const nowStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const postId = postData.id || 'post-' + Date.now();
    const existingIdx = globalStore.posts.findIndex((p) => p.id === postId);
    const newPost: FeedPost = {
      ...postData,
      id: postId,
      createdAt: postData.createdAt && postData.createdAt !== 'Baru saja' ? postData.createdAt : nowStr,
      likesCount: 0,
      isLiked: false,
      likedBy: [],
      reactionsByNrp: {},
      repostsCount: 0,
      isReposted: false,
      repostedBy: [],
      impressionsCount: 1,
      comments: [],
    };
    if (existingIdx >= 0) {
      globalStore.posts[existingIdx] = { ...globalStore.posts[existingIdx], ...newPost };
    } else {
      globalStore.posts.unshift(newPost);
    }
    persistLocalStore(globalStore);
    return newPost;
  },

  editPost: (
    postId: string,
    actorNrp: string,
    actorRole: string,
    updates: {
      content?: string;
      imageUrl?: string | null;
      category?: FeedPost['category'];
      pinned?: boolean;
      tags?: string[];
    }
  ): FeedPost | null => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p) return null;
    const isAdmin =
      actorRole === 'SUPERADMIN' ||
      actorNrp === '98010710' ||
      actorRole === 'SEKRETARIAT' ||
      actorRole === 'KETUA';
    if (p.authorNrp !== actorNrp && !isAdmin) return null;

    if (typeof updates.content === 'string') {
      p.content = updates.content.trim();
      const hashtagRegex = /#[a-zA-Z0-9_]+/g;
      const extractedTags = p.content.match(hashtagRegex);
      if (extractedTags && extractedTags.length > 0) {
        p.tags = Array.from(new Set(extractedTags));
      }
    }
    if (updates.imageUrl !== undefined) {
      p.imageUrl = updates.imageUrl || undefined;
    }
    if (updates.category) {
      p.category = updates.category;
    }
    if (typeof updates.pinned === 'boolean' && isAdmin) {
      p.pinned = updates.pinned;
    }
    p.isEdited = true;
    p.updatedAt = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    persistLocalStore(globalStore);
    return p;
  },

  deletePost: (postId: string, actorNrp: string, actorRole: string): boolean => {
    if (!globalStore.posts) return false;
    const idx = globalStore.posts.findIndex((x) => x.id === postId);
    if (idx < 0) return false;
    const target = globalStore.posts[idx];
    const isAdmin =
      actorRole === 'SUPERADMIN' ||
      actorNrp === '98010710' ||
      actorRole === 'SEKRETARIAT' ||
      actorRole === 'KETUA';
    if (target.authorNrp !== actorNrp && !isAdmin) return false;
    globalStore.posts.splice(idx, 1);
    persistLocalStore(globalStore);
    return true;
  },

  toggleLikePost: (postId: string, actorNrp?: string, reaction?: ReactionType | null) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p) return null;

    const nrp = (actorNrp || 'anon').trim();
    if (!Array.isArray(p.likedBy)) p.likedBy = [];
    if (!p.reactionsByNrp) p.reactionsByNrp = {};

    const wasLiked = p.likedBy.includes(nrp) || (nrp === 'anon' && !!p.isLiked);

    if (reaction === null) {
      // Explicit unlike
      if (wasLiked) {
        p.likedBy = p.likedBy.filter((x) => x !== nrp);
        delete p.reactionsByNrp[nrp];
        p.likesCount = Math.max(0, (p.likesCount || 0) - 1);
      }
      p.isLiked = false;
      p.userReaction = undefined;
    } else if (reaction) {
      // Specific reaction selected
      if (!wasLiked) {
        p.likedBy.push(nrp);
        p.likesCount = (p.likesCount || 0) + 1;
      }
      p.reactionsByNrp[nrp] = reaction;
      p.userReaction = reaction;
      p.isLiked = true;
    } else {
      // Simple toggle
      if (wasLiked) {
        p.likedBy = p.likedBy.filter((x) => x !== nrp);
        delete p.reactionsByNrp[nrp];
        p.likesCount = Math.max(0, (p.likesCount || 0) - 1);
        p.isLiked = false;
        p.userReaction = undefined;
      } else {
        p.likedBy.push(nrp);
        p.reactionsByNrp[nrp] = 'like';
        p.likesCount = (p.likesCount || 0) + 1;
        p.isLiked = true;
        p.userReaction = 'like';
      }
    }

    persistLocalStore(globalStore);
    return p;
  },

  toggleRepost: (postId: string, actorNrp?: string) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p) return null;

    const nrp = (actorNrp || 'anon').trim();
    if (!Array.isArray(p.repostedBy)) p.repostedBy = [];
    const wasReposted = p.repostedBy.includes(nrp) || (nrp === 'anon' && !!p.isReposted);

    if (wasReposted) {
      p.repostedBy = p.repostedBy.filter((x) => x !== nrp);
      p.repostsCount = Math.max(0, (p.repostsCount || 0) - 1);
      p.isReposted = false;
    } else {
      p.repostedBy.push(nrp);
      p.repostsCount = (p.repostsCount || 0) + 1;
      p.isReposted = true;
    }
    persistLocalStore(globalStore);
    return p;
  },

  addCommentToPost: (postId: string, comment: PostComment, parentCommentId?: string) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p) return null;
    if (!Array.isArray(p.comments)) p.comments = [];

    if (parentCommentId) {
      const parent = p.comments.find((c) => c.id === parentCommentId);
      if (parent) {
        if (!Array.isArray(parent.replies)) parent.replies = [];
        if (!parent.replies.some((r) => r.id === comment.id)) {
          parent.replies.push(comment);
        }
        persistLocalStore(globalStore);
        return p;
      }
    }

    if (!p.comments.some((c) => c.id === comment.id)) {
      p.comments.push(comment);
    }
    persistLocalStore(globalStore);
    return p;
  },

  editCommentOnPost: (
    postId: string,
    commentId: string,
    actorNrp: string,
    actorRole: string,
    content: string,
    parentCommentId?: string
  ) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p || !Array.isArray(p.comments)) return null;
    const isAdmin =
      actorRole === 'SUPERADMIN' ||
      actorNrp === '98010710' ||
      actorRole === 'SEKRETARIAT' ||
      actorRole === 'KETUA';

    const updateTarget = (list: PostComment[]): boolean => {
      for (const c of list) {
        if (c.id === commentId) {
          if (c.authorNrp !== actorNrp && !isAdmin) return false;
          c.content = content.trim();
          c.isEdited = true;
          c.updatedAt = 'Diedit';
          return true;
        }
        if (Array.isArray(c.replies) && updateTarget(c.replies)) {
          return true;
        }
      }
      return false;
    };

    if (parentCommentId) {
      const parent = p.comments.find((c) => c.id === parentCommentId);
      if (parent && Array.isArray(parent.replies)) {
        updateTarget(parent.replies);
      }
    } else {
      updateTarget(p.comments);
    }
    persistLocalStore(globalStore);
    return p;
  },

  deleteCommentOnPost: (
    postId: string,
    commentId: string,
    actorNrp: string,
    actorRole: string,
    parentCommentId?: string
  ) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p || !Array.isArray(p.comments)) return null;
    const isAdmin =
      actorRole === 'SUPERADMIN' ||
      actorNrp === '98010710' ||
      actorRole === 'SEKRETARIAT' ||
      actorRole === 'KETUA' ||
      p.authorNrp === actorNrp;

    if (parentCommentId) {
      const parent = p.comments.find((c) => c.id === parentCommentId);
      if (parent && Array.isArray(parent.replies)) {
        parent.replies = parent.replies.filter(
          (r) => !(r.id === commentId && (r.authorNrp === actorNrp || isAdmin))
        );
      }
    } else {
      p.comments = p.comments
        .filter((c) => !(c.id === commentId && (c.authorNrp === actorNrp || isAdmin)))
        .map((c) => ({
          ...c,
          replies: Array.isArray(c.replies)
            ? c.replies.filter((r) => !(r.id === commentId && (r.authorNrp === actorNrp || isAdmin)))
            : c.replies,
        }));
    }
    persistLocalStore(globalStore);
    return p;
  },

  toggleLikeComment: (
    postId: string,
    commentId: string,
    actorNrp: string,
    parentCommentId?: string
  ) => {
    if (!globalStore.posts) return null;
    const p = globalStore.posts.find((x) => x.id === postId);
    if (!p || !Array.isArray(p.comments)) return null;
    const nrp = (actorNrp || 'anon').trim();

    const toggleOnList = (list: PostComment[]): boolean => {
      for (const c of list) {
        if (c.id === commentId) {
          if (!Array.isArray(c.likedBy)) c.likedBy = [];
          if (c.likedBy.includes(nrp)) {
            c.likedBy = c.likedBy.filter((x) => x !== nrp);
            c.likesCount = Math.max(0, (c.likesCount || 1) - 1);
          } else {
            c.likedBy.push(nrp);
            c.likesCount = (c.likesCount || 0) + 1;
          }
          return true;
        }
        if (Array.isArray(c.replies) && toggleOnList(c.replies)) {
          return true;
        }
      }
      return false;
    };

    if (parentCommentId) {
      const parent = p.comments.find((c) => c.id === parentCommentId);
      if (parent && Array.isArray(parent.replies)) {
        toggleOnList(parent.replies);
      }
    } else {
      toggleOnList(p.comments);
    }
    persistLocalStore(globalStore);
    return p;
  },
};

export const getFinanceConfig = () => serverStore.getFinanceConfig();
export const updateFinanceConfig = (patch: Partial<FinanceConfig>, updatedBy: string) =>
  serverStore.updateFinanceConfig(patch, updatedBy);
export const getFinanceSummary = () => serverStore.getFinanceSummary();
export const recordIuranPayment = (nrp: string, nominal: number, pencatat?: string, skipTransaction?: boolean) =>
  serverStore.recordIuranPayment(nrp, nominal, pencatat, skipTransaction);

