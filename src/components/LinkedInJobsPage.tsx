'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AuthUser, AnggotaWiraSatya, RiwayatJabatanLeting, FungsiPolri } from '@/types';
import {
  DAFTAR_38_POLDA,
  getSatkerUtamaByWilayah,
  getSubSatkerOptionsBySatker,
} from '@/data/polriStructure';
import {
  getAvatarUrl,
  getOrBuildUserProfile,
  resolveAvatarUrl,
  formatJabatanWithSatker,
  detectStatusKedinasan,
  extractCleanJabatanTitle,
  stripRankFromName,
  getActiveAdcSessionFromStorage,
  recordAdcActivityToAuditLog,
  getPangkatRankOrder,
  getLevelSatkerOrder,
  getRoleRankOrder,
  getStatusKedinasanOrder,
  isSuperadminAccount,
} from '@/lib/avatarUtils';
import {
  getJabatanGroupsForPangkat,
  isStandardPolriJabatan,
  isOfficerRankIpdaUp,
  EXTERNAL_JABATAN_SENTINEL,
  classifyJabatanForStats,
} from '@/data/polriJabatan';
import { MetaVerifiedBadge, resolveRoleForBadge } from './MetaVerifiedBadge';
import { SortModalPopup, SortTriggerBar, UnifiedSortKey } from './SortModalPopup';
import { 
  Briefcase, 
  Building2, 
  MapPin, 
  Search, 
  PlusCircle,
  Award,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Phone,
  Info,
  X,
  ArrowUpDown,
} from 'lucide-react';

interface LinkedInJobsPageProps {
  currentUser: AuthUser;
  members: AnggotaWiraSatya[];
  onOpenFormWizard?: () => void;
  onSelectMember?: (member: AnggotaWiraSatya) => void;
  onOpenChat?: (member: AnggotaWiraSatya) => void;
  onUpdateMemberJabatan?: (nrp: string, jabatan: string, satker: string, polda: string) => void;
}

