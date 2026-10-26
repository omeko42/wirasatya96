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
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { num: 1, title: 'Kedinasan & Kontak', shortTitle: 'Kedinasan & Kontak', icon: Shield },
  { num: 2, title: 'Domisili & Keluarga', shortTitle: 'Domisili & Keluarga', icon: Users },
  { num: 3, title: 'Purna Tugas & Usaha', shortTitle: 'Purna Tugas & Usaha', icon: Home },
  { num: 4, title: 'Kesehatan & Asuransi', shortTitle: 'Kesehatan & Asuransi', icon: Activity },
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

  const initializedMemberKeyRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    rencanaAktivitas: ['USAHA SENDIRI'],
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
        golonganDarah: activeUser.golonganDarah || 'O',
        ukuranBaju: activeUser.ukuranBaju || 'XL',
        ukuranCelana: activeUser.ukuranCelana || '34',
        ukuranSepatu: activeUser.ukuranSepatu || '42',
        biayaSewaTempatTinggal: '',
        detailSewaTempatTinggal: '',
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
        golonganDarah: 'O',
        ukuranBaju: 'XL',
        ukuranCelana: '34',
        ukuranSepatu: '42',
        biayaSewaTempatTinggal: '',
        detailSewaTempatTinggal: '',
        biayaSewaTahunan: '',
        detailSewaPurnaTugas: '',
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

  // Per-Tab Validation
  const validateTab = (tabNum: 1 | 2 | 3 | 4): boolean => {
    setErrorMsg(null);

    // If creating a brand new member who doesn't exist yet in baselineMember,
    // require Tab 1 core identity (namaLengkap & nrp) first.
    if (!baselineMember && tabNum !== 1) {
      if (!formData.namaLengkap?.trim() || !formData.nrp?.trim()) {
        setStep(1);
        setErrorMsg(
          'Untuk personel baru yang belum terdaftar, mohon isi Nama Lengkap dan NRP pada Tab 1 (Kedinasan & Kontak) terlebih dahulu.'
        );
        return false;
      }
    }

    if (tabNum === 1) {
      if (!formData.namaLengkap?.trim()) {
        setErrorMsg('Mohon lengkapi Nama Lengkap & Gelar personel pada Tab 1.');
        return false;
      }
      const cleanNrp = (formData.nrp || '').replace(/\s+/g, '').trim();
      if (!cleanNrp) {
        setErrorMsg('Mohon lengkapi NRP / NIP personel pada Tab 1.');
        return false;
      }
      if (!/^\d{6,18}$/.test(cleanNrp)) {
        setErrorMsg('NRP / NIP harus berupa angka yang valid (minimal 8 digit NRP Polri).');
        return false;
      }
      if (!formData.satuanKerja?.trim() && !formData.satkerMabes?.trim()) {
        setErrorMsg('Mohon pilih Satuan Kerja (Satker) pada Tab 1.');
        return false;
      }
      if (isExternalJabatan && !formData.jabatanTerakhir?.trim()) {
        setErrorMsg('Mohon ketik nama Jabatan Eksternal (Luar Struktur Polri) pada Tab 1.');
        return false;
      }
      return true;
    }

    if (tabNum === 2) {
      if (Array.isArray(formData.daftarAnak) && formData.daftarAnak.length > 0) {
        const emptyChildIdx = formData.daftarAnak.findIndex((c) => !c.nama?.trim());
        if (emptyChildIdx >= 0) {
          setErrorMsg(
            `Mohon isi Nama Anak ke-${emptyChildIdx + 1} pada Tab 2, atau hapus baris anak yang masih kosong.`
          );
          return false;
        }
      }
      return true;
    }

    if (tabNum === 3) {
      if (!formData.statusRumahPurnaTugas) {
        setErrorMsg('Mohon pilih Status Tempat Tinggal Setelah Pensiun pada Tab 3.');
        return false;
      }
      return true;
    }

    if (tabNum === 4) {
      const hasCheckedDisease = (formData.daftarPenyakit?.length || 0) > 0;
      const hasCustomDisease = penyakitLainnya.trim().length > 0;
      const hasMedicalNote = Boolean(formData.kondisiSaatIni?.trim());
      if (
        formData.adaPenyakitKronis === 'ADA' &&
        !hasCheckedDisease &&
        !hasCustomDisease &&
        !hasMedicalNote
      ) {
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
      rencanaAktivitas: formData.rencanaAktivitas || ['USAHA SENDIRI'],
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
      // Tab 1: Kedinasan & Kontak ONLY
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
      // Tab 2: Domisili & Keluarga ONLY
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
      // Tab 3: Purna Tugas & Usaha ONLY
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
      // Tab 4: Kesehatan & Asuransi ONLY
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
          details: `Memperbarui Tab ${tabNum} (${tabMeta.title}) Pimpinan ${mergedMember.pangkat} ${mergedMember.namaLengkap}`,
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24 md:pb-12">
      {/* Compact Header & Free Tab Navigation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-polri-navy truncate">
              {baselineMember ? 'Edit Profil & Data Personel' : 'Tambah Data Personel'}
            </h2>
            <span
              title="Setiap tab dapat diklik langsung dan disimpan secara terpisah (independen) tanpa harus mengisi tab lainnya terlebih dahulu"
              className="inline-flex items-center text-slate-400 hover:text-slate-600 cursor-help flex-shrink-0"
            >
              <Info className="w-4 h-4" />
            </span>
            {activeUser.role === 'ANGGOTA' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 hidden sm:inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Mandiri
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full">
              Tab {step}/4 &bull; {currentTabMeta.shortTitle}
            </span>
          </div>
        </div>

        {/* 4 Freely Clickable Interactive Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TAB_CONFIG.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isSaved = Boolean(savedTabs[s.num]);
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  setStep(s.num);
                  setErrorMsg(null);
                }}
                className={`relative flex flex-col items-start sm:items-center justify-center gap-1 py-2.5 px-3 rounded-xl border text-left sm:text-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-polri-navy text-white border-polri-navy shadow-sm ring-2 ring-polri-gold/40'
                    : isSaved
                    ? 'bg-emerald-50/90 text-emerald-900 border-emerald-300 hover:bg-emerald-100/70'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between sm:justify-center w-full gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-polri-gold' : isSaved ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    />
                    <span className="text-[11px] sm:text-xs font-extrabold truncate">
                      {s.num}. {s.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-0.5">
                  {isSaved ? (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 ${
                        isActive
                          ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      &#10003; Tersimpan
                    </span>
                  ) : isActive ? (
                    <span className="text-[10px] font-bold text-polri-gold/90">
                      Sedang Dibuka
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Klik untuk buka
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Helper note about independent per-tab saving */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
          <span>
            💡 <strong>Simpan Per Tab Independen:</strong> Anda bebas berpindah tab kapan saja dan menyimpan perubahan hanya pada tab yang sedang dibuka.
          </span>
          {baselineMember && (
            <span className="font-bold text-polri-navy">
              Personel: {baselineMember.pangkat} {baselineMember.namaLengkap}
            </span>
          )}
        </div>
      </div>

      {/* Saved Toast / Banner */}
      {savedBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-extrabold text-emerald-900">
                Perubahan Tab {savedBanner.tabName} berhasil disimpan &amp; disinkronkan ke Profil, Beranda, Jabatan, Anev, dan User!
              </div>
              <div className="text-[11px] text-emerald-700">
                Disimpan pada pukul {savedBanner.timestamp} WIB &bull; Hanya data pada Tab {savedBanner.tabNum} ({savedBanner.tabName}) yang diperbarui.
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

      {/* Main Form Body */}
      <form
        onSubmit={handleFormSubmit}
        noValidate
        className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6"
      >
        {/* STEP 1: KEDINASAN & KONTAK */}
        {step === 1 && (
          <div className="space-y-6">
            {/* SEKSI 1: SATUAN KERJA & JABATAN */}
            <div className="bg-slate-50/70 border border-slate-200 p-4 sm:p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-polri-navy flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-polri-gold" />
                  1. Satuan Kerja &amp; Jabatan
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-polri-navy/10 text-polri-navy">
                  Standar SIPP Polri
                </span>
              </div>

              {/* Korps Personel, Status Kedinasan, Pangkat & Pendidikan Terakhir */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pendidikan Terakhir
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: S1 Teknik Informatika / Akpol 1996"
                    value={formData.pendidikanTerakhir || ''}
                    onChange={(e) => handleInputChange('pendidikanTerakhir', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  />
                </div>
              </div>

              {/* Kartu Informasi Khusus Personel Berstatus ALMARHUM di Tab 1 */}
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
                      {formData.kontakIstri && (
                        <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-slate-200 font-semibold border border-white/15">
                          WA Keluarga: {formData.kontakIstri}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
                  >
                    <Users className="w-4 h-4" />
                    <span>Lengkapi Data Istri &amp; Anak Almarhum (Buka Tab 2)</span>
                  </button>
                </div>
              )}

              {/* Satker Melekat (Pilih Satker Berjenjang) & Jabatan Organisasi Polri Saat Ini */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2.5">
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
                        placeholder="Contoh: Deputi Pemberantasan BNN / Direktur Penyidikan KPK / Staf Ahli Kementerian..."
                        value={formData.jabatanTerakhir || ''}
                        onChange={(e) => handleInputChange('jabatanTerakhir', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {jabatanSelectConfig.isOfficer
                        ? 'Pilihan jabatan distandarisasi sesuai pangkat (Perpol 4/2025 & SOTK Kewilayahan). Pilih Eksternal Polri jika penugasan di luar struktur.'
                        : 'Untuk pangkat selain IPDA ke atas di dalam struktur Polri cukup pilih Staf atau ADC (atau pilih Eksternal Polri untuk ketik sendiri).'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SEKSI 2: IDENTITAS PRIBADI & KONTAK */}
            <div className="bg-slate-50/70 border border-slate-200 p-4 sm:p-5 rounded-xl space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-polri-navy flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-polri-gold" />
                2. Identitas Pribadi &amp; Kontak
              </span>

              {/* Dual Compact Grid: Foto Profil & Gambar Sampul */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Foto Profil Card */}
                <div className="flex items-center gap-3.5 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-polri-gold bg-slate-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAvatarUrl(formData.fotoUrl)}
                      alt="Foto Profil"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-xs font-bold text-slate-800">Foto Profil</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="px-2.5 py-1.5 rounded-lg bg-polri-navy hover:bg-polri-navyLight text-polri-gold text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Unggah</span>
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
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gambar Sampul (Cover Banner) Card */}
                <div className="flex items-center gap-3.5 p-3 bg-white rounded-xl border border-slate-200">
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getCoverUrl(formData.coverUrl)}
                      alt="Sampul Profil"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-xs font-bold text-slate-800">Gambar Sampul</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Sampul</span>
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
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap &amp; Gelar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Eko Agung"
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
                    placeholder="Contoh: 74000000"
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
                  {activeUser.role === 'ANGGOTA' && baselineMember && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      NRP terkunci sebagai identitas utama akun.
                    </span>
                  )}
                </div>

                {/* Tempat Lahir & Tanggal Lahir (Terkait Hitungan Usia Pensiun 58 Tahun) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta / Surabaya / Bandung"
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

                {/* Live Banner: Hitungan Otomatis Usia Pensiun 58 Tahun (BUP Polri) */}
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-polri-navy to-slate-900 text-white border border-polri-gold/30 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-polri-gold flex-shrink-0" />
                      <span className="text-xs font-extrabold tracking-wide text-polri-gold uppercase">
                        Kalkulasi Otomatis Pensiun Polri (BUP {RETIREMENT_AGE_POLRI} Tahun)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200">
                      Lahir: {retirementCalc.formattedTanggalLahir}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[10px] text-slate-300 block">Usia Saat Ini</span>
                      <span className="font-extrabold text-white text-sm">
                        {retirementCalc.usiaLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[10px] text-slate-300 block">
                        Jatuh Tempo Pensiun (Usia {RETIREMENT_AGE_POLRI} Thn)
                      </span>
                      <span className="font-extrabold text-amber-300 text-sm">
                        Tahun {retirementCalc.tahunPurnaTugas}{' '}
                        <span className="text-[11px] font-normal text-slate-200">
                          ({retirementCalc.formattedTanggalPensiun})
                        </span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[10px] text-slate-300 block">
                        Sisa Masa Dinas menuju {RETIREMENT_AGE_POLRI} Tahun
                      </span>
                      <span
                        className={`font-extrabold text-sm ${
                          retirementCalc.isPurnaTugas ? 'text-red-300' : 'text-emerald-300'
                        }`}
                      >
                        {retirementCalc.sisaMasaDinasLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Dinas (@polri.go.id)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="Contoh: 74000000@example.com"
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
                      placeholder="Contoh: nama@gmail.com"
                      value={formData.secondaryEmail || ''}
                      onChange={(e) => handleInputChange('secondaryEmail', e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={formData.noHp || ''}
                    onChange={(e) => handleInputChange('noHp', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Golongan Darah
                  </label>
                  <select
                    value={formData.golonganDarah || 'O'}
                    onChange={(e) => handleInputChange('golonganDarah', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  >
                    {DAFTAR_GOLONGAN_DARAH.map((gd) => (
                      <option key={gd} value={gd}>
                        Golongan Darah {gd}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data Ukuran Aparel / Seragam Paguyuban (Baju, Celana, Sepatu) */}
                <div className="sm:col-span-2 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                      <span>👕 Data Ukuran Aparel / Seragam Paguyuban (Baju, Celana, Sepatu)</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Baju: {formData.ukuranBaju || 'XL'} &bull; Celana: {formData.ukuranCelana || '34'} &bull; Sepatu: {formData.ukuranSepatu || '42'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700">
                        1. Ukuran Baju / Kemeja / Kaos
                      </label>
                      <select
                        value={formData.ukuranBaju || 'XL'}
                        onChange={(e) => handleInputChange('ukuranBaju', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
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
                      <label className="block text-[11px] font-bold text-slate-700">
                        2. Ukuran Celana (Nomor 28 s/d 46)
                      </label>
                      <select
                        value={formData.ukuranCelana || '34'}
                        onChange={(e) => handleInputChange('ukuranCelana', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_CELANA.map((cl) => (
                          <option key={cl} value={cl}>
                            Nomor {cl}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Atau ketik ukuran celana (misal: 34 / 35)"
                        value={formData.ukuranCelana || ''}
                        onChange={(e) => handleInputChange('ukuranCelana', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-slate-50 focus:bg-white focus:ring-1 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700">
                        3. Ukuran Sepatu (Nomor 38 s/d 47)
                      </label>
                      <select
                        value={formData.ukuranSepatu || '42'}
                        onChange={(e) => handleInputChange('ukuranSepatu', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-bold bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      >
                        {DAFTAR_UKURAN_SEPATU.map((sp) => (
                          <option key={sp} value={sp}>
                            Nomor {sp}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Atau ketik ukuran sepatu (misal: 42 / 43)"
                        value={formData.ukuranSepatu || ''}
                        onChange={(e) => handleInputChange('ukuranSepatu', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-slate-50 focus:bg-white focus:ring-1 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

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
                    Alamat Domisili Saat Ini
                  </label>
                  <input
                    type="text"
                    placeholder="Kota / Alamat domisili saat ini..."
                    value={formData.alamatTempatTinggal || ''}
                    onChange={(e) => handleInputChange('alamatTempatTinggal', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  />
                </div>

                {/* Panel Rincian Biaya Sewa/Kontrak Tempat Tinggal Saat Ini di Tab 1 */}
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
                          placeholder="Contoh: Rp 36.000.000 / Tahun (Rp 3.000.000 / Bulan)"
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
                          placeholder="Contoh: Kontrakan Rumah 3 KT di Jakarta Selatan, masa sewa s/d Desember 2027"
                          value={formData.detailSewaTempatTinggal || ''}
                          onChange={(e) => handleInputChange('detailSewaTempatTinggal', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                        />
                        <p className="text-[10px] text-amber-800 leading-snug">
                          Isi rincian jenis hunian sewa/kontrak dan masa berlaku sewa saat ini.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ringkasan Profil / Bio
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ringkasan singkat penugasan, keahlian, atau riwayat kedinasan..."
                    value={formData.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  />
                </div>
              </div>

              {/* Rincian Data Ajudan / ADC Resmi & Pendamping Pimpinan */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
                  <div className="min-w-0">
                    <label className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-polri-gold flex-shrink-0" />
                      <span>Daftar ADC / Ajudan / Spri Pendamping Pimpinan (Opsional)</span>
                    </label>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Klik <strong>&ldquo;Tambah ADC&rdquo;</strong> untuk menambahkan data Ajudan/ADC. Jika NRP ADC diisi, ADC dapat login mewakili Pimpinan dan seluruh aktivitas tercatat di Log Audit.
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
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-white/70 text-center text-xs text-slate-400">
                    Belum ada akun / kontak ADC yang ditambahkan. Klik tombol <strong>&ldquo;Tambah ADC&rdquo;</strong> di atas untuk menginput data ADC.
                  </div>
                )}

                {formData.daftarAdc?.map((adc, idx) => {
                  const adcCalc = adc.tanggalLahir
                    ? calculateRetirement58(adc.tanggalLahir, adc.nrp)
                    : null;
                  return (
                    <div
                      key={adc.id || idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-extrabold text-polri-navy flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-polri-gold" />
                          <span>ADC / Ajudan ke-{idx + 1}</span>
                          {adcCalc && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Usia: {adcCalc.usiaTahun} Thn
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdc(idx)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Nama Lengkap &amp; Gelar ADC <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Aryo Pratama, S.H."
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
                            placeholder="Contoh: 99040123"
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
                            Peran / Jabatan Pendamping
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
                            placeholder="0812-xxxx-xxxx"
                            value={adc.noHp}
                            onChange={(e) => handleUpdateAdc(idx, 'noHp', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Email Dinas / Pribadi ADC
                          </label>
                          <input
                            type="email"
                            placeholder="Contoh: 99040123@polri.go.id"
                            value={adc.email || ''}
                            onChange={(e) => handleUpdateAdc(idx, 'email', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-polri-navy"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DOMISILI & KELUARGA */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b pb-2.5 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-polri-navy flex items-center gap-2">
                <Users className="w-4 h-4 text-polri-gold" />
                {formData.statusKedinasan === 'ALMARHUM'
                  ? '🕊️ Pendataan Keluarga & Ahli Waris Almarhum (Istri & Putra-Putri)'
                  : 'Domisili Saat Ini, Data Keluarga & Tanggungan Anak'}
              </h3>
            </div>

            {formData.statusKedinasan === 'ALMARHUM' && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/50 shadow-sm space-y-1.5">
                <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                  <span>🕊️ Pendataan Keluarga &amp; Ahli Waris Almarhum (Istri &amp; Putra-Putri)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Silakan lengkapi data Istri / Ahli Waris, Nomor HP/WhatsApp aktif keluarga, alamat domisili keluarga saat ini, serta daftar lengkap Putra-Putri Almarhum untuk keperluan santunan, silaturahmi, dan dukungan pendidikan Paguyuban Wira Satya 96.
                </p>
              </div>
            )}

            {/* Domisili & Tempat Tinggal Saat Ini */}
            <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl space-y-3.5">
              <span className="text-xs font-black uppercase tracking-wider text-polri-navy flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-polri-gold" />
                1. Domisili &amp; Tempat Tinggal {formData.statusKedinasan === 'ALMARHUM' ? 'Keluarga ' : ''}Saat Ini
              </span>
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
                    placeholder="Contoh: Jakarta Selatan / Bandung..."
                    value={formData.alamatTempatTinggal || ''}
                    onChange={(e) => handleInputChange('alamatTempatTinggal', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                  />
                </div>

                {/* Panel Rincian Biaya Sewa/Kontrak Tempat Tinggal Saat Ini di Tab 2 */}
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
                          placeholder="Contoh: Rp 36.000.000 / Tahun (Rp 3.000.000 / Bulan)"
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
                          placeholder="Contoh: Kontrakan Rumah 3 KT di Jakarta Selatan, masa sewa s/d Desember 2027"
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

            {/* Data Keluarga & Pasangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Perkawinan</label>
                <select
                  value={formData.statusPerkawinan || 'MENIKAH'}
                  onChange={(e) => handleInputChange('statusPerkawinan', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
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
                    : 'Nama Pasangan / Bhayangkari'}
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ny. Dewi Hadi Wicaksono"
                  value={formData.namaIstri || ''}
                  onChange={(e) => handleInputChange('namaIstri', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {formData.statusKedinasan === 'ALMARHUM'
                    ? 'Tanggal Lahir Istri / Ahli Waris'
                    : 'Tanggal Lahir Pasangan'}
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {formData.statusKedinasan === 'ALMARHUM'
                    ? 'Nomor HP / WhatsApp Aktif Istri / Keluarga'
                    : 'Kontak Pasangan / Keluarga'}
                </label>
                <input
                  type="text"
                  placeholder="0812-xxxx-xxxx"
                  value={formData.kontakIstri || ''}
                  onChange={(e) => handleInputChange('kontakIstri', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Anak</label>
                <input
                  type="number"
                  min="0"
                  value={formData.daftarAnak?.length || 0}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600"
                />
              </div>
            </div>

            {/* Rincian Anak Section */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  {formData.statusKedinasan === 'ALMARHUM'
                    ? 'Daftar Putra-Putri Almarhum & Status Pendidikan'
                    : 'Data Putra / Putri & Pendidikan'}
                </label>
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-polri-navy text-white text-xs font-semibold hover:bg-polri-navyLight transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Anak
                </button>
              </div>

              {(!formData.daftarAnak || formData.daftarAnak.length === 0) && (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Belum ada data anak. Klik &ldquo;Tambah Anak&rdquo; jika ingin menambahkan.
                </div>
              )}

              {formData.daftarAnak?.map((anak, idx) => (
                <div key={anak.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Anak ke-{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChild(idx)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Nama Anak <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nama Lengkap Anak"
                        value={anak.nama}
                        onChange={(e) => handleUpdateChild(idx, 'nama', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Tempat Lahir Anak
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Jakarta"
                        value={anak.tempatLahir || ''}
                        onChange={(e) => handleUpdateChild(idx, 'tempatLahir', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-polri-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
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
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
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
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
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
            </div>
          </div>
        )}

        {/* STEP 3: PURNA TUGAS & USAHA */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="border-b pb-2.5 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-polri-navy flex items-center gap-2">
                <Home className="w-4 h-4 text-polri-gold" />
                Persiapan Purna Tugas &amp; Rencana Usaha
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                BUP Polri: {RETIREMENT_AGE_POLRI} Tahun
              </span>
            </div>

            {/* Kartu Kalkulasi Usia Pensiun 58 Tahun Otomatis dari Tanggal Lahir */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold text-polri-navy block">
                    Hitungan Otomatis Pensiun di Usia {RETIREMENT_AGE_POLRI} Tahun
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="MILIK PRIBADI">MILIK PRIBADI</option>
                  <option value="RUMAH KELUARGA">RUMAH KELUARGA</option>
                  <option value="SEWA/KONTRAK">SEWA / KONTRAK (Belum Ada Rumah Tetap)</option>
                  <option value="DINAS">DINAS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Rencana Domisili Purna Tugas
                </label>
                <input
                  type="text"
                  placeholder="Kota / Wilayah rencana domisili pensiun..."
                  value={formData.alamatPurnaTugas || ''}
                  onChange={(e) => handleInputChange('alamatPurnaTugas', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                />
              </div>

              {/* Panel Rincian Biaya & Keterangan Sewa / Kontrak Hunian Purna Tugas di Tab 3 */}
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
                        placeholder="Contoh: Rp 30.000.000 / Tahun (Rp 2.500.000 / Bulan)"
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
                        placeholder="Contoh: Rencana sewa rumah di Bandung sambil menyiapkan hunian tetap"
                        value={formData.detailSewaPurnaTugas || ''}
                        onChange={(e) => handleInputChange('detailSewaPurnaTugas', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-polri-navy focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rencana Jenis Usaha / Aktivitas
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kuliner / Konsultan / Perkebunan / Peternakan"
                  value={formData.jenisUsaha || ''}
                  onChange={(e) => handleInputChange('jenisUsaha', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Kesiapan Usaha
                </label>
                <select
                  value={formData.statusUsaha || 'MASIH RENCANA'}
                  onChange={(e) => handleInputChange('statusUsaha', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="SUDAH JALAN">SUDAH JALAN</option>
                  <option value="DALAM PERSIAPAN">DALAM PERSIAPAN</option>
                  <option value="MASIH RENCANA">MASIH RENCANA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kebutuhan Dukungan Paguyuban
                </label>
                <select
                  value={formData.kebutuhanPembekalan?.[0] || 'PELATIHAN'}
                  onChange={(e) => handleInputChange('kebutuhanPembekalan', [e.target.value])}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="MODAL">Bantuan Akses Modal</option>
                  <option value="PELATIHAN">Pelatihan Kewirausahaan</option>
                  <option value="PENDAMPINGAN">Pendampingan Usaha</option>
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="OPTIMIS">OPTIMIS</option>
                  <option value="TENANG">TENANG</option>
                  <option value="CEMAS">CEMAS</option>
                  <option value="RAGU">RAGU</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: KESEHATAN & ASURANSI */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="border-b pb-2.5 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-polri-navy flex items-center gap-2">
                <Activity className="w-4 h-4 text-polri-gold" />
                Riwayat Kesehatan, Golongan Darah, Asuransi &amp; Kesejahteraan
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  Riwayat Penyakit Kronis
                </label>
                <select
                  value={formData.adaPenyakitKronis || 'TIDAK ADA'}
                  onChange={(e) => handleInputChange('adaPenyakitKronis', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="TIDAK ADA">TIDAK ADA</option>
                  <option value="ADA">ADA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kondisi Kesehatan Saat Ini
                </label>
                <select
                  value={formData.kondisiKesehatan || 'BAIK'}
                  onChange={(e) => handleInputChange('kondisiKesehatan', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
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
                  Rutin Medical Check-Up (MCU)
                </label>
                <select
                  value={formData.rutinMcu || 'YA'}
                  onChange={(e) => handleInputChange('rutinMcu', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
                >
                  <option value="< 6 BULAN">&lt; 6 Bulan Terakhir</option>
                  <option value="6-12 BULAN">6 - 12 Bulan Terakhir</option>
                  <option value="> 1 TAHUN">&gt; 1 Tahun Lalu</option>
                </select>
              </div>
            </div>

            {/* Jaminan Kesehatan / Asuransi Aktif */}
            <div className="pt-1">
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
                      <span className={isChecked ? 'font-bold text-polri-navy' : ''}>{ins}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checkbox Penyakit */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Riwayat Diagnosa Medis (Opsional):
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
                      <span className={isChecked ? 'font-bold text-polri-navy' : ''}>{penyakit}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Opsi Diagnosa Lainnya / Tulis Sendiri */}
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-950">
                  Diagnosa Lainnya (Pisahkan dengan koma):
                </label>
              </div>
              <input
                type="text"
                placeholder="Contoh: GERD, Vertigo..."
                value={penyakitLainnya}
                onChange={(e) => {
                  if (errorMsg) setErrorMsg(null);
                  setPenyakitLainnya(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-slate-800 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kondisi Terkini &amp; Penanganan Medis
              </label>
              <textarea
                rows={2}
                placeholder="Rincian kondisi kesehatan atau obat rutin..."
                value={formData.kondisiSaatIni || ''}
                onChange={(e) => handleInputChange('kondisiSaatIni', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Harapan Dukungan Kesejahteraan
              </label>
              <textarea
                rows={2}
                placeholder="Pesan atau harapan silaturahmi..."
                value={formData.harapanDukunganLeting || ''}
                onChange={(e) => handleInputChange('harapanDukunganLeting', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-polri-navy focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Unified Action Footer on ALL 4 Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-slate-200">
          {/* Left Side: Batal / Kembali + Tab Sebelumnya */}
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
                Tab Sebelumnya
              </button>
            )}
          </div>

          {/* Right Side: Simpan Tab [Nama Tab] + Simpan & Lihat Profil + Tab Berikutnya */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSaveTab(step, true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-polri-navy hover:bg-polri-navyLight text-polri-gold text-xs font-extrabold shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Tab {currentTabMeta.shortTitle}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveTab(step, false)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
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
                <span>Tab Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </form>

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
