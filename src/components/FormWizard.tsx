'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AnggotaWiraSatya,
  Anak,
  AdcPersonel,
  AuthUser,
  LowonganUsahaItem,
  RiwayatPenyakitItem,
  DAFTAR_PANGKAT_POLRI,
} from '@/types';
import {
  getAvatarUrl,
  getCoverUrl,
  resolveAvatarUrl,
  cleanJabatanOnly,
  calculateRetirement58,
  deriveBirthDateFromNrp,
  RETIREMENT_AGE_POLRI,
  DEFAULT_AVATAR_URL,
  DEFAULT_COVER_URL,
  detectStatusKedinasan,
  extractCleanJabatanTitle,
  getActiveAdcSessionFromStorage,
  recordAdcActivityToAuditLog,
} from '@/lib/avatarUtils';
import { SatkerBerjenjangModal } from '@/components/SatkerBerjenjangModal';
import {
  getJabatanGroupsForPangkat,
  isStandardPolriJabatan,
  isOfficerRankIpdaUp,
  EXTERNAL_JABATAN_SENTINEL,
} from '@/data/polriJabatan';
import {
  Shield,
  Users,
  Home,
  Activity,
  Shirt,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Save,
  Lock,
  Building2,
  Camera,
  Info,
  Image as ImageIcon,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  Eye,
  Layers,
  HeartPulse,
  Stethoscope,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import { processSecureImageUpload } from '@/lib/mediaSecurity';

export interface FormWizardProps {
  onSave: (data: AnggotaWiraSatya) => void;
  onCancel: () => void;
  currentUser?: AuthUser;
  existingMember?: AnggotaWiraSatya;
  initialTab?: 1 | 2 | 3 | 4 | 5;
  onSaveTab?: (data: AnggotaWiraSatya, tabNum: 1 | 2 | 3 | 4 | 5, stayOpen?: boolean) => void;
}

type JenisAnggotaOption =
  | 'ANGGOTA POLRI'
  | 'ALUMNI AKPOL 1996'
  | 'ASN / PNS POLRI'
  | 'PURNAWIRAWAN POLRI';

type FormWizardData = Omit<Partial<AnggotaWiraSatya>, 'jenisAnggota'> & {
  jenisAnggota?: JenisAnggotaOption | string;
};

export type SubSectionId =
  | '1A'
  | '1B'
  | '1C'
  | '1D'
  | '1E'
  | '2A'
  | '2B'
  | '2C'
  | '3A'
  | '3B'
  | '3C'
  | '4A'
  | '4B'
  | '4C'
  | '5A';

const BINTARA_TAMTAMA_RANKS = [
  'Briptu',
  'Brigpol',
  'Bripka',
  'Aipda',
  'Aiptu',
  'Bripda',
  'Bharada',
  'Bharatu',
  'Bharaka',
  'Abripda',
  'Abriptu',
  'Abrip',
];

const DAFTAR_PENYAKIT = [
  'HIPERTENSI (TEKANAN DARAH TINGGI)',
  'DIABETES MILITUS',
  'PENYAKIT JANTUNG',
  'STROKE',
  'KOLESTEROL TINGGI',
  'ASAM URAT',
  'OSTEOPOROSIS (PENGEROPOSAN TULANG)',
  'OSTEOARTITIS (PENGAPURAN SENDI)',
  'NYERI PINGGANG DAN LUTUT',
  'GANGGUAN PROSTAT',
  'PENYAKIT GINJAL',
  'PENYAKIT LIVER',
];

const DAFTAR_GOLONGAN_DARAH = [
  'O',
  'A',
  'B',
  'AB',
  'O+',
  'O-',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'BELUM TERDATA',
] as const;

const DAFTAR_RHESUS_DARAH = ['Rh+', 'Rh-'] as const;

const DAFTAR_KONDISI_MATA = [
  'Normal (Tanpa Kacamata)',
  'Kacamata Baca (Plus / Presbiopi)',
  'Kacamata Minus / Silinder',
  'Kacamata Bifokal / Progresif',
  'Lensa Kontak / Riwayat Lasik',
] as const;

const DAFTAR_FREKUENSI_OLAHRAGA = [
  'Rutin (3-5x Seminggu)',
  'Cukup Rutin (1-2x Seminggu)',
  'Kadang-kadang (1-3x Sebulan)',
  'Jarang / Belum Rutin',
] as const;

const DAFTAR_AGAMA = [
  'ISLAM',
  'KRISTEN PROTESTAN',
  'KATOLIK',
  'HINDU',
  'BUDDHA',
  'KONGHUCU',
] as const;

const DAFTAR_DIKBANG_POLRI = [
  'SESPIMTI POLRI',
  'LEMHANNAS RI (PPRA/PPSA)',
  'PKN TK. I (LAN RI)',
  'SESPIMMEN POLRI',
  'PKN TK. II',
  'STIK - PTIK',
  'SESPIMMA POLRI',
] as const;

const DAFTAR_UKURAN_BAJU = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'] as const;
const DAFTAR_UKURAN_JAKET = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'] as const;
const DAFTAR_UKURAN_CELANA = [
  '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '42', '44', '46',
] as const;
const DAFTAR_UKURAN_SEPATU = ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47'] as const;
const DAFTAR_UKURAN_TUTUP_KEPALA = ['54', '55', '56', '57', '58', '59', '60', '61', '62'] as const;

const DAFTAR_KOMPI = ['KOMPI A', 'KOMPI B', 'KOMPI C', 'KOMPI D'] as const;
const DAFTAR_PLETON = ['PLETON 1', 'PLETON 2', 'PLETON 3', 'PLETON 4'] as const;

const DAFTAR_KATEGORI_USAHA = [
  'USAHA PRIBADI / MANDIRI',
  'USAHA BERSAMA LETING',
  'USAHA PRIBADI & BERSAMA LETING',
  'YAYASAN / KOPERASI WS96',
  'BELUM ADA',
] as const;

const DAFTAR_PERAN_USAHA_YAYASAN = [
  'PEMILIK / FOUNDER USAHA',
  'DIREKTUR UTAMA / DIREKSI',
  'KOMISARIS / PENGAWAS',
  'INVESTOR / MITRA LETING',
  'PENGELOLA OPERASIONAL',
  'BELUM DITENTUKAN',
] as const;

const DAFTAR_RENCANA_AKTIVITAS = [
  'USAHA SENDIRI',
  'USAHA BERSAMA / YAYASAN',
  'BEKERJA KEMBALI',
  'BERTANI/BERKEBUN',
  'MENGURUS KELUARGA',
] as const;

const PRESET_POSISI_LOWONGAN = [
  'Direktur Operasional',
  'Sekretaris Direksi',
  'Manajer Operasional',
  'Staf Keuangan & Akuntansi',
  'Legal & Perizinan',
  'IT & Digital Marketing',
  'Management Trainee (Putra-Putri Leting)',
] as const;

const KISARAN_BIAYA_SEWA_OPTIONS = [
  '< 25 Jt/Thn',
  '25 - 50 Jt/Thn',
  '> 50 Jt/Thn',
] as const;

const DAFTAR_ASURANSI: ('BPJS' | 'ASURANSI KESEHATAN' | 'ASURANSI JIWA' | 'TIDAK ADA')[] = [
  'BPJS',
  'ASURANSI KESEHATAN',
  'ASURANSI JIWA',
  'TIDAK ADA',
];

async function resizeImageFile(
  file: File,
  preset: 'AVATAR' | 'COVER',
  actorNrp?: string,
  ownerNrp?: string
): Promise<string> {
  const processed = await processSecureImageUpload(file, {
    preset,
    actorNrp,
    ownerNrp,
  });
  return processed.dataUrl;
}

function resolveDefaultJenisAnggota(member?: AnggotaWiraSatya, user?: AuthUser): JenisAnggotaOption {
  const nrp = member?.nrp || user?.nrp || '';
  const pangkat = member?.pangkat || user?.pangkat || '';
  if (nrp === '98010710' || BINTARA_TAMTAMA_RANKS.includes(pangkat)) {
    return 'ANGGOTA POLRI';
  }
  if (pangkat.toUpperCase().includes('ASN') || pangkat.toUpperCase().includes('PNS')) {
    return 'ASN / PNS POLRI';
  }
  if (member?.tipeSatker === 'PURNA TUGAS' || member?.polda === 'PURNA TUGAS') {
    return 'PURNAWIRAWAN POLRI';
  }
  const raw = member?.jenisAnggota as string | undefined;
  if (
    raw === 'ALUMNI AKPOL 1996' ||
    raw === 'ASN / PNS POLRI' ||
    raw === 'PURNAWIRAWAN POLRI' ||
    raw === 'ANGGOTA POLRI'
  ) {
    return raw;
  }
  return 'ANGGOTA POLRI';
}

const TAB_CONFIG: {
  num: 1 | 2 | 3 | 4 | 5;
  title: string;
  shortTitle: string;
  subSections: SubSectionId[];
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    num: 1,
    title: 'Kedinasan & Identitas',
    shortTitle: 'Kedinasan',
    subSections: ['1A', '1B', '1C', '1D', '1E'],
    icon: Shield,
  },
  {
    num: 2,
    title: 'Domisili & Keluarga Inti',
    shortTitle: 'Keluarga Inti',
    subSections: ['2A', '2B', '2C'],
    icon: Users,
  },
  {
    num: 3,
    title: 'Purna Tugas & Usaha',
    shortTitle: 'Purna Tugas',
    subSections: ['3A', '3B', '3C'],
    icon: Home,
  },
  {
    num: 4,
    title: 'Kesehatan, Fisik & Asuransi',
    shortTitle: 'Kesehatan',
    subSections: ['4A', '4B', '4C'],
    icon: Activity,
  },
  {
    num: 5,
    title: 'Aparel & Perlengkapan',
    shortTitle: 'Aparel',
    subSections: ['5A'],
    icon: Shirt,
  },
];

const BULAN_INDO_LIST = [
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
] as const;

const PRESET_PENYAKIT_CEPAT = [
  'HIPERTENSI (TEKANAN DARAH TINGGI)',
  'DIABETES MILITUS',
  'PENYAKIT JANTUNG',
  'KOLESTEROL TINGGI',
  'ASAM URAT',
  'NYERI PINGGANG DAN LUTUT',
  'OSTEOARTITIS (PENGAPURAN SENDI)',
  'GANGGUAN PROSTAT',
  'STROKE',
  'PENYAKIT GINJAL',
  'PENYAKIT LIVER',
  'GERD / ASAM LAMBUNG',
] as const;

export function parseDiseaseListToDetail(
  existingDetail?: RiwayatPenyakitItem[],
  daftarPenyakit?: string[],
  defaultSejak?: string,
  defaultTerapi?: string
): RiwayatPenyakitItem[] {
  if (Array.isArray(existingDetail) && existingDetail.length > 0) {
    return existingDetail;
  }
  if (!Array.isArray(daftarPenyakit) || daftarPenyakit.length === 0) {
    return [];
  }
  return daftarPenyakit
    .map((raw, idx) => {
      const clean = (raw || '').trim();
      if (!clean) return null;
      const matchSejak = clean.match(/^(.*?)\s*\(\s*[Ss]ejak\s+([^)]+)\)\s*$/);
      const namaPenyakit = matchSejak ? matchSejak[1].trim() : clean;
      const sejakKapan = matchSejak ? matchSejak[2].trim() : defaultSejak || '';
      return {
        id: `penyakit-init-${idx}-${Date.now()}`,
        namaPenyakit,
        sejakKapan,
        statusPenyakit: 'TERKONTROL' as const,
        terapiObat: idx === 0 && defaultTerapi ? defaultTerapi : '',
      };
    })
    .filter(Boolean) as RiwayatPenyakitItem[];
}

export function formatDetailToDiseaseList(items?: RiwayatPenyakitItem[]): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const nama = (it.namaPenyakit || '').trim().toUpperCase();
      if (!nama) return '';
      const sejak = (it.sejakKapan || '').trim();
      return sejak ? `${nama} (Sejak ${sejak})` : nama;
    })
    .filter(Boolean);
}

/**
 * Compact label with optional icon, required star, and hover/tap tooltip so UI stays concise.
 */
const LabelWithTooltip: React.FC<{
  label: string;
  required?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}> = ({ label, required, tooltip, icon, badge, className = '' }) => (
  <div className={`flex items-center justify-between gap-1.5 mb-1 ${className}`}>
    <label className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-700 leading-tight">
      {icon && <span className="text-polri-navy/80 shrink-0">{icon}</span>}
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      {tooltip && (
        <span className="relative group inline-flex items-center cursor-help ml-0.5" tabIndex={0}>
          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-polri-navy transition-colors" />
          <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 sm:w-64 p-2 rounded-lg bg-slate-900 text-white text-[10px] font-medium leading-relaxed shadow-xl z-50 border border-slate-700">
            {tooltip}
          </span>
        </span>
      )}
    </label>
    {badge && <div className="shrink-0">{badge}</div>}
  </div>
);

/**
 * Flexible Date/Period Input: allows Tahun Saja (e.g. "2021"), Bulan & Tahun (e.g. "Mei 2022"), or Tanggal Lengkap ("2023-05-14").
 */
const FlexiblePeriodInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  defaultMode?: 'YEAR' | 'MONTH_YEAR' | 'FULL_DATE';
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  compact?: boolean;
}> = ({
  value,
  onChange,
  defaultMode = 'MONTH_YEAR',
  minYear = 1950,
  maxYear = new Date().getFullYear() + 5,
  placeholder = 'Pilih waktu...',
  compact = false,
}) => {
  const detectMode = (v: string): 'YEAR' | 'MONTH_YEAR' | 'FULL_DATE' => {
    const t = (v || '').trim();
    if (!t) return defaultMode;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'FULL_DATE';
    if (/^\d{4}$/.test(t) || /^Tahun\s+\d{4}$/i.test(t)) return 'YEAR';
    return 'MONTH_YEAR';
  };

  const [mode, setMode] = useState<'YEAR' | 'MONTH_YEAR' | 'FULL_DATE'>(() => detectMode(value));

  const parsedParts = React.useMemo(() => {
    const t = (value || '').trim();
    const curYearStr = String(new Date().getFullYear());
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const [y, m, d] = t.split('-');
      const mIdx = Math.max(0, Math.min(11, (parseInt(m, 10) || 1) - 1));
      return { year: y, monthName: BULAN_INDO_LIST[mIdx], monthNum: m, day: d, isoDate: t };
    }
    if (/^\d{4}-\d{2}$/.test(t)) {
      const [y, m] = t.split('-');
      const mIdx = Math.max(0, Math.min(11, (parseInt(m, 10) || 1) - 1));
      return {
        year: y,
        monthName: BULAN_INDO_LIST[mIdx],
        monthNum: m,
        day: '01',
        isoDate: `${y}-${m}-01`,
      };
    }
    const yearMatch = t.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : '';
    const lower = t.toLowerCase();
    const foundMonthIdx = BULAN_INDO_LIST.findIndex((b) => lower.includes(b.toLowerCase()));
    const monthName = foundMonthIdx >= 0 ? BULAN_INDO_LIST[foundMonthIdx] : 'Januari';
    const monthNum = foundMonthIdx >= 0 ? String(foundMonthIdx + 1).padStart(2, '0') : '01';
    return {
      year,
      monthName,
      monthNum,
      day: '01',
      isoDate: year ? `${year}-${monthNum}-01` : `${curYearStr}-01-01`,
    };
  }, [value]);

  const years = React.useMemo(() => {
    const arr: string[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      arr.push(String(y));
    }
    return arr;
  }, [minYear, maxYear]);

  const handleSwitchMode = (nextMode: 'YEAR' | 'MONTH_YEAR' | 'FULL_DATE') => {
    setMode(nextMode);
    if (!value?.trim()) return;
    const yr = parsedParts.year || String(new Date().getFullYear());
    if (nextMode === 'YEAR') {
      onChange(yr);
    } else if (nextMode === 'MONTH_YEAR') {
      onChange(`${parsedParts.monthName} ${yr}`);
    } else {
      onChange(parsedParts.isoDate);
    }
  };

  const padCls = compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-xs sm:text-sm';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {mode === 'YEAR' && (
          <select
            value={parsedParts.year || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-lg border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-polri-navy ${padCls}`}
          >
            <option value="">{placeholder} (Tahun)</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>
        )}

        {mode === 'MONTH_YEAR' && (
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <select
              value={parsedParts.year ? parsedParts.monthName : ''}
              onChange={(e) => {
                const mName = e.target.value || 'Januari';
                const yr = parsedParts.year || String(new Date().getFullYear());
                onChange(`${mName} ${yr}`);
              }}
              className={`w-full rounded-lg border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-polri-navy ${padCls}`}
            >
              <option value="" disabled>
                Bulan
              </option>
              {BULAN_INDO_LIST.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={parsedParts.year || ''}
              onChange={(e) => {
                const yr = e.target.value;
                if (!yr) {
                  onChange('');
                } else {
                  onChange(`${parsedParts.monthName || 'Januari'} ${yr}`);
                }
              }}
              className={`w-full rounded-lg border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-polri-navy ${padCls}`}
            >
              <option value="">Tahun</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'FULL_DATE' && (
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : parsedParts.isoDate}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full rounded-lg border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-polri-navy ${padCls}`}
          />
        )}
      </div>

      {/* Mode Switcher Pills: Tahun Saja | Bulan & Tahun | Tanggal Lengkap */}
      <div className="flex items-center justify-between gap-1">
        <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200">
          {(
            [
              { id: 'YEAR', label: 'Tahun' },
              { id: 'MONTH_YEAR', label: 'Bln & Thn' },
              { id: 'FULL_DATE', label: 'Tgl Lengkap' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSwitchMode(opt.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                mode === opt.id
                  ? 'bg-polri-navy text-polri-gold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {value && (
          <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[110px]">
            {value}
          </span>
        )}
      </div>
    </div>
  );
};

export const FormWizard: React.FC<FormWizardProps> = ({
  onSave,
  onCancel,
  currentUser,
  existingMember,
  initialTab,
  onSaveTab,
}) => {
  const activeUser: AuthUser = currentUser || {
    id: 'u-default',
    nrp: existingMember?.nrp || '',
    nama: existingMember?.namaLengkap || 'Personel',
    pangkat: existingMember?.pangkat || 'Kombes Pol',
    email: existingMember?.email || '',
    role: 'SUPERADMIN',
    profileId: existingMember?.id || 'ws-default',
    mfaEnabled: false,
    mfaMethod: 'PIN',
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialTab || 1);
  const [baselineMember, setBaselineMember] = useState<AnggotaWiraSatya | undefined>(existingMember);
  const [savedBanner, setSavedBanner] = useState<{
    tabNum: number;
    tabName: string;
    timestamp: string;
  } | null>(null);
  const [savedTabs, setSavedTabs] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [penyakitLainnya, setPenyakitLainnya] = useState('');
  const [isSatkerModalOpen, setIsSatkerModalOpen] = useState(false);
  const [avatarCleared, setAvatarCleared] = useState(false);
  const [isExternalJabatan, setIsExternalJabatan] = useState(false);

  // Accordion state for sub-sections (1A-1E, 2A-2C, 3A-3C, 4A-4C, 5A) — Default tertutup semua agar ringkas & rapi
  const [expandedSections, setExpandedSections] = useState<Record<SubSectionId, boolean>>({
    '1A': false,
    '1B': false,
    '1C': false,
    '1D': false,
    '1E': false,
    '2A': false,
    '2B': false,
    '2C': false,
    '3A': false,
    '3B': false,
    '3C': false,
    '4A': false,
    '4B': false,
    '4C': false,
    '5A': false,
  });

  const initializedMemberKeyRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access Control Check
  const canEditAnyMember = ['SUPERADMIN', 'SEKRETARIAT'].includes(activeUser.role);
  const activeAdcSession =
    typeof window !== 'undefined' ? getActiveAdcSessionFromStorage() : null;
  const isEditingRepresentedPimpinan = Boolean(
    baselineMember &&
      ((activeUser.isAdcAccount && activeUser.adcOfNrp === baselineMember.nrp) ||
        (activeAdcSession && activeAdcSession.pimpinanNrp === baselineMember.nrp))
  );
  const isEditingSelf =
    !baselineMember ||
    !baselineMember.nrp ||
    baselineMember.nrp === activeUser.nrp ||
    isEditingRepresentedPimpinan;
  const hasEditPermission = canEditAnyMember || isEditingSelf;

  // Sync step when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setStep(initialTab);
      setErrorMsg(null);
    }
  }, [initialTab]);

  // Sync baselineMember whenever existingMember prop changes
  useEffect(() => {
    setBaselineMember(existingMember);
  }, [existingMember]);

  // Cleanup banner timer on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  // Form State initialized from existing member or defaults
  const [formData, setFormData] = useState<FormWizardData>({
    jenisAnggota: 'ANGGOTA POLRI',
    statusKedinasan: 'AKTIF',
    tipeSatker: 'MABES',
    satkerMabes: 'BARESKRIM POLRI',
    subSatker: '',
    satuanKerja: 'Bareskrim Polri',
    namaPolres: '',
    namaPolsek: '',
    pangkat: 'Kombes Pol',
    tmtPangkat: '',
    polda: 'MABES POLRI',
    pendidikanTerakhir: '',
    dikbangPolri: 'SESPIMTI POLRI',
    tandaKehormatan: 'Bintang Bhayangkara Nararya, SL Pengabdian 24 Thn',
    agama: 'ISLAM',
    sukuBangsa: '',
    jenisKelamin: 'LAKI-LAKI',
    kompi: 'KOMPI A',
    pleton: 'PLETON 1',
    golonganDarah: 'O',
    rhesusDarah: 'Rh+',
    tinggiBadan: 172,
    beratBadan: 74,
    kondisiMata: 'Normal (Tanpa Kacamata)',
    frekuensiOlahraga: 'Rutin (3-5x Seminggu)',
    olahragaFavorit: '',
    faskesRujukan: '',
    alergiObatMakanan: '',
    ukuranBaju: 'XL',
    ukuranJaket: 'XL',
    ukuranCelana: '34',
    ukuranSepatu: '42',
    ukuranTutupKepala: '58',
    catatanAparel: '',
    statusTempatTinggal: 'MILIK PRIBADI',
    kotaDomisili: '',
    provinsiDomisili: '',
    biayaSewaTempatTinggal: '',
    detailSewaTempatTinggal: '',
    statusPerkawinan: 'MENIKAH',
    pekerjaanIstri: '',
    jumlahAnak: 0,
    daftarAnak: [],
    namaAdc: '',
    pangkatAdc: 'Briptu',
    nrpAdc: '',
    kontakAdc: '',
    daftarAdc: [],
    tahunPurnaTugas: 2034,
    sisaTahunDinas: 8,
    statusRumahPurnaTugas: 'MILIK PRIBADI',
    biayaSewaTahunan: '',
    detailSewaPurnaTugas: '',
    sudahPembekalan: 'SUDAH',
    rencanaAktivitas: ['USAHA SENDIRI'],
    kategoriUsaha: 'USAHA PRIBADI / MANDIRI',
    namaUsahaYayasan: '',
    peranUsahaYayasan: 'PEMILIK / FOUNDER USAHA',
    lokasiUsaha: '',
    bidangKeahlianPensiun: '',
    statusUsaha: 'MASIH RENCANA',
    bukaLowonganKerja: 'TIDAK',
    daftarLowonganUsaha: [],
    kebutuhanPembekalan: ['PELATIHAN'],
    sumberPenghasilanPasca: ['DANA PENSIUN'],
    kecukupanDanaPensiun: 'CUKUP',
    kesiapanPensiun: 'SIAP',
    perasaanPensiun: 'OPTIMIS',
    dukunganKeluarga: 'SANGAT MENDUKUNG',
    adaPenyakitKronis: 'TIDAK ADA',
    kondisiKesehatan: 'BAIK',
    daftarPenyakit: [],
    riwayatPenyakitDetail: [],
    asuransiAktif: ['BPJS'],
    rutinMcu: 'YA',
    mcuTerakhir: '< 6 BULAN',
    waktuMcuTerakhir: '',
    sejakKapanUsaha: '',
    sejakKapanSewa: '',
    kesehatanLainLain: '',
  });

  // Prepopulate formData when target member changes (without wiping unsaved edits on same-member tab save)
  useEffect(() => {
    const memberKey = existingMember
      ? `${existingMember.id || ''}:${existingMember.nrp || ''}`
      : `NEW:${activeUser.nrp || ''}:${activeUser.role || ''}`;

    if (initializedMemberKeyRef.current === memberKey) {
      return;
    }
    initializedMemberKeyRef.current = memberKey;

    setAvatarCleared(false);
    setSavedTabs({});
    setSavedBanner(null);
    setErrorMsg(null);
    setExpandedSections({
      '1A': false,
      '1B': false,
      '1C': false,
      '1D': false,
      '1E': false,
      '2A': false,
      '2B': false,
      '2C': false,
      '3A': false,
      '3B': false,
      '3C': false,
      '4A': false,
      '4B': false,
      '4C': false,
      '5A': false,
    });

    if (existingMember) {
      const isSelf = existingMember.nrp === activeUser.nrp;
      const resolvedKind = resolveDefaultJenisAnggota(existingMember, isSelf ? activeUser : undefined);
      const calc58 = calculateRetirement58(existingMember.tanggalLahir, existingMember.nrp);

      // Build initial daftarAdc from existingMember.daftarAdc or migrate legacy kontakAdc/namaAdc
      let initialDaftarAdc: AdcPersonel[] = [];
      if (Array.isArray(existingMember.daftarAdc) && existingMember.daftarAdc.length > 0) {
        initialDaftarAdc = existingMember.daftarAdc;
      } else if (existingMember.kontakAdc?.trim() || existingMember.namaAdc?.trim() || existingMember.nrpAdc?.trim()) {
        const raw = (existingMember.kontakAdc || '').trim();
        const parts = raw.split(/\s*-\s*|\s*•\s*/);
        initialDaftarAdc = [
          {
            id: 'adc-init-1',
            nama: existingMember.namaAdc?.trim() || parts[0] || '',
            nrp: existingMember.nrpAdc?.trim() || '',
            pangkat: existingMember.pangkatAdc || 'Briptu',
            jabatan: 'ADC / Ajudan',
            tanggalLahir: '',
            noHp: parts.length > 1 ? parts.slice(1).join(' ') : raw,
            email: '',
          },
        ];
      }

      const detectedStatus = detectStatusKedinasan(
        existingMember.statusKedinasan || existingMember.statusDinas,
        existingMember.jabatanTerakhir || existingMember.jabatan,
        existingMember.jenisAnggota
      );
      const rawCleanedJab =
        cleanJabatanOnly(existingMember.jabatanTerakhir) || existingMember.jabatanTerakhir || '';
      const cleanedJabatan = extractCleanJabatanTitle(rawCleanedJab) || rawCleanedJab;
      const isExt = existingMember.tipeSatker === 'KEMEN/LEMBAGA';
      setIsExternalJabatan(isExt);

      const firstAdc = initialDaftarAdc[0];
      const normalizedRencanaAktivitas =
        existingMember.rencanaAktivitas && existingMember.rencanaAktivitas.length > 0
          ? existingMember.rencanaAktivitas
          : ['USAHA SENDIRI'];

      const hydratedPenyakitDetail = parseDiseaseListToDetail(
        existingMember.riwayatPenyakitDetail,
        existingMember.daftarPenyakit,
        existingMember.lamaMenderita,
        existingMember.penangananPengobatan
      );

      setFormData({
        ...existingMember,
        statusKedinasan: detectedStatus,
        tempatLahir: existingMember.tempatLahir || 'Jakarta',
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        jabatanTerakhir: cleanedJabatan,
        jenisAnggota: resolvedKind,
        tmtPangkat: existingMember.tmtPangkat || '',
        dikbangPolri:
          existingMember.dikbangPolri ||
          (existingMember.nrp === '98010710' ? 'DIKBANGSPES TI POLRI' : 'SESPIMTI POLRI'),
        tandaKehormatan:
          existingMember.tandaKehormatan ||
          'Bintang Bhayangkara Nararya, SL Pengabdian 24 Thn',
        agama: existingMember.agama || 'ISLAM',
        sukuBangsa: existingMember.sukuBangsa || '',
        kompi: existingMember.kompi || (isSelf ? activeUser.kompi : undefined) || 'KOMPI A',
        pleton: existingMember.pleton || (isSelf ? activeUser.pleton : undefined) || 'PLETON 1',
        golonganDarah:
          existingMember.golonganDarah || (isSelf ? activeUser.golonganDarah : undefined) || 'O',
        rhesusDarah:
          existingMember.rhesusDarah || (isSelf ? activeUser.rhesusDarah : undefined) || 'Rh+',
        tinggiBadan:
          existingMember.tinggiBadan || (isSelf ? activeUser.tinggiBadan : undefined) || 172,
        beratBadan:
          existingMember.beratBadan || (isSelf ? activeUser.beratBadan : undefined) || 74,
        kondisiMata: existingMember.kondisiMata || 'Normal (Tanpa Kacamata)',
        frekuensiOlahraga: existingMember.frekuensiOlahraga || 'Rutin (3-5x Seminggu)',
        olahragaFavorit: existingMember.olahragaFavorit || '',
        faskesRujukan: existingMember.faskesRujukan || '',
        alergiObatMakanan: existingMember.alergiObatMakanan || '',
        ukuranBaju:
          existingMember.ukuranBaju || (isSelf ? activeUser.ukuranBaju : undefined) || 'XL',
        ukuranJaket:
          existingMember.ukuranJaket ||
          (isSelf ? activeUser.ukuranJaket : undefined) ||
          existingMember.ukuranBaju ||
          'XL',
        ukuranCelana:
          existingMember.ukuranCelana || (isSelf ? activeUser.ukuranCelana : undefined) || '34',
        ukuranSepatu:
          existingMember.ukuranSepatu || (isSelf ? activeUser.ukuranSepatu : undefined) || '42',
        ukuranTutupKepala:
          existingMember.ukuranTutupKepala ||
          (isSelf ? activeUser.ukuranTutupKepala : undefined) ||
          '58',
        catatanAparel: existingMember.catatanAparel || '',
        kotaDomisili: existingMember.kotaDomisili || '',
        provinsiDomisili: existingMember.provinsiDomisili || '',
        pekerjaanIstri: existingMember.pekerjaanIstri || '',
        biayaSewaTempatTinggal: existingMember.biayaSewaTempatTinggal || '',
        detailSewaTempatTinggal: existingMember.detailSewaTempatTinggal || '',
        sejakKapanSewa: existingMember.sejakKapanSewa || '',
        biayaSewaTahunan: existingMember.biayaSewaTahunan || '',
        detailSewaPurnaTugas: existingMember.detailSewaPurnaTugas || '',
        rencanaAktivitas: normalizedRencanaAktivitas,
        kategoriUsaha: existingMember.kategoriUsaha || 'USAHA PRIBADI / MANDIRI',
        namaUsahaYayasan: existingMember.namaUsahaYayasan || '',
        peranUsahaYayasan: existingMember.peranUsahaYayasan || 'PEMILIK / FOUNDER USAHA',
        lokasiUsaha: existingMember.lokasiUsaha || '',
        sejakKapanUsaha: existingMember.sejakKapanUsaha || '',
        bidangKeahlianPensiun: existingMember.bidangKeahlianPensiun || '',
        bukaLowonganKerja:
          existingMember.bukaLowonganKerja ||
          ((existingMember.daftarLowonganUsaha?.length || 0) > 0 ? 'YA' : 'TIDAK'),
        daftarLowonganUsaha: existingMember.daftarLowonganUsaha || [],
        riwayatPenyakitDetail: hydratedPenyakitDetail,
        daftarPenyakit: formatDetailToDiseaseList(hydratedPenyakitDetail),
        waktuMcuTerakhir: existingMember.waktuMcuTerakhir || '',
        kesehatanLainLain: existingMember.kesehatanLainLain || '',
        namaAdc: existingMember.namaAdc || firstAdc?.nama || '',
        pangkatAdc: existingMember.pangkatAdc || firstAdc?.pangkat || 'Briptu',
        nrpAdc: existingMember.nrpAdc || firstAdc?.nrp || '',
        kontakAdc: existingMember.kontakAdc || firstAdc?.noHp || '',
        daftarAdc: initialDaftarAdc,
        tipeSatker:
          existingMember.tipeSatker ||
          (existingMember.polda?.toUpperCase().includes('MABES') ? 'MABES' : 'POLDA'),
        pendidikanTerakhir:
          existingMember.pendidikanTerakhir ||
          (existingMember.nrp === '98010710' ? 'S1 Teknik Informatika' : 'Akpol 1996 / S2 Hukum'),
        fotoUrl: isSelf
          ? resolveAvatarUrl(existingMember.fotoUrl, activeUser.fotoUrl)
          : getAvatarUrl(existingMember.fotoUrl),
        coverUrl: existingMember.coverUrl || (isSelf ? activeUser.coverUrl : undefined),
        email:
          existingMember.email ||
          (isSelf ? activeUser.email : undefined) ||
          (existingMember.nrp ? `${existingMember.nrp}@polri.go.id` : ''),
        secondaryEmail:
          existingMember.secondaryEmail ||
          (isSelf ? activeUser.secondaryEmail : undefined) ||
          (existingMember.nrp === '98010710' ? 'superadmin@example.com' : ''),
        bio: existingMember.bio || (isSelf ? activeUser.bio : '') || '',
      });
      setPenyakitLainnya('');
    } else if (activeUser.role === 'ANGGOTA') {
      const resolvedKind = resolveDefaultJenisAnggota(undefined, activeUser);
      const calc58 = calculateRetirement58(undefined, activeUser.nrp);
      setFormData((prev) => ({
        ...prev,
        nrp: activeUser.nrp,
        namaLengkap: activeUser.nama,
        pangkat: activeUser.pangkat,
        tempatLahir: 'Jakarta',
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        jenisAnggota: resolvedKind,
        kompi: activeUser.kompi || 'KOMPI A',
        pleton: activeUser.pleton || 'PLETON 1',
        golonganDarah: activeUser.golonganDarah || 'O',
        rhesusDarah: activeUser.rhesusDarah || 'Rh+',
        tinggiBadan: activeUser.tinggiBadan || 172,
        beratBadan: activeUser.beratBadan || 74,
        ukuranBaju: activeUser.ukuranBaju || 'XL',
        ukuranJaket: activeUser.ukuranJaket || 'XL',
        ukuranCelana: activeUser.ukuranCelana || '34',
        ukuranSepatu: activeUser.ukuranSepatu || '42',
        ukuranTutupKepala: activeUser.ukuranTutupKepala || '58',
        biayaSewaTempatTinggal: '',
        detailSewaTempatTinggal: '',
        rencanaAktivitas: ['USAHA BERSAMA / YAYASAN'],
        kategoriUsaha: 'USAHA BERSAMA LETING',
        namaUsahaYayasan: '',
        peranUsahaYayasan: 'ANGGOTA PENYERTA MODAL',
        kesehatanLainLain: '',
        satuanKerja: activeUser.satker || 'Bareskrim Polri',
        polda: activeUser.polda || 'MABES POLRI',
        fotoUrl: resolveAvatarUrl(activeUser.fotoUrl),
        coverUrl: activeUser.coverUrl,
        email: activeUser.email || (activeUser.nrp ? `${activeUser.nrp}@polri.go.id` : ''),
        secondaryEmail: activeUser.secondaryEmail || '',
        bio: activeUser.bio || '',
        daftarAdc: [],
      }));
    } else {
      // Clean form for adding new member
      const calc58 = calculateRetirement58('1974-01-01', '');
      setFormData((prev) => ({
        ...prev,
        id: undefined,
        nrp: '',
        namaLengkap: '',
        tempatLahir: 'Jakarta',
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        jenisAnggota: 'ANGGOTA POLRI',
        kompi: 'KOMPI A',
        pleton: 'PLETON 1',
        golonganDarah: 'O',
        rhesusDarah: 'Rh+',
        tinggiBadan: 172,
        beratBadan: 74,
        ukuranBaju: 'XL',
        ukuranJaket: 'XL',
        ukuranCelana: '34',
        ukuranSepatu: '42',
        ukuranTutupKepala: '58',
        biayaSewaTempatTinggal: '',
        detailSewaTempatTinggal: '',
        biayaSewaTahunan: '',
        detailSewaPurnaTugas: '',
        rencanaAktivitas: ['USAHA BERSAMA / YAYASAN'],
        kategoriUsaha: 'USAHA BERSAMA LETING',
        namaUsahaYayasan: '',
        peranUsahaYayasan: 'ANGGOTA PENYERTA MODAL',
        kesehatanLainLain: '',
        jabatanTerakhir: '',
        satuanKerja: 'Bareskrim Polri',
        polda: 'MABES POLRI',
        subSatker: '',
        pendidikanTerakhir: '',
        noHp: '',
        email: '',
        secondaryEmail: '',
        bio: '',
        fotoUrl: DEFAULT_AVATAR_URL,
        coverUrl: undefined,
        daftarAdc: [],
      }));
      setPenyakitLainnya('');
    }
  }, [existingMember, activeUser]);

  const retirementCalc = React.useMemo(
    () => calculateRetirement58(formData.tanggalLahir, formData.nrp),
    [formData.tanggalLahir, formData.nrp]
  );

  // Memoize Jabatan groups & active selection so typing in text fields is smooth
  const jabatanSelectConfig = React.useMemo(() => {
    const groups = getJabatanGroupsForPangkat(formData.pangkat, formData.nrp);
    const curJab = (formData.jabatanTerakhir || '').trim();
    const isCurInStandard = isStandardPolriJabatan(curJab, formData.pangkat, formData.nrp);
    const isOfficer = isOfficerRankIpdaUp(formData.pangkat);
    const selectValue = isExternalJabatan
      ? EXTERNAL_JABATAN_SENTINEL
      : isCurInStandard
      ? curJab
      : isOfficer && curJab
      ? curJab
      : groups[0]?.options[0] || 'Staf';
    return {
      groups,
      curJab,
      isCurInStandard,
      isOfficer,
      selectValue,
    };
  }, [formData.pangkat, formData.nrp, formData.jabatanTerakhir, isExternalJabatan]);

  const toggleSubSection = (id: SubSectionId) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAndFocusSubSection = (tabNum: 1 | 2 | 3 | 4 | 5, id: SubSectionId) => {
    setStep(tabNum);
    setExpandedSections((prev) => ({ ...prev, [id]: true }));
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(`wizard-sub-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  };

  const setAllSubSectionsInStep = (open: boolean) => {
    const tabMeta = TAB_CONFIG.find((t) => t.num === step);
    if (!tabMeta) return;
    setExpandedSections((prev) => {
      const next = { ...prev };
      tabMeta.subSections.forEach((id) => {
        next[id] = open;
      });
      return next;
    });
  };

  const handleInputChange = (
    field: keyof FormWizardData,
    value: any
  ) => {
    if (errorMsg) setErrorMsg(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleBirthDateChange = (newBirthDate: string) => {
    if (errorMsg) setErrorMsg(null);
    const calc = calculateRetirement58(newBirthDate, formData.nrp);
    setFormData((prev) => ({
      ...prev,
      tanggalLahir: newBirthDate,
      usia: calc.usiaTahun,
      tahunPurnaTugas: calc.tahunPurnaTugas,
      sisaTahunDinas: calc.sisaTahunDinas,
    }));
  };

  const handleAddAdc = () => {
    const newAdc: AdcPersonel = {
      id: 'adc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      nama: '',
      nrp: '',
      pangkat: 'Briptu',
      jabatan: 'ADC / Ajudan',
      tanggalLahir: '',
      noHp: '',
      email: '',
    };
    setFormData((prev) => ({
      ...prev,
      daftarAdc: [...(prev.daftarAdc || []), newAdc],
    }));
    setExpandedSections((prev) => ({ ...prev, '1E': true }));
  };

  const handleRemoveAdc = (index: number) => {
    setFormData((prev) => {
      const updated = [...(prev.daftarAdc || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        daftarAdc: updated,
      };
    });
  };

  const handleUpdateAdc = (index: number, field: keyof AdcPersonel, value: string) => {
    setFormData((prev) => {
      const updated = [...(prev.daftarAdc || [])];
      const currentItem = updated[index];
      if (!currentItem) return prev;
      const nextItem: AdcPersonel = { ...currentItem, [field]: value };
      if (field === 'nrp') {
        const cleanNrp = value.replace(/\s+/g, '');
        const oldAutoEmail = currentItem.nrp ? `${currentItem.nrp.replace(/\s+/g, '')}@polri.go.id` : '';
        if (!currentItem.email || currentItem.email === oldAutoEmail) {
          nextItem.email = cleanNrp ? `${cleanNrp}@polri.go.id` : '';
        }
        if (!currentItem.tanggalLahir && cleanNrp.length >= 4) {
          nextItem.tanggalLahir = deriveBirthDateFromNrp(cleanNrp);
        }
      }
      updated[index] = nextItem;
      return { ...prev, daftarAdc: updated };
    });
  };

  const handleAddChild = () => {
    const newChild: Anak = {
      id: Date.now().toString(),
      nama: '',
      jenisKelamin: 'L',
      tempatLahir: '',
      tanggalLahir: '',
      status: 'PELAJAR',
      institusi: '',
      biayaPendidikanTahunan: '5.000.000 S.D. 25.000.000',
    };
    setFormData((prev) => ({
      ...prev,
      daftarAnak: [...(prev.daftarAnak || []), newChild],
      jumlahAnak: (prev.daftarAnak?.length || 0) + 1,
    }));
    setExpandedSections((prev) => ({ ...prev, '2C': true }));
  };

  const handleRemoveChild = (index: number) => {
    setFormData((prev) => {
      const updated = [...(prev.daftarAnak || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        daftarAnak: updated,
        jumlahAnak: updated.length,
      };
    });
  };

  const handleUpdateChild = (index: number, field: keyof Anak, value: string) => {
    if (errorMsg) setErrorMsg(null);
    setFormData((prev) => {
      const updated = [...(prev.daftarAnak || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, daftarAnak: updated };
    });
  };

  const handleAddLowongan = (presetPosisi?: string) => {
    const newLowongan: LowonganUsahaItem = {
      id: 'loker-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      posisi: presetPosisi || '',
      tipePekerjaan: 'FULL_TIME',
      kuota: '1 Orang',
      prioritasPelamar: 'PUTRA_PUTRI_ALMARHUM_LETING',
      kualifikasi: 'Putra/Putri keluarga besar Wira Satya 96',
      statusLowongan: 'BUKA',
    };
    setFormData((prev) => ({
      ...prev,
      bukaLowonganKerja: 'YA',
      daftarLowonganUsaha: [...(prev.daftarLowonganUsaha || []), newLowongan],
    }));
  };

  const handleRemoveLowongan = (index: number) => {
    setFormData((prev) => {
      const updated = [...(prev.daftarLowonganUsaha || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        bukaLowonganKerja: updated.length > 0 ? prev.bukaLowonganKerja : 'TIDAK',
        daftarLowonganUsaha: updated,
      };
    });
  };

  const handleUpdateLowongan = (
    index: number,
    field: keyof LowonganUsahaItem,
    value: string
  ) => {
    setFormData((prev) => {
      const updated = [...(prev.daftarLowonganUsaha || [])];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, daftarLowonganUsaha: updated };
    });
  };

  // Repeatable Riwayat Penyakit / Diagnosa handlers (like Tambah Anak)
  const handleAddPenyakit = (presetNama?: string) => {
    if (errorMsg) setErrorMsg(null);
    const newItem: RiwayatPenyakitItem = {
      id: 'penyakit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      namaPenyakit: presetNama || '',
      sejakKapan: String(new Date().getFullYear() - 1),
      statusPenyakit: 'TERKONTROL',
      terapiObat: '',
    };
    setFormData((prev) => {
      const nextDetail = [...(prev.riwayatPenyakitDetail || []), newItem];
      return {
        ...prev,
        adaPenyakitKronis: 'ADA',
        riwayatPenyakitDetail: nextDetail,
        daftarPenyakit: formatDetailToDiseaseList(nextDetail),
      };
    });
    setExpandedSections((prev) => ({ ...prev, '4B': true }));
  };

  const handleRemovePenyakit = (index: number) => {
    if (errorMsg) setErrorMsg(null);
    setFormData((prev) => {
      const nextDetail = [...(prev.riwayatPenyakitDetail || [])];
      nextDetail.splice(index, 1);
      const nextStrings = formatDetailToDiseaseList(nextDetail);
      return {
        ...prev,
        riwayatPenyakitDetail: nextDetail,
        daftarPenyakit: nextStrings,
        adaPenyakitKronis: nextDetail.length > 0 ? 'ADA' : 'TIDAK ADA',
      };
    });
  };

  const handleUpdatePenyakit = (
    index: number,
    field: keyof RiwayatPenyakitItem,
    value: string
  ) => {
    if (errorMsg) setErrorMsg(null);
    setFormData((prev) => {
      const nextDetail = [...(prev.riwayatPenyakitDetail || [])];
      if (!nextDetail[index]) return prev;
      nextDetail[index] = { ...nextDetail[index], [field]: value };
      return {
        ...prev,
        riwayatPenyakitDetail: nextDetail,
        daftarPenyakit: formatDetailToDiseaseList(nextDetail),
        adaPenyakitKronis: nextDetail.length > 0 ? 'ADA' : prev.adaPenyakitKronis,
      };
    });
  };

  const handleToggleInsurance = (ins: 'BPJS' | 'ASURANSI KESEHATAN' | 'ASURANSI JIWA' | 'TIDAK ADA') => {
    setFormData((prev) => {
      const current = (prev.asuransiAktif || []) as ('BPJS' | 'ASURANSI KESEHATAN' | 'ASURANSI JIWA' | 'TIDAK ADA')[];
      if (ins === 'TIDAK ADA') {
        return { ...prev, asuransiAktif: ['TIDAK ADA'] };
      }
      const withoutNone = current.filter((x) => x !== 'TIDAK ADA');
      const updated = withoutNone.includes(ins)
        ? withoutNone.filter((x) => x !== ins)
        : [...withoutNone, ins];
      return { ...prev, asuransiAktif: updated.length > 0 ? updated : ['BPJS'] };
    });
  };

  const handleToggleRencanaAktivitas = (act: string) => {
    setFormData((prev) => {
      const current = prev.rencanaAktivitas || [];
      const updated = current.includes(act)
        ? current.filter((x) => x !== act)
        : [...current, act];
      return {
        ...prev,
        rencanaAktivitas: updated.length > 0 ? updated : ['USAHA BERSAMA / YAYASAN'],
      };
    });
  };

  const handleToggleSumberPenghasilan = (src: 'DANA PENSIUN' | 'USAHA' | 'INVESTASI') => {
    setFormData((prev) => {
      const current = (prev.sumberPenghasilanPasca || []) as ('DANA PENSIUN' | 'USAHA' | 'INVESTASI')[];
      const updated = current.includes(src)
        ? current.filter((x) => x !== src)
        : [...current, src];
      return {
        ...prev,
        sumberPenghasilanPasca: updated.length > 0 ? updated : ['DANA PENSIUN'],
      };
    });
  };

  // Real-time BMI / IMT calculation from Tinggi Badan (cm) & Berat Badan (kg)
  const bmiInfo = React.useMemo(() => {
    const tbCm = Number(formData.tinggiBadan) || 0;
    const bbKg = Number(formData.beratBadan) || 0;
    if (tbCm < 100 || bbKg < 30) {
      return null;
    }
    const tbM = tbCm / 100;
    const bmi = bbKg / (tbM * tbM);
    const rounded = bmi.toFixed(1);
    let label = 'Normal / Ideal';
    let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (bmi < 18.5) {
      label = 'Berat Kurang';
      colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (bmi >= 25 && bmi < 30) {
      label = 'Berat Lebih (Overweight)';
      colorClass = 'bg-amber-50 text-amber-900 border-amber-300';
    } else if (bmi >= 30) {
      label = 'Obesitas';
      colorClass = 'bg-red-50 text-red-800 border-red-200';
    }
    return { value: rounded, label, colorClass };
  }, [formData.tinggiBadan, formData.beratBadan]);

  // Sub-section metadata & existing data summaries for left sidebar & right accordion headers
  const subSectionMetaList = React.useMemo(() => {
    const hasCustomFoto = Boolean(formData.fotoUrl && formData.fotoUrl !== DEFAULT_AVATAR_URL);
    const hasBio = Boolean(formData.bio?.trim());
    const anakNames = (formData.daftarAnak || [])
      .map((a) => a.nama?.trim())
      .filter(Boolean);
    const penyakitCount = (formData.riwayatPenyakitDetail || []).filter((p) =>
      p.namaPenyakit?.trim()
    ).length;

    const list: {
      id: SubSectionId;
      tab: 1 | 2 | 3 | 4 | 5;
      title: string;
      shortTitle: string;
      existingDetail: string;
      isComplete: boolean;
    }[] = [
      {
        id: '1A',
        tab: 1,
        title: 'Foto, Sampul & Bio',
        shortTitle: '1A. Foto & Bio',
        existingDetail: `${hasCustomFoto ? 'Foto Terpasang' : 'Foto Standar'} • ${
          hasBio ? `Bio: "${formData.bio!.trim().slice(0, 36)}..."` : 'Bio kosong'
        }`,
        isComplete: hasCustomFoto || hasBio,
      },
      {
        id: '1B',
        tab: 1,
        title: 'Jabatan & Satker Polri',
        shortTitle: '1B. Jabatan & Satker',
        existingDetail: `${formData.pangkat || 'Kombes Pol'} • ${
          formData.jabatanTerakhir?.trim() || 'Belum diisi'
        } — ${formData.satuanKerja || 'Bareskrim Polri'}`,
        isComplete: Boolean(
          formData.pangkat && formData.jabatanTerakhir?.trim() && formData.satuanKerja?.trim()
        ),
      },
      {
        id: '1C',
        tab: 1,
        title: 'Identitas Pribadi & Batalyon',
        shortTitle: '1C. Identitas & Kompi',
        existingDetail: `${formData.kompi || 'KOMPI A'} • ${formData.pleton || 'PLETON 1'} • ${
          retirementCalc.formattedTanggalLahir
        } (${retirementCalc.usiaTahun} Thn)`,
        isComplete: Boolean(
          formData.namaLengkap?.trim() &&
            formData.nrp?.trim() &&
            formData.kompi &&
            formData.pleton &&
            formData.tanggalLahir
        ),
      },
      {
        id: '1D',
        tab: 1,
        title: 'Pendidikan, Dikbang & Tanda Kehormatan',
        shortTitle: '1D. Dikbang & Brevet',
        existingDetail: `${formData.pendidikanTerakhir?.trim() || 'Akpol 1996'} • ${
          formData.dikbangPolri?.trim() || 'SESPIMTI POLRI'
        }`,
        isComplete: Boolean(
          formData.pendidikanTerakhir?.trim() || formData.dikbangPolri?.trim()
        ),
      },
      {
        id: '1E',
        tab: 1,
        title: 'Kontak & Ajudan (ADC)',
        shortTitle: '1E. Kontak & ADC',
        existingDetail: `HP: ${formData.noHp?.trim() || '-'} • ${
          formData.daftarAdc?.length || 0
        } ADC`,
        isComplete: Boolean(formData.noHp?.trim() && formData.email?.trim()),
      },
      {
        id: '2A',
        tab: 2,
        title: 'Domisili & Biaya Sewa',
        shortTitle: '2A. Domisili & Sewa',
        existingDetail: `${formData.statusTempatTinggal || 'MILIK PRIBADI'} • ${
          formData.alamatTempatTinggal?.trim() || 'Belum diisi'
        }${
          formData.statusTempatTinggal === 'SEWA/KONTRAK'
            ? ` • ${formData.biayaSewaTempatTinggal?.trim() || 'Biaya belum diisi'}`
            : ''
        }`,
        isComplete: Boolean(
          formData.alamatTempatTinggal?.trim() &&
            (formData.statusTempatTinggal !== 'SEWA/KONTRAK' ||
              Boolean(formData.biayaSewaTempatTinggal?.trim()))
        ),
      },
      {
        id: '2B',
        tab: 2,
        title:
          formData.statusKedinasan === 'ALMARHUM'
            ? 'Data Istri / Ahli Waris'
            : 'Data Istri / Pasangan',
        shortTitle: '2B. Data Istri',
        existingDetail: `${formData.statusPerkawinan || 'MENIKAH'} • ${
          formData.namaIstri?.trim() ? formData.namaIstri : 'Belum diisi'
        } • HP: ${formData.kontakIstri?.trim() || '-'}`,
        isComplete: Boolean(
          formData.statusPerkawinan === 'BELUM MENIKAH' || formData.namaIstri?.trim()
        ),
      },
      {
        id: '2C',
        tab: 2,
        title: 'Putra-Putri (Anak 1 Garis Keturunan)',
        shortTitle: '2C. Putra-Putri (Anak)',
        existingDetail: `${formData.daftarAnak?.length || 0} Anak${
          anakNames.length > 0 ? ` (${anakNames.join(', ')})` : ''
        }`,
        isComplete:
          (formData.daftarAnak?.length || 0) === 0 ||
          anakNames.length === (formData.daftarAnak?.length || 0),
      },
      {
        id: '3A',
        tab: 3,
        title: `Purna Tugas (${RETIREMENT_AGE_POLRI} Thn) & Hunian`,
        shortTitle: `3A. Purna Tugas & Hunian`,
        existingDetail: `Pensiun ${retirementCalc.tahunPurnaTugas} • Hunian: ${
          formData.statusRumahPurnaTugas || 'MILIK PRIBADI'
        }${
          formData.statusRumahPurnaTugas === 'SEWA/KONTRAK'
            ? ` (${formData.biayaSewaTahunan?.trim() || 'Belum diisi'})`
            : ''
        }`,
        isComplete: Boolean(
          formData.statusRumahPurnaTugas &&
            (formData.statusRumahPurnaTugas !== 'SEWA/KONTRAK' ||
              Boolean(formData.biayaSewaTahunan?.trim()))
        ),
      },
      {
        id: '3B',
        tab: 3,
        title: 'Usaha (Pribadi / Bersama) & Open Lowongan Kerja',
        shortTitle: '3B. Usaha & Lowongan',
        existingDetail: `${formData.kategoriUsaha || 'USAHA PRIBADI / MANDIRI'} • ${
          formData.namaUsahaYayasan?.trim() || formData.jenisUsaha?.trim() || 'Belum diisi'
        }${
          formData.bukaLowonganKerja === 'YA' && (formData.daftarLowonganUsaha?.length || 0) > 0
            ? ` • 💼 ${formData.daftarLowonganUsaha!.length} Lowongan (${formData.daftarLowonganUsaha!
                .map((l) => l.posisi)
                .filter(Boolean)
                .join(', ')})`
            : ''
        }`,
        isComplete: Boolean(
          formData.namaUsahaYayasan?.trim() || formData.jenisUsaha?.trim()
        ),
      },
      {
        id: '3C',
        tab: 3,
        title: 'Kesiapan Finansial Pensiun',
        shortTitle: '3C. Kesiapan Finansial',
        existingDetail: `Dana: ${formData.kecukupanDanaPensiun || 'CUKUP'} • Sikap: ${
          formData.perasaanPensiun || 'OPTIMIS'
        }`,
        isComplete: Boolean(formData.kecukupanDanaPensiun && formData.perasaanPensiun),
      },
      {
        id: '4A',
        tab: 4,
        title: 'Postur Fisik & Golongan Darah',
        shortTitle: '4A. Fisik & Gol. Darah',
        existingDetail: `Gol. Darah: ${formData.golonganDarah || 'O'} (${
          formData.rhesusDarah || 'Rh+'
        }) • TB: ${formData.tinggiBadan || '-'} cm • BB: ${formData.beratBadan || '-'} kg${
          bmiInfo ? ` (IMT ${bmiInfo.value})` : ''
        }`,
        isComplete: Boolean(
          formData.golonganDarah && formData.tinggiBadan && formData.beratBadan
        ),
      },
      {
        id: '4B',
        tab: 4,
        title: 'Kondisi Medis & Riwayat Penyakit',
        shortTitle: '4B. Riwayat Penyakit',
        existingDetail: `Kondisi: ${formData.kondisiKesehatan || 'BAIK'} • Kronis: ${
          formData.adaPenyakitKronis || 'TIDAK ADA'
        }${penyakitCount > 0 ? ` (${penyakitCount} diagnosa)` : ''}`,
        isComplete: Boolean(formData.kondisiKesehatan && formData.adaPenyakitKronis),
      },
      {
        id: '4C',
        tab: 4,
        title: 'Asuransi, MCU & Alergi / Catatan',
        shortTitle: '4C. Asuransi, MCU & Alergi',
        existingDetail: `${(formData.asuransiAktif || ['BPJS']).join(', ')} • MCU: ${
          formData.rutinMcu || 'YA'
        }${formData.alergiObatMakanan?.trim() ? ` • Alergi: ${formData.alergiObatMakanan}` : ''}`,
        isComplete: Boolean((formData.asuransiAktif?.length || 0) > 0 && formData.rutinMcu),
      },
      {
        id: '5A',
        tab: 5,
        title: 'Ukuran Pakaian, Sepatu & Atribut',
        shortTitle: '5A. Ukuran Aparel',
        existingDetail: `Baju: ${formData.ukuranBaju || '-'} • Jaket: ${
          formData.ukuranJaket || formData.ukuranBaju || '-'
        } • Celana: ${formData.ukuranCelana || '-'} • Sepatu: ${
          formData.ukuranSepatu || '-'
        } • Baret/Peci: ${formData.ukuranTutupKepala || '-'}`,
        isComplete: Boolean(
          formData.ukuranBaju && formData.ukuranCelana && formData.ukuranSepatu
        ),
      },
    ];

    return list;
  }, [formData, retirementCalc, bmiInfo]);

  const getSubMeta = (id: SubSectionId) =>
    subSectionMetaList.find((m) => m.id === id) || subSectionMetaList[0];

  const completionPercentage = React.useMemo(() => {
    const completedCount = subSectionMetaList.filter((s) => s.isComplete).length;
    return Math.round((completedCount / subSectionMetaList.length) * 100);
  }, [subSectionMetaList]);

  // Per-Tab Validation
  const validateTab = (tabNum: 1 | 2 | 3 | 4 | 5): boolean => {
    setErrorMsg(null);

    if (!hasEditPermission) {
      setErrorMsg(
        'Akses Ditolak: Anda hanya memiliki izin untuk memperbarui data profil milik Anda sendiri.'
      );
      return false;
    }

    if (!baselineMember && tabNum !== 1) {
      if (!formData.namaLengkap?.trim() || !formData.nrp?.trim()) {
        setStep(1);
        setExpandedSections((prev) => ({ ...prev, '1C': true }));
        setErrorMsg(
          'Untuk personel baru yang belum terdaftar, mohon isi Nama Lengkap dan NRP pada Kategori 1 (Sub-bagian 1C) terlebih dahulu.'
        );
        return false;
      }
    }

    if (tabNum === 1) {
      if (!formData.namaLengkap?.trim()) {
        setExpandedSections((prev) => ({ ...prev, '1C': true }));
        setErrorMsg('Mohon lengkapi Nama Lengkap & Gelar personel pada Sub-bagian 1C.');
        return false;
      }
      const cleanNrp = (formData.nrp || '').replace(/\s+/g, '').trim();
      if (!cleanNrp) {
        setExpandedSections((prev) => ({ ...prev, '1C': true }));
        setErrorMsg('Mohon lengkapi NRP / NIP personel pada Sub-bagian 1C.');
        return false;
      }
      if (!/^\d{6,18}$/.test(cleanNrp)) {
        setExpandedSections((prev) => ({ ...prev, '1C': true }));
        setErrorMsg('NRP / NIP harus berupa angka yang valid (minimal 8 digit NRP Polri).');
        return false;
      }
      if (!formData.satuanKerja?.trim() && !formData.satkerMabes?.trim()) {
        setExpandedSections((prev) => ({ ...prev, '1B': true }));
        setErrorMsg('Mohon pilih Satuan Kerja (Satker) pada Sub-bagian 1B.');
        return false;
      }
      if (isExternalJabatan && !formData.jabatanTerakhir?.trim()) {
        setExpandedSections((prev) => ({ ...prev, '1B': true }));
        setErrorMsg('Mohon ketik nama Jabatan Eksternal (Luar Struktur Polri) pada Sub-bagian 1B.');
        return false;
      }
      return true;
    }

    if (tabNum === 2) {
      if (Array.isArray(formData.daftarAnak) && formData.daftarAnak.length > 0) {
        const emptyChildIdx = formData.daftarAnak.findIndex((c) => !c.nama?.trim());
        if (emptyChildIdx >= 0) {
          setExpandedSections((prev) => ({ ...prev, '2C': true }));
          setErrorMsg(
            `Mohon isi Nama Anak ke-${emptyChildIdx + 1} pada Sub-bagian 2C, atau hapus baris anak yang masih kosong.`
          );
          return false;
        }
      }
      return true;
    }

    if (tabNum === 3) {
      if (!formData.statusRumahPurnaTugas) {
        setExpandedSections((prev) => ({ ...prev, '3A': true }));
        setErrorMsg('Mohon pilih Status Tempat Tinggal Setelah Pensiun pada Sub-bagian 3A.');
        return false;
      }
      return true;
    }

    if (tabNum === 4) {
      const validPenyakitItems = (formData.riwayatPenyakitDetail || []).filter((p) =>
        p.namaPenyakit?.trim()
      );
      if (Array.isArray(formData.riwayatPenyakitDetail) && formData.riwayatPenyakitDetail.length > 0) {
        const emptyIdx = formData.riwayatPenyakitDetail.findIndex((p) => !p.namaPenyakit?.trim());
        if (emptyIdx >= 0) {
          setExpandedSections((prev) => ({ ...prev, '4B': true }));
          setErrorMsg(
            `Mohon isi Nama Penyakit / Diagnosa ke-${emptyIdx + 1} pada Sub-bagian 4B, atau hapus baris yang kosong.`
          );
          return false;
        }
      }
      const hasMedicalNote = Boolean(
        formData.kondisiSaatIni?.trim() || formData.kesehatanLainLain?.trim()
      );
      if (
        formData.adaPenyakitKronis === 'ADA' &&
        validPenyakitItems.length === 0 &&
        !hasMedicalNote
      ) {
        setExpandedSections((prev) => ({ ...prev, '4B': true }));
        setErrorMsg(
          'Anda memilih Status Penyakit Kronis "ADA". Klik "+ Tambah Penyakit" untuk menambahkan detail diagnosa medis & sejak kapan pada Sub-bagian 4B.'
        );
        return false;
      }
      return true;
    }

    return true;
  };

  // Build full AnggotaWiraSatya snapshot from current formData
  const buildFullMemberFromForm = (base?: AnggotaWiraSatya): AnggotaWiraSatya => {
    const derivedPolda = formData.polda || base?.polda || 'MABES POLRI';
    const derivedSatker =
      formData.satuanKerja ||
      (formData.subSatker
        ? `${formData.subSatker} - ${formData.satkerMabes || derivedPolda}`
        : formData.satkerMabes || derivedPolda);

    const validPenyakitDetail = (formData.riwayatPenyakitDetail || []).filter((p) =>
      p.namaPenyakit?.trim()
    );
    const combinedDiseases =
      validPenyakitDetail.length > 0
        ? formatDetailToDiseaseList(validPenyakitDetail)
        : [...(formData.daftarPenyakit || [])];
    const derivedLamaMenderita =
      validPenyakitDetail.find((p) => p.sejakKapan?.trim())?.sejakKapan ||
      formData.lamaMenderita ||
      '';
    const derivedPenanganan =
      validPenyakitDetail
        .map((p) => p.terapiObat?.trim())
        .filter(Boolean)
        .join('; ') ||
      formData.penangananPengobatan ||
      '';

    const finalFotoUrl = avatarCleared
      ? DEFAULT_AVATAR_URL
      : resolveAvatarUrl(formData.fotoUrl, base?.fotoUrl);

    const rawAdcList = [...(formData.daftarAdc || [])];
    const validAdcList = rawAdcList.filter(
      (a) => a.nama.trim().length > 0 || a.noHp.trim().length > 0 || (a.nrp && a.nrp.trim().length > 0)
    );
    const primaryAdc = validAdcList[0];
    const primaryAdcNrp = (primaryAdc?.nrp || '').trim();
    const primaryAdcPangkat = primaryAdc?.pangkat || 'Briptu';

    const syncedKontakAdc =
      validAdcList.length > 0
        ? validAdcList
            .map((a) => `${a.pangkat ? a.pangkat + ' ' : ''}${a.nama}${a.noHp ? ' - ' + a.noHp : ''}`.trim())
            .join(' • ')
        : '';
    const syncedNamaAdc =
      validAdcList.length > 0
        ? validAdcList.map((a) => `${a.pangkat ? a.pangkat + ' ' : ''}${a.nama}`.trim()).join(', ')
        : '';

    const finalCalc58 = calculateRetirement58(formData.tanggalLahir, formData.nrp);
    const resolvedStatusKedinasan = detectStatusKedinasan(
      formData.statusKedinasan,
      formData.jabatanTerakhir,
      formData.jenisAnggota
    );

    const groups = getJabatanGroupsForPangkat(formData.pangkat, formData.nrp);
    const fallbackJab = groups[0]?.options[0] || 'Staf';
    const rawJab = formData.jabatanTerakhir || (!isExternalJabatan ? fallbackJab : '');
    const cleanJabTitle =
      extractCleanJabatanTitle(cleanJabatanOnly(rawJab) || rawJab) ||
      cleanJabatanOnly(rawJab) ||
      rawJab ||
      '';

    const nowIso = new Date().toISOString();

    return {
      id: base?.id || 'ws-' + (formData.nrp || Date.now()),
      nrp: (formData.nrp || base?.nrp || '').trim(),
      ...(base?.oldNrp
        ? { oldNrp: base.oldNrp }
        : base?.nrp && formData.nrp && base.nrp !== formData.nrp.trim()
        ? { oldNrp: base.nrp }
        : {}),
      namaLengkap: (formData.namaLengkap || base?.namaLengkap || '').trim(),
      pangkat: formData.pangkat || base?.pangkat || 'Kombes Pol',
      tmtPangkat: formData.tmtPangkat || base?.tmtPangkat || '',
      jabatanTerakhir: cleanJabTitle,
      statusKedinasan: resolvedStatusKedinasan,
      statusDinas: resolvedStatusKedinasan,
      satuanKerja: derivedSatker,
      tipeSatker:
        formData.tipeSatker || (derivedPolda === 'MABES POLRI' ? 'MABES' : 'POLDA'),
      satkerMabes: formData.satkerMabes || '',
      subSatker: formData.subSatker || '',
      namaPolres: formData.namaPolres || '',
      namaPolsek: formData.namaPolsek || '',
      jenisAnggota: (formData.jenisAnggota || 'ANGGOTA POLRI') as AnggotaWiraSatya['jenisAnggota'],
      polda: derivedPolda,
      pendidikanTerakhir: formData.pendidikanTerakhir || '',
      dikbangPolri: formData.dikbangPolri || '',
      tandaKehormatan: formData.tandaKehormatan || '',
      agama: formData.agama || 'ISLAM',
      sukuBangsa: formData.sukuBangsa || '',
      nomorKtp: formData.nomorKtp || '',
      tempatLahir: formData.tempatLahir || 'Jakarta',
      tanggalLahir: finalCalc58.tanggalLahir,
      usia: finalCalc58.usiaTahun,
      jenisKelamin: formData.jenisKelamin || 'LAKI-LAKI',
      noHp: formData.noHp || '',
      email: formData.email || `${(formData.nrp || base?.nrp || '').trim()}@polri.go.id`,
      secondaryEmail: formData.secondaryEmail || '',
      kontakAdc: syncedKontakAdc,
      namaAdc: syncedNamaAdc,
      pangkatAdc: primaryAdcPangkat || validAdcList[0]?.pangkat || 'Briptu',
      nrpAdc: primaryAdcNrp || validAdcList[0]?.nrp || '',
      daftarAdc: validAdcList,
      fotoUrl: finalFotoUrl,
      coverUrl: formData.coverUrl,
      bio: formData.bio || '',
      kompi: formData.kompi || base?.kompi || 'KOMPI A',
      pleton: formData.pleton || base?.pleton || 'PLETON 1',
      golonganDarah: formData.golonganDarah || base?.golonganDarah || 'O',
      rhesusDarah: formData.rhesusDarah || base?.rhesusDarah || 'Rh+',
      tinggiBadan: Number(formData.tinggiBadan) || base?.tinggiBadan || 172,
      beratBadan: Number(formData.beratBadan) || base?.beratBadan || 74,
      kondisiMata: formData.kondisiMata || base?.kondisiMata || 'Normal (Tanpa Kacamata)',
      frekuensiOlahraga: formData.frekuensiOlahraga || base?.frekuensiOlahraga || '',
      olahragaFavorit: formData.olahragaFavorit || base?.olahragaFavorit || '',
      faskesRujukan: formData.faskesRujukan || base?.faskesRujukan || '',
      alergiObatMakanan: formData.alergiObatMakanan || base?.alergiObatMakanan || '',
      ukuranBaju: formData.ukuranBaju || base?.ukuranBaju || 'XL',
      ukuranJaket: formData.ukuranJaket || base?.ukuranJaket || formData.ukuranBaju || 'XL',
      ukuranCelana: formData.ukuranCelana || base?.ukuranCelana || '34',
      ukuranSepatu: formData.ukuranSepatu || base?.ukuranSepatu || '42',
      ukuranTutupKepala: formData.ukuranTutupKepala || base?.ukuranTutupKepala || '58',
      catatanAparel: formData.catatanAparel || base?.catatanAparel || '',
      alamatTempatTinggal: formData.alamatTempatTinggal || '',
      kotaDomisili: formData.kotaDomisili || '',
      provinsiDomisili: formData.provinsiDomisili || '',
      statusTempatTinggal: formData.statusTempatTinggal || 'MILIK PRIBADI',
      biayaSewaTempatTinggal: formData.biayaSewaTempatTinggal || '',
      detailSewaTempatTinggal: formData.detailSewaTempatTinggal || '',
      sejakKapanSewa: formData.sejakKapanSewa || '',

      statusPerkawinan: formData.statusPerkawinan || 'MENIKAH',
      namaIstri: formData.namaIstri || '',
      pekerjaanIstri: formData.pekerjaanIstri || '',
      tempatLahirIstri: formData.tempatLahirIstri || '',
      tanggalLahirIstri: formData.tanggalLahirIstri || '',
      usiaIstri: Number(formData.usiaIstri) || 50,
      kontakIstri: formData.kontakIstri || '',
      jumlahAnak: formData.daftarAnak?.length || 0,
      daftarAnak: formData.daftarAnak || [],
      tanggunganLain: undefined,

      tahunPurnaTugas: finalCalc58.tahunPurnaTugas,
      sisaTahunDinas: finalCalc58.sisaTahunDinas,
      alamatPurnaTugas: formData.alamatPurnaTugas || '',
      statusRumahPurnaTugas: formData.statusRumahPurnaTugas || 'MILIK PRIBADI',
      detailSewaPurnaTugas: formData.detailSewaPurnaTugas || '',
      biayaSewaTahunan: formData.biayaSewaTahunan || '',
      sudahPembekalan: formData.sudahPembekalan || 'SUDAH',
      rencanaAktivitas: formData.rencanaAktivitas || ['USAHA SENDIRI'],
      kategoriUsaha: formData.kategoriUsaha || 'USAHA PRIBADI / MANDIRI',
      namaUsahaYayasan: formData.namaUsahaYayasan || '',
      peranUsahaYayasan: formData.peranUsahaYayasan || 'PEMILIK / FOUNDER USAHA',
      jenisUsaha: formData.jenisUsaha || '',
      lokasiUsaha: formData.lokasiUsaha || '',
      sejakKapanUsaha: formData.sejakKapanUsaha || '',
      bidangKeahlianPensiun: formData.bidangKeahlianPensiun || '',
      statusUsaha: formData.statusUsaha || 'MASIH RENCANA',
      bukaLowonganKerja:
        (formData.daftarLowonganUsaha || []).filter((l) => l.posisi?.trim()).length > 0
          ? formData.bukaLowonganKerja || 'YA'
          : 'TIDAK',
      daftarLowonganUsaha: (formData.daftarLowonganUsaha || []).filter((l) => l.posisi?.trim()),
      kebutuhanPembekalan: formData.kebutuhanPembekalan || ['PELATIHAN'],
      sumberPenghasilanPasca: formData.sumberPenghasilanPasca || ['DANA PENSIUN'],
      kecukupanDanaPensiun: formData.kecukupanDanaPensiun || 'CUKUP',
      kesiapanPensiun: formData.kesiapanPensiun || 'SIAP',
      perasaanPensiun: formData.perasaanPensiun || 'OPTIMIS',
      dukunganKeluarga: formData.dukunganKeluarga || 'SANGAT MENDUKUNG',

      adaPenyakitKronis:
        combinedDiseases.length > 0 ? 'ADA' : formData.adaPenyakitKronis || 'TIDAK ADA',
      kondisiKesehatan: formData.kondisiKesehatan || 'BAIK',
      daftarPenyakit: combinedDiseases,
      riwayatPenyakitDetail: validPenyakitDetail,
      lamaMenderita: derivedLamaMenderita,
      kondisiSaatIni: formData.kondisiSaatIni || '',
      penangananPengobatan: derivedPenanganan,
      biayaPengobatanDitanggung:
        formData.biayaPengobatanDitanggung || 'DITANGGUNG BPJS/ASURANSI',
      asuransiAktif: formData.asuransiAktif || ['BPJS'],
      rutinMcu: formData.rutinMcu || 'YA',
      mcuTerakhir: formData.mcuTerakhir || '< 6 BULAN',
      waktuMcuTerakhir: formData.waktuMcuTerakhir || '',
      harapanLayananKesehatan: formData.harapanLayananKesehatan || '',
      harapanDukunganLeting: formData.harapanDukunganLeting || '',
      kesehatanLainLain: formData.kesehatanLainLain || '',

      createdAt: base?.createdAt || nowIso,
      updatedAt: nowIso,
    };
  };

  // Per-Tab Partial Save
  const handleSaveTab = (tabNum: 1 | 2 | 3 | 4 | 5, stayOpen: boolean) => {
    if (!validateTab(tabNum)) return;

    const fullSnapshot = buildFullMemberFromForm(baselineMember);
    const nowIso = new Date().toISOString();

    let mergedMember: AnggotaWiraSatya;

    if (!baselineMember) {
      mergedMember = fullSnapshot;
    } else if (tabNum === 1) {
      // Tab 1: Kedinasan, Identitas, Dikbang & Kontak
      mergedMember = {
        ...baselineMember,
        nrp: fullSnapshot.nrp,
        ...(fullSnapshot.oldNrp ? { oldNrp: fullSnapshot.oldNrp } : {}),
        namaLengkap: fullSnapshot.namaLengkap,
        pangkat: fullSnapshot.pangkat,
        tmtPangkat: fullSnapshot.tmtPangkat,
        jabatanTerakhir: fullSnapshot.jabatanTerakhir,
        statusKedinasan: fullSnapshot.statusKedinasan,
        statusDinas: fullSnapshot.statusDinas,
        satuanKerja: fullSnapshot.satuanKerja,
        tipeSatker: fullSnapshot.tipeSatker,
        satkerMabes: fullSnapshot.satkerMabes,
        subSatker: fullSnapshot.subSatker,
        namaPolres: fullSnapshot.namaPolres,
        namaPolsek: fullSnapshot.namaPolsek,
        jenisAnggota: fullSnapshot.jenisAnggota,
        polda: fullSnapshot.polda,
        pendidikanTerakhir: fullSnapshot.pendidikanTerakhir,
        dikbangPolri: fullSnapshot.dikbangPolri,
        tandaKehormatan: fullSnapshot.tandaKehormatan,
        agama: fullSnapshot.agama,
        sukuBangsa: fullSnapshot.sukuBangsa,
        nomorKtp: fullSnapshot.nomorKtp,
        tempatLahir: fullSnapshot.tempatLahir,
        tanggalLahir: fullSnapshot.tanggalLahir,
        usia: fullSnapshot.usia,
        tahunPurnaTugas: fullSnapshot.tahunPurnaTugas,
        sisaTahunDinas: fullSnapshot.sisaTahunDinas,
        jenisKelamin: fullSnapshot.jenisKelamin,
        noHp: fullSnapshot.noHp,
        email: fullSnapshot.email,
        secondaryEmail: fullSnapshot.secondaryEmail,
        kontakAdc: fullSnapshot.kontakAdc,
        namaAdc: fullSnapshot.namaAdc,
        pangkatAdc: fullSnapshot.pangkatAdc,
        nrpAdc: fullSnapshot.nrpAdc,
        daftarAdc: fullSnapshot.daftarAdc,
        fotoUrl: fullSnapshot.fotoUrl,
        coverUrl: fullSnapshot.coverUrl,
        bio: fullSnapshot.bio,
        kompi: fullSnapshot.kompi,
        pleton: fullSnapshot.pleton,
        updatedAt: nowIso,
      };
    } else if (tabNum === 2) {
      // Tab 2: Domisili & Keluarga Inti (1 Garis Keturunan)
      mergedMember = {
        ...baselineMember,
        alamatTempatTinggal: fullSnapshot.alamatTempatTinggal,
        kotaDomisili: fullSnapshot.kotaDomisili,
        provinsiDomisili: fullSnapshot.provinsiDomisili,
        statusTempatTinggal: fullSnapshot.statusTempatTinggal,
        biayaSewaTempatTinggal: fullSnapshot.biayaSewaTempatTinggal,
        detailSewaTempatTinggal: fullSnapshot.detailSewaTempatTinggal,
        sejakKapanSewa: fullSnapshot.sejakKapanSewa,
        statusPerkawinan: fullSnapshot.statusPerkawinan,
        namaIstri: fullSnapshot.namaIstri,
        pekerjaanIstri: fullSnapshot.pekerjaanIstri,
        tempatLahirIstri: fullSnapshot.tempatLahirIstri,
        tanggalLahirIstri: fullSnapshot.tanggalLahirIstri,
        usiaIstri: fullSnapshot.usiaIstri,
        kontakIstri: fullSnapshot.kontakIstri,
        jumlahAnak: fullSnapshot.jumlahAnak,
        daftarAnak: fullSnapshot.daftarAnak,
        tanggunganLain: undefined,
        updatedAt: nowIso,
      };
    } else if (tabNum === 3) {
      // Tab 3: Purna Tugas & Usaha Bersama / Yayasan
      mergedMember = {
        ...baselineMember,
        tanggalLahir: fullSnapshot.tanggalLahir,
        usia: fullSnapshot.usia,
        tahunPurnaTugas: fullSnapshot.tahunPurnaTugas,
        sisaTahunDinas: fullSnapshot.sisaTahunDinas,
        alamatPurnaTugas: fullSnapshot.alamatPurnaTugas,
        statusRumahPurnaTugas: fullSnapshot.statusRumahPurnaTugas,
        detailSewaPurnaTugas: fullSnapshot.detailSewaPurnaTugas,
        biayaSewaTahunan: fullSnapshot.biayaSewaTahunan,
        sudahPembekalan: fullSnapshot.sudahPembekalan,
        rencanaAktivitas: fullSnapshot.rencanaAktivitas,
        kategoriUsaha: fullSnapshot.kategoriUsaha,
        namaUsahaYayasan: fullSnapshot.namaUsahaYayasan,
        peranUsahaYayasan: fullSnapshot.peranUsahaYayasan,
        jenisUsaha: fullSnapshot.jenisUsaha,
        lokasiUsaha: fullSnapshot.lokasiUsaha,
        sejakKapanUsaha: fullSnapshot.sejakKapanUsaha,
        bidangKeahlianPensiun: fullSnapshot.bidangKeahlianPensiun,
        statusUsaha: fullSnapshot.statusUsaha,
        bukaLowonganKerja: fullSnapshot.bukaLowonganKerja,
        daftarLowonganUsaha: fullSnapshot.daftarLowonganUsaha,
        kebutuhanPembekalan: fullSnapshot.kebutuhanPembekalan,
        sumberPenghasilanPasca: fullSnapshot.sumberPenghasilanPasca,
        kecukupanDanaPensiun: fullSnapshot.kecukupanDanaPensiun,
        kesiapanPensiun: fullSnapshot.kesiapanPensiun,
        perasaanPensiun: fullSnapshot.perasaanPensiun,
        dukunganKeluarga: fullSnapshot.dukunganKeluarga,
        updatedAt: nowIso,
      };
    } else if (tabNum === 4) {
      // Tab 4: Kesehatan, Postur Fisik, Golongan Darah & Asuransi
      mergedMember = {
        ...baselineMember,
        golonganDarah: fullSnapshot.golonganDarah,
        rhesusDarah: fullSnapshot.rhesusDarah,
        tinggiBadan: fullSnapshot.tinggiBadan,
        beratBadan: fullSnapshot.beratBadan,
        kondisiMata: fullSnapshot.kondisiMata,
        frekuensiOlahraga: fullSnapshot.frekuensiOlahraga,
        olahragaFavorit: fullSnapshot.olahragaFavorit,
        faskesRujukan: fullSnapshot.faskesRujukan,
        alergiObatMakanan: fullSnapshot.alergiObatMakanan,
        adaPenyakitKronis: fullSnapshot.adaPenyakitKronis,
        kondisiKesehatan: fullSnapshot.kondisiKesehatan,
        daftarPenyakit: fullSnapshot.daftarPenyakit,
        riwayatPenyakitDetail: fullSnapshot.riwayatPenyakitDetail,
        lamaMenderita: fullSnapshot.lamaMenderita,
        kondisiSaatIni: fullSnapshot.kondisiSaatIni,
        penangananPengobatan: fullSnapshot.penangananPengobatan,
        biayaPengobatanDitanggung: fullSnapshot.biayaPengobatanDitanggung,
        asuransiAktif: fullSnapshot.asuransiAktif,
        rutinMcu: fullSnapshot.rutinMcu,
        mcuTerakhir: fullSnapshot.mcuTerakhir,
        waktuMcuTerakhir: fullSnapshot.waktuMcuTerakhir,
        harapanLayananKesehatan: fullSnapshot.harapanLayananKesehatan,
        harapanDukunganLeting: fullSnapshot.harapanDukunganLeting,
        kesehatanLainLain: fullSnapshot.kesehatanLainLain,
        catatanMedis: fullSnapshot.catatanMedis,
        updatedAt: nowIso,
      };
    } else {
      // Tab 5: Aparel & Perlengkapan
      mergedMember = {
        ...baselineMember,
        ukuranBaju: fullSnapshot.ukuranBaju,
        ukuranJaket: fullSnapshot.ukuranJaket,
        ukuranCelana: fullSnapshot.ukuranCelana,
        ukuranSepatu: fullSnapshot.ukuranSepatu,
        ukuranTutupKepala: fullSnapshot.ukuranTutupKepala,
        catatanAparel: fullSnapshot.catatanAparel,
        updatedAt: nowIso,
      };
    }

    // Update initialized key ref so parent existingMember update won't wipe unsaved edits on other tabs
    initializedMemberKeyRef.current = `${mergedMember.id || ''}:${mergedMember.nrp || ''}`;
    setBaselineMember(mergedMember);
    setSavedTabs((prev) => ({ ...prev, [tabNum]: true }));

    const tabMeta = TAB_CONFIG.find((t) => t.num === tabNum) || TAB_CONFIG[0];

    // Persist ADC registry & overrides if Tab 1 or new member
    if (typeof window !== 'undefined') {
      if (tabNum === 1 || !baselineMember) {
        const validAdcList = mergedMember.daftarAdc || [];
        const adcsToRegister = validAdcList.filter((a) => a.nrp && a.nrp.trim().length > 0);
        if (
          mergedMember.nrpAdc?.trim() &&
          !adcsToRegister.some((a) => a.nrp?.trim() === mergedMember.nrpAdc?.trim())
        ) {
          adcsToRegister.unshift({
            id: 'adc-reg-primary',
            nama: mergedMember.namaAdc || `ADC ${mergedMember.namaLengkap}`,
            nrp: mergedMember.nrpAdc.trim(),
            pangkat: mergedMember.pangkatAdc || 'Briptu',
            noHp: mergedMember.kontakAdc || '',
          });
        }

        if (adcsToRegister.length > 0) {
          try {
            const rawReg = localStorage.getItem('ws96_adc_registry_v1');
            const regMap: Record<string, any> = rawReg ? JSON.parse(rawReg) : {};
            const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
            const uOvMap: Record<string, any> = rawUOv ? JSON.parse(rawUOv) : {};

            adcsToRegister.forEach((adcItem) => {
              const cleanAdcNrp = (adcItem.nrp || '').replace(/\s+/g, '').trim();
              if (!cleanAdcNrp || cleanAdcNrp === mergedMember.nrp) return;
              const adcNamaClean = (
                adcItem.nama ||
                mergedMember.namaAdc ||
                `ADC ${mergedMember.namaLengkap}`
              ).trim();
              const adcPangkatClean = adcItem.pangkat || mergedMember.pangkatAdc || 'Briptu';
              const adcNoHpClean = adcItem.noHp || mergedMember.kontakAdc || '';

              regMap[cleanAdcNrp] = {
                adcNrp: cleanAdcNrp,
                adcNama: adcNamaClean,
                adcPangkat: adcPangkatClean,
                adcNoHp: adcNoHpClean,
                pimpinanNrp: mergedMember.nrp,
                pimpinanNama: mergedMember.namaLengkap,
                pimpinanPangkat: mergedMember.pangkat,
              };

              const existingAdcOv = uOvMap[cleanAdcNrp] || {};
              uOvMap[cleanAdcNrp] = {
                ...existingAdcOv,
                id: existingAdcOv.id || `u-adc-${cleanAdcNrp}`,
                profileId: mergedMember.id,
                nrp: cleanAdcNrp,
                nama: adcNamaClean,
                pangkat: adcPangkatClean,
                role: 'ANGGOTA',
                jabatanTerakhir: 'ADC',
                satker: mergedMember.satuanKerja,
                polda: mergedMember.polda,
                email: `${cleanAdcNrp}@polri.go.id`,
                noHp: adcNoHpClean,
                isAdcAccount: true,
                adcOfNrp: mergedMember.nrp,
                adcOfNama: mergedMember.namaLengkap,
                adcOfPangkat: mergedMember.pangkat,
                password: existingAdcOv.password || `WS96@${cleanAdcNrp}`,
                status: 'AKTIF',
                updatedAt: nowIso,
              };
            });

            localStorage.setItem('ws96_adc_registry_v1', JSON.stringify(regMap));
            localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(uOvMap));
          } catch {
            // ignore storage errors
          }
        }
      }

      if (getActiveAdcSessionFromStorage()) {
        recordAdcActivityToAuditLog({
          action: 'AKTIVITAS_ADC',
          details: `Memperbarui Kategori ${tabNum} (${tabMeta.title}) Pimpinan ${mergedMember.pangkat} ${mergedMember.namaLengkap}`,
        });
      }

      // Sync to ws96_auth_user if editing own profile
      if (mergedMember.nrp === activeUser.nrp) {
        try {
          const rawAuth = localStorage.getItem('ws96_auth_user');
          const parsedAuth = rawAuth ? JSON.parse(rawAuth) : activeUser;
          const updatedAuth: AuthUser = {
            ...parsedAuth,
            nama: mergedMember.namaLengkap,
            pangkat: mergedMember.pangkat,
            fotoUrl: mergedMember.fotoUrl,
            coverUrl: mergedMember.coverUrl,
            bio: mergedMember.bio,
            email: mergedMember.email || parsedAuth.email,
            secondaryEmail: mergedMember.secondaryEmail,
            satker: mergedMember.satuanKerja,
            polda: mergedMember.polda,
            statusKedinasan: mergedMember.statusKedinasan,
            kompi: mergedMember.kompi,
            pleton: mergedMember.pleton,
            golonganDarah: mergedMember.golonganDarah,
            rhesusDarah: mergedMember.rhesusDarah,
            tinggiBadan: mergedMember.tinggiBadan,
            beratBadan: mergedMember.beratBadan,
            ukuranBaju: mergedMember.ukuranBaju,
            ukuranJaket: mergedMember.ukuranJaket,
            ukuranCelana: mergedMember.ukuranCelana,
            ukuranSepatu: mergedMember.ukuranSepatu,
            ukuranTutupKepala: mergedMember.ukuranTutupKepala,
          };
          localStorage.setItem('ws96_auth_user', JSON.stringify(updatedAuth));
          localStorage.setItem('ws96_active_user', JSON.stringify(updatedAuth));
          localStorage.setItem('wirasatya96_current_user', JSON.stringify(updatedAuth));
          window.dispatchEvent(new Event('ws96_user_updated'));
        } catch {
          // Ignore storage errors
        }
      }
    }

    // Show saved banner with 5s auto-hide
    const timestamp = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setSavedBanner({
      tabNum,
      tabName: tabMeta.title,
      timestamp,
    });
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setSavedBanner(null);
    }, 5000);

    if (onSaveTab) {
      onSaveTab(mergedMember, tabNum, stayOpen);
    } else {
      onSave(mergedMember);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveTab(step, true);
  };

  const currentTabMeta = TAB_CONFIG.find((t) => t.num === step) || TAB_CONFIG[0];
  const currentStepSubSections = subSectionMetaList.filter((m) => m.tab === step);

  // Reusable Accordion Header + Footer wrapper for each Sub-Section
  const renderSubSectionCard = (id: SubSectionId, children: React.ReactNode, headerExtra?: React.ReactNode) => {
    const meta = getSubMeta(id);
    const isExpanded = Boolean(expandedSections[id]);

    return (
      <div
        id={`wizard-sub-${id}`}
        className={`rounded-2xl border transition-all overflow-hidden bg-white shadow-xs ${
          isExpanded ? 'border-polri-navy/40 ring-1 ring-polri-navy/15' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Clickable Accordion Header */}
        <div
          onClick={() => toggleSubSection(id)}
          className={`w-full p-3.5 sm:px-4 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
            isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50/90 hover:bg-slate-100/80 text-slate-900'
          }`}
        >
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${
                  isExpanded
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-polri-navy text-polri-gold'
                }`}
              >
                {meta.id}
              </span>
              <h4
                className={`text-xs sm:text-sm font-extrabold truncate ${
                  isExpanded ? 'text-white' : 'text-slate-900'
                }`}
              >
                {meta.title}
              </h4>
              {meta.isComplete ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isExpanded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  &#10003; Lengkap
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isExpanded
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  Perlu Diisi
                </span>
              )}
            </div>

            <p
              className={`text-[11px] leading-snug truncate ${
                isExpanded ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {meta.existingDetail}
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {headerExtra}
            <button
              type="button"
              onClick={() => toggleSubSection(id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                isExpanded
                  ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <span>{isExpanded ? 'Tutup' : 'Edit'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Body */}
        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4 bg-white border-t border-slate-100">
            {children}

            {/* Per-Sub-Section Save Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Bagian <strong>{meta.id}</strong> &bull; Tersinkron otomatis ke Profil
              </span>
              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                <span>Simpan Data</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 pb-24 md:pb-12">
      {!hasEditPermission && (
        <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 flex items-center gap-2.5 text-xs font-bold">
          <Lock className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            Akses baca: Anda hanya dapat mengubah data profil milik Anda sendiri.
          </span>
        </div>
      )}

      {/* Saved Toast / Banner */}
      {savedBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Data {savedBanner.tabName} tersimpan ({savedBanner.timestamp} WIB).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSavedBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Validation Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold text-red-700 hover:text-red-900 px-2 py-0.5 rounded-lg hover:bg-red-100 transition-colors shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2-COLUMN TOUR OF DUTY LAYOUT: LEFT SIDEBAR (4) + RIGHT ACCORDION (8)  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-6 items-start">
        {/* LEFT COLUMN (lg:col-span-4 xl:col-span-3): COMPACT SIDEBAR */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-3.5 lg:sticky lg:top-[76px]">
          {/* 1. KARTU RINGKASAN PERSONEL */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-polri-gold bg-slate-100 shrink-0 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(formData.fotoUrl)}
                  alt="Foto Personel"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800 block truncate">
                  {formData.pangkat || 'Kombes Pol'} &bull; NRP {formData.nrp || '—'}
                </span>
                <h3 className="text-sm font-black text-slate-900 truncate">
                  {formData.namaLengkap?.trim() || 'Personel Baru'}
                </h3>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-extrabold">
                    🎖️ {formData.kompi || 'KOMPI A'} &bull; {formData.pleton || 'PLETON 1'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                      formData.statusKedinasan === 'ALMARHUM'
                        ? 'bg-slate-800 text-amber-300 border-slate-700'
                        : formData.statusKedinasan === 'PURNA_TUGAS'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {formData.statusKedinasan === 'ALMARHUM'
                      ? '🕊️ ALMARHUM'
                      : formData.statusKedinasan || 'AKTIF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Kelengkapan Data */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-500">Kelengkapan Data</span>
                <span className="font-extrabold text-polri-navy">{completionPercentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-800 via-amber-500 to-emerald-600 transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Compact Actions: Lihat Profil & Simpan */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-red-900 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Buka tampilan Lihat Profil"
              >
                <Eye className="w-3.5 h-3.5 text-red-800 shrink-0" />
                <span>Lihat Profil</span>
              </button>
              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, false)}
                className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Simpan perubahan dan buka profil"
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>Simpan &amp; Lihat</span>
              </button>
            </div>
          </div>

          {/* 2. KARTU KATEGORI DATA DIRI + SHORTCUT LEMBAR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-red-800" />
                Kategori Data Diri
              </span>
              <span className="text-[10px] font-bold text-slate-400">5 Kategori</span>
            </div>

            <div className="space-y-1.5">
              {TAB_CONFIG.map((t) => {
                const Icon = t.icon;
                const isActive = step === t.num;
                const isSaved = Boolean(savedTabs[t.num]);
                const subItems = subSectionMetaList.filter((m) => m.tab === t.num);
                const doneCount = subItems.filter((m) => m.isComplete).length;

                return (
                  <div key={t.num} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(t.num);
                        setErrorMsg(null);
                      }}
                      className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-red-800 text-white border-red-900 shadow-xs'
                          : isSaved
                          ? 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:bg-emerald-100/60'
                          : 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-white/15 text-amber-300'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate">
                            {t.num}. {t.title}
                          </div>
                          <div
                            className={`text-[10px] font-medium ${
                              isActive ? 'text-amber-200' : 'text-slate-500'
                            }`}
                          >
                            {doneCount}/{subItems.length} lengkap
                            {isSaved ? ' • Tersimpan' : ''}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-black/25 text-white border border-white/20'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {doneCount}/{t.subSections.length}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-8 xl:col-span-9): COLLAPSIBLE SUB-SECTION CARDS */}
        <form onSubmit={handleFormSubmit} noValidate className="lg:col-span-8 xl:col-span-9 space-y-3.5">
          {/* Active Category Header Bar */}
          <div className="bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800 block">
                Kategori {step} dari 5
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {step}. {currentTabMeta.title}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAllSubSectionsInStep(true)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                Buka Semua
              </button>
              <button
                type="button"
                onClick={() => setAllSubSectionsInStep(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                Tutup Semua
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* KATEGORI 1: KEDINASAN & IDENTITAS (SUB-BAGIAN 1A s/d 1E)        */}
          {/* =============================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              {/* SUB-BAGIAN 1A: FOTO PROFIL, SAMPUL & BIO SINGKAT */}
              {renderSubSectionCard(
                '1A',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Foto Profil Card */}
                    <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-polri-gold bg-white flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAvatarUrl(formData.fotoUrl)}
                          alt="Foto Profil"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="text-xs font-bold text-slate-800">Foto Profil Personel</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="px-2.5 py-1.5 rounded-lg bg-polri-navy hover:bg-polri-navyLight text-polri-gold text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                            <Camera className="w-3.5 h-3.5" />
                            <span>Unggah Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const resized = await resizeImageFile(
                                    file,
                                    'AVATAR',
                                    activeUser.nrp,
                                    formData.nrp || activeUser.nrp
                                  );
                                  setAvatarCleared(false);
                                  handleInputChange('fotoUrl', resized);
                                } catch {
                                  // ignore
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {formData.fotoUrl && formData.fotoUrl !== DEFAULT_AVATAR_URL && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarCleared(true);
                                handleInputChange('fotoUrl', DEFAULT_AVATAR_URL);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 text-[11px] font-semibold transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gambar Sampul (Cover Banner) Card */}
                    <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="relative w-20 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getCoverUrl(formData.coverUrl)}
                          alt="Sampul Profil"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="text-xs font-bold text-slate-800">Gambar Sampul Profil</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Unggah Sampul</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const resized = await resizeImageFile(
                                    file,
                                    'COVER',
                                    activeUser.nrp,
                                    formData.nrp || activeUser.nrp
                                  );
                                  handleInputChange('coverUrl', resized);
                                } catch {
                                  // ignore
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {formData.coverUrl && formData.coverUrl !== DEFAULT_COVER_URL && (
                            <button
                              type="button"
                              onClick={() => handleInputChange('coverUrl', undefined)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 text-[11px] font-semibold transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bio / Ringkasan Kedinasan
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ringkasan singkat riwayat penugasan atau jabatan..."
                      value={formData.bio || ''}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1B: STATUS KEDINASAN, PANGKAT, TMT, JABATAN & SATKER POLRI */}
              {renderSubSectionCard(
                '1B',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kategori Personel <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.jenisAnggota || 'ANGGOTA POLRI'}
                        onChange={(e) => handleInputChange('jenisAnggota', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="ANGGOTA POLRI">Personel Polri Aktif</option>
                        <option value="ALUMNI AKPOL 1996">Alumni Akpol 1996</option>
                        <option value="ASN / PNS POLRI">ASN / PNS Polri</option>
                        <option value="PURNAWIRAWAN POLRI">Purnawirawan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Kedinasan <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.statusKedinasan || 'AKTIF'}
                        onChange={(e) => handleInputChange('statusKedinasan', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="AKTIF">Aktif Menjabat</option>
                        <option value="PURNA_TUGAS">Purna Tugas / Pensiun</option>
                        <option value="PTDH">PTDH</option>
                        <option value="ALMARHUM">Almarhum / Gugur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pangkat Terakhir <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.pangkat || 'Kombes Pol'}
                        onChange={(e) => {
                          const nextPangkat = e.target.value;
                          handleInputChange('pangkat', nextPangkat);
                          if (!isExternalJabatan) {
                            const nextGroups = getJabatanGroupsForPangkat(nextPangkat, formData.nrp);
                            const allNextOptions = nextGroups.flatMap((g) => g.options);
                            const curJab = (formData.jabatanTerakhir || '').trim();
                            if (!isOfficerRankIpdaUp(nextPangkat)) {
                              if (!allNextOptions.includes(curJab)) {
                                handleInputChange('jabatanTerakhir', allNextOptions[0] || 'Staf');
                              }
                            } else if (!curJab) {
                              handleInputChange('jabatanTerakhir', allNextOptions[0] || 'Kombes Pol');
                            }
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_PANGKAT_POLRI.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="TMT Pangkat"
                        tooltip="Bisa pilih Tahun saja (misal: 2023), Bulan & Tahun (misal: Januari 2023), atau Tanggal Lengkap."
                        icon={<Calendar className="w-3.5 h-3.5" />}
                      />
                      <FlexiblePeriodInput
                        value={formData.tmtPangkat || ''}
                        onChange={(val) => handleInputChange('tmtPangkat', val)}
                        defaultMode="MONTH_YEAR"
                        minYear={1996}
                        maxYear={new Date().getFullYear() + 1}
                        placeholder="Pilih TMT..."
                        compact
                      />
                    </div>
                  </div>

                  {/* Kartu Informasi Khusus Personel Berstatus ALMARHUM */}
                  {formData.statusKedinasan === 'ALMARHUM' && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                          <span>🕊️ Status: In Memoriam (Almarhum)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-white/10 text-amber-200 font-bold border border-white/15">
                            Istri: {formData.namaIstri?.trim() ? formData.namaIstri : 'Belum Diisi'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-emerald-200 font-bold border border-white/15">
                            Anak: {formData.daftarAnak?.length || 0} Orang
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAndFocusSubSection(2, '2B')}
                        className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Isi Data Keluarga</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2.5">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] font-bold text-slate-600">
                          Satker &amp; Wilayah <span className="text-red-500">*</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            {formData.satuanKerja || 'Bareskrim Polri'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-polri-navy/10 text-polri-navy border border-polri-navy/20">
                            {formData.polda || 'MABES POLRI'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSatkerModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-polri-navy hover:bg-polri-navyLight text-polri-gold text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-all flex-shrink-0 cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Pilih Satker</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          {formData.statusKedinasan === 'ALMARHUM' ||
                          formData.statusKedinasan === 'PURNA_TUGAS' ||
                          formData.statusKedinasan === 'PTDH'
                            ? 'Jabatan Terakhir'
                            : 'Jabatan Saat Ini'}{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                          {jabatanSelectConfig.isOfficer
                            ? `Standar ${formData.pangkat}`
                            : 'Staf / ADC'}
                        </span>
                      </div>

                      <select
                        value={jabatanSelectConfig.selectValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === EXTERNAL_JABATAN_SENTINEL) {
                            setIsExternalJabatan(true);
                            if (isStandardPolriJabatan(jabatanSelectConfig.curJab, formData.pangkat, formData.nrp)) {
                              handleInputChange('jabatanTerakhir', '');
                            }
                          } else {
                            setIsExternalJabatan(false);
                            handleInputChange('jabatanTerakhir', val);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {!isExternalJabatan &&
                          jabatanSelectConfig.isOfficer &&
                          jabatanSelectConfig.curJab &&
                          !jabatanSelectConfig.isCurInStandard && (
                            <optgroup label="Jabatan Tersimpan Saat Ini">
                              <option value={jabatanSelectConfig.curJab}>{jabatanSelectConfig.curJab}</option>
                            </optgroup>
                          )}
                        {jabatanSelectConfig.groups.map((grp) => (
                          <optgroup key={grp.group} label={grp.group}>
                            {grp.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <optgroup label="Penugasan Luar Struktur">
                          <option value={EXTERNAL_JABATAN_SENTINEL}>
                            Eksternal Polri — Tulis Sendiri
                          </option>
                        </optgroup>
                      </select>

                      {isExternalJabatan && (
                        <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 space-y-1">
                          <label className="block text-[11px] font-bold text-amber-900">
                            Jabatan Eksternal <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Nama jabatan di luar struktur Polri..."
                            value={formData.jabatanTerakhir || ''}
                            onChange={(e) => handleInputChange('jabatanTerakhir', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1C: IDENTITAS PRIBADI, AGAMA, SUKU, KOMPI & PLETON BATALYON */}
              {renderSubSectionCard(
                '1C',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Lengkap &amp; Gelar <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nama lengkap beserta gelar..."
                        value={formData.namaLengkap || ''}
                        onChange={(e) => handleInputChange('namaLengkap', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        NRP / NIP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        readOnly={activeUser.role === 'ANGGOTA' && !!baselineMember}
                        placeholder="8 digit NRP / NIP..."
                        value={formData.nrp || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleInputChange('nrp', val);
                          if (
                            (!formData.tanggalLahir || formData.tanggalLahir === '1974-01-01') &&
                            val.replace(/[^0-9]/g, '').length >= 4
                          ) {
                            handleBirthDateChange(deriveBirthDateFromNrp(val));
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none ${
                          activeUser.role === 'ANGGOTA' && baselineMember
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                            : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        NIK / Nomor KTP (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="16 digit NIK KTP..."
                        value={formData.nomorKtp || ''}
                        onChange={(e) => handleInputChange('nomorKtp', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Agama
                        </label>
                        <select
                          value={formData.agama || 'ISLAM'}
                          onChange={(e) => handleInputChange('agama', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        >
                          {DAFTAR_AGAMA.map((ag) => (
                            <option key={ag} value={ag}>
                              {ag}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Suku / Daerah Asal
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Jawa, Sunda, Batak..."
                          value={formData.sukuBangsa || ''}
                          onChange={(e) => handleInputChange('sukuBangsa', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tempat Lahir
                      </label>
                      <input
                        type="text"
                        placeholder="Kota / kabupaten lahir..."
                        value={formData.tempatLahir || ''}
                        onChange={(e) => handleInputChange('tempatLahir', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Tanggal Lahir <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          Usia: {retirementCalc.usiaTahun} Thn
                        </span>
                      </div>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="date"
                          value={formData.tanggalLahir || retirementCalc.tanggalLahir}
                          onChange={(e) => handleBirthDateChange(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Kelompok Kompi & Pleton Batalyon Wira Satya 96 */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-amber-950">
                        Kompi Batalyon Wira Satya 96
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {DAFTAR_KOMPI.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleInputChange('kompi', k)}
                            className={`px-2 py-2 rounded-lg text-[11px] font-extrabold border transition-colors cursor-pointer ${
                              (formData.kompi || 'KOMPI A') === k
                                ? 'bg-red-800 text-white border-red-900 shadow-xs'
                                : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-amber-950">
                        Pleton Batalyon Wira Satya 96
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {DAFTAR_PLETON.map((pl) => (
                          <button
                            key={pl}
                            type="button"
                            onClick={() => handleInputChange('pleton', pl)}
                            className={`px-2 py-2 rounded-lg text-[11px] font-extrabold border transition-colors cursor-pointer ${
                              (formData.pleton || 'PLETON 1') === pl
                                ? 'bg-red-800 text-white border-red-900 shadow-xs'
                                : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {pl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1D: PENDIDIKAN UMUM, DIKBANG POLRI & TANDA KEHORMATAN / BREVET */}
              {renderSubSectionCard(
                '1D',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pendidikan Umum &amp; Akademik Terakhir
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Akpol 1996 / S2 Hukum / S3 Ilmu Kepolisian..."
                        value={formData.pendidikanTerakhir || ''}
                        onChange={(e) => handleInputChange('pendidikanTerakhir', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dikbangti / Dikbangum Polri Terakhir
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: SESPIMTI POLRI / LEMHANNAS RI / SESPIMMEN..."
                        value={formData.dikbangPolri || ''}
                        onChange={(e) => handleInputChange('dikbangPolri', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick-select pills untuk Dikbang Polri */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Pilihan Cepat Dikbang Polri:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {DAFTAR_DIKBANG_POLRI.map((dk) => {
                        const active = (formData.dikbangPolri || '').toUpperCase().includes(dk);
                        return (
                          <button
                            key={dk}
                            type="button"
                            onClick={() => handleInputChange('dikbangPolri', dk)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-polri-navy text-polri-gold border-polri-navy'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {dk}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanda Kehormatan &amp; Brevet Kualifikasi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bintang Bhayangkara Nararya, SL Pengabdian 8/16/24 Thn, Brevet Penyidik..."
                      value={formData.tandaKehormatan || ''}
                      onChange={(e) => handleInputChange('tandaKehormatan', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1E: KONTAK KEDINASAN & DAFTAR AJUDAN (ADC) */}
              {renderSubSectionCard(
                '1E',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        No. WhatsApp Aktif
                      </label>
                      <input
                        type="text"
                        placeholder="0812xxxxxxxx"
                        value={formData.noHp || ''}
                        onChange={(e) => handleInputChange('noHp', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Utama
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          placeholder="Alamat email utama..."
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Cadangan
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          placeholder="Opsional..."
                          value={formData.secondaryEmail || ''}
                          onChange={(e) => handleInputChange('secondaryEmail', e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Daftar ADC / Ajudan */}
                  <div className="pt-3 border-t border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                      <div className="min-w-0">
                        <label className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-polri-gold flex-shrink-0" />
                          <span>Daftar ADC / Ajudan Pendamping (Opsional)</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAdc}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-polri-navy text-polri-gold text-xs font-bold hover:bg-polri-navyLight transition-colors cursor-pointer flex-shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah ADC</span>
                      </button>
                    </div>

                    {(!formData.daftarAdc || formData.daftarAdc.length === 0) && (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center text-xs text-slate-500">
                        Belum ada data ADC pendamping.
                      </div>
                    )}

                    {formData.daftarAdc?.map((adc, idx) => (
                      <div
                        key={adc.id || idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <span className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-polri-gold" />
                            <span>
                              ADC #{idx + 1}: {adc.nama?.trim() || 'Nama Belum Diisi'}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAdc(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Nama ADC <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Nama lengkap ADC..."
                              value={adc.nama}
                              onChange={(e) => handleUpdateAdc(idx, 'nama', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              NRP / NIP ADC
                            </label>
                            <input
                              type="text"
                              placeholder="NRP / NIP ADC..."
                              value={adc.nrp || ''}
                              onChange={(e) => handleUpdateAdc(idx, 'nrp', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Pangkat ADC
                            </label>
                            <select
                              value={adc.pangkat || 'Briptu'}
                              onChange={(e) => handleUpdateAdc(idx, 'pangkat', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            >
                              {DAFTAR_PANGKAT_POLRI.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <LabelWithTooltip
                              label="Kelahiran ADC"
                              tooltip="Bisa diisi Tahun saja, Bulan & Tahun, atau Tanggal Lengkap."
                            />
                            <FlexiblePeriodInput
                              value={adc.tanggalLahir || ''}
                              onChange={(val) => handleUpdateAdc(idx, 'tanggalLahir', val)}
                              defaultMode="YEAR"
                              minYear={1970}
                              maxYear={2008}
                              placeholder="Pilih..."
                              compact
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Peran Pendamping
                            </label>
                            <select
                              value={adc.jabatan || 'ADC / Ajudan'}
                              onChange={(e) => handleUpdateAdc(idx, 'jabatan', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            >
                              <option value="ADC / Ajudan">ADC / Ajudan</option>
                              <option value="Spri / Sekpri">Spri / Sekpri</option>
                              <option value="Walpri">Walpri</option>
                              <option value="Staf Pribadi">Staf Pribadi</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              No. WA ADC <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="0812xxxxxxxx"
                              value={adc.noHp}
                              onChange={(e) => handleUpdateAdc(idx, 'noHp', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* KATEGORI 2: DOMISILI & KELUARGA INTI (SUB-BAGIAN 2A s/d 2C)     */}
          {/* =============================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Compact Banner: Kriteria Calon Penerima Manfaat = Keluarga Inti 1 Garis Keturunan */}
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white border border-polri-gold/40 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Users className="w-4 h-4 text-polri-gold shrink-0" />
                  <span>
                    Cakupan Keluarga Inti:{' '}
                    <strong className="text-polri-gold">
                      Ayah/Suami, Ibu/Istri &amp; Anak (1 Garis Keturunan)
                    </strong>
                  </span>
                  <span
                    className="relative group inline-flex items-center cursor-help"
                    tabIndex={0}
                  >
                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-polri-gold" />
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150 absolute top-full left-0 mt-1.5 w-64 sm:w-72 p-2.5 rounded-lg bg-slate-950 text-slate-100 text-[10px] font-normal leading-relaxed shadow-xl z-50 border border-polri-gold/40">
                      Sesuai ketentuan Paguyuban Wira Satya 96, kriteria calon penerima manfaat hanya mencakup <strong>Keluarga Inti 1 Garis Keturunan (Ayah, Ibu, dan Anak)</strong>. Tanggungan lain di luar garis keturunan langsung tidak termasuk kriteria penerima manfaat.
                    </span>
                  </span>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-polri-gold/20 text-polri-gold border border-polri-gold/40">
                  Kriteria Penerima Manfaat
                </span>
              </div>

              {formData.statusKedinasan === 'ALMARHUM' && (
                <div className="p-3 rounded-xl bg-amber-950 text-white border border-amber-400/50 shadow-2xs flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-amber-300">
                    🕊️ Data Ahli Waris Inti Almarhum (Istri &amp; Putra-Putri)
                  </span>
                </div>
              )}

              {/* SUB-BAGIAN 2A: ALAMAT DOMISILI SAAT INI & RINCIAN BIAYA SEWA/KONTRAK */}
              {renderSubSectionCard(
                '2A',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <LabelWithTooltip
                        label="Status Hunian"
                        icon={<Home className="w-3.5 h-3.5" />}
                        tooltip="Pilih SEWA/KONTRAK jika saat ini menyewa tempat tinggal agar rincian biaya & periode kontrak muncul."
                      />
                      <select
                        value={formData.statusTempatTinggal || 'MILIK PRIBADI'}
                        onChange={(e) => handleInputChange('statusTempatTinggal', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="MILIK PRIBADI">MILIK PRIBADI</option>
                        <option value="RUMAH KELUARGA">RUMAH KELUARGA</option>
                        <option value="DINAS">DINAS (ASRAMA / RUMDIN)</option>
                        <option value="SEWA/KONTRAK">SEWA / KONTRAK</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label={
                          formData.statusKedinasan === 'ALMARHUM'
                            ? 'Alamat Domisili Keluarga'
                            : 'Alamat Domisili'
                        }
                      />
                      <input
                        type="text"
                        placeholder="Jalan, komplek, RT/RW..."
                        value={formData.alamatTempatTinggal || ''}
                        onChange={(e) => handleInputChange('alamatTempatTinggal', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Kota / Kabupaten" />
                      <input
                        type="text"
                        placeholder="Contoh: Jakarta Selatan..."
                        value={formData.kotaDomisili || ''}
                        onChange={(e) => handleInputChange('kotaDomisili', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Provinsi" />
                      <input
                        type="text"
                        placeholder="Contoh: DKI Jakarta..."
                        value={formData.provinsiDomisili || ''}
                        onChange={(e) => handleInputChange('provinsiDomisili', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    {formData.statusTempatTinggal === 'SEWA/KONTRAK' && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/80 border border-amber-300 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-200/80">
                          <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-700" />
                            <span>Rincian Sewa / Kontrak</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                            SEWA / KONTRAK
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <LabelWithTooltip label="Biaya Sewa / Thn" />
                            <input
                              type="text"
                              placeholder="Rp 36 Jt / Thn"
                              value={formData.biayaSewaTempatTinggal || ''}
                              onChange={(e) => handleInputChange('biayaSewaTempatTinggal', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                            <div className="grid grid-cols-3 gap-1">
                              {KISARAN_BIAYA_SEWA_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleInputChange('biayaSewaTempatTinggal', opt)}
                                  className={`px-1.5 py-1 rounded text-[10px] font-extrabold border text-center whitespace-nowrap transition-colors cursor-pointer ${
                                    formData.biayaSewaTempatTinggal === opt
                                      ? 'bg-amber-800 text-white border-amber-900'
                                      : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <LabelWithTooltip
                              label="Mulai Sewa Sejak"
                              tooltip="Bisa pilih Tahun saja, Bulan & Tahun, atau Tanggal Lengkap."
                            />
                            <FlexiblePeriodInput
                              value={formData.sejakKapanSewa || ''}
                              onChange={(val) => handleInputChange('sejakKapanSewa', val)}
                              defaultMode="MONTH_YEAR"
                              minYear={2010}
                              maxYear={new Date().getFullYear() + 2}
                              placeholder="Sejak..."
                              compact
                            />
                          </div>

                          <div>
                            <LabelWithTooltip label="Keterangan Kontrak" />
                            <input
                              type="text"
                              placeholder="Contoh: Kontrak 2 thn..."
                              value={formData.detailSewaTempatTinggal || ''}
                              onChange={(e) => handleInputChange('detailSewaTempatTinggal', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 2B: DATA ISTRI / PASANGAN & KONTAK KELUARGA */}
              {renderSubSectionCard(
                '2B',
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <LabelWithTooltip label="Status Perkawinan" />
                    <select
                      value={formData.statusPerkawinan || 'MENIKAH'}
                      onChange={(e) => handleInputChange('statusPerkawinan', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    >
                      <option value="MENIKAH">MENIKAH</option>
                      <option value="BELUM MENIKAH">BELUM MENIKAH</option>
                      <option value="DUDA/JANDA">DUDA / JANDA</option>
                    </select>
                  </div>

                  <div>
                    <LabelWithTooltip
                      label={
                        formData.statusKedinasan === 'ALMARHUM'
                          ? 'Nama Istri / Ahli Waris'
                          : 'Nama Istri / Pasangan'
                      }
                    />
                    <input
                      type="text"
                      placeholder="Nama lengkap istri..."
                      value={formData.namaIstri || ''}
                      onChange={(e) => handleInputChange('namaIstri', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <LabelWithTooltip label="No. WA Istri / Keluarga" />
                    <input
                      type="text"
                      placeholder="0812xxxxxxxx"
                      value={formData.kontakIstri || ''}
                      onChange={(e) => handleInputChange('kontakIstri', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <LabelWithTooltip label="Pekerjaan / Aktivitas Istri" />
                    <input
                      type="text"
                      placeholder="Bhayangkari / ASN / Wiraswasta..."
                      value={formData.pekerjaanIstri || ''}
                      onChange={(e) => handleInputChange('pekerjaanIstri', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <LabelWithTooltip label="Tempat Lahir Istri" />
                    <input
                      type="text"
                      placeholder="Kota lahir..."
                      value={formData.tempatLahirIstri || ''}
                      onChange={(e) => handleInputChange('tempatLahirIstri', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <LabelWithTooltip
                      label="Kelahiran Istri"
                      tooltip="Bisa pilih Tahun saja, Bulan & Tahun, atau Tanggal Lengkap."
                      badge={
                        formData.usiaIstri ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {formData.usiaIstri} Thn
                          </span>
                        ) : undefined
                      }
                    />
                    <FlexiblePeriodInput
                      value={formData.tanggalLahirIstri || ''}
                      onChange={(val) => {
                        handleInputChange('tanggalLahirIstri', val);
                        if (val) {
                          const c = calculateRetirement58(val);
                          handleInputChange('usiaIstri', c.usiaTahun);
                        }
                      }}
                      defaultMode="FULL_DATE"
                      minYear={1955}
                      maxYear={2005}
                      placeholder="Pilih kelahiran..."
                      compact
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 2C: DAFTAR PUTRA-PUTRI / ANAK (1 GARIS KETURUNAN) */}
              {renderSubSectionCard(
                '2C',
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-polri-navy" />
                      <span className="text-xs font-extrabold text-slate-800">
                        Putra-Putri Kandung / Sah ({formData.daftarAnak?.length || 0} Anak)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddChild}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-polri-navy text-polri-gold text-xs font-bold hover:bg-polri-navyLight transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Anak</span>
                    </button>
                  </div>

                  {(!formData.daftarAnak || formData.daftarAnak.length === 0) && (
                    <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center text-xs text-slate-500">
                      Belum ada data anak. Klik <strong>&ldquo;+ Tambah Anak&rdquo;</strong> untuk menambahkan.
                    </div>
                  )}

                  {formData.daftarAnak?.map((anak, idx) => (
                    <div
                      key={anak.id || idx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-polri-navy text-polri-gold text-[10px] font-extrabold">
                            Anak #{idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            {anak.nama?.trim() || 'Nama Belum Diisi'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(idx)}
                          className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                        <div className="lg:col-span-2">
                          <LabelWithTooltip label="Nama Lengkap Anak" required />
                          <input
                            type="text"
                            placeholder="Nama lengkap anak..."
                            value={anak.nama}
                            onChange={(e) => handleUpdateChild(idx, 'nama', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          />
                        </div>

                        <div>
                          <LabelWithTooltip label="L/P & Kota Lahir" />
                          <div className="flex gap-1">
                            <select
                              value={anak.jenisKelamin || 'L'}
                              onChange={(e) => handleUpdateChild(idx, 'jenisKelamin', e.target.value)}
                              className="w-14 px-1.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy shrink-0"
                            >
                              <option value="L">L</option>
                              <option value="P">P</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Kota..."
                              value={anak.tempatLahir || ''}
                              onChange={(e) => handleUpdateChild(idx, 'tempatLahir', e.target.value)}
                              className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                            />
                          </div>
                        </div>

                        <div>
                          <LabelWithTooltip
                            label="Kelahiran"
                            tooltip="Fleksibel: bisa pilih Tahun saja, Bulan & Tahun, atau Tanggal Lengkap."
                          />
                          <FlexiblePeriodInput
                            value={anak.tanggalLahir || ''}
                            onChange={(val) => handleUpdateChild(idx, 'tanggalLahir', val)}
                            defaultMode="YEAR"
                            minYear={1990}
                            maxYear={new Date().getFullYear()}
                            placeholder="Pilih..."
                            compact
                          />
                        </div>

                        <div>
                          <LabelWithTooltip label="Status & Institusi" />
                          <select
                            value={anak.status}
                            onChange={(e) => handleUpdateChild(idx, 'status', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy mb-1"
                          >
                            <option value="PELAJAR">PELAJAR / MHS</option>
                            <option value="BEKERJA">BEKERJA</option>
                            <option value="BELUM BEKERJA">CARI KERJA</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Sekolah/Kampus/Kantor..."
                            value={anak.institusi || ''}
                            onChange={(e) => handleUpdateChild(idx, 'institusi', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          />
                        </div>

                        <div>
                          <LabelWithTooltip
                            label="Biaya Pendidikan"
                            tooltip="Estimasi biaya pendidikan tahunan (jika masih sekolah/kuliah)."
                          />
                          <select
                            value={anak.biayaPendidikanTahunan || '< 5.000.000'}
                            onChange={(e) => handleUpdateChild(idx, 'biayaPendidikanTahunan', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          >
                            <option value="< 5.000.000">&lt; 5 Jt / Thn</option>
                            <option value="5.000.000 S.D. 25.000.000">5 - 25 Jt / Thn</option>
                            <option value="> 25.000.000">&gt; 25 Jt / Thn</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>,
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* KATEGORI 3: PURNA TUGAS & USAHA BERSAMA / YAYASAN (3A s/d 3C)   */}
          {/* =============================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              {/* SUB-BAGIAN 3A: PROYEKSI PURNA TUGAS (BUP 60 TAHUN) & RENCANA HUNIAN PENSIUN */}
              {renderSubSectionCard(
                '3A',
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-polri-navy">
                        Kalkulasi Pensiun BUP {RETIREMENT_AGE_POLRI} Tahun
                      </span>
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-polri-navy text-polri-gold">
                        Pensiun {retirementCalc.tahunPurnaTugas} ({retirementCalc.sisaMasaDinasShort})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Tanggal Lahir
                        </label>
                        <input
                          type="date"
                          value={formData.tanggalLahir || retirementCalc.tanggalLahir}
                          onChange={(e) => handleBirthDateChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Tahun Pensiun ({RETIREMENT_AGE_POLRI} Thn)
                        </label>
                        <input
                          type="number"
                          readOnly
                          value={retirementCalc.tahunPurnaTugas}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs font-extrabold text-slate-800 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Sisa Masa Dinas
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`${retirementCalc.sisaMasaDinasShort} (Usia ${retirementCalc.usiaTahun} Thn)`}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs font-extrabold text-emerald-800 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Pembekalan Purna Tugas
                      </label>
                      <select
                        value={formData.sudahPembekalan || 'SUDAH'}
                        onChange={(e) => handleInputChange('sudahPembekalan', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SUDAH">SUDAH MENGIKUTI</option>
                        <option value="BELUM">BELUM MENGIKUTI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Hunian Pensiun
                      </label>
                      <select
                        value={formData.statusRumahPurnaTugas || 'MILIK PRIBADI'}
                        onChange={(e) => handleInputChange('statusRumahPurnaTugas', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="MILIK PRIBADI">MILIK PRIBADI</option>
                        <option value="RUMAH KELUARGA">RUMAH KELUARGA</option>
                        <option value="SEWA/KONTRAK">SEWA / KONTRAK</option>
                        <option value="DINAS">DINAS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kota / Alamat Rencana Pensiun
                      </label>
                      <input
                        type="text"
                        placeholder="Kota atau alamat rencana pensiun..."
                        value={formData.alamatPurnaTugas || ''}
                        onChange={(e) => handleInputChange('alamatPurnaTugas', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    {formData.statusRumahPurnaTugas === 'SEWA/KONTRAK' && (
                      <div className="sm:col-span-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-300 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-200/80">
                          <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-700" />
                            <span>Rincian Biaya Sewa Hunian Pensiun</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                            SEWA / KONTRAK
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              Estimasi Biaya Sewa
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: Rp 30 Juta / Tahun"
                              value={formData.biayaSewaTahunan || ''}
                              onChange={(e) => handleInputChange('biayaSewaTahunan', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                              {KISARAN_BIAYA_SEWA_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleInputChange('biayaSewaTahunan', opt)}
                                  className={`px-2 py-1.5 rounded-lg text-[11px] font-extrabold border text-center whitespace-nowrap transition-colors cursor-pointer ${
                                    formData.biayaSewaTahunan === opt
                                      ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                                      : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              Keterangan Rencana Sewa
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: Rencana kontrak 2 tahun"
                              value={formData.detailSewaPurnaTugas || ''}
                              onChange={(e) => handleInputChange('detailSewaPurnaTugas', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 3B: USAHA PRIBADI / BERSAMA LETING & OPEN LOWONGAN KERJA */}
              {renderSubSectionCard(
                '3B',
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Rencana Aktivitas Pasca Dinas
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      {DAFTAR_RENCANA_AKTIVITAS.map((act) => {
                        const checked = (formData.rencanaAktivitas || []).includes(act);
                        return (
                          <label
                            key={act}
                            className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer p-1"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleRencanaAktivitas(act)}
                              className="rounded text-polri-navy focus:ring-polri-navy"
                            />
                            <span className={checked ? 'font-extrabold text-polri-navy' : ''}>
                              {act === 'USAHA SENDIRI'
                                ? 'USAHA SENDIRI (PRIBADI / MANDIRI)'
                                : act === 'USAHA BERSAMA / YAYASAN'
                                ? 'USAHA BERSAMA LETING / YAYASAN'
                                : act}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Skema Kepemilikan Usaha
                      </label>
                      <select
                        value={formData.kategoriUsaha || 'USAHA PRIBADI / MANDIRI'}
                        onChange={(e) => handleInputChange('kategoriUsaha', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_KATEGORI_USAHA.map((kat) => (
                          <option key={kat} value={kat}>
                            {kat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Jabatan / Peran dalam Usaha
                      </label>
                      <select
                        value={formData.peranUsahaYayasan || 'PEMILIK / FOUNDER USAHA'}
                        onChange={(e) => handleInputChange('peranUsahaYayasan', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_PERAN_USAHA_YAYASAN.map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="Nama Perusahaan / Unit Usaha"
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        tooltip="Nama PT/CV/Unit usaha pribadi maupun usaha bersama leting."
                      />
                      <input
                        type="text"
                        placeholder="Contoh: PT Garda Satya Nusantara..."
                        value={formData.namaUsahaYayasan || ''}
                        onChange={(e) => handleInputChange('namaUsahaYayasan', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Bidang Usaha / Produk & Jasa" />
                      <input
                        type="text"
                        placeholder="Contoh: Logistik, Pengamanan, Kuliner, Properti..."
                        value={formData.jenisUsaha || ''}
                        onChange={(e) => handleInputChange('jenisUsaha', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Lokasi / Kota Operasional" />
                      <input
                        type="text"
                        placeholder="Contoh: Jakarta Selatan, Surabaya..."
                        value={formData.lokasiUsaha || ''}
                        onChange={(e) => handleInputChange('lokasiUsaha', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Status Operasional" />
                      <select
                        value={formData.statusUsaha || 'MASIH RENCANA'}
                        onChange={(e) => handleInputChange('statusUsaha', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SUDAH JALAN">SUDAH JALAN (AKTIF)</option>
                        <option value="DALAM PERSIAPAN">DALAM PERSIAPAN</option>
                        <option value="MASIH RENCANA">MASIH RENCANA</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="Mulai / Berdiri Sejak"
                        tooltip="Fleksibel: bisa pilih Tahun saja, Bulan & Tahun, atau Tanggal Lengkap."
                      />
                      <FlexiblePeriodInput
                        value={formData.sejakKapanUsaha || ''}
                        onChange={(val) => handleInputChange('sejakKapanUsaha', val)}
                        defaultMode="YEAR"
                        minYear={1996}
                        maxYear={new Date().getFullYear() + 5}
                        placeholder="Sejak..."
                        compact
                      />
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="Kompetensi / Keahlian Pasca Dinas"
                        tooltip="Keahlian profesional untuk sinergi bisnis atau penugasan komisaris/konsultan."
                      />
                      <input
                        type="text"
                        placeholder="Konsultan Hukum, Manajemen Pengamanan, Dosen..."
                        value={formData.bidangKeahlianPensiun || ''}
                        onChange={(e) => handleInputChange('bidangKeahlianPensiun', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* =========================================================== */}
                  {/* BURSA OPEN LOWONGAN KERJA DARI USAHA PRIBADI / LETING       */}
                  {/* =========================================================== */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200/80">
                      <LabelWithTooltip
                        label="💼 Open Lowongan Kerja (Bursa Kerja Keluarga WS96)"
                        tooltip="Buka posisi di usaha pribadi atau usaha bersama Anda (Sekretaris, Direktur, Manajer, Staf, Magang) bagi putra-putri leting / almarhum yang membutuhkan pekerjaan."
                        className="mb-0"
                      />
                      <select
                        value={formData.bukaLowonganKerja || 'TIDAK'}
                        onChange={(e) => {
                          const val = e.target.value as 'YA' | 'TIDAK';
                          handleInputChange('bukaLowonganKerja', val);
                          if (val === 'YA' && (formData.daftarLowonganUsaha?.length || 0) === 0) {
                            handleAddLowongan('Sekretaris Direksi');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-extrabold text-emerald-900 shrink-0 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      >
                        <option value="TIDAK">BELUM BUKA LOWONGAN</option>
                        <option value="YA">YA, BUKA LOWONGAN</option>
                      </select>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-900 block">
                        Tambah Cepat Posisi Lowongan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_POSISI_LOWONGAN.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddLowongan(preset)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddLowongan('')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold transition-colors cursor-pointer"
                        >
                          + Posisi Kustom
                        </button>
                      </div>
                    </div>

                    {formData.bukaLowonganKerja === 'YA' &&
                      (formData.daftarLowonganUsaha?.length || 0) > 0 && (
                        <div className="space-y-3 pt-1">
                          {(formData.daftarLowonganUsaha || []).map((loker, idx) => (
                            <div
                              key={loker.id || idx}
                              className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-emerald-900">
                                  Lowongan #{idx + 1} — {loker.posisi || 'Posisi Baru'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLowongan(idx)}
                                  className="text-[11px] font-bold text-red-700 hover:text-red-900 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                                >
                                  Hapus Lowongan
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Nama Posisi / Jabatan Lowongan *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Contoh: Sekretaris, Direktur Operasional, Manajer..."
                                    value={loker.posisi || ''}
                                    onChange={(e) =>
                                      handleUpdateLowongan(idx, 'posisi', e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Tipe Penempatan
                                  </label>
                                  <select
                                    value={loker.tipePekerjaan || 'FULL_TIME'}
                                    onChange={(e) =>
                                      handleUpdateLowongan(idx, 'tipePekerjaan', e.target.value)
                                    }
                                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                                  >
                                    <option value="FULL_TIME">Full-Time / Tetap</option>
                                    <option value="KONTRAK">Kontrak Profesional</option>
                                    <option value="MAGANG">Magang Putra-Putri Leting</option>
                                    <option value="MITRA_PENGELOLA">Mitra Pengelola / Direksi</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Kuota Kebutuhan
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Contoh: 1 Orang, 2 Orang"
                                    value={loker.kuota || ''}
                                    onChange={(e) =>
                                      handleUpdateLowongan(idx, 'kuota', e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Prioritas Pelamar Keluarga WS96
                                  </label>
                                  <select
                                    value={
                                      loker.prioritasPelamar || 'PUTRA_PUTRI_ALMARHUM_LETING'
                                    }
                                    onChange={(e) =>
                                      handleUpdateLowongan(
                                        idx,
                                        'prioritasPelamar',
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                                  >
                                    <option value="PUTRA_PUTRI_ALMARHUM_LETING">
                                      Prioritas Putra-Putri Almarhum &amp; Leting WS96
                                    </option>
                                    <option value="PUTRA_PUTRI_LETING">
                                      Putra-Putri Leting WS96 (Fresh Graduate / Umum)
                                    </option>
                                    <option value="KELUARGA_BESAR_UMUM">
                                      Keluarga Besar WS96 &amp; Profesional
                                    </option>
                                  </select>
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Kualifikasi / Syarat Singkat
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Contoh: S1/D3, komunikatif, penempatan Jakarta..."
                                    value={loker.kualifikasi || ''}
                                    onChange={(e) =>
                                      handleUpdateLowongan(idx, 'kualifikasi', e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 3C: KESIAPAN FINANSIAL & DUKUNGAN PURNA TUGAS */}
              {renderSubSectionCard(
                '3C',
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Sumber Penghasilan Pasca Dinas
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      {(['DANA PENSIUN', 'USAHA', 'INVESTASI'] as const).map((src) => {
                        const checked = (formData.sumberPenghasilanPasca || []).includes(src);
                        return (
                          <label
                            key={src}
                            className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer p-1"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleSumberPenghasilan(src)}
                              className="rounded text-polri-navy focus:ring-polri-navy"
                            />
                            <span className={checked ? 'font-extrabold text-polri-navy' : ''}>
                              {src}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kecukupan Dana Pensiun
                      </label>
                      <select
                        value={formData.kecukupanDanaPensiun || 'CUKUP'}
                        onChange={(e) => handleInputChange('kecukupanDanaPensiun', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SANGAT CUKUP">SANGAT CUKUP</option>
                        <option value="CUKUP">CUKUP</option>
                        <option value="KURANG">KURANG</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dukungan Paguyuban / Yayasan
                      </label>
                      <select
                        value={formData.kebutuhanPembekalan?.[0] || 'PELATIHAN'}
                        onChange={(e) => handleInputChange('kebutuhanPembekalan', [e.target.value])}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="MODAL">Akses Modal &amp; Kemitraan</option>
                        <option value="PELATIHAN">Pelatihan &amp; Inkubasi Usaha</option>
                        <option value="PENDAMPINGAN">Pendampingan Manajemen &amp; Hukum</option>
                        <option value="TIDAK PERLU">Tidak Perlu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sikap Menghadapi Purna Tugas
                      </label>
                      <select
                        value={formData.perasaanPensiun || 'OPTIMIS'}
                        onChange={(e) => handleInputChange('perasaanPensiun', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="OPTIMIS">OPTIMIS</option>
                        <option value="TENANG">TENANG</option>
                        <option value="CEMAS">CEMAS</option>
                        <option value="RAGU">RAGU</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dukungan Keluarga
                      </label>
                      <select
                        value={formData.dukunganKeluarga || 'SANGAT MENDUKUNG'}
                        onChange={(e) => handleInputChange('dukunganKeluarga', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SANGAT MENDUKUNG">SANGAT MENDUKUNG</option>
                        <option value="MENDUKUNG">MENDUKUNG</option>
                        <option value="KURANG MENDUKUNG">KURANG MENDUKUNG</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* KATEGORI 4: KESEHATAN, FISIK & ASURANSI (4A s/d 4C)             */}
          {/* =============================================================== */}
          {step === 4 && (
            <div className="space-y-4">
              {/* SUB-BAGIAN 4A: POSTUR FISIK, TINGGI/BERAT BADAN, IMT & GOLONGAN DARAH */}
              {renderSubSectionCard(
                '4A',
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Golongan Darah <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.golonganDarah || 'O'}
                        onChange={(e) => handleInputChange('golonganDarah', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_GOLONGAN_DARAH.map((gd) => (
                          <option key={gd} value={gd}>
                            Gol. {gd}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Rhesus Darah
                      </label>
                      <select
                        value={formData.rhesusDarah || 'Rh+'}
                        onChange={(e) => handleInputChange('rhesusDarah', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_RHESUS_DARAH.map((rh) => (
                          <option key={rh} value={rh}>
                            {rh} ({rh === 'Rh+' ? 'Positif' : 'Negatif'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tinggi Badan (cm)
                      </label>
                      <input
                        type="number"
                        min={140}
                        max={220}
                        placeholder="Contoh: 172"
                        value={formData.tinggiBadan || ''}
                        onChange={(e) =>
                          handleInputChange(
                            'tinggiBadan',
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Berat Badan (kg)
                      </label>
                      <input
                        type="number"
                        min={40}
                        max={180}
                        placeholder="Contoh: 74"
                        value={formData.beratBadan || ''}
                        onChange={(e) =>
                          handleInputChange(
                            'beratBadan',
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Kalkulasi Otomatis IMT / BMI */}
                  {bmiInfo && (
                    <div
                      className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${bmiInfo.colorClass}`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Activity className="w-4 h-4 shrink-0" />
                        <span>
                          Indeks Massa Tubuh (IMT / BMI): <strong>{bmiInfo.value} kg/m&sup2;</strong>
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white/80 border border-current/20">
                        Kategori: {bmiInfo.label}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kondisi Mata / Visus
                      </label>
                      <select
                        value={formData.kondisiMata || 'Normal (Tanpa Kacamata)'}
                        onChange={(e) => handleInputChange('kondisiMata', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_KONDISI_MATA.map((km) => (
                          <option key={km} value={km}>
                            {km}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Frekuensi Olahraga
                      </label>
                      <select
                        value={formData.frekuensiOlahraga || 'Rutin (3-5x Seminggu)'}
                        onChange={(e) => handleInputChange('frekuensiOlahraga', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_FREKUENSI_OLAHRAGA.map((fo) => (
                          <option key={fo} value={fo}>
                            {fo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Olahraga Favorit / Kebugaran
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Jalan Pagi, Golf, Tenis, Sepeda..."
                        value={formData.olahragaFavorit || ''}
                        onChange={(e) => handleInputChange('olahragaFavorit', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 4B: KONDISI MEDIS, RIWAYAT PENYAKIT & FASKES RUJUKAN */}
              {renderSubSectionCard(
                '4B',
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <LabelWithTooltip
                        label="Kondisi Kesehatan Umum"
                        icon={<HeartPulse className="w-3.5 h-3.5" />}
                      />
                      <select
                        value={formData.kondisiKesehatan || 'BAIK'}
                        onChange={(e) => handleInputChange('kondisiKesehatan', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SANGAT BAIK">SANGAT BAIK</option>
                        <option value="BAIK">BAIK</option>
                        <option value="CUKUP">CUKUP</option>
                        <option value="PERLU PERHATIAN KHUSUS">PERLU PERHATIAN KHUSUS</option>
                        <option value="SAKIT">SAKIT</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="Status Penyakit Kronis"
                        tooltip="Jika ADA, klik '+ Tambah Penyakit' di bawah untuk mengisi nama diagnosa & sejak kapan."
                      />
                      <select
                        value={formData.adaPenyakitKronis || 'TIDAK ADA'}
                        onChange={(e) => {
                          const val = e.target.value as 'ADA' | 'TIDAK ADA';
                          handleInputChange('adaPenyakitKronis', val);
                          if (
                            val === 'ADA' &&
                            (formData.riwayatPenyakitDetail?.length || 0) === 0
                          ) {
                            handleAddPenyakit('');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="TIDAK ADA">TIDAK ADA</option>
                        <option value="ADA">ADA DIAGNOSA MEDIS</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="RS / Faskes Rujukan"
                        tooltip="Rumah sakit atau fasilitas kesehatan rujukan utama personel."
                      />
                      <input
                        type="text"
                        placeholder="RS Polri Kramat Jati / RS Bhayangkara..."
                        value={formData.faskesRujukan || ''}
                        onChange={(e) => handleInputChange('faskesRujukan', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Daftar Riwayat Penyakit / Diagnosa (Repeatable seperti Tambah Anak) */}
                  <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-polri-navy shrink-0" />
                        <span className="text-xs font-extrabold text-slate-800">
                          Daftar Riwayat Penyakit / Diagnosa ({formData.riwayatPenyakitDetail?.length || 0})
                        </span>
                        <span
                          className="relative group inline-flex items-center cursor-help"
                          tabIndex={0}
                        >
                          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-polri-navy" />
                          <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-60 p-2 rounded-lg bg-slate-900 text-white text-[10px] font-medium leading-relaxed shadow-xl z-50">
                            Tambahkan satu per satu riwayat penyakit beserta waktu mulai terdiagnosa (bisa Tahun saja, Bulan &amp; Tahun, atau Tanggal Lengkap) serta terapi/obat rutin.
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddPenyakit('')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-polri-navy text-polri-gold text-xs font-bold hover:bg-polri-navyLight transition-colors cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Penyakit</span>
                      </button>
                    </div>

                    {/* Quick-Add Preset Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 mr-1">
                        + Cepat:
                      </span>
                      {[
                        { label: 'Hipertensi', val: 'HIPERTENSI (TEKANAN DARAH TINGGI)' },
                        { label: 'Diabetes', val: 'DIABETES MILITUS' },
                        { label: 'Jantung', val: 'PENYAKIT JANTUNG' },
                        { label: 'Kolesterol', val: 'KOLESTEROL TINGGI' },
                        { label: 'Asam Urat', val: 'ASAM URAT' },
                        { label: 'Sendi / Lutut', val: 'NYERI PINGGANG DAN LUTUT' },
                        { label: 'GERD / Lambung', val: 'GERD / ASAM LAMBUNG' },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => handleAddPenyakit(chip.val)}
                          className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-polri-navy border border-slate-200 hover:border-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          + {chip.label}
                        </button>
                      ))}
                    </div>

                    <datalist id="ws96-penyakit-presets">
                      {PRESET_PENYAKIT_CEPAT.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>

                    {(!formData.riwayatPenyakitDetail ||
                      formData.riwayatPenyakitDetail.length === 0) && (
                      <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-white/80 text-center text-xs text-slate-500">
                        Tidak ada riwayat penyakit kronis. Klik{' '}
                        <strong>&ldquo;+ Tambah Penyakit&rdquo;</strong> atau tombol cepat di atas jika ada diagnosa medis.
                      </div>
                    )}

                    {formData.riwayatPenyakitDetail?.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-800 text-white text-[10px] font-extrabold">
                              Diagnosa #{idx + 1}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 truncate max-w-[220px] sm:max-w-[340px]">
                              {item.namaPenyakit?.trim() || 'Nama Diagnosa Belum Diisi'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePenyakit(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <LabelWithTooltip
                              label="Nama Penyakit / Diagnosa"
                              required
                              tooltip="Pilih dari saran atau ketik langsung nama penyakit/diagnosa medis."
                            />
                            <input
                              type="text"
                              list="ws96-penyakit-presets"
                              placeholder="Ketik atau pilih diagnosa..."
                              value={item.namaPenyakit || ''}
                              onChange={(e) =>
                                handleUpdatePenyakit(idx, 'namaPenyakit', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                            />
                          </div>

                          <div>
                            <LabelWithTooltip
                              label="Sejak Kapan"
                              tooltip="Fleksibel: bisa pilih Tahun saja (misal 2021), Bulan & Tahun (Mei 2022), atau Tanggal Lengkap."
                            />
                            <FlexiblePeriodInput
                              value={item.sejakKapan || ''}
                              onChange={(val) =>
                                handleUpdatePenyakit(idx, 'sejakKapan', val)
                              }
                              defaultMode="YEAR"
                              minYear={1990}
                              maxYear={new Date().getFullYear()}
                              placeholder="Sejak..."
                              compact
                            />
                          </div>

                          <div>
                            <LabelWithTooltip label="Status Saat Ini" />
                            <select
                              value={item.statusPenyakit || 'TERKONTROL'}
                              onChange={(e) =>
                                handleUpdatePenyakit(idx, 'statusPenyakit', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                            >
                              <option value="TERKONTROL">Terkontrol / Stabil</option>
                              <option value="TERAPI_RUTIN">Rawat Jalan / Obat Rutin</option>
                              <option value="PEMULIHAN">Masa Pemulihan</option>
                              <option value="ATENSI_KHUSUS">Perlu Atensi Khusus</option>
                              <option value="RIWAYAT_SEMBUH">Riwayat Lama (Sembuh)</option>
                            </select>
                          </div>

                          <div>
                            <LabelWithTooltip
                              label="Terapi / Obat Rutin"
                              tooltip="Obat rutin yang dikonsumsi atau tindakan medis berkala."
                            />
                            <input
                              type="text"
                              placeholder="Obat rutin / kontrol dokter..."
                              value={item.terapiObat || ''}
                              onChange={(e) =>
                                handleUpdatePenyakit(idx, 'terapiObat', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ringkasan Kondisi Terkini */}
                  <div>
                    <LabelWithTooltip
                      label="Ringkasan Kondisi & Penanganan Terkini (Opsional)"
                      tooltip="Catatan umum mengenai perkembangan kondisi fisik atau terapi saat ini."
                    />
                    <input
                      type="text"
                      placeholder="Contoh: Tekanan darah terkontrol dengan olahraga & obat rutin..."
                      value={formData.kondisiSaatIni || ''}
                      onChange={(e) => handleInputChange('kondisiSaatIni', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>,
                <button
                  type="button"
                  onClick={() => handleAddPenyakit('')}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              )}

              {/* SUB-BAGIAN 4C: ASURANSI KESEHATAN, MCU BERKALA, ALERGI & CATATAN LAINNYA */}
              {renderSubSectionCard(
                '4C',
                <div className="space-y-3.5">
                  <div>
                    <LabelWithTooltip label="Asuransi Kesehatan Aktif" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      {DAFTAR_ASURANSI.map((ins) => {
                        const isChecked = formData.asuransiAktif?.includes(ins);
                        return (
                          <label
                            key={ins}
                            className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(isChecked)}
                              onChange={() => handleToggleInsurance(ins)}
                              className="rounded text-polri-navy focus:ring-polri-navy"
                            />
                            <span className={isChecked ? 'font-bold text-polri-navy' : ''}>
                              {ins}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div>
                      <LabelWithTooltip label="Rutin Medical Check-Up" />
                      <select
                        value={formData.rutinMcu || 'YA'}
                        onChange={(e) => handleInputChange('rutinMcu', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="YA">YA (Rutin MCU)</option>
                        <option value="TIDAK">TIDAK</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip label="Rentang MCU Terakhir" />
                      <select
                        value={formData.mcuTerakhir || '< 6 BULAN'}
                        onChange={(e) => handleInputChange('mcuTerakhir', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="< 6 BULAN">&lt; 6 Bulan Lalu</option>
                        <option value="6-12 BULAN">6 - 12 Bulan Lalu</option>
                        <option value="> 1 TAHUN">&gt; 1 Tahun Lalu</option>
                      </select>
                    </div>

                    <div>
                      <LabelWithTooltip
                        label="Waktu MCU Terakhir"
                        tooltip="Fleksibel: bisa pilih Tahun saja, Bulan & Tahun, atau Tanggal Lengkap pelaksanaan MCU."
                      />
                      <FlexiblePeriodInput
                        value={formData.waktuMcuTerakhir || ''}
                        onChange={(val) => handleInputChange('waktuMcuTerakhir', val)}
                        defaultMode="MONTH_YEAR"
                        minYear={2018}
                        maxYear={new Date().getFullYear()}
                        placeholder="Pilih..."
                        compact
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Penanggungan Biaya Medis" />
                      <select
                        value={formData.biayaPengobatanDitanggung || 'DITANGGUNG BPJS/ASURANSI'}
                        onChange={(e) => handleInputChange('biayaPengobatanDitanggung', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="DITANGGUNG BPJS/ASURANSI">BPJS / Asuransi</option>
                        <option value="5.000.000 S.D. 10.000.000">Mandiri Rp 5 - 10 Jt</option>
                        <option value="DI ATAS 10.000.000">Mandiri &gt; Rp 10 Jt</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                    <div>
                      <LabelWithTooltip
                        label="Alergi Obat / Makanan"
                        tooltip="Penting untuk informasi medis darurat saat kegiatan leting."
                      />
                      <input
                        type="text"
                        placeholder="Tidak ada / Alergi seafood / Antibiotik..."
                        value={formData.alergiObatMakanan || ''}
                        onChange={(e) => handleInputChange('alergiObatMakanan', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <LabelWithTooltip label="Harapan Dukungan Kesehatan Leting" />
                      <input
                        type="text"
                        placeholder="Saran layanan kesehatan Paguyuban..."
                        value={formData.harapanDukunganLeting || ''}
                        onChange={(e) => handleInputChange('harapanDukunganLeting', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <LabelWithTooltip label="Catatan Kesehatan Tambahan (Suplemen / Fisioterapi)" />
                      <textarea
                        rows={2}
                        placeholder="Catatan tambahan terkait kesehatan atau kebugaran..."
                        value={formData.kesehatanLainLain || ''}
                        onChange={(e) => handleInputChange('kesehatanLainLain', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* KATEGORI 5: APAREL & PERLENGKAPAN LETING (SUB-BAGIAN 5A)        */}
          {/* =============================================================== */}
          {step === 5 && (
            <div className="space-y-4">
              {/* SUB-BAGIAN 5A: UKURAN PAKAIAN, JAKET, CELANA, SEPATU & TUTUP KEPALA */}
              {renderSubSectionCard(
                '5A',
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Baju / Kemeja
                      </label>
                      <select
                        value={formData.ukuranBaju || 'XL'}
                        onChange={(e) => handleInputChange('ukuranBaju', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_BAJU.map((sz) => (
                          <option key={sz} value={sz}>
                            Ukuran {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Jaket / Rompi
                      </label>
                      <select
                        value={formData.ukuranJaket || formData.ukuranBaju || 'XL'}
                        onChange={(e) => handleInputChange('ukuranJaket', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_JAKET.map((jk) => (
                          <option key={jk} value={jk}>
                            Ukuran {jk}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Celana
                      </label>
                      <select
                        value={formData.ukuranCelana || '34'}
                        onChange={(e) => handleInputChange('ukuranCelana', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_CELANA.map((cl) => (
                          <option key={cl} value={cl}>
                            No. {cl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Sepatu
                      </label>
                      <select
                        value={formData.ukuranSepatu || '42'}
                        onChange={(e) => handleInputChange('ukuranSepatu', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_SEPATU.map((sp) => (
                          <option key={sp} value={sp}>
                            No. {sp}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Tutup Kepala / Baret / Peci
                      </label>
                      <select
                        value={formData.ukuranTutupKepala || '58'}
                        onChange={(e) => handleInputChange('ukuranTutupKepala', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_TUTUP_KEPALA.map((tk) => (
                          <option key={tk} value={tk}>
                            No. {tk}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Catatan Ukuran Khusus / Atribut Reuni Leting (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kemeja lengan panjang, cutting regular fit, kaos olahraga XXL..."
                      value={formData.catatanAparel || ''}
                      onChange={(e) => handleInputChange('catatanAparel', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Unified Action Footer on ALL 5 Categories */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Kembali
              </button>

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-polri-navy hover:bg-polri-navyLight disabled:opacity-50 text-polri-gold text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Kategori {step}</span>
              </button>

              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, false)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Simpan &amp; Profil</span>
              </button>

              {step < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep((step + 1) as 1 | 2 | 3 | 4 | 5);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl border border-polri-navy/30 bg-slate-50 hover:bg-slate-100 text-polri-navy text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* CAS-Style Satker Berjenjang Modal */}
      <SatkerBerjenjangModal
        isOpen={isSatkerModalOpen}
        onClose={() => setIsSatkerModalOpen(false)}
        initialPolda={formData.polda || 'MABES POLRI'}
        initialSatker={formData.satkerMabes || ''}
        initialSubSatker={formData.subSatker || ''}
        onApply={(result) => {
          const isKemen =
            result.polda === 'KEMEN/LEMBAGA' ||
            result.satkerUtama?.toUpperCase().includes('LUAR STRUKTUR') ||
            result.satkerUtama?.toUpperCase().includes('EKSTERNAL');
          if (isKemen) {
            setIsExternalJabatan(true);
          }
          setFormData((prev) => ({
            ...prev,
            polda: result.polda,
            satuanKerja: result.composedSatker,
            satkerMabes: result.satkerUtama,
            subSatker: result.subSatker,
            tipeSatker: isKemen
              ? 'KEMEN/LEMBAGA'
              : result.polda === 'MABES POLRI'
              ? 'MABES'
              : 'POLDA',
          }));
        }}
      />
    </div>
  );
};
