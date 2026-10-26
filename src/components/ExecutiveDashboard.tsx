'use client';

import React, { useState } from 'react';
import { AnggotaWiraSatya, AuthUser, LowonganUsahaItem } from '@/types';
import { DAFTAR_38_POLDA } from '@/data/polriStructure';
import { generateLeakageTrackedFileName } from '@/lib/mediaSecurity';
import {
  isSuperadminAccount,
  detectStatusKedinasan,
  formatHumanTimestamp,
  formatHumanDiseaseList,
  formatBloodTypeWithRhesus,
  formatJabatanWithSatker,
  formatHumanEnum,
  RETIREMENT_AGE_POLRI,
} from '@/lib/avatarUtils';
import { 
  BarChart3, 
  Heart, 
  Home, 
  Briefcase, 
  Users, 
  Download, 
  MessageCircle, 
  ShieldAlert,
  MapPin,
  GraduationCap,
  Wallet,
  AlertCircle,
  Info,
  Lock,
  Plus,
  CheckCircle2,
  X
} from 'lucide-react';

interface ExecutiveDashboardProps {
  members: AnggotaWiraSatya[];
  currentUser: AuthUser;
  onOpenDataDiriUsaha?: () => void;
  onSaveMember?: (member: AnggotaWiraSatya) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  members,
  currentUser,
  onOpenDataDiriUsaha,
  onSaveMember,
}) => {
  // Default subtab according to role
  const getInitialSubTab = () => {
    if (currentUser.role === 'SEKRETARIAT') return 'pemetaan';
    if (currentUser.role === 'BENDAHARA') return 'keuangan';
    return 'kesehatan';
  };

  const [activeSubTab, setActiveSubTab] = useState<'kesehatan' | 'hunian' | 'usaha' | 'pemetaan' | 'keuangan' | 'almarhum'>(getInitialSubTab());
  const [showAnevInfo, setShowAnevInfo] = useState<boolean>(false);
  const [selectedKompi, setSelectedKompi] = useState<string>('SEMUA');
  const [selectedPleton, setSelectedPleton] = useState<string>('SEMUA');
  const [usahaFilter, setUsahaFilter] = useState<'SEMUA' | 'PRIBADI' | 'BERSAMA' | 'LOWONGAN'>('SEMUA');
  const [showQuickUsahaModal, setShowQuickUsahaModal] = useState<boolean>(false);
  const [quickTargetNrp, setQuickTargetNrp] = useState<string>('');
  const [quickKategoriUsaha, setQuickKategoriUsaha] = useState<string>('USAHA PRIBADI / MANDIRI');
  const [quickNamaUsaha, setQuickNamaUsaha] = useState<string>('');
  const [quickBidangUsaha, setQuickBidangUsaha] = useState<string>('');
  const [quickPeranUsaha, setQuickPeranUsaha] = useState<string>('PEMILIK / FOUNDER USAHA');
  const [quickLokasiUsaha, setQuickLokasiUsaha] = useState<string>('');
  const [quickStatusUsaha, setQuickStatusUsaha] = useState<'SUDAH JALAN' | 'DALAM PERSIAPAN' | 'MASIH RENCANA'>('SUDAH JALAN');
  const [quickBukaLoker, setQuickBukaLoker] = useState<'YA' | 'TIDAK'>('YA');
  const [quickLowonganList, setQuickLowonganList] = useState<LowonganUsahaItem[]>([
    {
      id: 'ql-1',
      posisi: 'Sekretaris Direksi',
      tipePekerjaan: 'FULL_TIME',
      kuota: '1 Orang',
      prioritasPelamar: 'PUTRA_PUTRI_ALMARHUM_LETING',
      kualifikasi: 'Putra/Putri keluarga besar Wira Satya 96',
      statusLowongan: 'BUKA',
    },
  ]);

  const canExportAndManage = Boolean(currentUser?.role && currentUser.role !== 'ANGGOTA');

  // Exclude behind-the-scenes Superadmin from all alumni counts, recaps, and exports
  const alumniMembers = React.useMemo(
    () => members.filter((m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)),
    [members]
  );

  // Stats calculation (strictly alumni only)
  const total = alumniMembers.length;
  const needHealthAttention = alumniMembers.filter(
    (m) => m.adaPenyakitKronis === 'ADA' || m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT'
  );
  const stillRenting = alumniMembers.filter(
    (m) => m.statusRumahPurnaTugas === 'SEWA/KONTRAK' || m.statusTempatTinggal === 'SEWA/KONTRAK'
  );
  const hunianMilikPribadiCount = alumniMembers.filter(
    (m) => m.statusRumahPurnaTugas === 'MILIK PRIBADI' && m.statusTempatTinggal !== 'SEWA/KONTRAK'
  ).length;
  const hunianKeluargaCount = alumniMembers.filter(
    (m) =>
      (m.statusRumahPurnaTugas === 'RUMAH KELUARGA' || m.statusRumahPurnaTugas === 'DINAS') &&
      m.statusTempatTinggal !== 'SEWA/KONTRAK'
  ).length;
  // Katalog Usaha: hanya personel yang benar-benar mengisi nama/bidang usaha atau membuka lowongan kerja (bukan 261 default)
  const entrepreneurs = React.useMemo(
    () =>
      alumniMembers.filter((m) => {
        const hasRealBusinessName = Boolean(
          (m.jenisUsaha && m.jenisUsaha.trim().length > 0) ||
            (m.namaUsahaYayasan &&
              m.namaUsahaYayasan.trim().length > 0 &&
              m.namaUsahaYayasan.trim() !== 'Yayasan / Usaha Bersama Wira Satya 96')
        );
        const hasOpenLoker =
          m.bukaLowonganKerja === 'YA' &&
          Array.isArray(m.daftarLowonganUsaha) &&
          m.daftarLowonganUsaha.length > 0;
        const hasExplicitRunningStatus =
          (m.statusUsaha === 'SUDAH JALAN' || m.statusUsaha === 'DALAM PERSIAPAN') &&
          hasRealBusinessName;
        return hasRealBusinessName || hasOpenLoker || hasExplicitRunningStatus;
      }),
    [alumniMembers]
  );
  const withBusiness = entrepreneurs;

  const isUsahaBersamaMember = (m: AnggotaWiraSatya) => {
    const kat = (m.kategoriUsaha || '').toUpperCase();
    return kat.includes('BERSAMA') || kat.includes('YAYASAN') || kat.includes('KOPERASI');
  };

  const usahaPribadiList = React.useMemo(
    () => entrepreneurs.filter((m) => !isUsahaBersamaMember(m)),
    [entrepreneurs]
  );

  const usahaBersamaList = React.useMemo(
    () => entrepreneurs.filter((m) => isUsahaBersamaMember(m)),
    [entrepreneurs]
  );

  const membersWithOpenLowongan = React.useMemo(
    () =>
      entrepreneurs.filter(
        (m) =>
          m.bukaLowonganKerja === 'YA' &&
          Array.isArray(m.daftarLowonganUsaha) &&
          m.daftarLowonganUsaha.some((l) => l.posisi?.trim() && l.statusLowongan !== 'TUTUP')
      ),
    [entrepreneurs]
  );

  const totalOpenLowonganPositions = React.useMemo(
    () =>
      entrepreneurs.reduce((acc, m) => {
        if (m.bukaLowonganKerja !== 'YA' || !Array.isArray(m.daftarLowonganUsaha)) return acc;
        return (
          acc +
          m.daftarLowonganUsaha.filter((l) => l.posisi?.trim() && l.statusLowongan !== 'TUTUP')
            .length
        );
      }, 0),
    [entrepreneurs]
  );

  const filteredEntrepreneurs = React.useMemo(() => {
    if (usahaFilter === 'PRIBADI') return usahaPribadiList;
    if (usahaFilter === 'BERSAMA') return usahaBersamaList;
    if (usahaFilter === 'LOWONGAN') return membersWithOpenLowongan;
    return entrepreneurs;
  }, [entrepreneurs, usahaPribadiList, usahaBersamaList, membersWithOpenLowongan, usahaFilter]);

  const anakButuhKerjaList = React.useMemo(() => {
    const list: {
      namaAnak: string;
      tempatTanggalLahir: string;
      namaOrtu: string;
      pangkatOrtu: string;
      poldaOrtu: string;
      noHpOrtu: string;
      isAlmarhumOrtu: boolean;
    }[] = [];
    alumniMembers.forEach((m) => {
      const isAlm =
        detectStatusKedinasan(
          m.statusKedinasan || m.statusDinas,
          m.jabatanTerakhir || m.jabatan,
          m.jenisAnggota
        ) === 'ALMARHUM';
      (m.daftarAnak || []).forEach((a) => {
        if (a.nama?.trim() && a.status === 'BELUM BEKERJA') {
          list.push({
            namaAnak: a.nama.trim(),
            tempatTanggalLahir:
              [a.tempatLahir, a.tanggalLahir ? formatHumanTimestamp(a.tanggalLahir) : '']
                .filter(Boolean)
                .join(', ') || '-',
            namaOrtu: m.namaLengkap,
            pangkatOrtu: m.pangkat,
            poldaOrtu: m.polda,
            noHpOrtu: m.kontakIstri || m.noHp || '',
            isAlmarhumOrtu: isAlm,
          });
        }
      });
    });
    return list;
  }, [alumniMembers]);

  const kompiCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      'KOMPI A': 0,
      'KOMPI B': 0,
      'KOMPI C': 0,
      'KOMPI D': 0,
    };
    alumniMembers.forEach((m) => {
      const k = (m.kompi || 'KOMPI A').toUpperCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [alumniMembers]);

  const pletonCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      'PLETON 1': 0,
      'PLETON 2': 0,
      'PLETON 3': 0,
      'PLETON 4': 0,
    };
    alumniMembers
      .filter((m) => selectedKompi === 'SEMUA' || (m.kompi || 'KOMPI A').toUpperCase() === selectedKompi)
      .forEach((m) => {
        const p = (m.pleton || 'PLETON 1').toUpperCase();
        counts[p] = (counts[p] || 0) + 1;
      });
    return counts;
  }, [alumniMembers, selectedKompi]);

  const filteredMappingMembers = React.useMemo(
    () =>
      alumniMembers.filter((m) => {
        const k = (m.kompi || 'KOMPI A').toUpperCase();
        const p = (m.pleton || 'PLETON 1').toUpperCase();
        const matchK = selectedKompi === 'SEMUA' || k === selectedKompi;
        const matchP = selectedPleton === 'SEMUA' || p === selectedPleton;
        return matchK && matchP;
      }),
    [alumniMembers, selectedKompi, selectedPleton]
  );
  const almarhumMembers = React.useMemo(
    () =>
      alumniMembers.filter(
        (m) =>
          detectStatusKedinasan(
            m.statusKedinasan || m.statusDinas,
            m.jabatanTerakhir || m.jabatan,
            m.jenisAnggota
          ) === 'ALMARHUM'
      ),
    [alumniMembers]
  );
  const totalAnakAlmarhum = React.useMemo(
    () =>
      almarhumMembers.reduce(
        (sum, m) => sum + (Array.isArray(m.daftarAnak) && m.daftarAnak.length > 0 ? m.daftarAnak.length : m.jumlahAnak || 0),
        0
      ),
    [almarhumMembers]
  );

  // Regional distribution (for Kesekretariatan)
  const regionalStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    alumniMembers.forEach((m) => {
      const p = m.polda || 'MABES POLRI';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [alumniMembers]);

  // Unreached Poldas for active mapping (Kesekretariatan)
  const unreachedPoldas = React.useMemo(() => {
    const coveredSet = new Set(alumniMembers.map((m) => (m.polda || '').toUpperCase()));
    return DAFTAR_38_POLDA.filter((p) => !coveredSet.has(p.toUpperCase()));
  }, [alumniMembers]);

  // Financial & Education stats (for Bendahara)
  const financialStats = React.useMemo(() => {
    let collegeCount = 0;
    let highCostEdu = 0;
    let midCostEdu = 0;
    let lowCostEdu = 0;

    alumniMembers.forEach((m) => {
      (m.daftarAnak || []).forEach((a) => {
        if (a.status === 'PELAJAR') {
          collegeCount++;
          if (a.biayaPendidikanTahunan === '> 25.000.000') highCostEdu++;
          else if (a.biayaPendidikanTahunan === '5.000.000 S.D. 25.000.000') midCostEdu++;
          else lowCostEdu++;
        }
      });
    });

    const needFinancialAidPension = alumniMembers.filter((m) => m.kecukupanDanaPensiun === 'KURANG').length;

    return {
      collegeCount,
      highCostEdu,
      midCostEdu,
      lowCostEdu,
      needFinancialAidPension,
    };
  }, [alumniMembers]);

  const formatWaUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}?text=Halo%20Komandan%2C%20mohon%20izin%20menghubungi%20dari%20Pengurus%20Wira%20Satya%2096`;
  };

  // Export to CSV (strictly alumni only)
  const handleExportCSV = () => {
    if (!canExportAndManage) return;
    const headers = [
      'NRP',
      'Nama Lengkap',
      'Pangkat',
      'Kompi',
      'Pleton',
      'Jabatan Terakhir',
      'Satker',
      'Polda',
      'No HP',
      'Golongan Darah',
      'Ukuran Baju',
      'Ukuran Celana',
      'Ukuran Sepatu',
      'Status Rumah Sekarang',
      'Biaya Sewa Domisili',
      'Nama Istri',
      'Kontak Istri',
      'Jumlah Anak',
      'Rincian Anak',
      'Tahun Pensiun',
      'Status Rumah Pensiun',
      'Biaya Sewa Purna Tugas',
      'Kategori Usaha Bersama/Yayasan',
      'Nama Usaha/Yayasan',
      'Peran Usaha/Yayasan',
      'Rencana Usaha',
      'Status Usaha',
      'Riwayat Sakit Kronis',
      'Kondisi Kesehatan',
      'Penyakit',
      'Kesehatan Lain-lain',
    ];

    const rows = alumniMembers.map((m) => {
      const rincianAnak = (m.daftarAnak || [])
        .map(
          (a) =>
            `${a.nama} (${a.tempatLahir || '-'}, ${a.tanggalLahir || '-'} | ${a.status}${
              a.biayaPendidikanTahunan ? ` - ${a.biayaPendidikanTahunan}` : ''
            })`
        )
        .join('; ');
      return [
        `"${m.nrp}"`,
        `"${m.namaLengkap}"`,
        `"${m.pangkat}"`,
        `"${m.kompi || 'KOMPI A'}"`,
        `"${m.pleton || 'PLETON 1'}"`,
        `"${m.jabatanTerakhir}"`,
        `"${m.satuanKerja}"`,
        `"${m.polda}"`,
        `"${m.noHp}"`,
        `"${formatBloodTypeWithRhesus(m.golonganDarah, m.rhesusDarah)}"`,
        `"${m.ukuranBaju || '-'}"`,
        `"${m.ukuranCelana || '-'}"`,
        `"${m.ukuranSepatu || '-'}"`,
        `"${m.statusTempatTinggal}"`,
        `"${m.biayaSewaTempatTinggal || '-'}"`,
        `"${m.namaIstri || '-'}"`,
        `"${m.kontakIstri || m.noHp || '-'}"`,
        m.jumlahAnak,
        `"${rincianAnak || '-'}"`,
        m.tahunPurnaTugas,
        `"${m.statusRumahPurnaTugas}"`,
        `"${m.biayaSewaTahunan || '-'}"`,
        `"${m.kategoriUsaha || 'USAHA BERSAMA LETING'}"`,
        `"${m.namaUsahaYayasan || m.jenisUsaha || '-'}"`,
        `"${m.peranUsahaYayasan || 'Anggota Partisipan'}"`,
        `"${m.jenisUsaha || '-'}"`,
        `"${m.statusUsaha || '-'}"`,
        `"${m.adaPenyakitKronis}"`,
        `"${m.kondisiKesehatan}"`,
        `"${(m.daftarPenyakit || []).join('; ')}"`,
        `"${m.kesehatanLainLain || '-'}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const trackedName = generateLeakageTrackedFileName({
      actorNrp: currentUser.nrp,
      ownerNrp: 'EXPORT-ANEV',
      preset: 'EXPORT',
      extension: 'csv',
      extraEntropy: String(alumniMembers.length),
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', trackedName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-polri-navy via-slate-900 to-polri-navyLight p-4 sm:p-5 rounded-2xl border border-polri-gold/40 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-xl bg-polri-gold/20 text-polri-gold border border-polri-gold/30">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                Anev &amp; Statistik
              </h2>
              {!canExportAndManage && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-amber-300 text-[11px] font-bold">
                  🔒 Mode Lihat Anggota
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowAnevInfo((prev) => !prev)}
                className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 text-amber-300 inline-flex items-center justify-center cursor-pointer text-[11px] font-bold focus:outline-none"
                title="Ikhtisar kesehatan personel, kesiapan hunian purna tugas, usaha bersama & yayasan, dan sebaran penugasan se-Indonesia."
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {showAnevInfo && (
            <p className="text-[11px] text-slate-300 mt-2 pl-12 leading-relaxed">
              Ikhtisar kesehatan personel, kesiapan hunian purna tugas, usaha bersama &amp; yayasan, serta sebaran penugasan &amp; Kompi/Pleton Batalyon se-Indonesia.
            </p>
          )}
        </div>

        {canExportAndManage ? (
          <button
            onClick={handleExportCSV}
            title="Unduh Rekapitulasi Anev ke CSV"
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-polri-gold hover:bg-polri-goldDark text-polri-navy font-bold text-xs shadow-lg transition-all self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span className="sm:hidden">CSV</span>
            <span className="hidden sm:inline">Unduh CSV</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Ekspor CSV hanya tersedia untuk Pengurus (Ketua, Sekretaris, Bendahara, Superadmin)"
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-600 text-slate-300 font-bold text-xs cursor-not-allowed self-start sm:self-auto"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Ekspor CSV (Khusus Pengurus)</span>
          </button>
        )}
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Personel */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Personel</span>
            <span className="text-2xl font-black text-slate-900">{total}</span>
            <span className="text-[11px] text-slate-400 block">4 Kompi • 16 Pleton</span>
          </div>
        </div>

        {/* Atensi Kesehatan */}
        <div
          onClick={() => setActiveSubTab('kesehatan')}
          className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/20 shadow-sm flex items-center gap-4 cursor-pointer hover:border-red-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-red-600 font-bold block">Atensi Kesehatan</span>
            <span className="text-2xl font-black text-red-900">{needHealthAttention.length}</span>
            <span className="text-[11px] text-red-500 block">Perlu Perhatian</span>
          </div>
        </div>

        {/* Status Hunian Belum Tetap */}
        <div
          onClick={() => setActiveSubTab('hunian')}
          className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-4 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-amber-700 font-bold block">Hunian Purna Tugas</span>
            <span className="text-2xl font-black text-amber-900">{stillRenting.length}</span>
            <span className="text-[11px] text-amber-600 block">Belum Rumah Pribadi</span>
          </div>
        </div>

        {/* Katalog Usaha & Open Lowongan */}
        <div
          onClick={() => setActiveSubTab('usaha')}
          className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-emerald-600 font-bold block">Katalog Usaha &amp; Loker</span>
            <span className="text-2xl font-black text-emerald-900">{withBusiness.length}</span>
            <span className="text-[11px] text-emerald-600 font-semibold block">
              {totalOpenLowonganPositions > 0
                ? `${totalOpenLowonganPositions} Open Lowongan`
                : 'Usaha Pribadi & Leting'}
            </span>
          </div>
        </div>

        {/* In Memoriam (Almarhum) & Pendataan Keluarga */}
        <div
          onClick={() => setActiveSubTab('almarhum')}
          className="col-span-2 lg:col-span-1 bg-white p-5 rounded-xl border border-slate-300 bg-slate-100/50 shadow-sm flex items-center gap-4 cursor-pointer hover:border-slate-500 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center flex-shrink-0 text-lg">
            🕊️
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-700 font-bold block truncate" title="In Memoriam (Almarhum) & Pendataan Keluarga">
              In Memoriam (Almarhum)
            </span>
            <span className="text-2xl font-black text-slate-900">{almarhumMembers.length}</span>
            <span className="text-[11px] text-slate-600 font-semibold block">
              {totalAnakAlmarhum} Putra-Putri Terdata
            </span>
          </div>
        </div>
      </div>

      {/* Actionable Solution Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-1.5 sm:gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('kesehatan')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'kesehatan'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Kesehatan ({needHealthAttention.length})
          </button>

          <button
            onClick={() => setActiveSubTab('hunian')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'hunian'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="sm:hidden">Hunian ({stillRenting.length})</span>
            <span className="hidden sm:inline">Hunian &amp; Purna Tugas ({stillRenting.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('usaha')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'usaha'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span className="sm:hidden">Usaha ({withBusiness.length})</span>
            <span className="hidden sm:inline">
              Katalog Usaha &amp; Lowongan ({withBusiness.length})
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('pemetaan')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'pemetaan'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="sm:hidden">Wilayah &amp; Kompi ({regionalStats.length})</span>
            <span className="hidden sm:inline">Sebaran Wilayah &amp; Kompi/Pleton ({regionalStats.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('keuangan')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'keuangan'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span className="sm:hidden">Pendidikan</span>
            <span className="hidden sm:inline">Pendidikan &amp; Pensiun</span>
          </button>

          <button
            onClick={() => setActiveSubTab('almarhum')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'almarhum'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <span>🕊️ Keluarga Almarhum ({almarhumMembers.length})</span>
          </button>
        </div>

        {/* Tab 1: ATENSI KESEHATAN */}
        {activeSubTab === 'kesehatan' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 text-red-900 text-xs">
              <span className="font-bold">📌 Atensi Kesehatan:</span> Daftar personel dalam masa pengobatan atau memerlukan perhatian medis khusus, dilengkapi Kompi/Pleton, Golongan Darah, Ukuran Aparel, dan Keterangan Kesehatan Lain-lain.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {needHealthAttention.map((m) => (
                <div key={m.id} className="p-4 rounded-xl border border-red-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-100 text-red-800">
                          {formatHumanEnum(m.kondisiKesehatan)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-900 border border-rose-200">
                          🩸 Gol. Darah: {formatBloodTypeWithRhesus(m.golonganDarah, m.rhesusDarah)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                          {m.kompi || 'KOMPI A'} • {m.pleton || 'PLETON 1'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{m.namaLengkap}</h4>
                      <p className="text-xs text-slate-500">{m.jabatanTerakhir} — {m.polda}</p>
                      <p className="text-[11px] text-slate-600 font-medium mt-1">
                        👕 Aparel: Baju: <b>{m.ukuranBaju || '-'}</b> | Celana: <b>{m.ukuranCelana || '-'}</b> | Sepatu: <b>{m.ukuranSepatu || '-'}</b>
                      </p>
                    </div>
                    <a
                      href={formatWaUrl(m.noHp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                      title="Hubungi Personel"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-500 font-semibold block">Diagnosis Penyakit:</span>
                    <div className="flex flex-wrap gap-1">
                      {m.daftarPenyakit?.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-medium text-[11px]">
                          {formatHumanDiseaseList([p], { includeSince: true }) || p}
                        </span>
                      ))}
                    </div>
                    {m.kondisiSaatIni && (
                      <p className="text-slate-700 text-[11px] pt-1">
                        <b>Kondisi:</b> {m.kondisiSaatIni}
                      </p>
                    )}
                    {m.harapanLayananKesehatan && (
                      <p className="text-blue-700 text-[11px] pt-1">
                        <b>Kebutuhan:</b> {m.harapanLayananKesehatan}
                      </p>
                    )}
                    {m.kesehatanLainLain && (
                      <p className="text-amber-900 text-[11px] pt-1">
                        <b>Lain-lain Kesehatan:</b> {m.kesehatanLainLain}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: HUNIAN PURNA TUGAS */}
        {activeSubTab === 'hunian' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
              <span className="font-bold">📌 Rekap Program Hunian Purna Tugas (BUP {RETIREMENT_AGE_POLRI} Thn):</span> Rekapitulasi kesiapan tempat tinggal pasca dinas seluruh alumni ({total} personel) serta rincian biaya sewa/kontrak personel yang masih berstatus sewa/kontrak.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-700 block">Sudah Milik Pribadi</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-emerald-900">{hunianMilikPribadiCount}</span>
                  <span className="text-xs text-emerald-700 font-semibold">/ {total} Alumni</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-800 block">Masih Sewa / Kontrak</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-amber-900">{stillRenting.length}</span>
                  <span className="text-xs text-amber-700 font-semibold">Perlu Program Hunian</span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-600 block">Rumah Orang Tua / Keluarga</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-slate-900">{hunianKeluargaCount}</span>
                  <span className="text-xs text-slate-500 font-semibold">Alumni</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stillRenting.map((m) => {
                const isRentingDomisili = m.statusTempatTinggal === 'SEWA/KONTRAK';
                const isRentingPensiun = m.statusRumahPurnaTugas === 'SEWA/KONTRAK';
                const jenisSewaLabel =
                  isRentingDomisili && isRentingPensiun
                    ? 'Domisili Saat Ini & Rencana Purna Tugas (BUP 60 Thn)'
                    : isRentingDomisili
                    ? 'Domisili Saat Ini (Sewa/Kontrak)'
                    : 'Rencana Purna Tugas BUP 60 Thn (Sewa/Kontrak)';
                const nominalSewa =
                  m.biayaSewaTempatTinggal || m.biayaSewaTahunan || 'Belum dirinci nominalnya';
                const detailKontrak =
                  m.detailSewaTempatTinggal || m.detailSewaPurnaTugas || 'Kontrak tahunan berjalan';

                return (
                  <div key={m.id} className="p-4 rounded-xl border border-amber-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">
                            Domisili: {formatHumanEnum(m.statusTempatTinggal)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-orange-100 text-orange-900">
                            Pensiun (BUP {m.tahunPurnaTugas}): {formatHumanEnum(m.statusRumahPurnaTugas)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                            {m.kompi || 'KOMPI A'} • {m.pleton || 'PLETON 1'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{m.namaLengkap}</h4>
                        <p className="text-xs text-slate-500">{m.jabatanTerakhir} — {m.polda}</p>
                      </div>
                      <a
                        href={formatWaUrl(m.noHp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="text-xs bg-amber-50/50 p-3 rounded-lg border border-amber-200/70 space-y-1.5">
                      <p className="text-amber-950">
                        <b>Jenis Hunian Disewa:</b> {jenisSewaLabel}
                      </p>
                      <p className="text-slate-800">
                        <b>Rincian Biaya Sewa:</b>{' '}
                        <span className="font-bold text-red-800 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          {nominalSewa}
                        </span>
                      </p>
                      <p className="text-slate-700 text-[11px]">
                        <b>Detail / Masa Kontrak:</b> {detailKontrak}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        <b>Alamat Domisili:</b> {m.alamatTempatTinggal || '-'}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        <b>Rencana Domisili Purna Tugas:</b> {m.alamatPurnaTugas || 'Belum Menentukan'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: KATALOG USAHA (PRIBADI & BERSAMA LETING) + OPEN LOWONGAN KERJA */}
        {activeSubTab === 'usaha' && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Banner & Quick Action Buttons */}
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-xs text-emerald-950 space-y-0.5">
                <div className="font-extrabold text-sm text-emerald-900">
                  📌 Katalog Usaha (Pribadi &amp; Bersama Leting) &amp; Bursa Lowongan Kerja Putra-Putri WS96
                </div>
                <p className="text-emerald-800">
                  Direktori unit bisnis milik pribadi anggota maupun usaha bersama leting, dilengkapi pembukaan lowongan kerja (seperti posisi <b>Sekretaris</b>, <b>Direktur</b>, <b>Manajer</b>, atau <b>Staf</b>) bagi putra-putri leting / almarhum yang membutuhkan pekerjaan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onSaveMember && (
                  <button
                    type="button"
                    onClick={() => {
                      const selfMember =
                        alumniMembers.find((m) => m.nrp === currentUser.nrp) || alumniMembers[0];
                      if (selfMember) {
                        setQuickTargetNrp(selfMember.nrp);
                        setQuickKategoriUsaha(
                          selfMember.kategoriUsaha || 'USAHA PRIBADI / MANDIRI'
                        );
                        setQuickNamaUsaha(selfMember.namaUsahaYayasan || '');
                        setQuickBidangUsaha(selfMember.jenisUsaha || '');
                        setQuickPeranUsaha(
                          selfMember.peranUsahaYayasan || 'PEMILIK / FOUNDER USAHA'
                        );
                        setQuickLokasiUsaha(selfMember.lokasiUsaha || selfMember.polda || '');
                        setQuickStatusUsaha(selfMember.statusUsaha || 'SUDAH JALAN');
                        setQuickBukaLoker(selfMember.bukaLowonganKerja || 'YA');
                        setQuickLowonganList(
                          Array.isArray(selfMember.daftarLowonganUsaha) &&
                            selfMember.daftarLowonganUsaha.length > 0
                            ? selfMember.daftarLowonganUsaha
                            : [
                                {
                                  id: 'ql-' + Date.now(),
                                  posisi: 'Sekretaris Direksi',
                                  tipePekerjaan: 'FULL_TIME',
                                  kuota: '1 Orang',
                                  prioritasPelamar: 'PUTRA_PUTRI_ALMARHUM_LETING',
                                  kualifikasi: 'Putra/Putri keluarga besar Wira Satya 96',
                                  statusLowongan: 'BUKA',
                                },
                              ]
                        );
                      }
                      setShowQuickUsahaModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Daftarkan Usaha &amp; Buka Lowongan</span>
                  </button>
                )}
                {onOpenDataDiriUsaha && (
                  <button
                    type="button"
                    onClick={onOpenDataDiriUsaha}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Buka Formulir Data Usaha</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 Summary Cards + Filter Tabs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setUsahaFilter('SEMUA')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  usahaFilter === 'SEMUA'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold block ${
                    usahaFilter === 'SEMUA' ? 'text-emerald-200' : 'text-slate-500'
                  }`}
                >
                  Semua Katalog Usaha
                </span>
                <span className="text-xl font-black mt-0.5 block">{entrepreneurs.length}</span>
                <span
                  className={`text-[10px] font-semibold block ${
                    usahaFilter === 'SEMUA' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  Unit Bisnis Terdaftar
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUsahaFilter('PRIBADI')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  usahaFilter === 'PRIBADI'
                    ? 'bg-polri-navy text-white border-polri-navy shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold block ${
                    usahaFilter === 'PRIBADI' ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  🏢 Usaha Pribadi Anggota
                </span>
                <span className="text-xl font-black mt-0.5 block">{usahaPribadiList.length}</span>
                <span
                  className={`text-[10px] font-semibold block ${
                    usahaFilter === 'PRIBADI' ? 'text-slate-200' : 'text-slate-400'
                  }`}
                >
                  Usaha Mandiri / Keluarga
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUsahaFilter('BERSAMA')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  usahaFilter === 'BERSAMA'
                    ? 'bg-teal-800 text-white border-teal-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold block ${
                    usahaFilter === 'BERSAMA' ? 'text-teal-200' : 'text-slate-500'
                  }`}
                >
                  🤝 Usaha Bersama Leting
                </span>
                <span className="text-xl font-black mt-0.5 block">{usahaBersamaList.length}</span>
                <span
                  className={`text-[10px] font-semibold block ${
                    usahaFilter === 'BERSAMA' ? 'text-teal-100' : 'text-slate-400'
                  }`}
                >
                  Kolaborasi / Yayasan WS96
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUsahaFilter('LOWONGAN')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  usahaFilter === 'LOWONGAN'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border-amber-300'
                }`}
              >
                <span
                  className={`text-[11px] font-extrabold block ${
                    usahaFilter === 'LOWONGAN' ? 'text-amber-100' : 'text-amber-800'
                  }`}
                >
                  💼 Open Lowongan Kerja
                </span>
                <span className="text-xl font-black mt-0.5 block">
                  {totalOpenLowonganPositions} Posisi
                </span>
                <span
                  className={`text-[10px] font-semibold block ${
                    usahaFilter === 'LOWONGAN' ? 'text-white' : 'text-amber-700'
                  }`}
                >
                  Dari {membersWithOpenLowongan.length} Unit Usaha
                </span>
              </button>
            </div>

            {/* Quick Modal / Inline Form to Register Usaha & Open Lowongan */}
            {showQuickUsahaModal && onSaveMember && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-emerald-600/40 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      🏢 Daftarkan Unit Usaha (Pribadi / Bersama Leting) &amp; Buka Open Lowongan
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Data otomatis tersinkron ke profil personel dan langsung tampil di Katalog Usaha &amp; Bursa Lowongan Putra-Putri Leting.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuickUsahaModal(false)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Personel Pemilik / Penggerak Usaha
                    </label>
                    <select
                      value={quickTargetNrp}
                      onChange={(e) => {
                        const nrp = e.target.value;
                        setQuickTargetNrp(nrp);
                        const found = alumniMembers.find((m) => m.nrp === nrp);
                        if (found) {
                          setQuickKategoriUsaha(found.kategoriUsaha || 'USAHA PRIBADI / MANDIRI');
                          setQuickNamaUsaha(found.namaUsahaYayasan || '');
                          setQuickBidangUsaha(found.jenisUsaha || '');
                          setQuickPeranUsaha(found.peranUsahaYayasan || 'PEMILIK / FOUNDER USAHA');
                          setQuickLokasiUsaha(found.lokasiUsaha || found.polda || '');
                          setQuickStatusUsaha(found.statusUsaha || 'SUDAH JALAN');
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      {alumniMembers.map((m) => (
                        <option key={m.id} value={m.nrp}>
                          {m.namaLengkap} ({m.pangkat} — {m.polda})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Skema Kepemilikan Usaha
                    </label>
                    <select
                      value={quickKategoriUsaha}
                      onChange={(e) => setQuickKategoriUsaha(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="USAHA PRIBADI / MANDIRI">USAHA PRIBADI / MANDIRI</option>
                      <option value="USAHA BERSAMA LETING">USAHA BERSAMA LETING</option>
                      <option value="USAHA PRIBADI & BERSAMA LETING">
                        USAHA PRIBADI &amp; BERSAMA LETING
                      </option>
                      <option value="YAYASAN / KOPERASI WS96">YAYASAN / KOPERASI WS96</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Jabatan / Peran di Usaha
                    </label>
                    <select
                      value={quickPeranUsaha}
                      onChange={(e) => setQuickPeranUsaha(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="PEMILIK / FOUNDER USAHA">PEMILIK / FOUNDER USAHA</option>
                      <option value="DIREKTUR UTAMA / DIREKSI">DIREKTUR UTAMA / DIREKSI</option>
                      <option value="KOMISARIS / PENGAWAS">KOMISARIS / PENGAWAS</option>
                      <option value="INVESTOR / MITRA LETING">INVESTOR / MITRA LETING</option>
                      <option value="PENGELOLA OPERASIONAL">PENGELOLA OPERASIONAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Perusahaan / Unit Usaha *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Satya Garda Logistik / CV Mandiri Jaya..."
                      value={quickNamaUsaha}
                      onChange={(e) => setQuickNamaUsaha(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Bidang Usaha / Produk &amp; Jasa *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Logistik & Kargo, Jasa Keamanan, Properti, Kuliner..."
                      value={quickBidangUsaha}
                      onChange={(e) => setQuickBidangUsaha(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Kota Operasional
                      </label>
                      <input
                        type="text"
                        placeholder="Jakarta, Surabaya..."
                        value={quickLokasiUsaha}
                        onChange={(e) => setQuickLokasiUsaha(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Status Usaha
                      </label>
                      <select
                        value={quickStatusUsaha}
                        onChange={(e) =>
                          setQuickStatusUsaha(
                            e.target.value as 'SUDAH JALAN' | 'DALAM PERSIAPAN' | 'MASIH RENCANA'
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                      >
                        <option value="SUDAH JALAN">SUDAH JALAN</option>
                        <option value="DALAM PERSIAPAN">DALAM PERSIAPAN</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Open Lowongan Builder inside Quick Modal */}
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-extrabold text-emerald-950 block">
                        💼 Buka Open Lowongan Kerja (Untuk Putra-Putri / Keluarga Leting)
                      </span>
                      <span className="text-[11px] text-emerald-800">
                        Klik tombol posisi di bawah untuk membuka lowongan seperti Sekretaris, Direktur, Manajer, atau Staf.
                      </span>
                    </div>
                    <select
                      value={quickBukaLoker}
                      onChange={(e) => setQuickBukaLoker(e.target.value as 'YA' | 'TIDAK')}
                      className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-extrabold text-emerald-900"
                    >
                      <option value="YA">YA, BUKA LOWONGAN</option>
                      <option value="TIDAK">TANPA LOWONGAN</option>
                    </select>
                  </div>

                  {quickBukaLoker === 'YA' && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Direktur Operasional',
                          'Sekretaris Direksi',
                          'Manajer Keuangan',
                          'Kepala Cabang',
                          'Staf Administrasi',
                          'Legal Officer',
                          'Magang Putra-Putri Leting',
                        ].map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() =>
                              setQuickLowonganList((prev) => [
                                ...prev,
                                {
                                  id: 'ql-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                                  posisi: pos,
                                  tipePekerjaan: 'FULL_TIME',
                                  kuota: '1 Orang',
                                  prioritasPelamar: 'PUTRA_PUTRI_ALMARHUM_LETING',
                                  kualifikasi: 'Putra/Putri keluarga besar Wira Satya 96',
                                  statusLowongan: 'BUKA',
                                },
                              ])
                            }
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold cursor-pointer"
                          >
                            + {pos}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {quickLowonganList.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-2.5 rounded-lg bg-white border border-emerald-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                          >
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                placeholder="Nama Posisi (misal: Sekretaris, Direktur)..."
                                value={item.posisi}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuickLowonganList((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, posisi: val } : x))
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs font-bold"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                placeholder="Kuota (1 Orang)"
                                value={item.kuota || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuickLowonganList((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, kuota: val } : x))
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-5">
                              <input
                                type="text"
                                placeholder="Kualifikasi / Syarat singkat..."
                                value={item.kualifikasi || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuickLowonganList((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, kualifikasi: val } : x))
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickLowonganList((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickUsahaModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = alumniMembers.find((m) => m.nrp === quickTargetNrp);
                      if (!target) return;
                      if (!quickNamaUsaha.trim() && !quickBidangUsaha.trim()) return;
                      const validLoker =
                        quickBukaLoker === 'YA'
                          ? quickLowonganList.filter((l) => l.posisi?.trim())
                          : [];
                      onSaveMember({
                        ...target,
                        kategoriUsaha: quickKategoriUsaha,
                        namaUsahaYayasan: quickNamaUsaha.trim() || quickBidangUsaha.trim(),
                        jenisUsaha: quickBidangUsaha.trim() || quickNamaUsaha.trim(),
                        peranUsahaYayasan: quickPeranUsaha,
                        lokasiUsaha: quickLokasiUsaha.trim() || target.polda,
                        statusUsaha: quickStatusUsaha,
                        bukaLowonganKerja: validLoker.length > 0 ? 'YA' : 'TIDAK',
                        daftarLowonganUsaha: validLoker,
                      });
                      setShowQuickUsahaModal(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan ke Katalog Usaha</span>
                  </button>
                </div>
              </div>
            )}

            {/* Katalog Usaha Cards Grid */}
            {filteredEntrepreneurs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEntrepreneurs.map((m) => {
                  const isBersama = isUsahaBersamaMember(m);
                  const openLokers =
                    m.bukaLowonganKerja === 'YA' && Array.isArray(m.daftarLowonganUsaha)
                      ? m.daftarLowonganUsaha.filter(
                          (l) => l.posisi?.trim() && l.statusLowongan !== 'TUTUP'
                        )
                      : [];
                  const displayTitle =
                    m.namaUsahaYayasan?.trim() || m.jenisUsaha?.trim() || 'Unit Usaha Anggota';
                  const displayBidang =
                    m.jenisUsaha?.trim() && m.jenisUsaha?.trim() !== displayTitle
                      ? m.jenisUsaha.trim()
                      : '';

                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-xl border border-emerald-200 bg-white shadow-sm flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                isBersama
                                  ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                  : 'bg-blue-100 text-blue-900 border border-blue-200'
                              }`}
                            >
                              {isBersama ? '🤝 USAHA BERSAMA LETING' : '🏢 USAHA PRIBADI'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                              {formatHumanEnum(m.statusUsaha || 'SUDAH JALAN')}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {m.lokasiUsaha || m.polda}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">{displayTitle}</h4>
                          {displayBidang && (
                            <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                              Bidang: {displayBidang}
                            </p>
                          )}
                          <p className="text-xs text-slate-600 mt-1">
                            {isBersama ? 'Koordinator / Mitra:' : 'Pemilik:'}{' '}
                            <b>{m.namaLengkap}</b> ({m.peranUsahaYayasan || 'Pemilik Usaha'})
                          </p>
                        </div>

                        {/* Open Lowongan Kerja Section on Card */}
                        {openLokers.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wide text-amber-950">
                                💼 Open Lowongan Putra-Putri Leting ({openLokers.length})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {openLokers.map((loker, lIdx) => (
                                <div
                                  key={loker.id || lIdx}
                                  className="p-2 rounded bg-white border border-amber-200/80 text-[11px] space-y-0.5"
                                >
                                  <div className="flex items-center justify-between gap-1 font-extrabold text-slate-900">
                                    <span>• Posisi: {loker.posisi}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold shrink-0">
                                      {loker.kuota || '1 Orang'}
                                    </span>
                                  </div>
                                  {loker.kualifikasi && (
                                    <p className="text-[10px] text-slate-600">
                                      Syarat: {loker.kualifikasi}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          {openLokers.length > 0 ? 'Lamar / Sinergi Usaha:' : 'Kontak Sinergi:'}
                        </span>
                        <a
                          href={formatWaUrl(m.noHp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{openLokers.length > 0 ? 'Hubungi / Lamar Loker' : 'Hubungi Rekan'}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-3">
                <Briefcase className="w-8 h-8 text-emerald-700 mx-auto opacity-80" />
                <div className="space-y-1 max-w-lg mx-auto">
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Belum Ada Unit Usaha pada Kategori Ini
                  </h4>
                  <p className="text-xs text-slate-500">
                    Daftarkan usaha pribadi maupun usaha bersama leting Anda, serta buka lowongan kerja (seperti posisi Sekretaris, Direktur, Manajer, atau Staf) untuk membantu putra-putri leting yang membutuhkan pekerjaan.
                  </p>
                </div>
                {onSaveMember && (
                  <button
                    type="button"
                    onClick={() => setShowQuickUsahaModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Daftarkan Usaha &amp; Buka Lowongan Pertama</span>
                  </button>
                )}
              </div>
            )}

            {/* Cross-Reference: Daftar Putra-Putri Leting & Almarhum yang Butuh Kerja (BELUM BEKERJA) */}
            {anakButuhKerjaList.length > 0 && (
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                      🎓 Putra-Putri Leting / Almarhum Siap Kerja ({anakButuhKerjaList.length} Kandidat)
                    </h4>
                    <p className="text-[11px] text-blue-800">
                      Data putra-putri rekan leting berstatus <b>Siap Kerja / Mencari Pekerjaan</b> yang dapat direkrut ke posisi lowongan pada Usaha Pribadi atau Usaha Bersama Leting.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {anakButuhKerjaList.map((kand, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-blue-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {kand.namaAnak}
                          </span>
                          {kand.isAlmarhumOrtu && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[9px] font-bold">
                              🕊️ Putri/Putra Alm.
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          Ortu: <b>{kand.namaOrtu}</b> ({kand.poldaOrtu})
                        </p>
                        <p className="text-[10px] text-slate-400">{kand.tempatTanggalLahir}</p>
                      </div>
                      {kand.noHpOrtu && (
                        <a
                          href={formatWaUrl(kand.noHpOrtu)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold shrink-0"
                        >
                          Tawarkan Loker
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: PEMETAAN WILAYAH & KOMPI/PLETON */}
        {activeSubTab === 'pemetaan' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs">
              <span className="font-bold">🗺️ Sebaran Wilayah &amp; Pengelompokan Kompi / Pleton Batalyon:</span> Pemetaan penempatan personel di jajaran Mabes Polri, 38 Polda, Luar Struktur, serta struktur Kompi A–D dan Pleton 1–4.
            </div>

            {/* Pengelompokan & Filter per Kompi & Pleton */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  🎖️ Filter Kelompok Kompi &amp; Pleton Batalyon Wira Satya 96
                </span>
                {(selectedKompi !== 'SEMUA' || selectedPleton !== 'SEMUA') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKompi('SEMUA');
                      setSelectedPleton('SEMUA');
                    }}
                    className="text-xs font-bold text-red-700 hover:underline"
                  >
                    Reset Filter Kompi/Pleton ({filteredMappingMembers.length} tampil)
                  </button>
                )}
              </div>

              {/* Kartu Kompi A - D */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedKompi('SEMUA')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedKompi === 'SEMUA'
                      ? 'bg-polri-navy text-white border-polri-navy shadow-sm'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[10px] font-bold block opacity-80">SELURUH KOMPI</span>
                  <span className="text-lg font-black">{alumniMembers.length}</span>
                  <span className="text-[10px] block opacity-75">Personel</span>
                </button>
                {(['KOMPI A', 'KOMPI B', 'KOMPI C', 'KOMPI D'] as const).map((k) => {
                  const active = selectedKompi === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedKompi(active ? 'SEMUA' : k)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-red-800 text-white border-red-900 shadow-sm'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold block">{k}</span>
                      <span className="text-lg font-black">{kompiCounts[k] || 0}</span>
                      <span className="text-[10px] block opacity-75">Personel</span>
                    </button>
                  );
                })}
              </div>

              {/* Filter Pleton 1 - 4 */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] font-bold text-slate-600">Filter Pleton:</span>
                <button
                  type="button"
                  onClick={() => setSelectedPleton('SEMUA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    selectedPleton === 'SEMUA'
                      ? 'bg-blue-700 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Semua Pleton
                </button>
                {(['PLETON 1', 'PLETON 2', 'PLETON 3', 'PLETON 4'] as const).map((p) => {
                  const active = selectedPleton === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPleton(active ? 'SEMUA' : p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p} ({pletonCounts[p] || 0})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coverage Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 block">Cakupan Wilayah Terdata</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-blue-900">{regionalStats.length}</span>
                  <span className="text-xs text-slate-500 font-semibold">/ {DAFTAR_38_POLDA.length} Wilayah Polri</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-700 block">Personel Sesuai Filter</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-emerald-900">{filteredMappingMembers.length}</span>
                  <span className="text-xs text-emerald-700 font-semibold">/ {alumniMembers.length} Personel Alumni</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-800 block">Wilayah Perlu Penjangkauan</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-amber-900">{unreachedPoldas.length}</span>
                  <span className="text-xs text-amber-700 font-semibold">Polda Belum Ada Data</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Regional Summary Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b font-bold text-xs text-slate-800 flex justify-between">
                  <span>Wilayah Penugasan Terdata</span>
                  <span>Jumlah Personel</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {regionalStats.map(([polda, count]) => (
                    <div key={polda} className="px-4 py-2 flex justify-between text-xs items-center hover:bg-slate-50">
                      <span className="font-medium text-slate-800">{polda}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                        {count} Personel
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Update List */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b font-bold text-xs text-slate-800 flex justify-between">
                  <span>Personel Terdaftar ({filteredMappingMembers.length})</span>
                  <span>Kompi/Pleton &amp; Status</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {filteredMappingMembers.map((m) => {
                    const statusDinas = detectStatusKedinasan(
                      m.statusKedinasan || m.statusDinas,
                      m.jabatanTerakhir,
                      m.jenisAnggota
                    );
                    const badgeConfig =
                      statusDinas === 'PURNA_TUGAS'
                        ? { label: 'Purna Tugas', cls: 'bg-amber-100 text-amber-800 border border-amber-200' }
                        : statusDinas === 'PTDH'
                        ? { label: 'PTDH', cls: 'bg-red-100 text-red-800 border border-red-200' }
                        : statusDinas === 'ALMARHUM'
                        ? { label: 'Almarhum', cls: 'bg-slate-200 text-slate-700 border border-slate-300' }
                        : { label: 'Aktif', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };

                    return (
                      <div key={m.id} className="px-4 py-2.5 text-xs hover:bg-slate-50 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{m.namaLengkap}</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                              {m.kompi || 'KOMPI A'} • {m.pleton || 'PLETON 1'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                              Gol. {formatBloodTypeWithRhesus(m.golonganDarah, m.rhesusDarah)}
                            </span>
                          </div>
                          <span className="text-slate-500 text-[11px] block">{m.polda} • {m.satuanKerja}</span>
                          <span className="text-slate-600 text-[10px] block">
                            Baju: {m.ukuranBaju || '-'} | Celana: {m.ukuranCelana || '-'} | Sepatu: {m.ukuranSepatu || '-'}
                          </span>
                          {m.subSatker && (
                            <span className="text-[10px] text-amber-800 font-semibold block">{m.subSatker}</span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeConfig.cls}`}>
                          {badgeConfig.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Unreached Regions Notice for Secretariat */}
            {unreachedPoldas.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>Wilayah Belum Terisi ({unreachedPoldas.length} Polda):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {unreachedPoldas.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: ANALISIS KEUANGAN & BEBAN PENDIDIKAN */}
        {activeSubTab === 'keuangan' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-900 text-xs">
              <span className="font-bold">💰 Pendidikan &amp; Pensiun:</span> Data agregat tanggungan pendidikan anak dan kesiapan dana purna tugas.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold">Total Pelajar / Mahasiswa</span>
                </div>
                <span className="text-2xl font-black">{financialStats.collegeCount} Anak</span>
                <span className="text-[11px] text-purple-700 block mt-1">Dalam tanggungan pendidikan</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold">Biaya Pendidikan Tinggi (&gt; 25jt)</span>
                </div>
                <span className="text-2xl font-black">{financialStats.highCostEdu} Anak</span>
                <span className="text-[11px] text-amber-700 block mt-1">Kuliah Kedokteran/Swasta</span>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-red-700" />
                  <span className="text-xs font-bold">Kesiapan Dana Pensiun Kurang</span>
                </div>
                <span className="text-2xl font-black">{financialStats.needFinancialAidPension} Personel</span>
                <span className="text-[11px] text-red-700 block mt-1">Butuh dukungan usaha</span>
              </div>
            </div>

            {/* List of Education Details */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                Rekapitulasi Putra / Putri dalam Tanggungan Pendidikan:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {alumniMembers.map((m) => {
                  const studentChildren = (m.daftarAnak || []).filter((a) => a.status === 'PELAJAR');
                  if (studentChildren.length === 0) return null;
                  return (
                    <div key={m.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">{m.namaLengkap}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{studentChildren.length} Pelajar</span>
                      </div>
                      <div className="space-y-1">
                        {studentChildren.map((a, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                            <span>• {a.nama}</span>
                            <span className="font-semibold text-purple-700">{formatHumanEnum(a.biayaPendidikanTahunan)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: KELUARGA ALMARHUM (IN MEMORIAM & PENDATAAN ANAK/ISTRI) */}
        {activeSubTab === 'almarhum' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-4 rounded-xl bg-slate-900 text-white border border-amber-400/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-2">
                  <span>🕊️ In Memoriam (Almarhum) &amp; Pendataan Keluarga Besar Wira Satya 96</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Daftar khusus {almarhumMembers.length} rekan leting Almarhum beserta pendataan Istri / Ahli Waris dan {totalAnakAlmarhum} Putra-Putri untuk program silaturahmi, santunan, dan beasiswa pendidikan WS96.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                  {almarhumMembers.length} Almarhum • {totalAnakAlmarhum} Putra-Putri
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {almarhumMembers.map((m) => {
                const kontakKeluarga = m.kontakIstri || m.noHp;
                const daftarAnak = Array.isArray(m.daftarAnak) ? m.daftarAnak : [];
                const namaIstriLabel = m.namaIstri?.trim()
                  ? m.namaIstri
                  : 'Belum Diisi — Klik untuk mendata Istri & Anak';

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-slate-300 bg-white shadow-sm space-y-3 hover:border-slate-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-800 text-amber-300">
                            🕊️ IN MEMORIAM
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {m.pangkat} • NRP {m.nrp}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                            {m.kompi || 'KOMPI A'} • {m.pleton || 'PLETON 1'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm mt-1.5">{m.namaLengkap}</h4>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {formatJabatanWithSatker(m.jabatanTerakhir, m.satuanKerja)} ({m.polda})
                        </p>
                      </div>
                      {kontakKeluarga && (
                        <a
                          href={formatWaUrl(kontakKeluarga)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
                          title="Hubungi Keluarga / Ahli Waris via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WA Keluarga</span>
                        </a>
                      )}
                    </div>

                    {/* Data Istri / Ahli Waris */}
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-bold text-amber-950 flex items-center justify-between gap-2 flex-wrap">
                        <span>👩 Data Istri / Ahli Waris:</span>
                        <span className={`text-[11px] font-semibold ${m.namaIstri?.trim() ? 'text-amber-900' : 'text-red-700 italic'}`}>
                          {namaIstriLabel}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px]">
                        <b>No. WA / Kontak Keluarga:</b> {kontakKeluarga || '-'}
                      </p>
                      <p className="text-slate-700 text-[11px]">
                        <b>Domisili Keluarga:</b> {m.alamatTempatTinggal || '-'}
                      </p>
                    </div>

                    {/* Data Putra-Putri */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          🎓 Data Putra-Putri ({daftarAnak.length || m.jumlahAnak || 0} Anak):
                        </span>
                      </div>
                      {daftarAnak.length > 0 ? (
                        <div className="space-y-1.5">
                          {daftarAnak.map((anak, idx) => (
                            <div
                              key={anak.id || idx}
                              className="p-2 rounded bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                            >
                              <div>
                                <span className="font-bold text-slate-900">
                                  {idx + 1}. {anak.nama}
                                </span>
                                <span className="text-slate-500 block sm:inline sm:ml-1.5">
                                  ({anak.tempatLahir || '-'}, {anak.tanggalLahir ? formatHumanTimestamp(anak.tanggalLahir) : '-'})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                    anak.status === 'PELAJAR'
                                      ? 'bg-purple-100 text-purple-800'
                                      : anak.status === 'BEKERJA'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {formatHumanEnum(anak.status)}
                                </span>
                                {anak.biayaPendidikanTahunan && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                    Biaya: {formatHumanEnum(anak.biayaPendidikanTahunan)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">
                          Data rincian putra-putri sedang dalam pemutakhiran Sekretariat.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
