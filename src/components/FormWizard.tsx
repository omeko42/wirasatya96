'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnggotaWiraSatya, Anak, AdcPersonel, AuthUser, DAFTAR_PANGKAT_POLRI } from '@/types';
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
} from 'lucide-react';
import { processSecureImageUpload } from '@/lib/mediaSecurity';

export interface FormWizardProps {
  onSave: (data: AnggotaWiraSatya) => void;
  onCancel: () => void;
  currentUser?: AuthUser;
  existingMember?: AnggotaWiraSatya;
  initialTab?: 1 | 2 | 3 | 4;
  onSaveTab?: (data: AnggotaWiraSatya, tabNum: 1 | 2 | 3 | 4, stayOpen?: boolean) => void;
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
  | '4C';

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

const DAFTAR_UKURAN_BAJU = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL'] as const;
const DAFTAR_UKURAN_CELANA = [
  '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '42', '44', '46',
] as const;
const DAFTAR_UKURAN_SEPATU = ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47'] as const;

const DAFTAR_KOMPI = ['KOMPI A', 'KOMPI B', 'KOMPI C', 'KOMPI D'] as const;
const DAFTAR_PLETON = ['PLETON 1', 'PLETON 2', 'PLETON 3', 'PLETON 4'] as const;

const DAFTAR_KATEGORI_USAHA = [
  'USAHA BERSAMA LETING',
  'YAYASAN WIRA SATYA 96',
  'KOPERASI / INVESTASI BERSAMA',
  'USAHA MANDIRI & BERSAMA',
  'BELUM ADA',
] as const;

const DAFTAR_PERAN_USAHA_YAYASAN = [
  'PEMBINA / PENGAWAS',
  'PENGURUS YAYASAN / DIREKSI',
  'ANGGOTA PENYERTA MODAL',
  'MITRA OPERASIONAL',
  'BELUM DITENTUKAN',
] as const;

const DAFTAR_RENCANA_AKTIVITAS = [
  'USAHA BERSAMA / YAYASAN',
  'BEKERJA KEMBALI',
  'BERTANI/BERKEBUN',
  'MENGURUS KELUARGA',
] as const;

const KISARAN_BIAYA_SEWA_OPTIONS = [
  '< Rp 25 Juta / Tahun',
  'Rp 25 Juta - Rp 50 Juta / Tahun',
  '> Rp 50 Juta / Tahun',
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
  num: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  subSections: SubSectionId[];
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    num: 1,
    title: 'Kedinasan, Kompi & Kontak',
    shortTitle: 'Kedinasan, Kompi & Kontak',
    subSections: ['1A', '1B', '1C', '1D', '1E'],
    icon: Shield,
  },
  {
    num: 2,
    title: 'Domisili & Data Keluarga',
    shortTitle: 'Domisili & Keluarga',
    subSections: ['2A', '2B', '2C'],
    icon: Users,
  },
  {
    num: 3,
    title: 'Purna Tugas & Usaha Bersama / Yayasan',
    shortTitle: 'Purna Tugas & Usaha/Yayasan',
    subSections: ['3A', '3B', '3C'],
    icon: Home,
  },
  {
    num: 4,
    title: 'Kesehatan, Asuransi & Lain-lain',
    shortTitle: 'Kesehatan & Lain-lain',
    subSections: ['4A', '4B', '4C'],
    icon: Activity,
  },
];

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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialTab || 1);
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

  // Accordion state for sub-sections (1A-1E, 2A-2C, 3A-3C, 4A-4C)
  const [expandedSections, setExpandedSections] = useState<Record<SubSectionId, boolean>>({
    '1A': true,
    '1B': true,
    '1C': false,
    '1D': false,
    '1E': false,
    '2A': true,
    '2B': true,
    '2C': false,
    '3A': true,
    '3B': true,
    '3C': false,
    '4A': true,
    '4B': false,
    '4C': false,
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
    polda: 'MABES POLRI',
    pendidikanTerakhir: '',
    jenisKelamin: 'LAKI-LAKI',
    kompi: 'KOMPI A',
    pleton: 'PLETON 1',
    golonganDarah: 'O',
    ukuranBaju: 'XL',
    ukuranCelana: '34',
    ukuranSepatu: '42',
    statusTempatTinggal: 'MILIK PRIBADI',
    biayaSewaTempatTinggal: '',
    detailSewaTempatTinggal: '',
    statusPerkawinan: 'MENIKAH',
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
    rencanaAktivitas: ['USAHA BERSAMA / YAYASAN'],
    kategoriUsaha: 'USAHA BERSAMA LETING',
    namaUsahaYayasan: '',
    peranUsahaYayasan: 'ANGGOTA PENYERTA MODAL',
    statusUsaha: 'MASIH RENCANA',
    kebutuhanPembekalan: ['PELATIHAN'],
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
    mcuTerakhir: '< 6 BULAN',
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
          ? existingMember.rencanaAktivitas.map((act) =>
              act === 'USAHA SENDIRI' ? 'USAHA BERSAMA / YAYASAN' : act
            )
          : ['USAHA BERSAMA / YAYASAN'];

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
        kompi: existingMember.kompi || (isSelf ? activeUser.kompi : undefined) || 'KOMPI A',
        pleton: existingMember.pleton || (isSelf ? activeUser.pleton : undefined) || 'PLETON 1',
        golonganDarah:
          existingMember.golonganDarah || (isSelf ? activeUser.golonganDarah : undefined) || 'O',
        ukuranBaju:
          existingMember.ukuranBaju || (isSelf ? activeUser.ukuranBaju : undefined) || 'XL',
        ukuranCelana:
          existingMember.ukuranCelana || (isSelf ? activeUser.ukuranCelana : undefined) || '34',
        ukuranSepatu:
          existingMember.ukuranSepatu || (isSelf ? activeUser.ukuranSepatu : undefined) || '42',
        biayaSewaTempatTinggal: existingMember.biayaSewaTempatTinggal || '',
        detailSewaTempatTinggal: existingMember.detailSewaTempatTinggal || '',
        biayaSewaTahunan: existingMember.biayaSewaTahunan || '',
        detailSewaPurnaTugas: existingMember.detailSewaPurnaTugas || '',
        rencanaAktivitas: normalizedRencanaAktivitas,
        kategoriUsaha: existingMember.kategoriUsaha || 'USAHA BERSAMA LETING',
        namaUsahaYayasan: existingMember.namaUsahaYayasan || '',
        peranUsahaYayasan: existingMember.peranUsahaYayasan || 'ANGGOTA PENYERTA MODAL',
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
          (existingMember.nrp === '98010710' ? 'S1 Teknik Informatika' : 'Akpol 1996 / Sespimti'),
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

      // Extract any custom diseases not in DAFTAR_PENYAKIT
      if (existingMember.daftarPenyakit && existingMember.daftarPenyakit.length > 0) {
        const custom = existingMember.daftarPenyakit.filter((p) => !DAFTAR_PENYAKIT.includes(p));
        setPenyakitLainnya(custom.length > 0 ? custom.join(', ') : '');
      } else {
        setPenyakitLainnya('');
      }
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
        ukuranBaju: activeUser.ukuranBaju || 'XL',
        ukuranCelana: activeUser.ukuranCelana || '34',
        ukuranSepatu: activeUser.ukuranSepatu || '42',
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
        ukuranBaju: 'XL',
        ukuranCelana: '34',
        ukuranSepatu: '42',
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

  const openAndFocusSubSection = (tabNum: 1 | 2 | 3 | 4, id: SubSectionId) => {
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
    value: string | number | string[] | undefined
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
      tempatLahir: '',
      tanggalLahir: '',
      status: 'PELAJAR',
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

  const handleToggleDisease = (disease: string) => {
    if (errorMsg) setErrorMsg(null);
    setFormData((prev) => {
      const current = prev.daftarPenyakit || [];
      const updated = current.includes(disease)
        ? current.filter((d) => d !== disease)
        : [...current, disease];
      return {
        ...prev,
        daftarPenyakit: updated,
        adaPenyakitKronis: updated.length > 0 ? 'ADA' : prev.adaPenyakitKronis,
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

  // Sub-section metadata & existing data summaries for left sidebar & right accordion headers
  const subSectionMetaList = React.useMemo(() => {
    const hasCustomFoto = Boolean(formData.fotoUrl && formData.fotoUrl !== DEFAULT_AVATAR_URL);
    const hasBio = Boolean(formData.bio?.trim());
    const anakNames = (formData.daftarAnak || [])
      .map((a) => a.nama?.trim())
      .filter(Boolean);

    const list: {
      id: SubSectionId;
      tab: 1 | 2 | 3 | 4;
      title: string;
      shortTitle: string;
      existingDetail: string;
      isComplete: boolean;
    }[] = [
      {
        id: '1A',
        tab: 1,
        title: 'Foto Profil, Sampul & Bio Singkat',
        shortTitle: '1A. Foto, Sampul & Bio',
        existingDetail: `${hasCustomFoto ? 'Foto Profil Terpasang' : 'Foto Standar'} • ${
          hasBio ? `Bio: "${formData.bio!.trim().slice(0, 42)}..."` : 'Bio Belum Diisi'
        }`,
        isComplete: hasCustomFoto || hasBio,
      },
      {
        id: '1B',
        tab: 1,
        title: 'Status Kedinasan, Pangkat, Jabatan & Satker Polri',
        shortTitle: '1B. Jabatan & Satker Polri',
        existingDetail: `${formData.pangkat || 'Kombes Pol'} • ${
          formData.jabatanTerakhir?.trim() || 'Jabatan Belum Diisi'
        } — ${formData.satuanKerja || 'Bareskrim Polri'} (${formData.polda || 'MABES POLRI'}) • ${
          formData.statusKedinasan || 'AKTIF'
        }`,
        isComplete: Boolean(
          formData.pangkat && formData.jabatanTerakhir?.trim() && formData.satuanKerja?.trim()
        ),
      },
      {
        id: '1C',
        tab: 1,
        title: 'Kelompok Kompi, Pleton & Identitas Pribadi',
        shortTitle: '1C. Kompi, Pleton & Identitas',
        existingDetail: `${formData.kompi || 'KOMPI A'} • ${formData.pleton || 'PLETON 1'} • ${
          formData.tempatLahir || 'Jakarta'
        }, ${retirementCalc.formattedTanggalLahir} (${retirementCalc.usiaTahun} Thn) • ${
          formData.pendidikanTerakhir?.trim() || 'Pendidikan Belum Diisi'
        }`,
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
        title: 'Ukuran Aparel (Baju, Celana, Sepatu) & Golongan Darah',
        shortTitle: '1D. Ukuran Aparel & Gol. Darah',
        existingDetail: `Gol. Darah: ${formData.golonganDarah || 'O'} • Baju: ${
          formData.ukuranBaju || '-'
        } • Celana: ${formData.ukuranCelana || '-'} • Sepatu: ${formData.ukuranSepatu || '-'}`,
        isComplete: Boolean(
          formData.golonganDarah &&
            formData.ukuranBaju &&
            formData.ukuranCelana &&
            formData.ukuranSepatu
        ),
      },
      {
        id: '1E',
        tab: 1,
        title: 'Kontak Kedinasan & Daftar Ajudan (ADC)',
        shortTitle: '1E. Kontak & Daftar ADC',
        existingDetail: `No. HP: ${formData.noHp?.trim() || 'Belum Diisi'} • Email: ${
          formData.email?.trim() || '-'
        } • ${formData.daftarAdc?.length || 0} ADC Terdata`,
        isComplete: Boolean(formData.noHp?.trim() && formData.email?.trim()),
      },
      {
        id: '2A',
        tab: 2,
        title: 'Alamat Domisili Saat Ini & Rincian Biaya Sewa/Kontrak',
        shortTitle: '2A. Domisili & Rincian Sewa',
        existingDetail: `${formData.statusTempatTinggal || 'MILIK PRIBADI'} • ${
          formData.alamatTempatTinggal?.trim() || 'Alamat Belum Diisi - Perlu Diperbaharui'
        }${
          formData.statusTempatTinggal === 'SEWA/KONTRAK'
            ? ` • Sewa: ${formData.biayaSewaTempatTinggal?.trim() || 'Nominal Belum Dirinci'}`
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
            ? 'Data Istri / Ahli Waris Almarhum & Kontak Keluarga'
            : 'Data Istri / Pasangan & Kontak Keluarga',
        shortTitle: '2B. Data Istri / Pasangan',
        existingDetail: `${formData.statusPerkawinan || 'MENIKAH'} • ${
          formData.namaIstri?.trim()
            ? formData.namaIstri
            : 'Belum Diisi - Perlu Diperbaharui'
        } • No. HP: ${formData.kontakIstri?.trim() || 'Belum Diisi'}`,
        isComplete: Boolean(
          formData.statusPerkawinan === 'BELUM MENIKAH' || formData.namaIstri?.trim()
        ),
      },
      {
        id: '2C',
        tab: 2,
        title:
          formData.statusKedinasan === 'ALMARHUM'
            ? 'Daftar Putra-Putri Almarhum (Data Anak)'
            : 'Daftar Putra-Putri / Anak (Data Pendidikan & Tanggungan)',
        shortTitle: '2C. Daftar Putra-Putri / Anak',
        existingDetail: `${formData.daftarAnak?.length || 0} Anak Terdata • ${
          anakNames.length > 0 ? anakNames.join(', ') : 'Belum Ada Data Anak Tersimpan'
        }`,
        isComplete: (formData.daftarAnak?.length || 0) > 0 && anakNames.length === (formData.daftarAnak?.length || 0),
      },
      {
        id: '3A',
        tab: 3,
        title: `Proyeksi Purna Tugas (BUP ${RETIREMENT_AGE_POLRI} Tahun) & Rencana Hunian Pensiun`,
        shortTitle: `3A. Purna Tugas (${RETIREMENT_AGE_POLRI} Thn) & Hunian`,
        existingDetail: `Pensiun ${retirementCalc.tahunPurnaTugas} (${RETIREMENT_AGE_POLRI} Thn) • ${
          retirementCalc.sisaMasaDinasShort
        } • Hunian: ${formData.statusRumahPurnaTugas || 'MILIK PRIBADI'}${
          formData.statusRumahPurnaTugas === 'SEWA/KONTRAK'
            ? ` (${formData.biayaSewaTahunan?.trim() || 'Biaya Sewa Belum Dirinci'})`
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
        title: 'Usaha Bersama & Yayasan Wira Satya 96',
        shortTitle: '3B. Usaha Bersama & Yayasan',
        existingDetail: `${formData.kategoriUsaha || 'USAHA BERSAMA LETING'} • ${
          formData.namaUsahaYayasan?.trim() || formData.jenisUsaha?.trim() || 'Nama Unit Belum Diisi'
        } • Peran: ${formData.peranUsahaYayasan || 'ANGGOTA PENYERTA MODAL'} • ${
          formData.statusUsaha || 'MASIH RENCANA'
        }`,
        isComplete: Boolean(
          formData.kategoriUsaha &&
            (formData.namaUsahaYayasan?.trim() || formData.jenisUsaha?.trim())
        ),
      },
      {
        id: '3C',
        tab: 3,
        title: 'Kesiapan Finansial & Dukungan Purna Tugas',
        shortTitle: '3C. Kesiapan & Dukungan Pensiun',
        existingDetail: `Sumber: ${(formData.sumberPenghasilanPasca || ['DANA PENSIUN']).join(
          ', '
        )} • Dana: ${formData.kecukupanDanaPensiun || 'CUKUP'} • Kesiapan: ${
          formData.perasaanPensiun || 'OPTIMIS'
        }`,
        isComplete: Boolean(formData.kecukupanDanaPensiun && formData.perasaanPensiun),
      },
      {
        id: '4A',
        tab: 4,
        title: 'Kondisi Kesehatan Umum, Golongan Darah & Riwayat Penyakit',
        shortTitle: '4A. Kondisi Kesehatan & Penyakit',
        existingDetail: `Kondisi: ${formData.kondisiKesehatan || 'BAIK'} • Gol. Darah: ${
          formData.golonganDarah || 'O'
        } • Penyakit Kronis: ${formData.adaPenyakitKronis || 'TIDAK ADA'}${
          formData.daftarPenyakit && formData.daftarPenyakit.length > 0
            ? ` (${formData.daftarPenyakit.length} diagnosa)`
            : ''
        }`,
        isComplete: Boolean(formData.kondisiKesehatan && formData.golonganDarah),
      },
      {
        id: '4B',
        tab: 4,
        title: 'Asuransi Kesehatan & Pemeriksaan Medis Berkala (MCU)',
        shortTitle: '4B. Asuransi Kesehatan & MCU',
        existingDetail: `Asuransi: ${(formData.asuransiAktif || ['BPJS']).join(', ')} • Rutin MCU: ${
          formData.rutinMcu || 'YA'
        } (${formData.mcuTerakhir || '< 6 BULAN'})`,
        isComplete: Boolean((formData.asuransiAktif?.length || 0) > 0 && formData.rutinMcu),
      },
      {
        id: '4C',
        tab: 4,
        title: 'Kolom Lain-lain Kesehatan & Harapan Dukungan Medis',
        shortTitle: '4C. Lain-lain Kesehatan & Harapan',
        existingDetail: `Lain-lain: ${
          formData.kesehatanLainLain?.trim()
            ? formData.kesehatanLainLain.trim().slice(0, 38)
            : 'Belum Diisi'
        } • Harapan: ${
          formData.harapanDukunganLeting?.trim() || formData.kondisiSaatIni?.trim()
            ? 'Tersimpan'
            : 'Belum Diisi'
        }`,
        isComplete: Boolean(
          formData.kesehatanLainLain?.trim() ||
            formData.kondisiSaatIni?.trim() ||
            formData.harapanDukunganLeting?.trim()
        ),
      },
    ];

    return list;
  }, [formData, retirementCalc]);

  const getSubMeta = (id: SubSectionId) =>
    subSectionMetaList.find((m) => m.id === id) || subSectionMetaList[0];

  const completionPercentage = React.useMemo(() => {
    const completedCount = subSectionMetaList.filter((s) => s.isComplete).length;
    return Math.round((completedCount / subSectionMetaList.length) * 100);
  }, [subSectionMetaList]);

  // Per-Tab Validation
  const validateTab = (tabNum: 1 | 2 | 3 | 4): boolean => {
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
      const hasCheckedDisease = (formData.daftarPenyakit?.length || 0) > 0;
      const hasCustomDisease = penyakitLainnya.trim().length > 0;
      const hasMedicalNote = Boolean(
        formData.kondisiSaatIni?.trim() || formData.kesehatanLainLain?.trim()
      );
      if (
        formData.adaPenyakitKronis === 'ADA' &&
        !hasCheckedDisease &&
        !hasCustomDisease &&
        !hasMedicalNote
      ) {
        setExpandedSections((prev) => ({ ...prev, '4A': true }));
        setErrorMsg(
          'Anda memilih Riwayat Penyakit Kronis "ADA". Mohon centang minimal satu diagnosa medis atau isi Diagnosa Lainnya / Kondisi Terkini.'
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

    const combinedDiseases = [...(formData.daftarPenyakit || [])];
    if (penyakitLainnya.trim()) {
      const customList = penyakitLainnya
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      customList.forEach((d) => {
        if (!combinedDiseases.includes(d)) {
          combinedDiseases.push(d);
        }
      });
    }

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
      ukuranBaju: formData.ukuranBaju || base?.ukuranBaju || 'XL',
      ukuranCelana: formData.ukuranCelana || base?.ukuranCelana || '34',
      ukuranSepatu: formData.ukuranSepatu || base?.ukuranSepatu || '42',
      alamatTempatTinggal: formData.alamatTempatTinggal || '',
      statusTempatTinggal: formData.statusTempatTinggal || 'MILIK PRIBADI',
      biayaSewaTempatTinggal: formData.biayaSewaTempatTinggal || '',
      detailSewaTempatTinggal: formData.detailSewaTempatTinggal || '',

      statusPerkawinan: formData.statusPerkawinan || 'MENIKAH',
      namaIstri: formData.namaIstri || '',
      tempatLahirIstri: formData.tempatLahirIstri || '',
      tanggalLahirIstri: formData.tanggalLahirIstri || '',
      usiaIstri: Number(formData.usiaIstri) || 50,
      kontakIstri: formData.kontakIstri || '',
      jumlahAnak: formData.daftarAnak?.length || 0,
      daftarAnak: formData.daftarAnak || [],
      tanggunganLain: formData.tanggunganLain,

      tahunPurnaTugas: finalCalc58.tahunPurnaTugas,
      sisaTahunDinas: finalCalc58.sisaTahunDinas,
      alamatPurnaTugas: formData.alamatPurnaTugas || '',
      statusRumahPurnaTugas: formData.statusRumahPurnaTugas || 'MILIK PRIBADI',
      detailSewaPurnaTugas: formData.detailSewaPurnaTugas || '',
      biayaSewaTahunan: formData.biayaSewaTahunan || '',
      sudahPembekalan: formData.sudahPembekalan || 'SUDAH',
      rencanaAktivitas: formData.rencanaAktivitas || ['USAHA BERSAMA / YAYASAN'],
      kategoriUsaha: formData.kategoriUsaha || 'USAHA BERSAMA LETING',
      namaUsahaYayasan: formData.namaUsahaYayasan || '',
      peranUsahaYayasan: formData.peranUsahaYayasan || 'ANGGOTA PENYERTA MODAL',
      jenisUsaha: formData.jenisUsaha || '',
      statusUsaha: formData.statusUsaha || 'MASIH RENCANA',
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
      lamaMenderita: formData.lamaMenderita || '',
      kondisiSaatIni: formData.kondisiSaatIni || '',
      penangananPengobatan: formData.penangananPengobatan || '',
      biayaPengobatanDitanggung:
        formData.biayaPengobatanDitanggung || 'DITANGGUNG BPJS/ASURANSI',
      asuransiAktif: formData.asuransiAktif || ['BPJS'],
      rutinMcu: formData.rutinMcu || 'YA',
      mcuTerakhir: formData.mcuTerakhir || '< 6 BULAN',
      harapanLayananKesehatan: formData.harapanLayananKesehatan || '',
      harapanDukunganLeting: formData.harapanDukunganLeting || '',
      kesehatanLainLain: formData.kesehatanLainLain || '',

      createdAt: base?.createdAt || nowIso,
      updatedAt: nowIso,
    };
  };

  // Per-Tab Partial Save
  const handleSaveTab = (tabNum: 1 | 2 | 3 | 4, stayOpen: boolean) => {
    if (!validateTab(tabNum)) return;

    const fullSnapshot = buildFullMemberFromForm(baselineMember);
    const nowIso = new Date().toISOString();

    let mergedMember: AnggotaWiraSatya;

    if (!baselineMember) {
      mergedMember = fullSnapshot;
    } else if (tabNum === 1) {
      // Tab 1: Kedinasan, Kompi & Kontak
      mergedMember = {
        ...baselineMember,
        nrp: fullSnapshot.nrp,
        ...(fullSnapshot.oldNrp ? { oldNrp: fullSnapshot.oldNrp } : {}),
        namaLengkap: fullSnapshot.namaLengkap,
        pangkat: fullSnapshot.pangkat,
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
        golonganDarah: fullSnapshot.golonganDarah,
        ukuranBaju: fullSnapshot.ukuranBaju,
        ukuranCelana: fullSnapshot.ukuranCelana,
        ukuranSepatu: fullSnapshot.ukuranSepatu,
        alamatTempatTinggal: fullSnapshot.alamatTempatTinggal,
        statusTempatTinggal: fullSnapshot.statusTempatTinggal,
        biayaSewaTempatTinggal: fullSnapshot.biayaSewaTempatTinggal,
        detailSewaTempatTinggal: fullSnapshot.detailSewaTempatTinggal,
        updatedAt: nowIso,
      };
    } else if (tabNum === 2) {
      // Tab 2: Domisili & Keluarga
      mergedMember = {
        ...baselineMember,
        alamatTempatTinggal: fullSnapshot.alamatTempatTinggal,
        statusTempatTinggal: fullSnapshot.statusTempatTinggal,
        biayaSewaTempatTinggal: fullSnapshot.biayaSewaTempatTinggal,
        detailSewaTempatTinggal: fullSnapshot.detailSewaTempatTinggal,
        statusPerkawinan: fullSnapshot.statusPerkawinan,
        namaIstri: fullSnapshot.namaIstri,
        tempatLahirIstri: fullSnapshot.tempatLahirIstri,
        tanggalLahirIstri: fullSnapshot.tanggalLahirIstri,
        usiaIstri: fullSnapshot.usiaIstri,
        kontakIstri: fullSnapshot.kontakIstri,
        jumlahAnak: fullSnapshot.jumlahAnak,
        daftarAnak: fullSnapshot.daftarAnak,
        tanggunganLain: fullSnapshot.tanggunganLain,
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
        statusUsaha: fullSnapshot.statusUsaha,
        kebutuhanPembekalan: fullSnapshot.kebutuhanPembekalan,
        sumberPenghasilanPasca: fullSnapshot.sumberPenghasilanPasca,
        kecukupanDanaPensiun: fullSnapshot.kecukupanDanaPensiun,
        kesiapanPensiun: fullSnapshot.kesiapanPensiun,
        perasaanPensiun: fullSnapshot.perasaanPensiun,
        dukunganKeluarga: fullSnapshot.dukunganKeluarga,
        updatedAt: nowIso,
      };
    } else {
      // Tab 4: Kesehatan, Asuransi & Lain-lain
      mergedMember = {
        ...baselineMember,
        golonganDarah: fullSnapshot.golonganDarah,
        adaPenyakitKronis: fullSnapshot.adaPenyakitKronis,
        kondisiKesehatan: fullSnapshot.kondisiKesehatan,
        daftarPenyakit: fullSnapshot.daftarPenyakit,
        lamaMenderita: fullSnapshot.lamaMenderita,
        kondisiSaatIni: fullSnapshot.kondisiSaatIni,
        penangananPengobatan: fullSnapshot.penangananPengobatan,
        biayaPengobatanDitanggung: fullSnapshot.biayaPengobatanDitanggung,
        asuransiAktif: fullSnapshot.asuransiAktif,
        rutinMcu: fullSnapshot.rutinMcu,
        mcuTerakhir: fullSnapshot.mcuTerakhir,
        harapanLayananKesehatan: fullSnapshot.harapanLayananKesehatan,
        harapanDukunganLeting: fullSnapshot.harapanDukunganLeting,
        kesehatanLainLain: fullSnapshot.kesehatanLainLain,
        catatanMedis: fullSnapshot.catatanMedis,
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
            ukuranBaju: mergedMember.ukuranBaju,
            ukuranCelana: mergedMember.ukuranCelana,
            ukuranSepatu: mergedMember.ukuranSepatu,
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
        {/* Clickable Accordion Header Displaying Existing Data & Completeness Badge */}
        <div
          onClick={() => toggleSubSection(id)}
          className={`w-full p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
            isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50/90 hover:bg-slate-100/80 text-slate-900'
          }`}
        >
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider ${
                  isExpanded
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-polri-navy text-polri-gold'
                }`}
              >
                Lembar {meta.id}
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
                  &#10003; Data Existing Lengkap
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isExpanded
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  &#9888; Perlu Diperbaharui / Belum Lengkap
                </span>
              )}
            </div>

            <p
              className={`text-[11px] leading-snug line-clamp-2 ${
                isExpanded ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              <strong className={isExpanded ? 'text-amber-300' : 'text-slate-800'}>
                Data Existing:
              </strong>{' '}
              {meta.existingDetail}
            </p>
          </div>

          <div
            className="flex items-center gap-2 self-end sm:self-center shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {headerExtra}
            <button
              type="button"
              onClick={() => toggleSubSection(id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                isExpanded
                  ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <span>{isExpanded ? 'Tutup' : 'Buka & Edit'}</span>
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
            <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Lembar <strong>{meta.id} ({meta.title})</strong> &bull; Perubahan akan disimpan pada Kategori {step}.
              </span>
              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                <span>Simpan Lembar Data Ini</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-24 md:pb-12">
      {/* Top Bar: Title + Access Rights Badge */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-polri-navy">
              {baselineMember ? 'Manajemen & Pembaruan Lembar Data Personel' : 'Registrasi Lembar Data Personel Baru'}
            </h2>
            {canEditAnyMember ? (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-slate-700 inline-flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                Otoritas {activeUser.role} — Akses Edit Seluruh Personel
              </span>
            ) : isEditingRepresentedPimpinan ? (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-700" />
                Mode ADC / Ajudan — Mewakili Pimpinan
              </span>
            ) : (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Akses Mandiri — Hanya Profil Pribadi
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pilih kategori di panel kiri, lalu klik masing-masing lembar isian di sebelah kanan untuk melihat data existing atau memperbaharuinya.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            &larr; Kembali ke Profil
          </button>
          <button
            type="button"
            disabled={!hasEditPermission}
            onClick={() => handleSaveTab(step, false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Simpan &amp; Lihat Profil</span>
          </button>
        </div>
      </div>

      {!hasEditPermission && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 flex items-center gap-3 text-xs sm:text-sm font-bold">
          <Lock className="w-5 h-5 text-red-600 shrink-0" />
          <span>
            Anda login sebagai {activeUser.role} ({activeUser.nama}). Sesuai kebijakan keamanan Wira Satya 96, Anda hanya dapat mengubah data profil milik Anda sendiri.
          </span>
        </div>
      )}

      {/* Saved Toast / Banner */}
      {savedBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 shadow-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-extrabold text-emerald-900">
                Perubahan Kategori {savedBanner.tabName} berhasil disimpan &amp; disinkronkan ke Profil, Beranda, Jabatan, Anev, dan User!
              </div>
              <div className="text-[11px] text-emerald-700">
                Disimpan pada pukul {savedBanner.timestamp} WIB &bull; Kategori {savedBanner.tabNum} ({savedBanner.tabName}) telah diperbarui.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSavedBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex-shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Validation Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 shadow-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm font-bold leading-relaxed">{errorMsg}</div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold text-red-700 hover:text-red-900 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2-COLUMN TOUR OF DUTY LAYOUT: LEFT SIDEBAR (4) + RIGHT ACCORDION (8)  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (lg:col-span-4): TOUR OF DUTY STYLE SIDEBAR */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          {/* 1. KARTU RINGKASAN PERSONEL */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3.5">
            <div className="flex items-center gap-3.5">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-polri-gold bg-slate-100 shrink-0 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(formData.fotoUrl)}
                  alt="Foto Personel"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800 block">
                  {formData.pangkat || 'Kombes Pol'} &bull; NRP {formData.nrp || '—'}
                </span>
                <h3 className="text-sm font-black text-slate-900 truncate">
                  {formData.namaLengkap?.trim() || 'Nama Personel Belum Diisi'}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600">Kelengkapan Lembar Data</span>
                <span className="font-extrabold text-polri-navy">{completionPercentage}% Lengkap</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-800 via-amber-500 to-emerald-600 transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. KARTU KATEGORI LEMBAR DATA (GAYA SIDEBAR TOUR OF DUTY) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-red-800" />
                Kategori Lembar Data
              </span>
              <span className="text-[10px] font-bold text-slate-400">4 Modul</span>
            </div>

            <div className="space-y-1.5">
              {TAB_CONFIG.map((t) => {
                const Icon = t.icon;
                const isActive = step === t.num;
                const isSaved = Boolean(savedTabs[t.num]);
                const subItems = subSectionMetaList.filter((m) => m.tab === t.num);
                const doneCount = subItems.filter((m) => m.isComplete).length;

                return (
                  <button
                    key={t.num}
                    type="button"
                    onClick={() => {
                      setStep(t.num);
                      setErrorMsg(null);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-red-800 text-white border-red-900 shadow-sm'
                        : isSaved
                        ? 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:bg-emerald-100/60'
                        : 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-white/15 text-amber-300'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
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
                          {doneCount}/{subItems.length} sub-bagian lengkap
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
                      {t.subSections.length} Lembar
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. KARTU DAFTAR LEMBAR ISIAN (SUB-BAGIAN) PADA KATEGORI AKTIF */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Daftar Lembar Isian (Kategori {step})
              </span>
              <span className="text-[10px] font-bold text-slate-400">Klik untuk buka</span>
            </div>

            <div className="space-y-1.5">
              {currentStepSubSections.map((sub) => {
                const isOpen = Boolean(expandedSections[sub.id]);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openAndFocusSubSection(step, sub.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isOpen
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-extrabold truncate">{sub.shortTitle}</div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isOpen ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {sub.existingDetail}
                      </div>
                    </div>
                    {sub.isComplete ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold shrink-0">
                        Lengkap
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-extrabold shrink-0">
                        Perlu Diisi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-8): COLLAPSIBLE SUB-SECTION CARDS */}
        <form onSubmit={handleFormSubmit} noValidate className="lg:col-span-8 space-y-4">
          {/* Active Category Header Bar */}
          <div className="bg-white p-4 sm:px-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-800 block">
                Kategori {step} dari 4 &bull; Klik Header Lembar untuk Membuka / Menutup Isian
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {step}. {currentTabMeta.title}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllSubSectionsInStep(true)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                Buka Semua Lembar
              </button>
              <button
                type="button"
                onClick={() => setAllSubSectionsInStep(false)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                Tutup Semua
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* KATEGORI 1: KEDINASAN, KOMPI & KONTAK (SUB-BAGIAN 1A s/d 1E)    */}
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
                      Ringkasan Profil / Bio Kedinasan
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan ringkasan singkat riwayat penugasan, bidang keahlian, atau amanah jabatan saat ini..."
                      value={formData.bio || ''}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1B: STATUS KEDINASAN, PANGKAT, JABATAN & SATKER POLRI */}
              {renderSubSectionCard(
                '1B',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Korps / Kategori Personel <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.jenisAnggota || 'ANGGOTA POLRI'}
                        onChange={(e) => handleInputChange('jenisAnggota', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="ANGGOTA POLRI">Personel Polri Aktif</option>
                        <option value="ALUMNI AKPOL 1996">Perwira Polri (Alumni Akpol 1996)</option>
                        <option value="ASN / PNS POLRI">ASN / PNS Polri</option>
                        <option value="PURNAWIRAWAN POLRI">Purnawirawan / Purna Tugas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Kedinasan Personel <span className="text-red-500">*</span>
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
                  </div>

                  {/* Kartu Informasi Khusus Personel Berstatus ALMARHUM */}
                  {formData.statusKedinasan === 'ALMARHUM' && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                          <span>🕊️ Status Personel: In Memoriam (Almarhum)</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Pendataan keluarga &amp; ahli waris tetap aktif untuk keperluan santunan, silaturahmi, dan beasiswa pendidikan putra-putri almarhum.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                          <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-amber-200 font-bold border border-white/15">
                            Istri / Ahli Waris: {formData.namaIstri?.trim() ? formData.namaIstri : 'Belum Diisi'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-emerald-200 font-bold border border-white/15">
                            Putra-Putri Terdata: {formData.daftarAnak?.length || 0} Anak
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAndFocusSubSection(2, '2B')}
                        className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
                      >
                        <Users className="w-4 h-4" />
                        <span>Lengkapi Data Istri &amp; Anak Almarhum (Buka Tab 2)</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2.5">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] font-bold text-slate-600">
                          Satker Melekat &amp; Wilayah <span className="text-red-500">*</span>
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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          {formData.statusKedinasan === 'ALMARHUM' ||
                          formData.statusKedinasan === 'PURNA_TUGAS' ||
                          formData.statusKedinasan === 'PTDH'
                            ? 'Jabatan Terakhir Sebelum Purna Tugas / Wafat / PTDH'
                            : 'Jabatan Organisasi Polri Saat Ini'}{' '}
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
                        <optgroup label="Penugasan Luar Struktur (Eksternal Polri)">
                          <option value={EXTERNAL_JABATAN_SENTINEL}>
                            Penugasan Luar Struktur (Eksternal Polri) — Tulis Sendiri
                          </option>
                        </optgroup>
                      </select>

                      {isExternalJabatan ? (
                        <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 space-y-1">
                          <label className="block text-[11px] font-bold text-amber-900">
                            Ketik Nama Jabatan Eksternal (Luar Struktur Polri) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Masukkan nama jabatan penugasan di luar struktur Polri..."
                            value={formData.jabatanTerakhir || ''}
                            onChange={(e) => handleInputChange('jabatanTerakhir', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                          />
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Pilihan jabatan distandarisasi sesuai pangkat. Pilih Eksternal Polri jika penugasan di luar struktur.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1C: KELOMPOK KOMPI, PLETON & IDENTITAS PRIBADI */}
              {renderSubSectionCard(
                '1C',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Lengkap &amp; Gelar Akademik <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan nama lengkap beserta gelar akademik..."
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
                        placeholder="Masukkan 8 digit NRP atau NIP..."
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

                    {/* Kelompok Kompi & Pleton Batalyon Wira Satya 96 */}
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-amber-950">
                        Kelompok Kompi Batalyon Wira Satya 96
                      </label>
                      <select
                        value={formData.kompi || 'KOMPI A'}
                        onChange={(e) => handleInputChange('kompi', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_KOMPI.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {DAFTAR_KOMPI.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleInputChange('kompi', k)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border transition-colors cursor-pointer ${
                              (formData.kompi || 'KOMPI A') === k
                                ? 'bg-red-800 text-white border-red-900'
                                : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-amber-950">
                        Kelompok Pleton Batalyon Wira Satya 96
                      </label>
                      <select
                        value={formData.pleton || 'PLETON 1'}
                        onChange={(e) => handleInputChange('pleton', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_PLETON.map((pl) => (
                          <option key={pl} value={pl}>
                            {pl}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {DAFTAR_PLETON.map((pl) => (
                          <button
                            key={pl}
                            type="button"
                            onClick={() => handleInputChange('pleton', pl)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border transition-colors cursor-pointer ${
                              (formData.pleton || 'PLETON 1') === pl
                                ? 'bg-red-800 text-white border-red-900'
                                : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {pl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tempat Lahir
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan kota / kabupaten tempat lahir..."
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
                          Usia: {retirementCalc.usiaLabel}
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

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pendidikan Terakhir (Akademik &amp; Kedinasan)
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan pendidikan terakhir (misal: Akpol 1996 / S2 Ilmu Hukum / Sespimti)..."
                        value={formData.pendidikanTerakhir || ''}
                        onChange={(e) => handleInputChange('pendidikanTerakhir', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 1D: UKURAN APAREL (BAJU, CELANA, SEPATU) & GOLONGAN DARAH */}
              {renderSubSectionCard(
                '1D',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Golongan Darah
                      </label>
                      <select
                        value={formData.golonganDarah || 'O'}
                        onChange={(e) => handleInputChange('golonganDarah', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_GOLONGAN_DARAH.map((gd) => (
                          <option key={gd} value={gd}>
                            Golongan Darah {gd}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Baju / Kemeja / Kaos
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
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {DAFTAR_UKURAN_BAJU.map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleInputChange('ukuranBaju', sz)}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition-colors cursor-pointer ${
                              (formData.ukuranBaju || 'XL') === sz
                                ? 'bg-polri-navy text-polri-gold border-polri-navy'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Celana (28 s/d 46)
                      </label>
                      <select
                        value={formData.ukuranCelana || '34'}
                        onChange={(e) => handleInputChange('ukuranCelana', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_CELANA.map((cl) => (
                          <option key={cl} value={cl}>
                            Nomor {cl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Ukuran Sepatu (38 s/d 47)
                      </label>
                      <select
                        value={formData.ukuranSepatu || '42'}
                        onChange={(e) => handleInputChange('ukuranSepatu', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_SEPATU.map((sp) => (
                          <option key={sp} value={sp}>
                            Nomor {sp}
                          </option>
                        ))}
                      </select>
                    </div>
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
                        Nomor WhatsApp Aktif
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan nomor WhatsApp aktif..."
                        value={formData.noHp || ''}
                        onChange={(e) => handleInputChange('noHp', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Dinas (@polri.go.id)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          placeholder="Masukkan alamat email dinas..."
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Sekunder / Pribadi (Opsional)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          placeholder="Masukkan alamat email sekunder..."
                          value={formData.secondaryEmail || ''}
                          onChange={(e) => handleInputChange('secondaryEmail', e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Daftar ADC / Ajudan */}
                  <div className="pt-3 border-t border-slate-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
                      <div className="min-w-0">
                        <label className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-polri-gold flex-shrink-0" />
                          <span>Daftar ADC / Ajudan / Spri Pendamping Pimpinan (Opsional)</span>
                        </label>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          Jika NRP ADC diisi, ADC dapat login mewakili Pimpinan dan seluruh aktivitas tercatat di Log Audit.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAdc}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-polri-navy text-polri-gold text-xs font-bold hover:bg-polri-navyLight transition-colors cursor-pointer flex-shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah ADC</span>
                      </button>
                    </div>

                    {(!formData.daftarAdc || formData.daftarAdc.length === 0) && (
                      <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center text-xs text-slate-500">
                        Belum ada data ADC yang ditambahkan. Klik tombol <strong>&ldquo;Tambah ADC&rdquo;</strong> untuk menambahkan.
                      </div>
                    )}

                    {formData.daftarAdc?.map((adc, idx) => (
                      <div
                        key={adc.id || idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <span className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-polri-gold" />
                            <span>
                              ADC / Ajudan ke-{idx + 1}: {adc.nama?.trim() || 'Nama Belum Diisi'}
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
                              Nama Lengkap ADC / Ajudan <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan nama lengkap ADC / Ajudan..."
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
                              placeholder="Masukkan NRP / NIP ADC..."
                              value={adc.nrp || ''}
                              onChange={(e) => handleUpdateAdc(idx, 'nrp', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Pangkat / Golongan ADC
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
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Tanggal Lahir ADC
                            </label>
                            <input
                              type="date"
                              value={adc.tanggalLahir || ''}
                              onChange={(e) => handleUpdateAdc(idx, 'tanggalLahir', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
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
                              Nomor WhatsApp Aktif ADC <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan nomor WhatsApp ADC..."
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
          {/* KATEGORI 2: DOMISILI & DATA KELUARGA (SUB-BAGIAN 2A s/d 2C)     */}
          {/* =============================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              {formData.statusKedinasan === 'ALMARHUM' && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/50 shadow-sm space-y-1.5">
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                    <span>🕊️ Pendataan Keluarga &amp; Ahli Waris Almarhum (Istri &amp; Putra-Putri)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Silakan lengkapi data Istri / Ahli Waris, Nomor HP/WhatsApp aktif keluarga, alamat domisili keluarga saat ini, serta daftar lengkap Putra-Putri Almarhum untuk keperluan santunan, silaturahmi, dan dukungan pendidikan Paguyuban Wira Satya 96.
                  </p>
                </div>
              )}

              {/* SUB-BAGIAN 2A: ALAMAT DOMISILI SAAT INI & RINCIAN BIAYA SEWA/KONTRAK */}
              {renderSubSectionCard(
                '2A',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Kepemilikan Tempat Tinggal Saat Ini
                      </label>
                      <select
                        value={formData.statusTempatTinggal || 'MILIK PRIBADI'}
                        onChange={(e) => handleInputChange('statusTempatTinggal', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="MILIK PRIBADI">MILIK PRIBADI</option>
                        <option value="RUMAH KELUARGA">RUMAH KELUARGA</option>
                        <option value="DINAS">DINAS</option>
                        <option value="SEWA/KONTRAK">SEWA/KONTRAK</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {formData.statusKedinasan === 'ALMARHUM'
                          ? 'Alamat Domisili Keluarga Saat Ini'
                          : 'Alamat / Kota Domisili Saat Ini'}
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan alamat lengkap atau kota domisili saat ini..."
                        value={formData.alamatTempatTinggal || ''}
                        onChange={(e) => handleInputChange('alamatTempatTinggal', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    {formData.statusTempatTinggal === 'SEWA/KONTRAK' && (
                      <div className="sm:col-span-2 p-4 rounded-xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/80">
                          <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-700" />
                            <span>Rincian Biaya &amp; Keterangan Sewa / Kontrak Tempat Tinggal Saat Ini</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                            Status: SEWA / KONTRAK
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              1. Rincian Biaya Sewa / Kontrak (Per Tahun / Bulan)
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan nominal biaya sewa (misal: Rp 36.000.000 / Tahun)..."
                              value={formData.biayaSewaTempatTinggal || ''}
                              onChange={(e) => handleInputChange('biayaSewaTempatTinggal', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {KISARAN_BIAYA_SEWA_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleInputChange('biayaSewaTempatTinggal', opt)}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                                    formData.biayaSewaTempatTinggal === opt
                                      ? 'bg-amber-800 text-white border-amber-900'
                                      : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              2. Keterangan / Masa Sewa &amp; Lokasi Hunian
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan keterangan hunian sewa dan masa berlaku kontrak..."
                              value={formData.detailSewaTempatTinggal || ''}
                              onChange={(e) => handleInputChange('detailSewaTempatTinggal', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Perkawinan
                    </label>
                    <select
                      value={formData.statusPerkawinan || 'MENIKAH'}
                      onChange={(e) => handleInputChange('statusPerkawinan', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    >
                      <option value="MENIKAH">MENIKAH</option>
                      <option value="BELUM MENIKAH">BELUM MENIKAH</option>
                      <option value="DUDA/JANDA">DUDA/JANDA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.statusKedinasan === 'ALMARHUM'
                        ? 'Nama Lengkap Istri / Ahli Waris Almarhum'
                        : 'Nama Lengkap Istri / Pasangan'}
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama lengkap istri / pasangan..."
                      value={formData.namaIstri || ''}
                      onChange={(e) => handleInputChange('namaIstri', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.statusKedinasan === 'ALMARHUM'
                        ? 'Tanggal Lahir Istri / Ahli Waris'
                        : 'Tanggal Lahir Istri / Pasangan'}
                    </label>
                    <input
                      type="date"
                      value={formData.tanggalLahirIstri || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleInputChange('tanggalLahirIstri', val);
                        if (val) {
                          const c = calculateRetirement58(val);
                          handleInputChange('usiaIstri', c.usiaTahun);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.statusKedinasan === 'ALMARHUM'
                        ? 'Nomor HP / WhatsApp Aktif Istri / Keluarga'
                        : 'Nomor HP / WhatsApp Istri / Keluarga'}
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nomor WhatsApp aktif istri / keluarga..."
                      value={formData.kontakIstri || ''}
                      onChange={(e) => handleInputChange('kontakIstri', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 2C: DAFTAR PUTRA-PUTRI / ANAK */}
              {renderSubSectionCard(
                '2C',
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block">
                        {formData.statusKedinasan === 'ALMARHUM'
                          ? 'Daftar Putra-Putri Almarhum & Status Pendidikan'
                          : 'Daftar Putra-Putri / Anak & Estimasi Biaya Pendidikan'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Total Anak Terdata: <strong>{formData.daftarAnak?.length || 0} Anak</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddChild}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-polri-navy text-polri-gold text-xs font-bold hover:bg-polri-navyLight transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Data Anak</span>
                    </button>
                  </div>

                  {(!formData.daftarAnak || formData.daftarAnak.length === 0) && (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center text-xs text-slate-500">
                      Belum ada data anak yang tersimpan. Klik tombol <strong>&ldquo;+ Tambah Data Anak&rdquo;</strong> untuk menambahkan rincian putra/putri.
                    </div>
                  )}

                  {formData.daftarAnak?.map((anak, idx) => (
                    <div
                      key={anak.id || idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-polri-navy text-polri-gold text-[10px] font-extrabold">
                            Anak ke-{idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            {anak.nama?.trim() || 'Nama Anak Belum Diisi (Perlu Diperbaharui)'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(idx)}
                          className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Nama Lengkap Anak <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Masukkan nama lengkap anak..."
                            value={anak.nama}
                            onChange={(e) => handleUpdateChild(idx, 'nama', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Tempat Lahir Anak
                          </label>
                          <input
                            type="text"
                            placeholder="Masukkan kota lahir..."
                            value={anak.tempatLahir || ''}
                            onChange={(e) => handleUpdateChild(idx, 'tempatLahir', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Tanggal Lahir Anak
                          </label>
                          <input
                            type="date"
                            value={anak.tanggalLahir || ''}
                            onChange={(e) => handleUpdateChild(idx, 'tanggalLahir', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Status Kegiatan
                          </label>
                          <select
                            value={anak.status}
                            onChange={(e) => handleUpdateChild(idx, 'status', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          >
                            <option value="PELAJAR">PELAJAR / MAHASISWA</option>
                            <option value="BEKERJA">BEKERJA</option>
                            <option value="BELUM BEKERJA">BELUM BEKERJA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">
                            Estimasi Biaya Pendidikan
                          </label>
                          <select
                            value={anak.biayaPendidikanTahunan || '< 5.000.000'}
                            onChange={(e) => handleUpdateChild(idx, 'biayaPendidikanTahunan', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                          >
                            <option value="< 5.000.000">&lt; 5 Juta / Tahun</option>
                            <option value="5.000.000 S.D. 25.000.000">5 Juta s/d 25 Juta / Tahun</option>
                            <option value="> 25.000.000">&gt; 25 Juta / Tahun</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>,
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Data Anak</span>
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
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-polri-navy block">
                          Hitungan Otomatis Pensiun di Usia {RETIREMENT_AGE_POLRI} Tahun (BUP Polri)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Dihitung otomatis dari Tanggal Lahir personel ({retirementCalc.formattedTanggalLahir})
                        </span>
                      </div>
                      <span className="text-xs font-extrabold px-3 py-1 rounded-lg bg-polri-navy text-polri-gold">
                        Pensiun: {retirementCalc.tahunPurnaTugas} ({retirementCalc.sisaMasaDinasShort})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Tanggal Lahir Personel
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
                          Tahun Purna Tugas (Usia {RETIREMENT_AGE_POLRI} Thn)
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
                          Sisa Masa Dinas Aktif
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`${retirementCalc.sisaMasaDinasLabel} (Usia kini ${retirementCalc.usiaTahun} Thn)`}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs font-extrabold text-emerald-800 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Rumah / Tempat Tinggal Setelah Pensiun
                      </label>
                      <select
                        value={formData.statusRumahPurnaTugas || 'MILIK PRIBADI'}
                        onChange={(e) => handleInputChange('statusRumahPurnaTugas', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="MILIK PRIBADI">MILIK PRIBADI</option>
                        <option value="RUMAH KELUARGA">RUMAH KELUARGA</option>
                        <option value="SEWA/KONTRAK">SEWA / KONTRAK (Belum Ada Rumah Tetap)</option>
                        <option value="DINAS">DINAS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Alamat / Kota Rencana Domisili Purna Tugas
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan kota atau wilayah rencana domisili pensiun..."
                        value={formData.alamatPurnaTugas || ''}
                        onChange={(e) => handleInputChange('alamatPurnaTugas', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    {formData.statusRumahPurnaTugas === 'SEWA/KONTRAK' && (
                      <div className="sm:col-span-2 p-4 rounded-xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/80">
                          <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-700" />
                            <span>Rincian Biaya &amp; Keterangan Sewa / Kontrak Hunian Purna Tugas</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 text-amber-950">
                            Hunian Pensiun: SEWA / KONTRAK
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              1. Rincian Estimasi Biaya Sewa / Kontrak Tahunan
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan estimasi biaya sewa tahunan (misal: Rp 30.000.000 / Tahun)..."
                              value={formData.biayaSewaTahunan || ''}
                              onChange={(e) => handleInputChange('biayaSewaTahunan', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {KISARAN_BIAYA_SEWA_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleInputChange('biayaSewaTahunan', opt)}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                                    formData.biayaSewaTahunan === opt
                                      ? 'bg-amber-800 text-white border-amber-900'
                                      : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-amber-950">
                              2. Detail Rencana Sewa / Kontrak Hunian Purna Tugas
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan detail rencana sewa/kontrak hunian purna tugas..."
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

              {/* SUB-BAGIAN 3B: USAHA BERSAMA & YAYASAN WIRA SATYA 96 */}
              {renderSubSectionCard(
                '3B',
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Rencana Aktivitas Utama Pasca Dinas (Dapat pilih lebih dari satu)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
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
                              {act}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bentuk Partisipasi Usaha Bersama / Yayasan
                      </label>
                      <select
                        value={formData.kategoriUsaha || 'USAHA BERSAMA LETING'}
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
                        Peran dalam Usaha Bersama / Yayasan
                      </label>
                      <select
                        value={formData.peranUsahaYayasan || 'ANGGOTA PENYERTA MODAL'}
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

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Usaha Bersama / Yayasan / Unit Kegiatan
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan nama unit usaha bersama atau yayasan..."
                        value={formData.namaUsahaYayasan || ''}
                        onChange={(e) => handleInputChange('namaUsahaYayasan', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bidang / Sektor Usaha Bersama &amp; Sosial
                      </label>
                      <input
                        type="text"
                        placeholder="Masukkan bidang kegiatan usaha bersama atau yayasan..."
                        value={formData.jenisUsaha || ''}
                        onChange={(e) => handleInputChange('jenisUsaha', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Pelaksanaan Usaha / Yayasan
                      </label>
                      <select
                        value={formData.statusUsaha || 'MASIH RENCANA'}
                        onChange={(e) => handleInputChange('statusUsaha', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SUDAH JALAN">SUDAH JALAN</option>
                        <option value="DALAM PERSIAPAN">DALAM PERSIAPAN</option>
                        <option value="MASIH RENCANA">MASIH RENCANA</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 3C: KESIAPAN FINANSIAL & DUKUNGAN PURNA TUGAS */}
              {renderSubSectionCard(
                '3C',
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
                      Kebutuhan Dukungan Paguyuban / Yayasan
                    </label>
                    <select
                      value={formData.kebutuhanPembekalan?.[0] || 'PELATIHAN'}
                      onChange={(e) => handleInputChange('kebutuhanPembekalan', [e.target.value])}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    >
                      <option value="MODAL">Bantuan Akses Modal &amp; Kemitraan</option>
                      <option value="PELATIHAN">Pelatihan &amp; Inkubasi Usaha Bersama</option>
                      <option value="PENDAMPINGAN">Pendampingan Manajemen &amp; Hukum</option>
                      <option value="TIDAK PERLU">Tidak Perlu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kesiapan Menghadapi Purna Tugas
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
                      Dukungan Keluarga terhadap Rencana Purna Tugas
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
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* KATEGORI 4: KESEHATAN, ASURANSI & LAIN-LAIN (4A s/d 4C)         */}
          {/* =============================================================== */}
          {step === 4 && (
            <div className="space-y-4">
              {/* SUB-BAGIAN 4A: KONDISI KESEHATAN UMUM, GOLONGAN DARAH & RIWAYAT PENYAKIT */}
              {renderSubSectionCard(
                '4A',
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Golongan Darah Personel
                      </label>
                      <select
                        value={formData.golonganDarah || 'O'}
                        onChange={(e) => handleInputChange('golonganDarah', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_GOLONGAN_DARAH.map((gd) => (
                          <option key={gd} value={gd}>
                            Golongan Darah {gd}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kondisi Kesehatan Saat Ini
                      </label>
                      <select
                        value={formData.kondisiKesehatan || 'BAIK'}
                        onChange={(e) => handleInputChange('kondisiKesehatan', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="SANGAT BAIK">SANGAT BAIK</option>
                        <option value="BAIK">BAIK</option>
                        <option value="CUKUP">CUKUP</option>
                        <option value="PERLU PERHATIAN KHUSUS">PERLU PERHATIAN KHUSUS</option>
                        <option value="SAKIT">SAKIT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Riwayat Penyakit Kronis
                      </label>
                      <select
                        value={formData.adaPenyakitKronis || 'TIDAK ADA'}
                        onChange={(e) => handleInputChange('adaPenyakitKronis', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="TIDAK ADA">TIDAK ADA</option>
                        <option value="ADA">ADA</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkbox Penyakit */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Daftar Diagnosa Medis / Riwayat Penyakit (Centang jika ada):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {DAFTAR_PENYAKIT.map((penyakit) => {
                        const isChecked = formData.daftarPenyakit?.includes(penyakit);
                        return (
                          <label
                            key={penyakit}
                            className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(isChecked)}
                              onChange={() => handleToggleDisease(penyakit)}
                              className="rounded text-polri-navy focus:ring-polri-navy"
                            />
                            <span className={isChecked ? 'font-bold text-polri-navy' : ''}>
                              {penyakit}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Opsi Diagnosa Lainnya */}
                  <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-1.5">
                    <label className="block text-xs font-bold text-amber-950">
                      Diagnosa Medis Lainnya (Pisahkan dengan tanda koma):
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan diagnosa lainnya jika tidak ada di daftar atas..."
                      value={penyakitLainnya}
                      onChange={(e) => {
                        if (errorMsg) setErrorMsg(null);
                        setPenyakitLainnya(e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 4B: ASURANSI KESEHATAN & PEMERIKSAAN MEDIS BERKALA (MCU) */}
              {renderSubSectionCard(
                '4B',
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Jaminan Kesehatan &amp; Asuransi Aktif:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Rutin Medical Check-Up (MCU)
                      </label>
                      <select
                        value={formData.rutinMcu || 'YA'}
                        onChange={(e) => handleInputChange('rutinMcu', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="YA">YA (Rutin MCU)</option>
                        <option value="TIDAK">TIDAK</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pelaksanaan MCU Terakhir
                      </label>
                      <select
                        value={formData.mcuTerakhir || '< 6 BULAN'}
                        onChange={(e) => handleInputChange('mcuTerakhir', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="< 6 BULAN">&lt; 6 Bulan Terakhir</option>
                        <option value="6-12 BULAN">6 - 12 Bulan Terakhir</option>
                        <option value="> 1 TAHUN">&gt; 1 Tahun Lalu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Penanggungan Biaya Pengobatan
                      </label>
                      <select
                        value={formData.biayaPengobatanDitanggung || 'DITANGGUNG BPJS/ASURANSI'}
                        onChange={(e) => handleInputChange('biayaPengobatanDitanggung', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        <option value="DITANGGUNG BPJS/ASURANSI">Ditanggung BPJS / Asuransi</option>
                        <option value="5.000.000 S.D. 10.000.000">Rp 5 Juta s/d 10 Juta</option>
                        <option value="DI ATAS 10.000.000">Di Atas Rp 10 Juta</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-BAGIAN 4C: KOLOM LAIN-LAIN KESEHATAN & HARAPAN DUKUNGAN MEDIS */}
              {renderSubSectionCard(
                '4C',
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Kolom Lain-lain Kesehatan (Alergi, Terapi Khusus, Alat Bantu Medis, atau Catatan Kesehatan Lainnya)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Masukkan keterangan kesehatan lain-lain seperti alergi obat/makanan, terapi rutin, pantangan medis, atau catatan khusus..."
                      value={formData.kesehatanLainLain || ''}
                      onChange={(e) => handleInputChange('kesehatanLainLain', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kondisi Terkini &amp; Penanganan Medis
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Masukkan rincian kondisi kesehatan terkini atau penanganan medis yang sedang dijalani..."
                      value={formData.kondisiSaatIni || ''}
                      onChange={(e) => handleInputChange('kondisiSaatIni', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Harapan Layanan Kesehatan &amp; Dukungan Solidaritas Leting
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Masukkan saran atau harapan dukungan kesejahteraan dan kesehatan dari Paguyuban Wira Satya 96..."
                      value={formData.harapanDukunganLeting || ''}
                      onChange={(e) => handleInputChange('harapanDukunganLeting', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Unified Action Footer on ALL 4 Categories */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal / Kembali
              </button>

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep((step - 1) as 1 | 2 | 3 | 4);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Kategori Sebelumnya
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-polri-navy hover:bg-polri-navyLight disabled:opacity-50 text-polri-gold text-xs font-extrabold shadow-md transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kategori {currentTabMeta.shortTitle}</span>
              </button>

              <button
                type="button"
                disabled={!hasEditPermission}
                onClick={() => handleSaveTab(step, false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Simpan &amp; Lihat Profil</span>
              </button>

              {step < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep((step + 1) as 1 | 2 | 3 | 4);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border border-polri-navy/30 bg-slate-50 hover:bg-slate-100 text-polri-navy text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Kategori Berikutnya</span>
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