const DAFTAR_FUNGSI_POLRI: {
  key: FungsiPolri;
  label: string;
  badgeBg: string;
}[] = [
  { key: 'WASUM', label: 'Wasum', badgeBg: 'bg-slate-100 text-slate-800 border-slate-300' },
  { key: 'RENA', label: 'Rena', badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { key: 'OPS', label: 'Ops', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'LEMDIKLAT', label: 'Lemdiklat', badgeBg: 'bg-purple-50 text-purple-800 border-purple-200' },
  { key: 'RESERSE', label: 'Reserse', badgeBg: 'bg-red-50 text-red-800 border-red-200' },
  { key: 'INTELKAM', label: 'Intelkam', badgeBg: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'HARKAM', label: 'Harkam', badgeBg: 'bg-teal-50 text-teal-800 border-teal-200' },
  { key: 'BRIMOB', label: 'Brimob', badgeBg: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
  { key: 'SLOG', label: 'Slog', badgeBg: 'bg-orange-50 text-orange-800 border-orange-200' },
  { key: 'SAHLI', label: 'Sahli', badgeBg: 'bg-neutral-100 text-neutral-800 border-neutral-300' },
  { key: 'LANTAS', label: 'Lantas', badgeBg: 'bg-blue-50 text-blue-800 border-blue-200' },
  { key: 'DENSUS', label: 'Densus', badgeBg: 'bg-rose-50 text-rose-900 border-rose-300' },
  { key: 'HUMAS', label: 'Humas', badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { key: 'PROPAM', label: 'Propam', badgeBg: 'bg-sky-50 text-sky-900 border-sky-300' },
  { key: 'HUKUM', label: 'Hukum', badgeBg: 'bg-violet-50 text-violet-800 border-violet-200' },
  { key: 'HUBINTER', label: 'Hubinter', badgeBg: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { key: 'TIK', label: 'TIK', badgeBg: 'bg-blue-50 text-blue-900 border-blue-200' },
  { key: 'SDM', label: 'SDM', badgeBg: 'bg-lime-50 text-lime-900 border-lime-200' },
  { key: 'TASPIDKOR', label: 'Taspidkor', badgeBg: 'bg-red-100 text-red-900 border-red-300' },
  { key: 'KEU', label: 'Keu', badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { key: 'DOKKES', label: 'Dokkes', badgeBg: 'bg-pink-50 text-pink-800 border-pink-200' },
  { key: 'LITBANG', label: 'Litbang', badgeBg: 'bg-amber-50 text-amber-900 border-amber-200' },
  { key: 'SEJARAH', label: 'Sejarah', badgeBg: 'bg-orange-50 text-orange-900 border-orange-200' },
  { key: 'SETUM', label: 'Setum', badgeBg: 'bg-stone-100 text-stone-800 border-stone-300' },
  { key: 'YANMA', label: 'Yanma', badgeBg: 'bg-slate-100 text-slate-800 border-slate-300' },
  { key: 'SPRIPIM', label: 'Spripim', badgeBg: 'bg-yellow-50 text-yellow-900 border-yellow-300' },
  { key: 'KEWILAYAHAN', label: 'Kewilayahan', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'LUAR_STRUKTUR', label: 'Luar Struktur', badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
];

const VALID_FUNGSI_KEYS = new Set<string>(DAFTAR_FUNGSI_POLRI.map((f) => f.key));

function inferFungsiPolri(jabatan: string, satker: string, polda: string): FungsiPolri {
  const cleanJab = (jabatan || '').replace(/\(Eks[^)]*\)/gi, '');
  const t = `${cleanJab} ${satker} ${polda}`.toUpperCase();
  if (
    t.includes('LUAR STRUKTUR') ||
    t.includes('BNN') ||
    t.includes('KPK') ||
    t.includes('BNPT') ||
    t.includes('BAKAMLA') ||
    t.includes('BADAN INTELIJEN NEGARA') ||
    t.includes('BIN RI') ||
    t.includes('KEMENTERIAN') ||
    t.includes('KEMEN') ||
    t.includes('KOMDIGI') ||
    t.includes('IMIGRASI') ||
    t.includes('IMIPAS') ||
    t.includes('DPD RI') ||
    t.includes('DPR RI') ||
    t.includes('MPR RI') ||
    t.includes('LEMHANNAS RI') ||
    t.includes('WANTANNAS') ||
    t.includes('BSSN') ||
    t.includes('PPATK') ||
    t.includes('OMBUDSMAN') ||
    t.includes('SKK MIGAS') ||
    t.includes('OTORITA IKN') ||
    t.includes('BP2MI') ||
    t.includes('SEKMIL') ||
    t.includes('SETMILPRES')
  ) return 'LUAR_STRUKTUR';
  if (t.includes('SAHLI') || t.includes('STAF AHLI')) return 'SAHLI';
  if (t.includes('TASPIDKOR') || t.includes('KORTASTIPIDKOR') || t.includes('TIPIDKOR')) return 'TASPIDKOR';
  if (t.includes('DENSUS')) return 'DENSUS';
  if (t.includes('ITWAS') || t.includes('WASUM') || t.includes('IRWAS') || t.includes('IRWIL') || t.includes('AUDITOR KEPOLISIAN') || t.includes('INSPEKTUR')) return 'WASUM';
  if (t.includes('RENA') || t.includes('STAMARENA') || t.includes('SRENA')) return 'RENA';
  if (t.includes('LEMDIKLAT') || t.includes('SESPIM') || t.includes('AKPOL') || t.includes('STIK') || t.includes('SPN') || t.includes('PUSDIK') || t.includes('WIDYAISWARA') || t.includes('DOSEN')) return 'LEMDIKLAT';
  if (t.includes('PROPAM') || t.includes('WABPROF') || t.includes('PAMINAL') || t.includes('PROVOS')) return 'PROPAM';
  if (t.includes('HUMAS') || t.includes('PENMAS') || t.includes('PID')) return 'HUMAS';
  if (t.includes('HUKUM') || t.includes('DIVKUM') || t.includes('BIDKUM')) return 'HUKUM';
  if (t.includes('HUBINTER') || t.includes('INTERPOL') || t.includes('MHI')) return 'HUBINTER';
  if (t.includes('TIK')) return 'TIK';
  if (t.includes('SDM') || t.includes('SSDM') || t.includes('BINKAR') || t.includes('DALPERS') || t.includes('WATPERS') || t.includes('ROPSI') || t.includes('PSI BIRO')) return 'SDM';
  if (t.includes('KEU') || t.includes('PUSKEU') || t.includes('BIDKEU')) return 'KEU';
  if (t.includes('DOKKES') || t.includes('PUSDOKKES') || t.includes('BIDDOKKES') || t.includes('RS BHAYANGKARA') || t.includes('KESEHATAN')) return 'DOKKES';
  if (t.includes('LITBANG') || t.includes('PUSLITBANG')) return 'LITBANG';
  if (t.includes('PUSJARAH') || t.includes('SEJARAH')) return 'SEJARAH';
  if (t.includes('SETUM') || t.includes('KASETUM')) return 'SETUM';
  if (/\bYANMA\b/.test(t) || t.includes('KAYANMA')) return 'YANMA';
  if (t.includes('SPRIPIM') || t.includes('KOORSPRIPIM') || t.includes('KORSPRIPIM') || t.includes('SESPRI') || t.includes('KASPRIPIM') || t.includes('AJUDAN')) return 'SPRIPIM';
  if (t.includes('SLOG') || t.includes('ROLOG') || t.includes('SARPRAS') || t.includes('FASKON') || t.includes('BEKUM') || t.includes('ADA BARANG')) return 'SLOG';
  if (t.includes('BRIMOB') || t.includes('GEGANA') || t.includes('PELOPOR') || t.includes('PASBRIMOB')) return 'BRIMOB';
  if (t.includes('LANTAS') || t.includes('KORLANTAS') || t.includes('PJR') || t.includes('REGIDENT') || t.includes('GAKKUM') || t.includes('KAMSEL')) return 'LANTAS';
  if (t.includes('INTEL') || t.includes('BAINTELKAM') || t.includes('SOSBUD') || t.includes('KAMNEG') || t.includes('POLITIK') || t.includes('KAMSUS') || t.includes('SANDI')) return 'INTELKAM';
  if (t.includes('RESKRIM') || t.includes('BARESKRIM') || t.includes('NARKOBA') || t.includes('DITTIPID') || t.includes('SIBER') || t.includes('PUSIKNAS') || t.includes('LABFOR') || t.includes('PUSINAFIS') || t.includes('INAFIS') || t.includes('PPNS') || t.includes('TIPIDUM') || t.includes('TIPIDEKSUS') || t.includes('TIPIDTER') || t.includes('PPA DAN PPO') || t.includes('PENYIDIK') || t.includes('WASSIDIK')) return 'RESERSE';
  if (t.includes('BAHARKAM') || t.includes('HARKAM') || t.includes('SAMAPTA') || t.includes('SABHARA') || t.includes('PAMOBVIT') || t.includes('POLAIR') || t.includes('POLUDARA') || t.includes('BINMAS') || t.includes('KAKORBINMAS') || t.includes('SATWA')) return 'HARKAM';
  if (t.includes('SOPS') || t.includes('STAMAOPS') || t.includes('ROOPS') || t.includes('KARO OPS') || t.includes('KAROOPS') || t.includes('KABAGOPS') || t.includes('BAGOPS') || t.includes('KERMA') || t.includes('ROKERMA') || t.includes('BINOPSNAL') || t.includes('DALOPS') || t.includes('SIAGA')) return 'OPS';
  if (t.includes('KAPOLDA') || t.includes('WAKAPOLDA') || t.includes('KAPOLRES') || t.includes('WAKAPOLRES') || t.includes('KAPOLSEK') || t.includes('POLDA') || t.includes('POLRES') || t.includes('SPKT')) return 'KEWILAYAHAN';
  return 'OPS';
}

export const LinkedInJobsPage: React.FC<LinkedInJobsPageProps> = ({
  currentUser,
  members,
  onOpenFormWizard,
  onSelectMember,
  onOpenChat,
  onUpdateMemberJabatan,
}) => {
  const [selectedFungsi, setSelectedFungsi] = useState<string>('SEMUA');
  const [selectedPolda, setSelectedPolda] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<UnifiedSortKey>('DEFAULT');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [isSortModalOpen, setIsSortModalOpen] = useState<boolean>(false);
  const [showJabatanHeaderInfo, setShowJabatanHeaderInfo] = useState<boolean>(false);
  const [showTodInfo, setShowTodInfo] = useState<boolean>(false);
  const [mobileOpenProfile, setMobileOpenProfile] = useState<boolean>(false);
  const [mobileOpenTod, setMobileOpenTod] = useState<boolean>(false);
  const [mobileOpenKategori, setMobileOpenKategori] = useState<boolean>(false);
  const myProfile = useMemo(() => getOrBuildUserProfile(currentUser, members), [currentUser, members]);
  const myAvatarUrl = resolveAvatarUrl(myProfile.fotoUrl, currentUser.fotoUrl);

  const [customJabatanList, setCustomJabatanList] = useState<RiwayatJabatanLeting[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wirasatya96_riwayat_jabatan_v4');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.map((j: RiwayatJabatanLeting) => ({
              ...j,
              avatarUrl: getAvatarUrl(j.avatarUrl),
              fungsiPolri: VALID_FUNGSI_KEYS.has(j.fungsiPolri)
                ? j.fungsiPolri
                : inferFungsiPolri(j.jabatan || '', j.satker || '', j.polda || ''),
            }));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [];
  });

  // Live Sync active positions with `members` prop whenever a member is updated in FormWizard or Menu User
  useEffect(() => {
    if (!members || members.length === 0) return;
    setCustomJabatanList((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((j) => {
        const matched = members.find((m) => m.nrp === j.perwiraNrp);
        if (!matched) return j;
        const isActivePosition =
          j.isCurrent !== false || (j as unknown as { status?: string }).status === 'SAAT_INI';
        const nextNama = matched.namaLengkap || j.namaPerwira;
        const nextPangkat = matched.pangkat || j.pangkat;
        const nextAvatar = getAvatarUrl(matched.fotoUrl);
        const nextStatusKedinasan = detectStatusKedinasan(
          matched.statusKedinasan || matched.statusDinas,
          matched.jabatanTerakhir || matched.jabatan,
          matched.jenisAnggota
        );

        if (isActivePosition) {
          const nextJabatan =
            extractCleanJabatanTitle(matched.jabatanTerakhir || matched.jabatan) || j.jabatan;
          const nextSatker = matched.satuanKerja || matched.satker || j.satker;
          const nextPolda = matched.polda || j.polda;
          const nextFungsi = inferFungsiPolri(nextJabatan, nextSatker, nextPolda);

          if (
            j.namaPerwira !== nextNama ||
            j.pangkat !== nextPangkat ||
            j.avatarUrl !== nextAvatar ||
            j.jabatan !== nextJabatan ||
            j.satker !== nextSatker ||
            j.polda !== nextPolda ||
            j.fungsiPolri !== nextFungsi ||
            j.statusKedinasan !== nextStatusKedinasan
          ) {
            changed = true;
            return {
              ...j,
              namaPerwira: nextNama,
              pangkat: nextPangkat,
              avatarUrl: nextAvatar,
              jabatan: nextJabatan,
              satker: nextSatker,
              polda: nextPolda,
              fungsiPolri: nextFungsi,
              statusKedinasan: nextStatusKedinasan,
            };
          }
          return j;
        }

        if (
          j.namaPerwira !== nextNama ||
          j.pangkat !== nextPangkat ||
          j.avatarUrl !== nextAvatar ||
          j.statusKedinasan !== nextStatusKedinasan
        ) {
          changed = true;
          return {
            ...j,
            namaPerwira: nextNama,
            pangkat: nextPangkat,
            avatarUrl: nextAvatar,
            statusKedinasan: nextStatusKedinasan,
          };
        }
        return j;
      });

      if (changed && typeof window !== 'undefined') {
        try {
          localStorage.setItem('wirasatya96_riwayat_jabatan_v4', JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return changed ? next : prev;
    });
  }, [members]);

  const jabatanList = useMemo(() => {
    const visibleMembers = members.filter(
      (m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
    );
    const visibleCustom = customJabatanList.filter(
      (j) => !isSuperadminAccount(j.perwiraNrp)
    );

    const memberEntries: RiwayatJabatanLeting[] = visibleMembers.map((m) => {
      const statusKedinasan = detectStatusKedinasan(
        m.statusKedinasan || m.statusDinas,
        m.jabatanTerakhir || m.jabatan,
        m.jenisAnggota
      );
      const cleanJab = extractCleanJabatanTitle(m.jabatanTerakhir || m.jabatan) || 'Perwira Menengah Polri';
      const stk = m.satuanKerja || m.satker || 'Mabes Polri';
      const pld = m.polda || 'MABES POLRI';
      const uraianTugas =
        statusKedinasan === 'ALMARHUM'
          ? `Almarhum • Jabatan terakhir pada ${stk} (${pld}).`
          : statusKedinasan === 'PURNA_TUGAS'
          ? `Purna Tugas Polri • Jabatan terakhir pada ${stk} (${pld}).`
          : statusKedinasan === 'PTDH'
          ? `PTDH • Jabatan terakhir pada ${stk} (${pld}).`
          : `Penugasan aktif pada ${stk} (${pld}).`;
      return {
        id: `jab-member-${m.nrp}`,
        perwiraNrp: m.nrp,
        namaPerwira: m.namaLengkap,
        pangkat: m.pangkat,
        avatarUrl: getAvatarUrl(m.fotoUrl),
        jabatan: cleanJab,
        satker: stk,
        polda: pld,
        fungsiPolri: inferFungsiPolri(cleanJab, stk, pld),
        tahunMulai: 2024,
        isCurrent: statusKedinasan === 'AKTIF',
        statusKedinasan,
        uraianTugas,
        dasarTR: 'Data Direktori & UKP',
      };
    });
    return [...visibleCustom, ...memberEntries];
  }, [customJabatanList, members]);

  const [selectedKategoriJabatan, setSelectedKategoriJabatan] = useState<string>('SEMUA');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'AKTIF' | 'PURNA_TUGAS' | 'PTDH' | 'ALMARHUM'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNewExternalJabatan, setIsNewExternalJabatan] = useState(false);
  const [newJabatan, setNewJabatan] = useState({
    jabatan: '',
    polda: 'MABES POLRI',
    satkerUtama: 'BARESKRIM POLRI',
    subSatker: 'Pimpinan / Staf Utama Satker',
    fungsiPolri: 'RESERSE' as FungsiPolri,
    tahunMulai: 2026,
    uraianTugas: '',
    prestasiOperasional: '',
    dasarTR: '',
  });

  const jabatanCategoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    jabatanList.forEach((item) => {
      const cat = classifyJabatanForStats(
        item.jabatan,
        item.pangkat,
        item.polda === 'KEMEN/LEMBAGA' ? 'KEMEN/LEMBAGA' : undefined
      );
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [jabatanList]);

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: jabatanList.length,
      AKTIF: 0,
      PURNA_TUGAS: 0,
      PTDH: 0,
      ALMARHUM: 0,
    };
    jabatanList.forEach((item) => {
      const st = item.statusKedinasan || 'AKTIF';
      if (st === 'ALMARHUM') counts.ALMARHUM++;
      else if (st === 'PURNA_TUGAS') counts.PURNA_TUGAS++;
      else if (st === 'PTDH') counts.PTDH++;
      else counts.AKTIF++;
    });
    return counts;
  }, [jabatanList]);

  const filteredJabatan = useMemo(() => {
    return jabatanList.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchedMember = members.find((m) => m.nrp === item.perwiraNrp);
      const matchesSearch = 
        item.jabatan.toLowerCase().includes(q) ||
        item.namaPerwira.toLowerCase().includes(q) ||
        item.perwiraNrp.toLowerCase().includes(q) ||
        item.satker.toLowerCase().includes(q) ||
        item.polda.toLowerCase().includes(q) ||
        (item.dasarTR && item.dasarTR.toLowerCase().includes(q)) ||
        (matchedMember?.namaIstri && matchedMember.namaIstri.toLowerCase().includes(q)) ||
        (matchedMember?.daftarAnak && matchedMember.daftarAnak.some((a) => a.nama.toLowerCase().includes(q)));

      const matchesFungsi = selectedFungsi === 'SEMUA' || item.fungsiPolri === selectedFungsi;
      const matchesPolda = selectedPolda === 'SEMUA' || item.polda.toUpperCase() === selectedPolda.toUpperCase();
      const itemCat = classifyJabatanForStats(
        item.jabatan,
        item.pangkat,
        item.polda === 'KEMEN/LEMBAGA' ? 'KEMEN/LEMBAGA' : undefined
      );
      const matchesKategori = selectedKategoriJabatan === 'SEMUA' || itemCat === selectedKategoriJabatan;
      const itemStatus = item.statusKedinasan || 'AKTIF';
      const matchesStatus = selectedStatusFilter === 'ALL' || itemStatus === selectedStatusFilter;
      return matchesSearch && matchesFungsi && matchesPolda && matchesKategori && matchesStatus;
    });
  }, [jabatanList, members, searchQuery, selectedFungsi, selectedPolda, selectedKategoriJabatan, selectedStatusFilter]);

  const sortedJabatan = useMemo(() => {
    const cmpStatus = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) =>
      getStatusKedinasanOrder(a.statusKedinasan) - getStatusKedinasanOrder(b.statusKedinasan);
    const cmpPangkat = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) =>
      getPangkatRankOrder(a.pangkat) - getPangkatRankOrder(b.pangkat);
    const cmpLevelSatker = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) =>
      getLevelSatkerOrder(a.satker, a.polda, a.jabatan) - getLevelSatkerOrder(b.satker, b.polda, b.jabatan);
    const cmpNrp = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) => {
      const nA = Number(String(a.perwiraNrp || '').replace(/\D/g, '')) || 0;
      const nB = Number(String(b.perwiraNrp || '').replace(/\D/g, '')) || 0;
      if (nA !== nB) return nA - nB;
      return String(a.perwiraNrp || '').localeCompare(String(b.perwiraNrp || ''));
    };
    const cmpNama = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) =>
      (stripRankFromName(a.namaPerwira) || a.namaPerwira).localeCompare(
        stripRankFromName(b.namaPerwira) || b.namaPerwira,
        'id'
      );
    const cmpRole = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting) =>
      getRoleRankOrder(resolveRoleForBadge(a.perwiraNrp)) -
      getRoleRankOrder(resolveRoleForBadge(b.perwiraNrp));

    const comparePair = (a: RiwayatJabatanLeting, b: RiwayatJabatanLeting): number => {
      if (sortBy === 'NRP') {
        // Ascend (!sortDesc) = NRP Kecil -> Besar; Descend (sortDesc) = NRP Besar -> Kecil
        const nrpDiff = sortDesc ? -cmpNrp(a, b) : cmpNrp(a, b);
        return (
          nrpDiff ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b)
        );
      }
      if (sortBy === 'NAMA') {
        // Ascend (!sortDesc) = Abjad A -> Z; Descend (sortDesc) = Abjad Z -> A
        const namaDiff = sortDesc ? -cmpNama(a, b) : cmpNama(a, b);
        return (
          namaDiff ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpRole(a, b)
        );
      }

      let res = 0;
      if (sortBy === 'PANGKAT_UTAMA') {
        res =
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b) ||
          cmpStatus(a, b);
      } else if (sortBy === 'STATUS') {
        // 1. Aktif -> 2. Purna Tugas -> 3. PTDH -> 4. Almarhum (NRP Kecil di atas)
        res =
          cmpStatus(a, b) ||
          cmpNrp(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'PANGKAT') {
        res =
          cmpPangkat(a, b) ||
          cmpStatus(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'LEVEL_SATKER') {
        res =
          cmpLevelSatker(a, b) ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'ROLE') {
        res =
          cmpRole(a, b) ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b);
      } else {
        // DEFAULT Kombinasi Utama (Menu User + Menu Jabatan):
        // Status (Aktif -> Purna -> PTDH -> Almarhum) • Pangkat • Level Satker • NRP • Nama • Role
        res =
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      }
      return sortDesc ? res : -res;
    };

    return [...filteredJabatan].sort(comparePair);
  }, [filteredJabatan, sortBy, sortDesc]);

  const nonAlmarhumJabatan = useMemo(
    () => sortedJabatan.filter((item) => item.statusKedinasan !== 'ALMARHUM'),
    [sortedJabatan]
  );

  const almarhumJabatan = useMemo(
    () => sortedJabatan.filter((item) => item.statusKedinasan === 'ALMARHUM'),
    [sortedJabatan]
  );

  const handleAddJabatanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackGroups = getJabatanGroupsForPangkat(currentUser.pangkat, currentUser.nrp);
    const effectiveJabatan =
      newJabatan.jabatan.trim() ||
      (!isNewExternalJabatan ? fallbackGroups[0]?.options[0] || 'Staf' : '');
    if (!effectiveJabatan) return;

    const composedSatker =
      newJabatan.subSatker && newJabatan.subSatker !== 'Pimpinan / Staf Utama Satker'
        ? `${newJabatan.subSatker} - ${newJabatan.satkerUtama}`
        : newJabatan.satkerUtama;

    const entry: RiwayatJabatanLeting = {
      id: `jab-${Date.now()}`,
      perwiraNrp: currentUser.nrp,
      namaPerwira: currentUser.nama.replace(/\(.*?\)/g, '').trim(),
      pangkat: currentUser.pangkat,
      avatarUrl: getAvatarUrl(currentUser.fotoUrl),
      jabatan: effectiveJabatan,
      satker: composedSatker,
      polda: newJabatan.polda,
      fungsiPolri: newJabatan.fungsiPolri,
      tahunMulai: Number(newJabatan.tahunMulai),
      isCurrent: true,
      uraianTugas: newJabatan.uraianTugas,
      prestasiOperasional: newJabatan.prestasiOperasional,
      dasarTR: newJabatan.dasarTR || `ST/${Math.floor(1000 + Math.random() * 9000)}/X/KEP./2026`,
    };

    const updated = [entry, ...customJabatanList];
    setCustomJabatanList(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wirasatya96_riwayat_jabatan_v4', JSON.stringify(updated));
    }

    if (getActiveAdcSessionFromStorage()) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: 'Menambahkan/memperbarui riwayat jabatan: ' + effectiveJabatan + ' pada ' + composedSatker,
      });
    }

    // Sync active jabatan/satker/polda to members & users database
    if (onUpdateMemberJabatan) {
      onUpdateMemberJabatan(currentUser.nrp, effectiveJabatan, composedSatker, newJabatan.polda);
    }

    setIsAddModalOpen(false);
    setNewJabatan({
      jabatan: '',
      polda: 'MABES POLRI',
      satkerUtama: 'BARESKRIM POLRI',
      subSatker: 'Pimpinan / Staf Utama Satker',
      fungsiPolri: 'RESERSE',
      tahunMulai: 2026,
      uraianTugas: '',
      prestasiOperasional: '',
      dasarTR: '',
    });
  };

  const getFungsiBadge = (fungsi: FungsiPolri) => {
    const found = DAFTAR_FUNGSI_POLRI.find((f) => f.key === fungsi);
    if (found) {
      return { label: found.label, bg: found.badgeBg };
    }
    return { label: 'Ops', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  return (
    <div className="font-sans text-slate-900 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ============================================================ */}
        {/* LEFT RAIL (lg:col-span-4): PROFIL & STATISTIK PENUGASAN     */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          {/* User Career Card (Collapsible Header di HP) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Mobile Compact Header */}
            <div
              onClick={() => setMobileOpenProfile((prev) => !prev)}
              className="lg:hidden flex items-center justify-between gap-2.5 p-3.5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={myAvatarUrl}
                  alt={myProfile.namaLengkap || currentUser.nama}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 bg-white"
                />
                <div className="min-w-0 text-left">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1 truncate">
                    <span className="truncate">
                      {(myProfile.namaLengkap || currentUser.nama).replace(/\(.*?\)/g, '').trim()}
                    </span>
                    <MetaVerifiedBadge role={currentUser.role} nrp={currentUser.nrp} size="sm" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {myProfile.pangkat || currentUser.pangkat} &bull; {myProfile.polda || 'MABES POLRI'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  Karier
                </span>
                {mobileOpenProfile ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Desktop Cover & Avatar */}
            <div className="hidden lg:block text-center">
              <div className="h-16 bg-gradient-to-r from-red-950 via-slate-900 to-red-900 relative overflow-hidden">
                {(myProfile.coverUrl || currentUser.coverUrl) !== 'none' && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={myProfile.coverUrl || currentUser.coverUrl || '/default-cover.jpg'}
                    alt="Sampul Polri"
                    className="w-full h-full object-cover object-center"
                  />
                )}
              </div>

              <div className="px-5 relative">
                <div
                  onClick={() => onSelectMember && onSelectMember(myProfile)}
                  className="w-16 h-16 rounded-full border-2 border-white shadow-md mx-auto -mt-8 overflow-hidden bg-white cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={myAvatarUrl}
                    alt={myProfile.namaLengkap || currentUser.nama}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3
                  onClick={() => onSelectMember && onSelectMember(myProfile)}
                  className="text-sm font-bold text-slate-900 hover:text-red-900 cursor-pointer mt-2 leading-tight flex items-center justify-center gap-1"
                >
                  <span className="truncate">{(myProfile.namaLengkap || currentUser.nama).replace(/\(.*?\)/g, '').trim()}</span>
                  <MetaVerifiedBadge role={currentUser.role} nrp={currentUser.nrp} size="sm" />
                </h3>
                <p
                  className="text-xs font-semibold text-red-800 mt-0.5 truncate"
                  title={`${myProfile.pangkat || currentUser.pangkat} • ${formatJabatanWithSatker(myProfile.jabatanTerakhir, myProfile.satuanKerja || currentUser.satker)}`}
                >
                  {myProfile.pangkat || currentUser.pangkat} &bull; {formatJabatanWithSatker(myProfile.jabatanTerakhir, myProfile.satuanKerja || currentUser.satker)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {myProfile.polda || 'MABES POLRI'}
                </p>
              </div>
            </div>

            <div className={`${mobileOpenProfile ? 'block' : 'hidden'} lg:block px-4 lg:px-5 pb-4 lg:pb-5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100`}>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full lg:mt-4 py-2 px-3 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tambah Jabatan</span>
              </button>

              <button
                onClick={onOpenFormWizard}
                className="w-full mt-2 py-1.5 px-3 rounded-lg border border-red-800/40 text-red-900 hover:bg-red-50 font-bold text-xs transition-colors"
              >
                <span className="sm:hidden">Perbarui Profil</span>
                <span className="hidden sm:inline">Perbarui Data Kedinasan</span>
              </button>
            </div>
          </div>

          {/* Statistik Tour of Duty (Collapsible Header di HP) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
            <div
              onClick={() => setMobileOpenTod((prev) => !prev)}
              className="flex items-center justify-between gap-1.5 cursor-pointer lg:cursor-default select-none"
            >
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <Building2 className="w-4 h-4 text-red-800 flex-shrink-0" />
                <span>Tour of Duty</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTodInfo((prev) => !prev);
                  }}
                  title="Statistik penempatan dan riwayat jabatan personel per fungsi Polri (Klik untuk memfilter)"
                  className="text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedFungsi !== 'SEMUA' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFungsi('SEMUA');
                    }}
                    className="text-[10px] font-bold text-red-700 hover:underline"
                  >
                    Reset
                  </button>
                )}
                <span className="lg:hidden text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full">
                  {jabatanList.length}
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenTod ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>
            {showTodInfo && (
              <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                Statistik penempatan &amp; riwayat jabatan personel per fungsi Polri. Ketuk baris fungsi untuk memfilter.
              </div>
            )}

            <div className={`${mobileOpenTod ? 'block' : 'hidden'} lg:block pt-2.5 mt-2.5 border-t border-slate-100 space-y-2.5`}>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 text-xs">
                {[
                  {
                    key: 'SEMUA',
                    label: 'Semua',
                    count: jabatanList.length,
                  },
                  ...DAFTAR_FUNGSI_POLRI.map((f) => ({
                    key: f.key,
                    label: f.label,
                    count: jabatanList.filter((j) => j.fungsiPolri === f.key).length,
                  })),
                ].map((row) => {
                  const isSelected = selectedFungsi === row.key;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() =>
                        setSelectedFungsi(isSelected && row.key !== 'SEMUA' ? 'SEMUA' : row.key)
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-800 text-white font-bold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className={`truncate pr-2 ${isSelected ? 'text-white font-bold' : 'text-slate-700 font-medium'}`}>
                        {row.label}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-900 border border-slate-200'
                        }`}
                      >
                        <span className="sm:hidden">{row.count}</span>
                        <span className="hidden sm:inline">{row.count} Jabatan</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate">
                Sumber: TR Mutasi &amp; Data Mandiri
              </div>
            </div>
          </div>

          {/* Rekapitulasi Hitungan Kategori Jabatan Organisasi Polri (Collapsible Header di HP) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
            <div
              onClick={() => setMobileOpenKategori((prev) => !prev)}
              className="flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <Award className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="sm:hidden truncate">Kategori Jabatan</span>
                <span className="hidden sm:inline truncate">Rekap Kategori Jabatan</span>
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                {selectedKategoriJabatan !== 'SEMUA' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKategoriJabatan('SEMUA');
                    }}
                    className="text-[10px] font-bold text-red-700 hover:underline"
                  >
                    Reset
                  </button>
                )}
                <span className="lg:hidden text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {jabatanCategoryStats.length} Kategori
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenKategori ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            <div className={`${mobileOpenKategori ? 'block' : 'hidden'} lg:block pt-2.5 mt-2.5 border-t border-slate-100`}>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5 text-xs">
                {jabatanCategoryStats.map(([cat, count]) => {
                  const isSelected = selectedKategoriJabatan === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedKategoriJabatan(isSelected ? 'SEMUA' : cat)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-red-800 text-white font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="truncate pr-2 text-[11px]">{cat}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-900 border border-slate-200'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CENTER / MAIN FEED (lg:col-span-8): RIWAYAT JABATAN STREAM   */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Top Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                    <Briefcase className="w-5 h-5 text-red-800 flex-shrink-0" />
                    <span className="truncate">Riwayat Jabatan ({sortedJabatan.length})</span>
                  </h1>
                  <button
                    type="button"
                    onClick={() => setShowJabatanHeaderInfo((prev) => !prev)}
                    title="Penempatan aktif di Mabes Polri & 38 Polda • Urutan Default: Status (Aktif → Purna → PTDH → Almarhum) • Pangkat • Level Satker • NRP • Nama • Role"
                    className="sm:hidden text-slate-400 hover:text-red-800 cursor-pointer focus:outline-none shrink-0"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <p className="hidden sm:block text-xs text-slate-500 mt-0.5 truncate">
                  Penempatan aktif di Mabes Polri &amp; 38 Polda &bull; Urutan Default: Status (Aktif &rarr; Purna &rarr; PTDH &rarr; Almarhum) &bull; Pangkat &bull; Level Satker &bull; NRP &bull; Nama &bull; Role
                </p>
                {showJabatanHeaderInfo && (
                  <p className="sm:hidden text-[11px] text-slate-600 mt-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 leading-relaxed">
                    Penempatan Mabes Polri &amp; 38 Polda. Urutan Default: <strong>Status (Aktif &rarr; Purna &rarr; PTDH &rarr; Almarhum) &bull; Pangkat &bull; Level Satker &bull; NRP &bull; Nama &bull; Role</strong>.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                {/* Sorting Button Trigger -> Membuka Modal Pop-up List dengan Pilihan Ascend / Descend */}
                <SortTriggerBar
                  sortBy={sortBy}
                  sortDesc={sortDesc}
                  onOpenModal={() => setIsSortModalOpen(true)}
                  onToggleDirection={() => setSortDesc((prev) => !prev)}
                  compact
                />

                <SortModalPopup
                  isOpen={isSortModalOpen}
                  onClose={() => setIsSortModalOpen(false)}
                  sortBy={sortBy}
                  sortDesc={sortDesc}
                  onSelectSort={(newKey, newDesc) => {
                    setSortBy(newKey);
                    setSortDesc(newDesc);
                  }}
                  contextTitle="Menu Jabatan (Riwayat Jabatan)"
                />

                <select
                  value={selectedPolda}
                  onChange={(e) => setSelectedPolda(e.target.value)}
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-800/30"
                >
                  <option value="SEMUA">Filter Wilayah (Semua)</option>
                  {DAFTAR_38_POLDA.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[180px] sm:min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama, NRP, jabatan, satker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800/30 focus:border-red-800"
                  />
                </div>
              </div>
            </div>

            {/* Filter Tab Status Kedinasan & Grup Khusus Almarhum */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold pt-1 pb-1 border-t border-slate-100">
              {[
                { key: 'ALL' as const, label: `Semua (${statusCounts.ALL})` },
                { key: 'AKTIF' as const, label: `🎖️ Dinas Aktif (${statusCounts.AKTIF})` },
                { key: 'PURNA_TUGAS' as const, label: `🏛️ Purna Tugas BUP 60 Thn (${statusCounts.PURNA_TUGAS})` },
                ...(statusCounts.PTDH > 0 ? [{ key: 'PTDH' as const, label: `⚠️ PTDH (${statusCounts.PTDH})` }] : []),
                { key: 'ALMARHUM' as const, label: `🕊️ In Memoriam / Almarhum (Data Keluarga) (${statusCounts.ALMARHUM})` },
              ].map((stTab) => (
                <button
                  key={stTab.key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(stTab.key)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    selectedStatusFilter === stTab.key
                      ? stTab.key === 'ALMARHUM'
                        ? 'bg-slate-800 text-amber-300 font-bold shadow-sm border border-amber-400/50'
                        : 'bg-red-800 text-white font-bold shadow-sm'
                      : stTab.key === 'ALMARHUM'
                      ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {stTab.label}
                </button>
              ))}
            </div>

            {/* Filter Pills based on Police Functions */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold pt-1 pb-1">
              {[
                { key: 'SEMUA', label: 'Semua' },
                ...DAFTAR_FUNGSI_POLRI.map((f) => ({ key: f.key, label: f.label })),
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFungsi(f.key)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    selectedFungsi === f.key
                      ? 'bg-red-800 text-white font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Jabatan Cards Stream (Personel Aktif / Purna Tugas / PTDH) */}
          {selectedStatusFilter !== 'ALMARHUM' && (
            <div className="space-y-3">
              {nonAlmarhumJabatan.length === 0 && almarhumJabatan.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                  Tidak ditemukan riwayat jabatan yang sesuai kriteria pencarian.
                </div>
              ) : (
                nonAlmarhumJabatan.map((item) => {
                  const badge = getFungsiBadge(item.fungsiPolri);
                  const matchedMember = members.find((m) => m.nrp === item.perwiraNrp);
                  const angkatanRole = resolveRoleForBadge(item.perwiraNrp);
                  const jabatanAngkatanBadge =
                    angkatanRole === 'KETUA'
                      ? { shortLabel: 'Ketua Angkatan', fullLabel: 'Jabatan Angkatan: Ketua Angkatan', cls: 'bg-red-100 text-red-900 border-red-300' }
                      : angkatanRole === 'SEKRETARIAT'
                      ? { shortLabel: 'Sekretaris', fullLabel: 'Jabatan Angkatan: Sekretaris Angkatan', cls: 'bg-amber-100 text-amber-900 border-amber-300' }
                      : angkatanRole === 'BENDAHARA'
                      ? { shortLabel: 'Bendahara', fullLabel: 'Jabatan Angkatan: Bendahara Angkatan', cls: 'bg-amber-100 text-amber-900 border-amber-300' }
                      : null;

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 hover:border-red-800/40 transition-all hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0">
                          {/* Perwira Avatar */}
                          <div 
                            onClick={() => matchedMember && onSelectMember && onSelectMember(matchedMember)}
                            className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0 cursor-pointer hover:border-red-800 transition-colors"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.avatarUrl || '/default-avatar.png'}
                              alt={item.namaPerwira}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0">
                            {/* Perwira Name (Bold Black) + Verified Badge + Pangkat + Jabatan Angkatan */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2
                                onClick={() => matchedMember && onSelectMember && onSelectMember(matchedMember)}
                                className="text-sm sm:text-base font-bold text-slate-900 hover:text-red-800 cursor-pointer transition-colors"
                              >
                                {stripRankFromName(item.namaPerwira) || item.namaPerwira}
                              </h2>
                              <MetaVerifiedBadge nrp={item.perwiraNrp} size="xs" />
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                {item.pangkat}
                              </span>
                              {jabatanAngkatanBadge && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${jabatanAngkatanBadge.cls}`}
                                >
                                  <span className="sm:hidden">{jabatanAngkatanBadge.shortLabel}</span>
                                  <span className="hidden sm:inline">{jabatanAngkatanBadge.fullLabel}</span>
                                </span>
                              )}
                            </div>

                            {/* Jabatan Organisasi Polri (Red) & NRP */}
                            <div className="text-xs flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-semibold text-red-900">
                                {item.statusKedinasan === 'ALMARHUM' || item.statusKedinasan === 'PURNA_TUGAS' || item.statusKedinasan === 'PTDH'
                                  ? `Eks ${extractCleanJabatanTitle(item.jabatan)}`
                                  : extractCleanJabatanTitle(item.jabatan)}
                              </span>
                              <span className="text-slate-400 font-normal">&bull;</span>
                              <span className="text-slate-600 font-normal">NRP {item.perwiraNrp}</span>
                            </div>

                            {/* Satker & Polda */}
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {item.satker}
                              </span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {item.polda}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {item.statusKedinasan === 'PURNA_TUGAS' ? (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="sm:hidden">🎖️ Purna Tugas</span>
                              <span className="hidden sm:inline">🎖️ Purna Tugas / Pensiun</span>
                            </span>
                          ) : item.statusKedinasan === 'PTDH' ? (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              ⚠️ PTDH
                            </span>
                          ) : item.isCurrent ? (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="sm:hidden">Aktif</span>
                              <span className="hidden sm:inline">Menjabat Sekarang</span>
                            </span>
                          ) : (
                            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {item.tahunMulai} - {item.tahunSelesai || 'Selesai'}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Uraian Tugas */}
                      {item.uraianTugas && (
                        <p className="text-xs text-slate-700 mt-3 pl-0 sm:pl-[62px] leading-relaxed">
                          {item.uraianTugas}
                        </p>
                      )}

                      {/* Prestasi Operasional / Inovasi */}
                      {item.prestasiOperasional && (
                        <div className="mt-2.5 sm:ml-[62px] p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                          <Award className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">
                              <span className="sm:hidden">Prestasi: </span>
                              <span className="hidden sm:inline">Prestasi Operasional / Inovasi: </span>
                            </span>
                            <span>{item.prestasiOperasional}</span>
                          </div>
                        </div>
                      )}

                      {/* Footer / TR & Quick Actions (Profil, Pesan, WA) */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:ml-[62px] flex-wrap gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Dasar: <span className="text-slate-600 font-semibold">{item.dasarTR || '-'}</span>
                        </span>

                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {matchedMember && (
                            <button
                              onClick={() => onSelectMember && onSelectMember(matchedMember)}
                              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors flex items-center gap-1"
                              title="Lihat Profil Lengkap"
                            >
                              <span className="sm:hidden">Profil</span>
                              <span className="hidden sm:inline">Lihat Profil</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {matchedMember && onOpenChat && (
                            <button
                              onClick={() => onOpenChat(matchedMember)}
                              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                              title="Kirim Pesan / Obrolan Cepat"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="sm:hidden">Pesan</span>
                              <span className="hidden sm:inline">Obrolan Cepat</span>
                            </button>
                          )}
                          {matchedMember?.noHp && (
                            <a
                              href={`https://wa.me/${matchedMember.noHp.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=Halo%20Komandan%20${encodeURIComponent(item.namaPerwira)}%2C%20salam%20Wira%20Satya%2096`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 sm:gap-1.5 shadow-2xs"
                              title="Hubungi via WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="sm:hidden">WA</span>
                              <span className="hidden sm:inline">WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* GRUP KHUSUS IN MEMORIAM (ALMARHUM) & PENDATAAN KELUARGA        */}
          {/* ============================================================== */}
          {(selectedStatusFilter === 'ALL' || selectedStatusFilter === 'ALMARHUM') && almarhumJabatan.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-2">
                    <span>🕊️ Grup Khusus In Memoriam — Keluarga Besar Almarhum Wira Satya 96</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Dikelompokkan tersendiri untuk kehormatan rekan leting yang telah mendahului kita, dilengkapi pendataan Istri / Ahli Waris dan Putra-Putri.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold self-start sm:self-auto shrink-0">
                  {almarhumJabatan.length} Personel Almarhum
                </span>
              </div>

              <div className="space-y-3">
                {almarhumJabatan.map((item) => {
                  const badge = getFungsiBadge(item.fungsiPolri);
                  const matchedMember = members.find((m) => m.nrp === item.perwiraNrp);
                  const daftarAnak = matchedMember?.daftarAnak || [];
                  const kontakKeluarga = matchedMember?.kontakIstri || matchedMember?.noHp || '';

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border-2 border-slate-300 shadow-sm p-4 sm:p-5 hover:border-slate-500 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            onClick={() => matchedMember && onSelectMember && onSelectMember(matchedMember)}
                            className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-400 flex-shrink-0 cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.avatarUrl || '/default-avatar.png'}
                              alt={item.namaPerwira}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2
                                onClick={() => matchedMember && onSelectMember && onSelectMember(matchedMember)}
                                className="text-sm sm:text-base font-bold text-slate-900 hover:text-red-800 cursor-pointer transition-colors"
                              >
                                Alm. {stripRankFromName(item.namaPerwira) || item.namaPerwira}
                              </h2>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold text-[10px]">
                                {item.pangkat}
                              </span>
                            </div>

                            <div className="text-xs flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-semibold text-slate-700">
                                Jabatan Terakhir: {extractCleanJabatanTitle(item.jabatan)}
                              </span>
                              <span className="text-slate-400 font-normal">&bull;</span>
                              <span className="text-slate-600 font-normal">NRP {item.perwiraNrp}</span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {item.satker}
                              </span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {item.polda}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                            🕊️ In Memoriam
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Data Keluarga Almarhum (Istri & Anak) */}
                      <div className="mt-3.5 sm:ml-[62px] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 space-y-1">
                          <div className="font-bold text-amber-950">👩 Data Istri / Ahli Waris:</div>
                          <p className="text-slate-800">
                            <b>Nama Istri:</b> {matchedMember?.namaIstri || 'Ny. Keluarga Almarhum'}
                          </p>
                          <p className="text-slate-700 text-[11px]">
                            <b>Kontak Keluarga:</b> {kontakKeluarga || '-'}
                          </p>
                          <p className="text-slate-700 text-[11px]">
                            <b>Domisili Keluarga:</b> {matchedMember?.alamatTempatTinggal || '-'}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                          <div className="font-bold text-slate-800">
                            🎓 Putra-Putri Almarhum ({daftarAnak.length || matchedMember?.jumlahAnak || 0} Anak):
                          </div>
                          {daftarAnak.length > 0 ? (
                            <div className="space-y-1">
                              {daftarAnak.map((anak, idx) => (
                                <div
                                  key={anak.id || idx}
                                  className="text-[11px] bg-white px-2 py-1 rounded border border-slate-200 flex items-center justify-between gap-2"
                                >
                                  <span className="font-semibold text-slate-800 truncate">
                                    {idx + 1}. {anak.nama}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-bold text-[10px] shrink-0">
                                    {anak.status}
                                    {anak.biayaPendidikanTahunan ? ` • ${anak.biayaPendidikanTahunan}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">
                              Belum ada rincian putra-putri.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:ml-[62px] flex-wrap gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">
                          🕊️ Pendataan Keluarga &amp; Silaturahmi Ahli Waris WS96
                        </span>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {matchedMember && (
                            <button
                              onClick={() => onSelectMember && onSelectMember(matchedMember)}
                              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-amber-300 font-bold text-xs transition-colors flex items-center gap-1"
                              title="Buka Profil & Edit Data Keluarga Almarhum"
                            >
                              <span>Profil &amp; Data Keluarga</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {kontakKeluarga && (
                            <a
                              href={`https://wa.me/${kontakKeluarga.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=Assalamualaikum%20Keluarga%20Almarhum%20${encodeURIComponent(item.namaPerwira)}%2C%20kami%20dari%20Paguyuban%20Wira%20Satya%2096`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1 sm:gap-1.5 shadow-2xs"
                              title="Hubungi Keluarga / Ahli Waris via WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>WA Keluarga</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* MODAL: TAMBAH RIWAYAT JABATAN BARU (MUTASI / PROMOSI)          */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-900 text-white">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">Tambah Jabatan</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddJabatanSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">
                    Jabatan Organisasi Polri <span className="text-red-600">*</span>
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {isOfficerRankIpdaUp(currentUser.pangkat)
                      ? `Standar ${currentUser.pangkat}`
                      : 'Staf / ADC'}
                  </span>
                </div>
                {(() => {
                  const groups = getJabatanGroupsForPangkat(currentUser.pangkat, currentUser.nrp);
                  const curVal = newJabatan.jabatan.trim();
                  const isStd = isStandardPolriJabatan(curVal, currentUser.pangkat, currentUser.nrp);
                  const selectVal = isNewExternalJabatan
                    ? EXTERNAL_JABATAN_SENTINEL
                    : isStd
                    ? curVal
                    : groups[0]?.options[0] || 'Staf';

                  return (
                    <>
                      <select
                        value={selectVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === EXTERNAL_JABATAN_SENTINEL) {
                            setIsNewExternalJabatan(true);
                            setNewJabatan({ ...newJabatan, jabatan: '', fungsiPolri: 'LUAR_STRUKTUR' });
                          } else {
                            setIsNewExternalJabatan(false);
                            setNewJabatan({
                              ...newJabatan,
                              jabatan: val,
                              fungsiPolri: inferFungsiPolri(val, newJabatan.satkerUtama, newJabatan.polda),
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-red-800 focus:outline-none"
                      >
                        {groups.map((grp) => (
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

                      {isNewExternalJabatan && (
                        <input
                          type="text"
                          required
                          placeholder="Ketik nama jabatan eksternal (misal BNN, KPK, BNPT, Kementerian)..."
                          value={newJabatan.jabatan}
                          onChange={(e) => setNewJabatan({ ...newJabatan, jabatan: e.target.value })}
                          className="w-full px-3 py-2 border border-amber-300 bg-amber-50/50 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                        />
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">1. Wilayah Induk (Mabes / 38 Polda) *</label>
                  <select
                    value={newJabatan.polda}
                    onChange={(e) => {
                      const w = e.target.value;
                      const satkers = getSatkerUtamaByWilayah(w);
                      const firstS = satkers[0] || w;
                      const subs = getSubSatkerOptionsBySatker(w, firstS);
                      setNewJabatan({
                        ...newJabatan,
                        polda: w,
                        satkerUtama: firstS,
                        subSatker: subs[0] || 'Pimpinan / Staf Utama Satker',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                  >
                    {DAFTAR_38_POLDA.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">2. Master Satker Utama (Satker / Polres) *</label>
                  <select
                    value={newJabatan.satkerUtama}
                    onChange={(e) => {
                      const s = e.target.value;
                      const subs = getSubSatkerOptionsBySatker(newJabatan.polda, s);
                      setNewJabatan({
                        ...newJabatan,
                        satkerUtama: s,
                        subSatker: subs[0] || 'Pimpinan / Staf Utama Satker',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                  >
                    {getSatkerUtamaByWilayah(newJabatan.polda).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">3. Sub-Satker / Direktorat / Bagian / ADC</label>
                  <select
                    value={newJabatan.subSatker}
                    onChange={(e) => setNewJabatan({ ...newJabatan, subSatker: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                  >
                    {getSubSatkerOptionsBySatker(newJabatan.polda, newJabatan.satkerUtama).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fungsi Kepolisian</label>
                  <select
                    value={newJabatan.fungsiPolri}
                    onChange={(e) => setNewJabatan({ ...newJabatan, fungsiPolri: e.target.value as FungsiPolri })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                  >
                    {DAFTAR_FUNGSI_POLRI.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tahun Mulai Menjabat</label>
                  <input
                    type="number"
                    value={newJabatan.tahunMulai}
                    onChange={(e) => setNewJabatan({ ...newJabatan, tahunMulai: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dasar Surat Telegram Kapolri (TR)</label>
                <input
                  type="text"
                  placeholder="Misal: ST/1422/VI/KEP./2024"
                  value={newJabatan.dasarTR}
                  onChange={(e) => setNewJabatan({ ...newJabatan, dasarTR: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Uraian Tugas Pokok</label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan tanggung jawab operasional dan pembinaan..."
                  value={newJabatan.uraianTugas}
                  onChange={(e) => setNewJabatan({ ...newJabatan, uraianTugas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prestasi Operasional / Kasus Menonjol</label>
                <textarea
                  rows={2}
                  placeholder="Pengungkapan kasus menonjol, inovasi pelayanan, atau penghargaan pimpinan..."
                  value={newJabatan.prestasiOperasional}
                  onChange={(e) => setNewJabatan({ ...newJabatan, prestasiOperasional: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold shadow-md"
                >
                  Simpan Jabatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
