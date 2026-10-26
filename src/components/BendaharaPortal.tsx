'use client';

import React, { useState, useEffect } from 'react';
import {
  AuthUser,
  KasTransaction,
  IuranAnggota,
  FinanceSummary,
  AnggotaWiraSatya,
  TransactionType,
  TransactionCategory,
  AssetPortfolioItem,
  AssetCategory,
} from '@/types';
import { generateLeakageTrackedFileName } from '@/lib/mediaSecurity';
import {
  isSuperadminAccount,
  formatHumanTimestamp,
  formatHumanDiseaseList,
  formatHumanEnum,
  syncCampaignsWithTransactions,
} from '@/lib/avatarUtils';
import { resolveRoleForBadge } from './MetaVerifiedBadge';
import { NON_AKTIF_IURAN_NRPS } from '@/data/akpol1996Alumni';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Download,
  Heart,
  GraduationCap,
  Search,
  Filter,
  X,
  CreditCard,
  CheckCircle2,
  Users,
  Coins,
  Briefcase,
  Trash2,
  Eye,
  Info,
  Settings,
  Plus,
  Calendar,
  RotateCcw,
} from 'lucide-react';

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
  iuranWajibPerBulan: number;
  tahunBuku: number;
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

const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
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
  updatedBy: 'Bendahara',
};

const CAMPAIGN_CATEGORY_META: Record<
  CampaignCategory,
  { label: string; icon: string; badge: string; barGradient: string; defaultInflowCode: string; defaultOutflowCode: string }
> = {
  ANAK_YATIM: {
    label: 'Anak Yatim',
    icon: '🤲',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    barGradient: 'from-purple-600 to-indigo-600',
    defaultInflowCode: 'DANA_SOSIAL_YATIM',
    defaultOutflowCode: 'BANTUAN_PENDIDIKAN_ANAK',
  },
  ANGGOTA_SAKIT: {
    label: 'Anggota Sakit',
    icon: '🏥',
    badge: 'bg-red-100 text-red-800 border-red-200',
    barGradient: 'from-red-600 to-rose-600',
    defaultInflowCode: 'DANA_SOSIAL_SAKIT',
    defaultOutflowCode: 'SANTUNAN_KESEHATAN',
  },
  ANGGOTA_MD: {
    label: 'Dana Duka',
    icon: '🕊️',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    barGradient: 'from-amber-500 to-orange-600',
    defaultInflowCode: 'DANA_SOSIAL_MD',
    defaultOutflowCode: 'SANTUNAN_DUKA_CITA',
  },
  EVENT_BAKSOS: {
    label: 'Event & Baksos',
    icon: '🤝',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    barGradient: 'from-emerald-600 to-teal-600',
    defaultInflowCode: 'DONASI_MILESTONE_EVENT',
    defaultOutflowCode: 'KEGIATAN_REUNI_LETING',
  },
  LAINNYA: {
    label: 'Lainnya',
    icon: '🎯',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    barGradient: 'from-blue-600 to-cyan-600',
    defaultInflowCode: 'SUMBANGAN_SUKARELA',
    defaultOutflowCode: 'OPERASIONAL_PAGUYUBAN',
  },
};

interface BendaharaPortalProps {
  currentUser: AuthUser;
  members: AnggotaWiraSatya[];
  financeSummary: FinanceSummary;
  transactions: KasTransaction[];
  iuranList: IuranAnggota[];
  assets?: AssetPortfolioItem[];
  financeConfig?: FinanceConfig;
  onAddTransaction: (trx: Omit<KasTransaction, 'id' | 'createdAt'> & { jumlahBulanIuran?: number }) => void;
  onPayIuran: (nrp: string, nominal: number) => void;
  onAddAsset?: (asset: Omit<AssetPortfolioItem, 'id' | 'updatedAt'>) => void;
  onDeleteAsset?: (id: string) => void;
  onUpdateFinanceConfig?: (config: FinanceConfig) => void;
}

const ASSET_CATEGORY_LABELS: Record<
  AssetCategory,
  { label: string; badge: string; defaultSatuan: string; placeholderNama: string; placeholderKustodian: string }
> = {
  SURAT_BERHARGA: {
    label: 'Deposito / SBN',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    defaultSatuan: 'Lembar/Bilyet',
    placeholderNama: 'Contoh: SBN ORI025 / Deposito Bank Mandiri',
    placeholderKustodian: 'Contoh: Bank Mandiri Prioritas / BRI Sekuritas',
  },
  VALUTA_ASING: {
    label: 'Valas',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    defaultSatuan: 'USD',
    placeholderNama: 'Contoh: Kas USD / SGD Paguyuban',
    placeholderKustodian: 'Contoh: Rekening Valas BNI / Brankas Bendahara',
  },
  CRYPTO: {
    label: 'Crypto',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    defaultSatuan: 'BTC',
    placeholderNama: 'Contoh: Bitcoin (BTC) / Tether (USDT) Treasury',
    placeholderKustodian: 'Contoh: Cold Wallet Ledger / Indodax / Tokocrypto',
  },
  LOGAM_MULIA_ASET: {
    label: 'Emas & Aset',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    defaultSatuan: 'Gram',
    placeholderNama: 'Contoh: Emas Antam CertiEye / Inventaris',
    placeholderKustodian: 'Contoh: Safe Deposit Box (SDB) BCA',
  },
};

const SATUAN_OPTIONS_BY_CATEGORY: Record<AssetCategory, string[]> = {
  SURAT_BERHARGA: ['Lembar/Bilyet', 'Unit', 'Lot'],
  VALUTA_ASING: ['USD', 'SGD', 'EUR', 'SAR', 'AUD', 'JPY'],
  CRYPTO: ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB'],
  LOGAM_MULIA_ASET: ['Gram', 'Keping', 'Unit'],
};

export const BendaharaPortal: React.FC<BendaharaPortalProps> = ({
  currentUser,
  members,
  financeSummary,
  transactions,
  iuranList,
  assets: propAssets,
  financeConfig: propFinanceConfig,
  onAddTransaction,
  onPayIuran,
  onAddAsset,
  onDeleteAsset,
  onUpdateFinanceConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'milestone' | 'aset' | 'bukuKas' | 'santunan' | 'pendidikan'>('milestone');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'SEMUA' | 'MASUK' | 'KELUAR'>('SEMUA');
  const [kasPilarFilter, setKasPilarFilter] = useState<'SEMUA' | 'DANA_SOSIAL' | 'DANA_INVESTASI'>('SEMUA');
  const [showReadOnlyInfo, setShowReadOnlyInfo] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<'SEMUA' | CampaignCategory>('SEMUA');

  const filterOutSuperadminIuran = (list: IuranAnggota[]) => {
    const nonAktifMemberNrps = new Set<string>(NON_AKTIF_IURAN_NRPS);
    (members || []).forEach((m) => {
      const st = m.statusKedinasan || m.statusDinas || 'AKTIF';
      if (st !== 'AKTIF') {
        if (m.nrp) nonAktifMemberNrps.add(m.nrp);
        if (m.oldNrp) nonAktifMemberNrps.add(m.oldNrp);
      }
    });
    return (list || []).filter(
      (item) => !isSuperadminAccount(item.nrp) && !nonAktifMemberNrps.has(item.nrp)
    );
  };

  // Local synced state for finance data & config
  const [localSummary, setLocalSummary] = useState<FinanceSummary & { totalKasMasuk?: number; totalKasKeluar?: number }>(
    financeSummary
  );
  const [localTransactions, setLocalTransactions] = useState<KasTransaction[]>(transactions || []);
  const [localIuranList, setLocalIuranList] = useState<IuranAnggota[]>(() => filterOutSuperadminIuran(iuranList || []));
  const [localAssets, setLocalAssets] = useState<AssetPortfolioItem[]>(propAssets || []);
  const [financeConfig, setFinanceConfig] = useState<FinanceConfig>(propFinanceConfig || DEFAULT_FINANCE_CONFIG);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'SEMUA' | AssetCategory>('SEMUA');

  // Derived Campaigns & Investment Participants from financeConfig
  const rawCampaigns: FundraisingCampaign[] =
    Array.isArray(financeConfig.campaigns) && financeConfig.campaigns.length > 0
      ? financeConfig.campaigns
      : DEFAULT_CAMPAIGNS;
  const baseCampaigns: FundraisingCampaign[] = rawCampaigns.map((c) =>
    c.id === 'cmp-anggota-md' && c.title.includes('Anggota yang MD')
      ? {
          ...c,
          title: 'Dana Duka & Tali Asih Keluarga Besar WS96',
          description:
            'Dana duka kehormatan untuk tali asih, karangan bunga, dan santunan keluarga rekan Wira Satya 96 yang berpulang.',
        }
      : c
  );
  const campaigns: FundraisingCampaign[] = syncCampaignsWithTransactions(
    baseCampaigns,
    localTransactions.length > 0 ? localTransactions : transactions
  );
  const investmentParticipants: InvestmentParticipant[] = Array.isArray(financeConfig.investmentParticipants)
    ? financeConfig.investmentParticipants
    : [];

  // Modal State for Create / Edit Fundraising Campaign (Milestone ala Kitabisa / Saweria)
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [cmpTitle, setCmpTitle] = useState('');
  const [cmpCategory, setCmpCategory] = useState<CampaignCategory>('ANAK_YATIM');
  const [cmpTarget, setCmpTarget] = useState<number>(100000000);
  const [cmpCollected, setCmpCollected] = useState<number>(0);
  const [cmpDisbursed, setCmpDisbursed] = useState<number>(0);
  const [cmpDonors, setCmpDonors] = useState<number>(0);
  const [cmpDeadline, setCmpDeadline] = useState<string>('2026-12-31');
  const [cmpStatus, setCmpStatus] = useState<'AKTIF' | 'TERCAPAI' | 'SELESAI'>('AKTIF');
  const [cmpDesc, setCmpDesc] = useState('');

  // Modal State for Quick Donation / Disbursement on a Milestone Campaign
  const [milestoneActionModal, setMilestoneActionModal] = useState<{
    campaign: FundraisingCampaign;
    mode: 'DONASI' | 'SALURKAN';
  } | null>(null);
  const [mlsNominal, setMlsNominal] = useState<number>(1000000);
  const [mlsPihak, setMlsPihak] = useState<string>('');
  const [mlsNrp, setMlsNrp] = useState<string>('');
  const [mlsKeterangan, setMlsKeterangan] = useState<string>('');
  const [mlsMemberQuery, setMlsMemberQuery] = useState<string>('');

  // Modal State for Voluntary Investment Participant ("Dana Investasi — Bagi yang Mau Ikut")
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
  const [editingInvestId, setEditingInvestId] = useState<string | null>(null);
  const [invNrp, setInvNrp] = useState<string>('');
  const [invNama, setInvNama] = useState<string>('');
  const [invPangkat, setInvPangkat] = useState<string>('Kombes Pol.');
  const [invPolda, setInvPolda] = useState<string>('MABES POLRI');
  const [invProgram, setInvProgram] = useState<string>('Pool Investasi Bersama Wira Satya 96');
  const [invNominal, setInvNominal] = useState<number>(10000000);
  const [invEstimasi, setInvEstimasi] = useState<number>(10000000);
  const [invTanggal, setInvTanggal] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [invStatus, setInvStatus] = useState<'AKTIF' | 'CAIR'>('AKTIF');
  const [invCatatan, setInvCatatan] = useState<string>('');
  const [invRecordToKas, setInvRecordToKas] = useState<boolean>(true);
  const [invMemberQuery, setInvMemberQuery] = useState<string>('');

  useEffect(() => {
    setLocalSummary(financeSummary);
  }, [financeSummary]);

  useEffect(() => {
    setLocalTransactions(transactions || []);
  }, [transactions]);

  useEffect(() => {
    setLocalIuranList(filterOutSuperadminIuran(iuranList || []));
  }, [iuranList, members]);

  useEffect(() => {
    if (propAssets) {
      setLocalAssets(propAssets);
    }
  }, [propAssets]);

  useEffect(() => {
    if (propFinanceConfig) {
      setFinanceConfig(propFinanceConfig);
    } else if (typeof window !== 'undefined') {
      try {
        const rawCfg = localStorage.getItem('ws96_finance_config_v1');
        if (rawCfg) {
          const parsedCfg = JSON.parse(rawCfg);
          if (parsedCfg && Number(parsedCfg.iuranWajibPerBulan) > 0) {
            setFinanceConfig(parsedCfg);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [propFinanceConfig]);

  // Fetch latest finance state and config from API (preserving user-saved config against serverless cold starts)
  useEffect(() => {
    const fetchLatestFinanceState = () => {
      let savedLocalCfg: FinanceConfig | null = null;
      if (typeof window !== 'undefined') {
        try {
          const rawCfg = localStorage.getItem('ws96_finance_config_v1');
          if (rawCfg) {
            savedLocalCfg = JSON.parse(rawCfg);
          } else {
            const rawFin = localStorage.getItem('wirasatya96_finance');
            if (rawFin) {
              const parsedFin = JSON.parse(rawFin);
              if (parsedFin?.financeConfig) savedLocalCfg = parsedFin.financeConfig;
            }
          }
        } catch {
          // ignore
        }
      }

      fetch('/api/finance')
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const payload = res.data || res;
            const serverCfg: FinanceConfig | undefined = payload.financeConfig;
            const isServerDefault =
              !serverCfg ||
              serverCfg.updatedBy === 'Sistem Default Kebendaharaan WS96';
            const hasCustomLocalCfg =
              savedLocalCfg &&
              Number(savedLocalCfg.iuranWajibPerBulan) > 0 &&
              savedLocalCfg.updatedBy &&
              savedLocalCfg.updatedBy !== 'Sistem Default Kebendaharaan WS96';

            const effectiveCfg =
              isServerDefault && hasCustomLocalCfg ? savedLocalCfg! : serverCfg || savedLocalCfg || DEFAULT_FINANCE_CONFIG;

            setFinanceConfig(effectiveCfg);

            if (payload.summary) {
              setLocalSummary({
                ...payload.summary,
                iuranWajibPerBulan: effectiveCfg.iuranWajibPerBulan,
              });
            }
            if (Array.isArray(payload.transactions)) setLocalTransactions(payload.transactions);
            if (Array.isArray(payload.assets)) setLocalAssets(payload.assets);

            const rawIuran: IuranAnggota[] =
              Array.isArray(payload.iuranList) && payload.iuranList.length > 0
                ? payload.iuranList
                : Array.isArray(payload.iuran) && payload.iuran.length > 0
                ? payload.iuran
                : [];

            if (rawIuran.length > 0) {
              const annualTarget = (Number(effectiveCfg.iuranWajibPerBulan) || 250000) * 12;
              const syncedIuran = filterOutSuperadminIuran(rawIuran).map((item) => {
                const status: IuranAnggota['status'] =
                  item.totalTerbayar >= annualTarget
                    ? 'LUNAS'
                    : item.totalTerbayar > 0
                    ? 'SEBAGIAN'
                    : 'BELUM_BAYAR';
                return { ...item, totalTagihan: annualTarget, status };
              });
              setLocalIuranList(syncedIuran);
            } else {
              setLocalIuranList([]);
            }

            // Re-hydrate cold-started server with user's custom saved config
            if (isServerDefault && hasCustomLocalCfg && savedLocalCfg) {
              fetch('/api/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'UPDATE_FINANCE_CONFIG',
                  actorRole: 'SUPERADMIN',
                  iuranWajibPerBulan: savedLocalCfg.iuranWajibPerBulan,
                  tahunBuku: savedLocalCfg.tahunBuku,
                  subKategoriMasuk: savedLocalCfg.subKategoriMasuk,
                  subKategoriKeluar: savedLocalCfg.subKategoriKeluar,
                  updatedBy: savedLocalCfg.updatedBy,
                }),
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    };

    fetchLatestFinanceState();
    window.addEventListener('ws96_dummy_data_changed', fetchLatestFinanceState);
    return () => {
      window.removeEventListener('ws96_dummy_data_changed', fetchLatestFinanceState);
    };
  }, []);

  // Modal State for Cascading Cashflow Input (BENDAHARA & SUPERADMIN)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trxJenis, setTrxJenis] = useState<TransactionType>('MASUK');
  const [trxKategori, setTrxKategori] = useState<string>('IURAN_WAJIB_BULANAN');
  const [trxNominal, setTrxNominal] = useState<number>(250000);
  const [trxTanggal, setTrxTanggal] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [trxReferensi, setTrxReferensi] = useState<string>('');
  const [trxKeterangan, setTrxKeterangan] = useState('');
  const [trxPihak, setTrxPihak] = useState('');
  const [trxNrp, setTrxNrp] = useState('');
  const [jumlahBulanIuran, setJumlahBulanIuran] = useState<number>(1);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Modal State for Pengaturan Kebendaharaan (Tarif Iuran Wajib & Master Kategori Cashflow)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [draftIuranPerBulan, setDraftIuranPerBulan] = useState<number>(DEFAULT_FINANCE_CONFIG.iuranWajibPerBulan);
  const [draftTahunBuku, setDraftTahunBuku] = useState<number>(DEFAULT_FINANCE_CONFIG.tahunBuku);
  const [draftSubMasuk, setDraftSubMasuk] = useState<FinanceCategoryOption[]>(DEFAULT_FINANCE_CONFIG.subKategoriMasuk);
  const [draftSubKeluar, setDraftSubKeluar] = useState<FinanceCategoryOption[]>(DEFAULT_FINANCE_CONFIG.subKategoriKeluar);
  const [newMasukLabel, setNewMasukLabel] = useState('');
  const [newKeluarLabel, setNewKeluarLabel] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modal State for New Asset Portfolio Item (BENDAHARA & SUPERADMIN)
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [astNama, setAstNama] = useState('');
  const [astKategori, setAstKategori] = useState<AssetCategory>('SURAT_BERHARGA');
  const [astSatuan, setAstSatuan] = useState('Lembar/Bilyet');
  const [astJumlah, setAstJumlah] = useState<number>(1);
  const [astNilaiBeli, setAstNilaiBeli] = useState<number>(10000000);
  const [astEstimasiIdr, setAstEstimasiIdr] = useState<number>(10000000);
  const [astKustodian, setAstKustodian] = useState('');
  const [astNomorSeri, setAstNomorSeri] = useState('');
  const [astTanggalPerolehan, setAstTanggalPerolehan] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [astKeterangan, setAstKeterangan] = useState('');

  // Period / Date Range Filter State (Kas & Aset)
  const [periodMode, setPeriodMode] = useState<
    'SEMUA' | 'BULAN_INI' | 'TRIWULAN_INI' | 'TAHUN_INI' | 'PILIH_BULAN' | 'RENTANG_TANGGAL'
  >('SEMUA');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modal Pay Iuran (BENDAHARA & SUPERADMIN)
  const [payIuranModal, setPayIuranModal] = useState<IuranAnggota | null>(null);
  const [payNominal, setPayNominal] = useState<number>(250000);

  // PERMISSION RULES:
  const userRole = resolveRoleForBadge(currentUser.nrp, currentUser.role) || currentUser.role;
  const canInputKas = userRole === 'BENDAHARA' || userRole === 'SUPERADMIN';
  const canRekap = userRole === 'BENDAHARA' || userRole === 'KETUA' || userRole === 'SUPERADMIN';
  const canInputFinance = canInputKas;
  const canRekapFinance = canRekap;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const NAMA_BULAN_OPTIONS = [
    { value: 0, label: 'Semua Bulan' },
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const availableYears = React.useMemo(() => {
    const yearSet = new Set<number>([2024, 2025, 2026, 2027, new Date().getFullYear()]);
    localTransactions.forEach((t) => {
      const y = Number((t.tanggal || '').slice(0, 4));
      if (y >= 2000 && y <= 2100) yearSet.add(y);
    });
    localAssets.forEach((a) => {
      const y = Number((a.tanggalPerolehan || '').slice(0, 4));
      if (y >= 2000 && y <= 2100) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [localTransactions, localAssets]);

  const matchesPeriod = (dateStr?: string): boolean => {
    if (periodMode === 'SEMUA') return true;
    if (!dateStr) return false;
    const ymd = dateStr.trim().slice(0, 10);
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    if (!y || !m) return false;

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    if (periodMode === 'BULAN_INI') {
      return y === curY && m === curM;
    }
    if (periodMode === 'TRIWULAN_INI') {
      const diffMonths = (curY - y) * 12 + (curM - m);
      return diffMonths >= 0 && diffMonths < 3;
    }
    if (periodMode === 'TAHUN_INI') {
      return y === curY;
    }
    if (periodMode === 'PILIH_BULAN') {
      return y === selectedYear && (selectedMonth === 0 ? true : m === selectedMonth);
    }
    if (periodMode === 'RENTANG_TANGGAL') {
      if (dateFrom && ymd < dateFrom) return false;
      if (dateTo && ymd > dateTo) return false;
      return true;
    }
    return true;
  };

  const activePeriodLabel = React.useMemo(() => {
    const now = new Date();
    const curMonthName = NAMA_BULAN_OPTIONS.find((b) => b.value === now.getMonth() + 1)?.label || '';
    if (periodMode === 'SEMUA') return 'Semua Periode';
    if (periodMode === 'BULAN_INI') return `Bulan Ini (${curMonthName} ${now.getFullYear()})`;
    if (periodMode === 'TRIWULAN_INI') return '3 Bulan Terakhir (Triwulan)';
    if (periodMode === 'TAHUN_INI') return `Tahun Ini (${now.getFullYear()})`;
    if (periodMode === 'PILIH_BULAN') {
      const mLabel = NAMA_BULAN_OPTIONS.find((b) => b.value === selectedMonth)?.label || '';
      return `${mLabel} ${selectedYear}`;
    }
    if (periodMode === 'RENTANG_TANGGAL') {
      if (!dateFrom && !dateTo) return 'Rentang Tanggal (Semua)';
      return `${dateFrom || 'Awal'} s/d ${dateTo || 'Sekarang'}`;
    }
    return 'Semua Periode';
  }, [periodMode, selectedMonth, selectedYear, dateFrom, dateTo]);

  const periodFilteredTransactions = localTransactions.filter((t) => matchesPeriod(t.tanggal));
  const periodFilteredAssets = localAssets.filter((a) => matchesPeriod(a.tanggalPerolehan));

  // Compute Cashflow Summary from period-filtered transactions & assets (plus all-time totals for reference)
  const allTimeKasMasuk = localTransactions
    .filter((t) => t.jenis === 'MASUK')
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const allTimeKasKeluar = localTransactions
    .filter((t) => t.jenis === 'KELUAR')
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const allTimeSaldoKas =
    localTransactions.length > 0 ? allTimeKasMasuk - allTimeKasKeluar : localSummary.saldoUtama || 0;

  const totalKasMasuk = periodFilteredTransactions
    .filter((t) => t.jenis === 'MASUK')
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const totalKasKeluar = periodFilteredTransactions
    .filter((t) => t.jenis === 'KELUAR')
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const effectiveSaldoKas =
    periodMode === 'SEMUA'
      ? allTimeSaldoKas
      : totalKasMasuk - totalKasKeluar;
  const totalValuasiAset = periodFilteredAssets.reduce((sum, a) => sum + (Number(a.estimasiNilaiIdr) || 0), 0);
  const totalDanaInvestasiPartisipan = investmentParticipants
    .filter((p) => p.statusPartisipasi !== 'CAIR')
    .reduce((sum, p) => sum + (Number(p.estimasiNilaiSaatIni || p.nominalPenyertaan) || 0), 0);
  const totalKekayaanGabungan = effectiveSaldoKas + totalValuasiAset + totalDanaInvestasiPartisipan;

  // Milestone Dana Sosial Totals
  const totalTargetMilestone = campaigns.reduce((sum, c) => sum + (Number(c.targetAmount) || 0), 0);
  const totalTerkumpulMilestone = campaigns.reduce((sum, c) => sum + (Number(c.collectedAmount) || 0), 0);
  const totalDisalurkanMilestone = campaigns.reduce((sum, c) => sum + (Number(c.disbursedAmount) || 0), 0);
  const milestoneOverallPct =
    totalTargetMilestone > 0 ? Math.min(100, Math.round((totalTerkumpulMilestone / totalTargetMilestone) * 100)) : 0;

  const filteredCampaigns = campaigns.filter(
    (c) => campaignFilter === 'SEMUA' || c.category === campaignFilter
  );

  // Sync helper for Campaigns & Investment Participants
  const persistCampaignsAndInvestments = async (
    nextCampaigns: FundraisingCampaign[],
    nextInvestments: InvestmentParticipant[],
    linkedTrx?: {
      jenis: TransactionType;
      kategori: string;
      nominal: number;
      keterangan: string;
      pihakTerkait?: string;
      nrpTerkait?: string;
    }
  ) => {
    const optimisticCfg: FinanceConfig = {
      ...financeConfig,
      campaigns: nextCampaigns,
      investmentParticipants: nextInvestments,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.nama,
    };
    setFinanceConfig(optimisticCfg);
    if (onUpdateFinanceConfig) onUpdateFinanceConfig(optimisticCfg);

    if (linkedTrx) {
      onAddTransaction({
        nomorReferensi: 'WS96-MLS-' + Date.now().toString().slice(-4),
        tanggal: new Date().toISOString().split('T')[0],
        jenis: linkedTrx.jenis,
        kategori: linkedTrx.kategori as TransactionCategory,
        nominal: linkedTrx.nominal,
        keterangan: linkedTrx.keterangan,
        pihakTerkait: linkedTrx.pihakTerkait || '-',
        nrpTerkait: linkedTrx.nrpTerkait || '',
        dicatatOleh: currentUser.nama,
      });
    }

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_FINANCE_CONFIG',
          actorRole: currentUser.role,
          campaigns: nextCampaigns,
          investmentParticipants: nextInvestments,
          linkedTransaction: linkedTrx,
          updatedBy: currentUser.nama,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const srvCfg = data.financeConfig || data.data?.financeConfig || optimisticCfg;
        setFinanceConfig(srvCfg);
        if (Array.isArray(data.transactions)) setLocalTransactions(data.transactions);
        if (data.summary) setLocalSummary(data.summary);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ws96_finance_config_v1', JSON.stringify(srvCfg));
          window.dispatchEvent(new Event('ws96_finance_updated'));
        }
        return;
      }
    } catch {
      // Fallback local
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('ws96_finance_config_v1', JSON.stringify(optimisticCfg));
      window.dispatchEvent(new Event('ws96_finance_updated'));
    }
  };

  const handleOpenCreateCampaign = (defaultCat: CampaignCategory = 'EVENT_BAKSOS') => {
    setEditingCampaignId(null);
    setCmpCategory(defaultCat);
    setCmpTitle('');
    setCmpTarget(50000000);
    setCmpCollected(0);
    setCmpDisbursed(0);
    setCmpDonors(0);
    setCmpDeadline('2026-12-31');
    setCmpStatus('AKTIF');
    setCmpDesc('');
    setIsCampaignModalOpen(true);
  };

  const handleOpenEditCampaign = (cmp: FundraisingCampaign) => {
    setEditingCampaignId(cmp.id);
    setCmpCategory(cmp.category);
    setCmpTitle(cmp.title);
    setCmpTarget(cmp.targetAmount);
    setCmpCollected(cmp.collectedAmount);
    setCmpDisbursed(cmp.disbursedAmount);
    setCmpDonors(cmp.donorCount);
    setCmpDeadline(cmp.deadline || '2026-12-31');
    setCmpStatus(cmp.status);
    setCmpDesc(cmp.description);
    setIsCampaignModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas || !cmpTitle.trim()) return;
    const item: FundraisingCampaign = {
      id: editingCampaignId || 'cmp-' + Date.now(),
      title: cmpTitle.trim(),
      category: cmpCategory,
      targetAmount: Math.max(0, Number(cmpTarget) || 0),
      collectedAmount: Math.max(0, Number(cmpCollected) || 0),
      disbursedAmount: Math.max(0, Number(cmpDisbursed) || 0),
      donorCount: Math.max(0, Number(cmpDonors) || 0),
      deadline: cmpDeadline || '2026-12-31',
      status: cmpStatus,
      description: cmpDesc.trim(),
      updatedAt: new Date().toISOString(),
    };
    const nextList = editingCampaignId
      ? campaigns.map((c) => (c.id === editingCampaignId ? item : c))
      : [item, ...campaigns];
    setIsCampaignModalOpen(false);
    await persistCampaignsAndInvestments(nextList, investmentParticipants);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!canInputKas) return;
    const nextList = campaigns.filter((c) => c.id !== id);
    setIsCampaignModalOpen(false);
    await persistCampaignsAndInvestments(nextList, investmentParticipants);
  };

  const handleOpenMilestoneAction = (campaign: FundraisingCampaign, mode: 'DONASI' | 'SALURKAN') => {
    setMilestoneActionModal({ campaign, mode });
    setMlsNominal(mode === 'DONASI' ? 1000000 : 5000000);
    setMlsPihak('');
    setMlsNrp('');
    setMlsMemberQuery('');
    setMlsKeterangan(
      mode === 'DONASI'
        ? `Donasi / Kontribusi untuk ${campaign.title}`
        : `Penyaluran Dana Sosial: ${campaign.title}`
    );
  };

  const handleSubmitMilestoneAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas || !milestoneActionModal) return;
    const { campaign, mode } = milestoneActionModal;
    const amount = Math.max(1, Number(mlsNominal) || 0);
    const meta = CAMPAIGN_CATEGORY_META[campaign.category] || CAMPAIGN_CATEGORY_META.LAINNYA;

    const updatedCmp: FundraisingCampaign =
      mode === 'DONASI'
        ? {
            ...campaign,
            collectedAmount: (Number(campaign.collectedAmount) || 0) + amount,
            donorCount: (Number(campaign.donorCount) || 0) + 1,
            status:
              campaign.targetAmount > 0 && (Number(campaign.collectedAmount) || 0) + amount >= campaign.targetAmount
                ? 'TERCAPAI'
                : campaign.status,
            updatedAt: new Date().toISOString(),
          }
        : {
            ...campaign,
            disbursedAmount: (Number(campaign.disbursedAmount) || 0) + amount,
            updatedAt: new Date().toISOString(),
          };

    const nextCampaigns = campaigns.map((c) => (c.id === campaign.id ? updatedCmp : c));
    setMilestoneActionModal(null);

    await persistCampaignsAndInvestments(nextCampaigns, investmentParticipants, {
      jenis: mode === 'DONASI' ? 'MASUK' : 'KELUAR',
      kategori: mode === 'DONASI' ? meta.defaultInflowCode : meta.defaultOutflowCode,
      nominal: amount,
      keterangan:
        mlsKeterangan.trim() ||
        (mode === 'DONASI'
          ? `Donasi Program "${campaign.title}" oleh ${mlsPihak || 'Anggota WS96'}`
          : `Penyaluran Program "${campaign.title}" kepada ${mlsPihak || 'Penerima Manfaat'}`),
      pihakTerkait: mlsPihak.trim() || '-',
      nrpTerkait: mlsNrp.trim() || '',
    });
  };

  const handleOpenInvestModal = (existing?: InvestmentParticipant) => {
    if (existing) {
      setEditingInvestId(existing.id);
      setInvNrp(existing.nrp);
      setInvNama(existing.namaLengkap);
      setInvPangkat(existing.pangkat);
      setInvPolda(existing.polda);
      setInvProgram(existing.namaProgram);
      setInvNominal(existing.nominalPenyertaan);
      setInvEstimasi(existing.estimasiNilaiSaatIni);
      setInvTanggal(existing.tanggalBergabung);
      setInvStatus(existing.statusPartisipasi);
      setInvCatatan(existing.catatan);
      setInvRecordToKas(false);
    } else {
      setEditingInvestId(null);
      setInvNrp('');
      setInvNama('');
      setInvPangkat('Kombes Pol.');
      setInvPolda('MABES POLRI');
      setInvProgram('Pool Investasi Bersama Wira Satya 96');
      setInvNominal(10000000);
      setInvEstimasi(10000000);
      setInvTanggal(new Date().toISOString().split('T')[0]);
      setInvStatus('AKTIF');
      setInvCatatan('');
      setInvRecordToKas(true);
    }
    setInvMemberQuery('');
    setIsInvestModalOpen(true);
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas || !invNama.trim()) return;
    const item: InvestmentParticipant = {
      id: editingInvestId || 'inv-' + Date.now(),
      nrp: invNrp.trim() || '-',
      namaLengkap: invNama.trim(),
      pangkat: invPangkat.trim() || 'Kombes Pol.',
      polda: invPolda.trim() || 'MABES POLRI',
      namaProgram: invProgram.trim() || 'Pool Investasi Bersama Wira Satya 96',
      nominalPenyertaan: Math.max(0, Number(invNominal) || 0),
      estimasiNilaiSaatIni: Math.max(0, Number(invEstimasi || invNominal) || 0),
      tanggalBergabung: invTanggal || new Date().toISOString().split('T')[0],
      statusPartisipasi: invStatus,
      catatan: invCatatan.trim(),
    };
    const nextList = editingInvestId
      ? investmentParticipants.map((p) => (p.id === editingInvestId ? item : p))
      : [item, ...investmentParticipants];
    setIsInvestModalOpen(false);

    await persistCampaignsAndInvestments(
      campaigns,
      nextList,
      !editingInvestId && invRecordToKas && item.nominalPenyertaan > 0
        ? {
            jenis: 'MASUK',
            kategori: 'DANA_INVESTASI_ANGGOTA',
            nominal: item.nominalPenyertaan,
            keterangan: `Penyertaan Dana Investasi (${item.namaProgram}) oleh ${item.namaLengkap}`,
            pihakTerkait: item.namaLengkap,
            nrpTerkait: item.nrp !== '-' ? item.nrp : '',
          }
        : undefined
    );
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!canInputKas) return;
    const nextList = investmentParticipants.filter((p) => p.id !== id);
    await persistCampaignsAndInvestments(campaigns, nextList);
  };

  const getCategoryLabel = (code: string) => {
    const foundMasuk = financeConfig.subKategoriMasuk.find((c) => c.code === code);
    if (foundMasuk) return foundMasuk.label;
    const foundKeluar = financeConfig.subKategoriKeluar.find((c) => c.code === code);
    if (foundKeluar) return foundKeluar.label;
    return code.replace(/_/g, ' ');
  };

  const isInvestmentTransaction = (kategoriCode: string) => {
    const upper = (kategoriCode || '').toUpperCase();
    return (
      upper === 'DANA_INVESTASI_ANGGOTA' ||
      upper === 'PENCAIRAN_ASET_INVESTASI' ||
      upper === 'PEMBELIAN_ASET_INVESTASI' ||
      upper.includes('INVESTASI') ||
      upper.includes('ASET')
    );
  };

  const kasSosialMasuk = periodFilteredTransactions
    .filter((t) => t.jenis === 'MASUK' && !isInvestmentTransaction(t.kategori))
    .reduce((s, t) => s + (Number(t.nominal) || 0), 0);
  const kasSosialKeluar = periodFilteredTransactions
    .filter((t) => t.jenis === 'KELUAR' && !isInvestmentTransaction(t.kategori))
    .reduce((s, t) => s + (Number(t.nominal) || 0), 0);
  const saldoKasSosial = kasSosialMasuk - kasSosialKeluar;

  const kasInvestasiMasuk = periodFilteredTransactions
    .filter((t) => t.jenis === 'MASUK' && isInvestmentTransaction(t.kategori))
    .reduce((s, t) => s + (Number(t.nominal) || 0), 0);
  const kasInvestasiKeluar = periodFilteredTransactions
    .filter((t) => t.jenis === 'KELUAR' && isInvestmentTransaction(t.kategori))
    .reduce((s, t) => s + (Number(t.nominal) || 0), 0);
  const saldoKasInvestasi = kasInvestasiMasuk - kasInvestasiKeluar;

  // Filtered transactions (by period + pilar Dana Sosial/Investasi + MASUK/KELUAR + text search)
  const filteredTransactions = periodFilteredTransactions.filter((t) => {
    const isInv = isInvestmentTransaction(t.kategori);
    const matchPilar =
      kasPilarFilter === 'SEMUA' ||
      (kasPilarFilter === 'DANA_INVESTASI' ? isInv : !isInv);
    const matchType = selectedFilter === 'SEMUA' || t.jenis === selectedFilter;
    const matchSearch =
      t.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nomorReferensi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.kategori.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.pihakTerkait && t.pihakTerkait.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchPilar && matchType && matchSearch;
  });

  // Filtered assets (by period + category)
  const filteredAssets = periodFilteredAssets.filter((a) => {
    return assetCategoryFilter === 'SEMUA' || a.kategori === assetCategoryFilter;
  });

  const handleOpenMutasiModal = (defaultJenis: TransactionType = 'MASUK', defaultKategori?: string) => {
    setTrxJenis(defaultJenis);
    const list = defaultJenis === 'MASUK' ? financeConfig.subKategoriMasuk : financeConfig.subKategoriKeluar;
    const chosenCat = defaultKategori || list[0]?.code || (defaultJenis === 'MASUK' ? 'IURAN_WAJIB_BULANAN' : 'SANTUNAN_KESEHATAN');
    setTrxKategori(chosenCat);
    setJumlahBulanIuran(1);
    setTrxNominal(
      defaultJenis === 'MASUK' && chosenCat === 'IURAN_WAJIB_BULANAN'
        ? financeConfig.iuranWajibPerBulan
        : 1000000
    );
    setTrxTanggal(new Date().toISOString().split('T')[0]);
    setTrxReferensi('WS96-KAS-' + Date.now().toString().slice(-4));
    setTrxKeterangan('');
    setTrxPihak('');
    setTrxNrp('');
    setMemberSearchQuery('');
    setIsModalOpen(true);
  };

  const handleOpenConfigModal = () => {
    setDraftIuranPerBulan(financeConfig.iuranWajibPerBulan || 250000);
    setDraftTahunBuku(financeConfig.tahunBuku || 2026);
    setDraftSubMasuk([...(financeConfig.subKategoriMasuk || DEFAULT_FINANCE_CONFIG.subKategoriMasuk)]);
    setDraftSubKeluar([...(financeConfig.subKategoriKeluar || DEFAULT_FINANCE_CONFIG.subKategoriKeluar)]);
    setNewMasukLabel('');
    setNewKeluarLabel('');
    setIsConfigModalOpen(true);
  };

  const handleAddSubKategori = (jenis: 'MASUK' | 'KELUAR') => {
    const rawLabel = jenis === 'MASUK' ? newMasukLabel.trim() : newKeluarLabel.trim();
    if (!rawLabel) return;
    const generatedCode = rawLabel
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || ('KATEGORI_' + Date.now().toString().slice(-4));

    if (jenis === 'MASUK') {
      if (!draftSubMasuk.some((c) => c.code === generatedCode)) {
        setDraftSubMasuk([...draftSubMasuk, { code: generatedCode, label: rawLabel }]);
      }
      setNewMasukLabel('');
    } else {
      if (!draftSubKeluar.some((c) => c.code === generatedCode)) {
        setDraftSubKeluar([...draftSubKeluar, { code: generatedCode, label: rawLabel }]);
      }
      setNewKeluarLabel('');
    }
  };

  const handleRemoveSubKategori = (jenis: 'MASUK' | 'KELUAR', code: string) => {
    if (jenis === 'MASUK') {
      if (draftSubMasuk.length <= 1) return;
      setDraftSubMasuk(draftSubMasuk.filter((c) => c.code !== code));
    } else {
      if (draftSubKeluar.length <= 1) return;
      setDraftSubKeluar(draftSubKeluar.filter((c) => c.code !== code));
    }
  };

  const handleSaveFinanceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas) return;
    setIsSavingConfig(true);

    const nextIuran = Math.max(10000, Number(draftIuranPerBulan) || 250000);
    const nextTahun = Number(draftTahunBuku) || 2026;

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_FINANCE_CONFIG',
          actorRole: currentUser.role,
          iuranWajibPerBulan: nextIuran,
          tahunBuku: nextTahun,
          subKategoriMasuk: draftSubMasuk,
          subKategoriKeluar: draftSubKeluar,
          updatedBy: currentUser.nama,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedCfg: FinanceConfig = data.financeConfig || data.data?.financeConfig || {
          iuranWajibPerBulan: nextIuran,
          tahunBuku: nextTahun,
          subKategoriMasuk: draftSubMasuk,
          subKategoriKeluar: draftSubKeluar,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.nama,
        };
        setFinanceConfig(updatedCfg);
        if (onUpdateFinanceConfig) onUpdateFinanceConfig(updatedCfg);

        const nextIuranList: IuranAnggota[] = filterOutSuperadminIuran(
          data.iuranList ||
            data.iuran ||
            data.data?.iuranList ||
            localIuranList.map((item) => {
              const totalTagihan = nextIuran * 12;
              const status =
                item.totalTerbayar >= totalTagihan
                  ? 'LUNAS'
                  : item.totalTerbayar > 0
                  ? 'SEBAGIAN'
                  : 'BELUM_BAYAR';
              return { ...item, tahun: nextTahun, totalTagihan, status };
            })
        );
        setLocalIuranList(nextIuranList);

        if (data.summary || data.data?.summary) {
          setLocalSummary(data.summary || data.data.summary);
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('ws96_finance_config_v1', JSON.stringify(updatedCfg));
          localStorage.setItem(
            'wirasatya96_finance',
            JSON.stringify({
              summary: data.summary || localSummary,
              transactions: localTransactions,
              assets: localAssets,
              iuranList: nextIuranList,
              financeConfig: updatedCfg,
            })
          );
          window.dispatchEvent(new Event('ws96_finance_updated'));
        }
      }
    } catch {
      // Fallback local update
      const updatedCfg: FinanceConfig = {
        iuranWajibPerBulan: nextIuran,
        tahunBuku: nextTahun,
        subKategoriMasuk: draftSubMasuk,
        subKategoriKeluar: draftSubKeluar,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.nama,
      };
      setFinanceConfig(updatedCfg);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ws96_finance_config_v1', JSON.stringify(updatedCfg));
        window.dispatchEvent(new Event('ws96_finance_updated'));
      }
    } finally {
      setIsSavingConfig(false);
      setIsConfigModalOpen(false);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas) {
      alert('Akses Ditolak: Penginputan transaksi kas hanya dapat dilakukan oleh Bendahara atau Superadmin.');
      return;
    }
    if (!trxNominal || !trxKeterangan) {
      alert('Mohon isi nominal dan keterangan transaksi.');
      return;
    }

    const refCode = trxReferensi.trim() || 'WS96-KAS-' + Date.now().toString().slice(-4);
    const tanggalStr = trxTanggal || new Date().toISOString().split('T')[0];
    const bulanCount =
      trxJenis === 'MASUK' && trxKategori === 'IURAN_WAJIB_BULANAN' && trxNrp
        ? Math.max(1, Number(jumlahBulanIuran) || 1)
        : 0;

    const trxPayload = {
      nomorReferensi: refCode,
      tanggal: tanggalStr,
      jenis: trxJenis,
      kategori: trxKategori as TransactionCategory,
      nominal: Number(trxNominal),
      keterangan: trxKeterangan.trim(),
      pihakTerkait: trxPihak.trim() || '-',
      nrpTerkait: trxNrp.trim() || '',
      dicatatOleh: currentUser.nama,
      ...(bulanCount > 0 ? { jumlahBulanIuran: bulanCount } : {}),
    };

    onAddTransaction(trxPayload);

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_TRANSACTION',
          actorRole: currentUser.role,
          ...trxPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.transactions)) setLocalTransactions(data.transactions);
        if (Array.isArray(data.iuranList)) setLocalIuranList(filterOutSuperadminIuran(data.iuranList));
        if (data.summary) setLocalSummary(data.summary);
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'wirasatya96_finance',
            JSON.stringify({
              summary: data.summary || localSummary,
              transactions: data.transactions || localTransactions,
              assets: localAssets,
              iuranList: filterOutSuperadminIuran(data.iuranList || localIuranList),
              financeConfig,
            })
          );
        }
      }
    } catch {
      // Fallback local state update
      const fallbackTrx: KasTransaction = {
        ...trxPayload,
        id: 'trx-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      setLocalTransactions((prev) => [fallbackTrx, ...prev]);
    }

    setIsModalOpen(false);
    setTrxKeterangan('');
    setTrxPihak('');
    setTrxNrp('');
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas) {
      alert('Akses Ditolak: Pencatatan aset hanya dapat dilakukan oleh Bendahara atau Superadmin.');
      return;
    }
    if (!astNama.trim() || !astEstimasiIdr) {
      alert('Mohon lengkapi nama aset dan estimasi nilai Rupiah.');
      return;
    }

    const payload: Omit<AssetPortfolioItem, 'id' | 'updatedAt'> = {
      kodeAset: 'WS96-AST-' + Date.now().toString().slice(-4),
      namaAset: astNama.trim(),
      kategori: astKategori,
      satuan: astSatuan,
      jumlahUnit: Number(astJumlah) || 1,
      nilaiPerolehanIdr: Number(astNilaiBeli) || Number(astEstimasiIdr),
      estimasiNilaiIdr: Number(astEstimasiIdr),
      kustodianLokasi: astKustodian.trim() || 'Bendahara Paguyuban',
      nomorSeriAtauWallet: astNomorSeri.trim() || '-',
      tanggalPerolehan: astTanggalPerolehan || new Date().toISOString().split('T')[0],
      keterangan: astKeterangan.trim(),
      dicatatOleh: currentUser.nama,
    };

    if (onAddAsset) {
      onAddAsset(payload);
    }

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_ASSET',
          actorRole: currentUser.role,
          ...payload,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLocalAssets((prev) => {
          if (prev.some((a) => a.kodeAset === data.data.kodeAset)) return prev;
          return [data.data, ...prev];
        });
        if (data.summary) setLocalSummary(data.summary);
      }
    } catch {
      // Fallback local
    }

    setIsAssetModalOpen(false);
    setAstNama('');
    setAstKustodian('');
    setAstNomorSeri('');
    setAstTanggalPerolehan(new Date().toISOString().split('T')[0]);
    setAstKeterangan('');
  };

  const handleRemoveAsset = async (id: string) => {
    if (!canInputKas) return;
    if (onDeleteAsset) {
      onDeleteAsset(id);
    }
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_ASSET',
          actorRole: currentUser.role,
          id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalAssets((prev) => prev.filter((a) => a.id !== id));
        if (data.summary) setLocalSummary(data.summary);
      }
    } catch {
      setLocalAssets((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleConfirmPayIuran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputKas || !payIuranModal) return;
    const targetNrp = payIuranModal.nrp;
    const amount = Number(payNominal);
    onPayIuran(targetNrp, amount);
    setPayIuranModal(null);

    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PAY_IURAN',
          actorRole: currentUser.role,
          nrp: targetNrp,
          nominal: amount,
          dicatatOleh: currentUser.nama,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.iuranList)) setLocalIuranList(filterOutSuperadminIuran(data.iuranList));
        if (Array.isArray(data.transactions)) setLocalTransactions(data.transactions);
        if (data.summary) setLocalSummary(data.summary);
      }
    } catch {
      // ignore
    }
  };

  const handleExportFinanceCSV = () => {
    if (!canRekap) {
      alert('Akses Ditolak: Rekap laporan kas & aset hanya dapat diunduh oleh Bendahara, Ketua, dan Superadmin.');
      return;
    }

    const trxHeaders = [
      'PERIODE FILTER',
      'TIPE DATA',
      'Nomor Referensi / Kode',
      'Tanggal',
      'Jenis / Kategori',
      'Sub-Kategori / Satuan',
      'Unit',
      'Nominal / Estimasi IDR',
      'Pihak / Kustodian',
      'Keterangan',
      'Dicatat Oleh',
    ];
    const trxRows = filteredTransactions.map((t) => [
      `"${activePeriodLabel}"`,
      '"TRANSAKSI_KAS"',
      `"${t.nomorReferensi}"`,
      `"${t.tanggal}"`,
      `"${t.jenis}"`,
      `"${getCategoryLabel(t.kategori).replace(/"/g, '""')}"`,
      '1',
      t.nominal,
      `"${(t.pihakTerkait || '-').replace(/"/g, '""')}"`,
      `"${t.keterangan.replace(/"/g, '""')}"`,
      `"${t.dicatatOleh}"`,
    ]);

    const assetRows = filteredAssets.map((a) => [
      `"${activePeriodLabel}"`,
      '"PORTOFOLIO_ASET"',
      `"${a.kodeAset}"`,
      `"${a.tanggalPerolehan}"`,
      `"${a.kategori}"`,
      `"${a.satuan}"`,
      a.jumlahUnit,
      a.estimasiNilaiIdr,
      `"${(a.kustodianLokasi || '-').replace(/"/g, '""')}"`,
      `"${(a.namaAset + (a.keterangan ? ' - ' + a.keterangan : '')).replace(/"/g, '""')}"`,
      `"${a.dicatatOleh}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [trxHeaders.join(','), ...trxRows.map((e) => e.join(',')), ...assetRows.map((e) => e.join(','))].join('\n');
    const trackedName = generateLeakageTrackedFileName({
      actorNrp: currentUser.nrp,
      ownerNrp: 'EXPORT-FINANCE',
      preset: 'EXPORT',
      extension: 'csv',
      extraEntropy: `${filteredTransactions.length}-${filteredAssets.length}-${periodMode}`,
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', trackedName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exclude behind-the-scenes Superadmin from alumni lists
  const alumniMembers = members.filter(
    (m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
  );

  // Chronic ill members linked from Modul 4
  const chronicIllMembers = alumniMembers.filter(
    (m) => m.adaPenyakitKronis === 'ADA' || m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT'
  );

  // Education burden linked from Modul 2
  const collegeChildren = alumniMembers.flatMap((m) =>
    (m.daftarAnak || [])
      .filter((a) => a.status === 'PELAJAR')
      .map((a) => ({
        ...a,
        namaOrangTua: m.namaLengkap,
        pangkatOrangTua: m.pangkat,
        poldaOrangTua: m.polda,
      }))
  );

  const filteredMemberOptions = alumniMembers.filter((m) => {
    const st = m.statusKedinasan || m.statusDinas || 'AKTIF';
    if (st !== 'AKTIF' || NON_AKTIF_IURAN_NRPS.has(m.nrp)) return false;
    return (
      !memberSearchQuery.trim() ||
      m.namaLengkap.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.nrp.includes(memberSearchQuery.trim())
    );
  });

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-4 sm:p-5 rounded-2xl border border-emerald-700/40 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
            <Wallet className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 relative">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                Dana Sosial &amp; Investasi
              </h2>
              <button
                type="button"
                onClick={() => setActiveTooltip((v) => (v === 'header' ? null : 'header'))}
                onMouseEnter={() => setActiveTooltip('header')}
                onMouseLeave={() => setActiveTooltip((v) => (v === 'header' ? null : v))}
                className="w-5 h-5 rounded-full bg-white/15 hover:bg-amber-400 hover:text-slate-950 text-amber-300 inline-flex items-center justify-center cursor-pointer text-[11px] font-bold shrink-0 transition-all"
                aria-label="Info Dana Sosial & Investasi"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {activeTooltip === 'header' && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-xl bg-slate-950/95 text-slate-100 text-[11px] leading-relaxed border border-amber-500/40 shadow-2xl z-50">
                  <div className="font-bold text-amber-300 mb-1 flex items-center justify-between">
                    <span>Panduan Kas &amp; Aset WS96</span>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-slate-200">
                    <li>&bull; <b>1. Dana Sosial:</b> Milestone sukarela (Anak Yatim, Anggota Sakit, Dana Duka, Event).</li>
                    <li>&bull; <b>2. Dana Investasi:</b> Penempatan Rupiah pada instrumen investasi/aset.</li>
                    <li>&bull; <b>Buku Kas:</b> Terbagi 2 (Kas Dana Sosial &amp; Kas Dana Investasi).</li>
                  </ul>
                </div>
              )}
            </div>
            <p className="text-[11px] text-emerald-200/80 truncate">
              Milestone Sosial &bull; Dana Investasi &bull; Buku Kas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          {canInputKas ? (
            <>
              <button
                onClick={() => handleOpenCreateCampaign('EVENT_BAKSOS')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
                title="Buat Program / Milestone Dana Sosial Baru"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Milestone
              </button>
              <button
                onClick={() => setIsAssetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
                title="Catat Dana Investasi Baru"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Investasi
              </button>
              <button
                onClick={() => handleOpenMutasiModal('MASUK')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
                title="Catat Mutasi Buku Kas"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Buku Kas
              </button>
              <button
                onClick={handleOpenConfigModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs border border-amber-400/30 transition-all whitespace-nowrap cursor-pointer"
                title="Pengaturan Sub-Kategori Buku Kas"
              >
                <Settings className="w-3.5 h-3.5" />
                Kategori
              </button>
            </>
          ) : (
            <div
              className="relative inline-flex items-center gap-1.5"
              onMouseEnter={() => setShowReadOnlyInfo(true)}
              onMouseLeave={() => setShowReadOnlyInfo(false)}
            >
              <span className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 border border-white/15">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                Mode Lihat Saja
              </span>
              <button
                type="button"
                onClick={() => setShowReadOnlyInfo((v) => !v)}
                aria-label="Informasi Hak Akses Kebendaharaan"
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-amber-400 hover:text-slate-950 text-amber-300 flex items-center justify-center border border-white/20 transition-all"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              {showReadOnlyInfo && (
                <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-xl bg-slate-950/95 text-slate-100 text-[11px] leading-relaxed border border-amber-500/40 shadow-2xl z-40">
                  <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Akses Kebendaharaan
                  </div>
                  Pengelolaan dana sosial, dana investasi, dan buku kas dikelola oleh{' '}
                  <b className="text-emerald-300">Bendahara</b>.
                </div>
              )}
            </div>
          )}

          {canRekap && (
            <button
              onClick={handleExportFinanceCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/25 transition-all whitespace-nowrap cursor-pointer"
              title="Unduh Rekap Buku Kas & Dana Investasi (CSV)"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter Periode Kas & Investasi Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 relative">
            <span className="p-2 rounded-xl bg-slate-900 text-amber-300 shrink-0">
              <Calendar className="w-4 h-4" />
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-slate-900">Periode</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                {activePeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => setActiveTooltip((v) => (v === 'periode' ? null : 'periode'))}
                onMouseEnter={() => setActiveTooltip('periode')}
                onMouseLeave={() => setActiveTooltip((v) => (v === 'periode' ? null : v))}
                className="w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 inline-flex items-center justify-center cursor-pointer"
                aria-label="Info Filter Periode"
              >
                <Info className="w-3 h-3" />
              </button>
              {activeTooltip === 'periode' && (
                <div className="absolute left-0 top-full mt-1.5 w-64 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] leading-relaxed shadow-xl z-40">
                  Menampilkan <b>{periodFilteredTransactions.length}</b> transaksi buku kas &amp;{' '}
                  <b>{periodFilteredAssets.length}</b> instrumen dana investasi pada periode ini.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'SEMUA', label: 'Semua' },
                { id: 'BULAN_INI', label: 'Bulan Ini' },
                { id: 'TRIWULAN_INI', label: '3 Bulan' },
                { id: 'TAHUN_INI', label: 'Tahun Ini' },
                { id: 'PILIH_BULAN', label: 'Pilih Bulan' },
                { id: 'RENTANG_TANGGAL', label: 'Rentang' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodMode(opt.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                  periodMode === opt.id
                    ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {periodMode !== 'SEMUA' && (
              <button
                type="button"
                onClick={() => {
                  setPeriodMode('SEMUA');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 inline-flex items-center gap-1 transition-all cursor-pointer"
                title="Reset Filter Periode"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Sub-controls for PILIH_BULAN */}
        {periodMode === 'PILIH_BULAN' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">Bulan:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
              >
                {NAMA_BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">Tahun:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Sub-controls for RENTANG_TANGGAL */}
        {periodMode === 'RENTANG_TANGGAL' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">Dari Tanggal:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">Sampai Tanggal:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
              />
            </div>

            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100"
              >
                Kosongkan Tanggal
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top KPI Cards — 1. Dana Sosial • 2. Dana Investasi • Buku Kas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Dana Sosial & Milestone */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-emerald-950">1. Dana Sosial (Milestone)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
              {milestoneOverallPct}% Tercapai
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-900 block">
              {formatRupiah(totalTerkumpulMilestone)}
            </span>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all ws96-progress-fill"
                style={{ width: `${Math.max(milestoneOverallPct, totalTerkumpulMilestone > 0 ? 4 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>Target: <b>{formatRupiah(totalTargetMilestone)}</b></span>
              <span className="text-emerald-700 font-bold">Salur: {formatRupiah(totalDisalurkanMilestone)}</span>
            </div>
          </div>
        </div>

        {/* 2. Dana Investasi (Simpel dalam Rupiah untuk Investasi/Aset) */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-blue-950">2. Dana Investasi</span>
            <span className="p-1.5 rounded-xl bg-blue-100 text-blue-800">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 block">
              {formatRupiah(totalValuasiAset)}
            </span>
            <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] text-slate-600">
              <span>Instrumen / Aset Investasi:</span>
              <b className="text-blue-800">{periodFilteredAssets.length} Instrumen</b>
            </div>
          </div>
        </div>

        {/* 3. Saldo Buku Kas (Terbagi 2: Kas Sosial & Kas Investasi) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700">Saldo Buku Kas</span>
            <span className="p-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block">
              {formatRupiah(effectiveSaldoKas)}
            </span>
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>Kas Dana Sosial:</span>
                <b className="text-emerald-700">{formatRupiah(saldoKasSosial)}</b>
              </div>
              <div className="flex justify-between">
                <span>Kas Dana Investasi:</span>
                <b className="text-blue-700">{formatRupiah(saldoKasInvestasi)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Arus Buku Kas (Inflow & Outflow) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50/30 via-white to-red-50/20 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700">Arus Buku Kas</span>
            <div className="flex items-center gap-1">
              <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700" title="Total Kas Masuk">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
              <span className="p-1 rounded-lg bg-red-100 text-red-700" title="Total Kas Keluar">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/70 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-emerald-800">Kas Masuk</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700">
                + {formatRupiah(totalKasMasuk)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-red-50/80 border border-red-200/70 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-red-800">Kas Keluar</span>
              <span className="text-xs sm:text-sm font-black text-red-600">
                - {formatRupiah(totalKasKeluar)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-1.5 sm:gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('milestone')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'milestone'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>🎯</span>
            1. Dana Sosial ({campaigns.length})
          </button>

          <button
            onClick={() => setActiveTab('aset')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'aset'
                ? 'bg-blue-800 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Coins className="w-4 h-4" />
            2. Dana Investasi ({filteredAssets.length})
          </button>

          <button
            onClick={() => setActiveTab('bukuKas')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'bukuKas'
                ? 'bg-slate-900 text-amber-300 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Buku Kas ({filteredTransactions.length})
          </button>

          <button
            onClick={() => setActiveTab('santunan')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'santunan'
                ? 'bg-red-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Heart className="w-4 h-4" />
            Atensi Sakit ({chronicIllMembers.length})
          </button>

          <button
            onClick={() => setActiveTab('pendidikan')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'pendidikan'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Anak Yatim ({collegeChildren.length})
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 0: PROGRAM DANA SOSIAL & MILESTONE EVENT (KITABISA/SAWERIA) */}
        {/* ============================================================== */}
        {activeTab === 'milestone' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-amber-50/40 border border-emerald-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap relative">
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  Milestone Sosial
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Program &amp; Milestone Dana Sosial WS96
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTooltip((v) => (v === 'milestone' ? null : 'milestone'))}
                  onMouseEnter={() => setActiveTooltip('milestone')}
                  onMouseLeave={() => setActiveTooltip((v) => (v === 'milestone' ? null : v))}
                  className="w-4 h-4 rounded-full bg-emerald-700/15 hover:bg-emerald-700 text-emerald-800 hover:text-white inline-flex items-center justify-center cursor-pointer transition-all"
                  aria-label="Info Milestone Dana Sosial"
                >
                  <Info className="w-3 h-3" />
                </button>
                {activeTooltip === 'milestone' && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 p-3 rounded-xl bg-slate-900 text-white text-[11px] leading-relaxed shadow-xl z-40">
                    Penggalangan dana sukarela untuk <b>Anak Yatim</b>, <b>Anggota Sakit</b>,{' '}
                    <b>Dana Duka</b>, dan <b>Event/Baksos</b> dengan target milestone fleksibel yang dapat diedit oleh Bendahara.
                  </div>
                )}
              </div>
              {canInputKas && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateCampaign('EVENT_BAKSOS')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                  title="Buat Program / Milestone Dana Sosial Baru"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Buat Milestone
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCampaignFilter('SEMUA')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                  campaignFilter === 'SEMUA'
                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semua ({campaigns.length})
              </button>
              {(['ANAK_YATIM', 'ANGGOTA_SAKIT', 'ANGGOTA_MD', 'EVENT_BAKSOS', 'LAINNYA'] as CampaignCategory[]).map(
                (cat) => {
                  const meta = CAMPAIGN_CATEGORY_META[cat];
                  const count = campaigns.filter((c) => c.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCampaignFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                        campaignFilter === cat
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {meta.icon} {meta.label} ({count})
                    </button>
                  );
                }
              )}
            </div>

            {/* Milestone Cards Grid (Kitabisa / Saweria style) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCampaigns.map((cmp) => {
                const meta = CAMPAIGN_CATEGORY_META[cmp.category] || CAMPAIGN_CATEGORY_META.LAINNYA;
                const pct =
                  cmp.targetAmount > 0
                    ? Math.min(100, Math.round(((Number(cmp.collectedAmount) || 0) / cmp.targetAmount) * 100))
                    : 0;
                const sisaDana = Math.max(0, (Number(cmp.collectedAmount) || 0) - (Number(cmp.disbursedAmount) || 0));

                return (
                  <div
                    key={cmp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${meta.badge}`}>
                            {meta.icon} {meta.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              cmp.status === 'TERCAPAI'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : cmp.status === 'SELESAI'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {cmp.status === 'TERCAPAI'
                              ? '🏆 TERCAPAI'
                              : cmp.status === 'SELESAI'
                              ? 'SELESAI'
                              : '● AKTIF'}
                          </span>
                        </div>
                        {cmp.deadline && (
                          <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                            s/d {formatHumanTimestamp(cmp.deadline)}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900">{cmp.title}</h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2" title={cmp.description}>
                          {cmp.description}
                        </p>
                      </div>

                      {/* Visual Milestone Progress Bar */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Terkumpul
                            </span>
                            <span className="text-lg sm:text-xl font-black text-emerald-800">
                              {formatRupiah(cmp.collectedAmount)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">
                              Target
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                              {formatRupiah(cmp.targetAmount)} ({pct}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full bg-gradient-to-r ${meta.barGradient} rounded-full transition-all duration-500 ws96-progress-fill`}
                            style={{ width: `${Math.max(pct, cmp.collectedAmount > 0 ? 4 : 0)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                          <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                            <span className="text-slate-400 block text-[10px]">Donatur</span>
                            <span className="font-extrabold text-slate-800">{cmp.donorCount || 0} Orang</span>
                          </div>
                          <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                            <span className="text-slate-400 block text-[10px]">Disalurkan</span>
                            <span className="font-extrabold text-red-700">{formatRupiah(cmp.disbursedAmount || 0)}</span>
                          </div>
                          <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                            <span className="text-slate-400 block text-[10px]">Siap Salur</span>
                            <span className="font-extrabold text-emerald-700">{formatRupiah(sisaDana)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {canInputKas && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenMilestoneAction(cmp, 'DONASI')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            title="Catat Donasi Masuk ke Milestone"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Donasi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMilestoneAction(cmp, 'SALURKAN')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            title="Salurkan Dana dari Milestone"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            Salurkan
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditCampaign(cmp)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                          title="Edit Target / Detail Milestone"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BUKU KAS (TERBAGI 2: DANA SOSIAL & DANA INVESTASI)      */}
        {/* ============================================================== */}
        {activeTab === 'bukuKas' && (
          <div className="p-5 sm:p-6 space-y-4">
            {/* PILIHAN SUB-BUKU KAS: 1. DANA SOSIAL vs 2. DANA INVESTASI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setKasPilarFilter('SEMUA')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  kasPilarFilter === 'SEMUA'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                    Semua Buku Kas
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    Gabungan
                  </span>
                </div>
                <p className="text-lg font-black mt-1">{formatRupiah(effectiveSaldoKas)}</p>
                <p className="text-[10px] opacity-75 mt-1">
                  Masuk: +{formatRupiah(totalKasMasuk)} &bull; Keluar: -{formatRupiah(totalKasKeluar)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setKasPilarFilter('DANA_SOSIAL')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  kasPilarFilter === 'DANA_SOSIAL'
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-md'
                    : 'bg-emerald-50/60 text-emerald-950 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider">
                    🤲 1. Kas Dana Sosial
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      kasPilarFilter === 'DANA_SOSIAL'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-200/70 text-emerald-900'
                    }`}
                  >
                    Yatim / Sakit / Dana Duka / Event
                  </span>
                </div>
                <p className="text-lg font-black mt-1">{formatRupiah(saldoKasSosial)}</p>
                <p className="text-[10px] opacity-80 mt-1">
                  Masuk: +{formatRupiah(kasSosialMasuk)} &bull; Keluar: -{formatRupiah(kasSosialKeluar)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setKasPilarFilter('DANA_INVESTASI')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  kasPilarFilter === 'DANA_INVESTASI'
                    ? 'bg-blue-800 text-white border-blue-800 shadow-md'
                    : 'bg-blue-50/60 text-blue-950 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider">
                    📈 2. Kas Dana Investasi
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      kasPilarFilter === 'DANA_INVESTASI'
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-200/70 text-blue-900'
                    }`}
                  >
                    Investasi &amp; Aset
                  </span>
                </div>
                <p className="text-lg font-black mt-1">{formatRupiah(saldoKasInvestasi)}</p>
                <p className="text-[10px] opacity-80 mt-1">
                  Masuk: +{formatRupiah(kasInvestasiMasuk)} &bull; Keluar: -{formatRupiah(kasInvestasiKeluar)}
                </p>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari transaksi, kategori, keterangan, no ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-semibold">Arus:</span>
                  {(['SEMUA', 'MASUK', 'KELUAR'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        selectedFilter === filter
                          ? filter === 'MASUK'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : filter === 'KELUAR'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {filter === 'MASUK' ? 'Masuk' : filter === 'KELUAR' ? 'Keluar' : 'Semua'}
                    </button>
                  ))}
                </div>

                {canInputKas && (
                  <button
                    onClick={() => handleOpenMutasiModal('MASUK')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                    title="Catat Mutasi Buku Kas"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Catat Kas
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tanggal &amp; Ref</th>
                    <th className="px-4 py-3">Pilar Buku Kas &amp; Kategori</th>
                    <th className="px-4 py-3">Keterangan &amp; Pihak Terkait</th>
                    <th className="px-4 py-3 text-right">Nominal (IDR)</th>
                    <th className="px-4 py-3">Dicatat Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((trx) => {
                    const isInvest = isInvestmentTransaction(trx.kategori);
                    return (
                      <tr key={trx.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 block">{formatHumanTimestamp(trx.tanggal)}</span>
                          <span className="text-[10px] font-mono text-slate-400">{trx.nomorReferensi}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                isInvest
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {isInvest ? '📈 DANA INVESTASI' : '🤲 DANA SOSIAL'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                trx.jenis === 'MASUK'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {trx.jenis === 'MASUK' ? 'MASUK' : 'KELUAR'}
                            </span>
                            <span className="text-slate-800 font-bold text-[11px]">
                              {getCategoryLabel(trx.kategori)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <span className="font-medium text-slate-900 block">{trx.keterangan}</span>
                          {trx.pihakTerkait && trx.pihakTerkait !== '-' && (
                            <span className="text-[11px] text-blue-700 font-semibold">
                              Terkait: {trx.pihakTerkait} {trx.nrpTerkait ? `(NRP ${trx.nrpTerkait})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span
                            className={`font-black text-sm ${
                              trx.jenis === 'MASUK' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {trx.jenis === 'MASUK' ? '+' : '-'} {formatRupiah(trx.nominal)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                          {trx.dicatatOleh}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Belum ada transaksi Buku Kas pada filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: DANA INVESTASI (SIMPLE — RUPIAH UNTUK INVESTASI APA)    */}
        {/* ============================================================== */}
        {activeTab === 'aset' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap relative">
                <span className="px-2 py-0.5 rounded bg-blue-800 text-white text-[10px] font-extrabold uppercase">
                  Dana Investasi
                </span>
                <h4 className="text-xs sm:text-sm font-extrabold text-blue-950">
                  Rekapan Dana Investasi &amp; Aset (Rupiah)
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTooltip((v) => (v === 'investasi' ? null : 'investasi'))}
                  onMouseEnter={() => setActiveTooltip('investasi')}
                  onMouseLeave={() => setActiveTooltip((v) => (v === 'investasi' ? null : v))}
                  className="w-4 h-4 rounded-full bg-blue-800/15 hover:bg-blue-800 text-blue-900 hover:text-white inline-flex items-center justify-center cursor-pointer transition-all"
                  aria-label="Info Dana Investasi"
                >
                  <Info className="w-3 h-3" />
                </button>
                {activeTooltip === 'investasi' && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 p-3 rounded-xl bg-slate-900 text-white text-[11px] leading-relaxed shadow-xl z-40">
                    Daftar penempatan Dana Investasi Wira Satya 96 dalam Rupiah beserta instrumen/aset, pengelola, dan valuasi saat ini.
                  </div>
                )}
              </div>
              {canInputKas && (
                <button
                  onClick={() => setIsAssetModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
                  title="Catat Dana Investasi Baru"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Catat Investasi
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setAssetCategoryFilter('SEMUA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                  assetCategoryFilter === 'SEMUA'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semua ({localAssets.length})
              </button>
              {(['SURAT_BERHARGA', 'VALUTA_ASING', 'CRYPTO', 'LOGAM_MULIA_ASET'] as AssetCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAssetCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                    assetCategoryFilter === cat
                      ? 'bg-blue-800 text-white border-blue-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {ASSET_CATEGORY_LABELS[cat].label} ({localAssets.filter((a) => a.kategori === cat).length})
                </button>
              ))}
            </div>

            {/* Unified Simple Dana Investasi Table */}
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tanggal &amp; Kode</th>
                    <th className="px-4 py-3">Instrumen / Aset Investasi</th>
                    <th className="px-4 py-3">Pengelola / Keterangan</th>
                    <th className="px-4 py-3 text-right">Modal Awal (Rp)</th>
                    <th className="px-4 py-3 text-right">Nilai Saat Ini (Rp)</th>
                    {canInputKas && <th className="px-4 py-3 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((ast) => {
                    const selisih = (ast.estimasiNilaiIdr || 0) - (ast.nilaiPerolehanIdr || 0);
                    return (
                      <tr key={ast.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 block">{ast.kodeAset}</span>
                          <span className="text-[10px] text-slate-400">{formatHumanTimestamp(ast.tanggalPerolehan)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block text-xs sm:text-sm">{ast.namaAset}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${
                                ASSET_CATEGORY_LABELS[ast.kategori]?.badge || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ASSET_CATEGORY_LABELS[ast.kategori]?.label || ast.kategori}
                            </span>
                            {ast.jumlahUnit > 0 && (
                              <span className="text-[11px] font-bold text-slate-600">
                                ({ast.jumlahUnit} {ast.satuan})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 block">{ast.kustodianLokasi}</span>
                          {ast.keterangan && (
                            <span className="block text-[11px] text-slate-500 mt-0.5">{ast.keterangan}</span>
                          )}
                          {ast.nomorSeriAtauWallet && ast.nomorSeriAtauWallet !== '-' && (
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              Ref: {ast.nomorSeriAtauWallet}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-slate-700">
                          {formatRupiah(ast.nilaiPerolehanIdr)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="font-black text-blue-900 text-sm block">
                            {formatRupiah(ast.estimasiNilaiIdr)}
                          </span>
                          {selisih !== 0 && (
                            <span
                              className={`text-[10px] font-bold ${
                                selisih > 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {selisih > 0 ? '+' : ''}
                              {formatRupiah(selisih)}
                            </span>
                          )}
                        </td>
                        {canInputKas && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveAsset(ast.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Hapus Item Dana Investasi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={canInputKas ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                        Belum ada item Dana Investasi yang tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: SANTUNAN KESEHATAN                                      */}
        {/* ============================================================== */}
        {activeTab === 'santunan' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
              <span className="font-bold">❤️ Santunan Medis:</span> Daftar personel yang membutuhkan atensi medis dan alokasi santunan dari kas.
            </div>

            {chronicIllMembers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chronicIllMembers.map((m) => (
                  <div key={m.id} className="p-5 rounded-xl border border-red-200 bg-white shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
                          {formatHumanEnum(m.kondisiKesehatan)}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{m.namaLengkap}</h4>
                        <p className="text-xs text-slate-500">
                          {m.pangkat} — {m.polda}
                        </p>
                      </div>

                      {canInputKas && (
                        <button
                          onClick={() => {
                            setTrxJenis('KELUAR');
                            setTrxKategori('SANTUNAN_KESEHATAN');
                            setTrxNominal(10000000);
                            setTrxTanggal(new Date().toISOString().split('T')[0]);
                            setTrxReferensi('WS96-SNT-' + Date.now().toString().slice(-4));
                            setTrxPihak(m.namaLengkap);
                            setTrxNrp(m.nrp);
                            setTrxKeterangan(
                              `Penyaluran santunan kesehatan untuk ${m.namaLengkap} (${formatHumanDiseaseList(m.daftarPenyakit) || 'Medis'})`
                            );
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                          Salurkan Santunan
                        </button>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <span className="text-slate-500 font-semibold block">Diagnosa Medis:</span>
                      <div className="flex flex-wrap gap-1">
                        {m.daftarPenyakit?.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-medium">
                            {formatHumanDiseaseList([p], { includeSince: true }) || p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 border border-slate-200 rounded-xl">
                Tidak ada personel yang terdaftar membutuhkan atensi medis khusus saat ini.
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: BEBAN PENDIDIKAN PUTRA/PUTRI                            */}
        {/* ============================================================== */}
        {activeTab === 'pendidikan' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-purple-800 block">Total Anak Pelajar / Kuliah</span>
                <span className="text-2xl font-black text-purple-900 mt-1 block">{collegeChildren.length} Anak</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-amber-800 block">Biaya Tinggi (&gt; 25jt/thn)</span>
                <span className="text-2xl font-black text-amber-900 mt-1 block">
                  {collegeChildren.filter((c) => c.biayaPendidikanTahunan === '> 25.000.000').length} Anak
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <span className="text-xs font-bold text-blue-800 block">Biaya Menengah (5-25jt/thn)</span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">
                  {collegeChildren.filter((c) => c.biayaPendidikanTahunan === '5.000.000 S.D. 25.000.000').length} Anak
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Putra / Putri</th>
                    <th className="px-4 py-3">Orang Tua (Personel)</th>
                    <th className="px-4 py-3">Penempatan</th>
                    <th className="px-4 py-3">Estimasi Biaya Tahunan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collegeChildren.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{c.nama || `Anak Pelajar (${idx + 1})`}</td>
                      <td className="px-4 py-3 text-slate-800">{c.namaOrangTua}</td>
                      <td className="px-4 py-3 text-slate-500">{c.poldaOrangTua}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">
                          {formatHumanEnum(c.biayaPendidikanTahunan || '5.000.000 S.D. 25.000.000')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {collegeChildren.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Belum ada data tanggungan pendidikan anak yang diinputkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: CASCADING CASHFLOW INPUT (CATAT MUTASI KAS)           */}
      {/* ============================================================== */}
      {isModalOpen && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  Catat Mutasi Kas &amp; Cashflow (Otoritas Bendahara / Superadmin)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pilih arah arus kas terlebih dahulu, lalu tentukan sub-kategori dan nominal.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 space-y-4 text-xs">
              {/* STEP 1: PILIH JENIS TRANSAKSI CASHFLOW */}
              <div className="space-y-1.5">
                <label className="block font-extrabold text-slate-800 uppercase tracking-wide text-[11px]">
                  Step 1: Pilih Jenis Transaksi Cashflow
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTrxJenis('MASUK');
                      const firstMasuk = financeConfig.subKategoriMasuk[0]?.code || 'IURAN_WAJIB_BULANAN';
                      setTrxKategori(firstMasuk);
                      if (firstMasuk === 'IURAN_WAJIB_BULANAN') {
                        setTrxNominal(financeConfig.iuranWajibPerBulan * jumlahBulanIuran);
                      }
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex items-center gap-2.5 ${
                      trxJenis === 'MASUK'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`p-2 rounded-lg ${
                        trxJenis === 'MASUK' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="font-black block text-xs">SALDO MASUK / PENERIMAAN</span>
                      <span className="text-[10px] opacity-80 block">Penerimaan Kas &amp; Iuran</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTrxJenis('KELUAR');
                      const firstKeluar = financeConfig.subKategoriKeluar[0]?.code || 'SANTUNAN_KESEHATAN';
                      setTrxKategori(firstKeluar);
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex items-center gap-2.5 ${
                      trxJenis === 'KELUAR'
                        ? 'border-red-600 bg-red-50 text-red-950 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`p-2 rounded-lg ${
                        trxJenis === 'KELUAR' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="font-black block text-xs">SALDO KELUAR / PENGELUARAN</span>
                      <span className="text-[10px] opacity-80 block">Pengeluaran &amp; Santunan</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: PILIH SUB-KATEGORI CASHFLOW (DYNAMICALLY FILTERED BY STEP 1) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-800 uppercase tracking-wide text-[11px]">
                    Step 2: Pilih Sub-Kategori Cashflow ({trxJenis === 'MASUK' ? 'PENERIMAAN' : 'PENGELUARAN'})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleOpenConfigModal();
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 underline"
                  >
                    Kelola Kategori
                  </button>
                </div>

                <select
                  value={trxKategori}
                  onChange={(e) => {
                    const nextCode = e.target.value;
                    setTrxKategori(nextCode);
                    if (trxJenis === 'MASUK' && nextCode === 'IURAN_WAJIB_BULANAN') {
                      setTrxNominal(financeConfig.iuranWajibPerBulan * jumlahBulanIuran);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-slate-50/70 focus:ring-2 focus:ring-slate-900"
                >
                  {(trxJenis === 'MASUK' ? financeConfig.subKategoriMasuk : financeConfig.subKategoriKeluar).map(
                    (opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    )
                  )}
                </select>

                {/* Special Iuran Wajib Bulanan Synchronizer Box */}
                {trxJenis === 'MASUK' && trxKategori === 'IURAN_WAJIB_BULANAN' && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-950 text-[11px]">
                        🔄 Sinkronisasi Otomatis Buku Iuran Personel (Opsional)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        Tarif: {formatRupiah(financeConfig.iuranWajibPerBulan)} / bln
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                          Cari / Pilih Personel Penyetor
                        </label>
                        <input
                          type="text"
                          placeholder="Ketik nama atau NRP..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs mb-1.5"
                        />
                        <select
                          value={trxNrp}
                          onChange={(e) => {
                            const selectedNrp = e.target.value;
                            setTrxNrp(selectedNrp);
                            const found = members.find((m) => m.nrp === selectedNrp);
                            if (found) {
                              setTrxPihak(found.namaLengkap);
                              setTrxKeterangan(
                                `Pembayaran Iuran Wajib Bulanan (${jumlahBulanIuran} bulan) oleh ${found.namaLengkap}`
                              );
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-semibold text-xs"
                        >
                          <option value="">-- Pilih Personel (Atau Isi Manual) --</option>
                          {filteredMemberOptions.slice(0, 300).map((m) => (
                            <option key={m.nrp} value={m.nrp}>
                              {m.namaLengkap} ({m.nrp})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                          Jumlah Bulan Iuran
                        </label>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {[1, 3, 6, 12].map((bln) => (
                            <button
                              key={bln}
                              type="button"
                              onClick={() => {
                                setJumlahBulanIuran(bln);
                                setTrxNominal(financeConfig.iuranWajibPerBulan * bln);
                                if (trxPihak) {
                                  setTrxKeterangan(`Pembayaran Iuran Wajib Bulanan (${bln} bulan) oleh ${trxPihak}`);
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border transition-all ${
                                jumlahBulanIuran === bln
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              {bln} Bln
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={jumlahBulanIuran}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setJumlahBulanIuran(val);
                            setTrxNominal(financeConfig.iuranWajibPerBulan * val);
                            if (trxPihak) {
                              setTrxKeterangan(`Pembayaran Iuran Wajib Bulanan (${val} bulan) oleh ${trxPihak}`);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: NOMINAL, TANGGAL, PIHAK TERKAIT & KETERANGAN */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="block font-extrabold text-slate-800 uppercase tracking-wide text-[11px]">
                  Step 3: Nominal (Rp), Tanggal, Pihak Terkait &amp; Keterangan
                </label>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-700">Nominal Transaksi (Rupiah)</span>
                    <span className="text-[11px] font-extrabold text-emerald-700">
                      {formatRupiah(trxNominal)}
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={trxNominal}
                    onChange={(e) => setTrxNominal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-black text-slate-900"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {[
                      financeConfig.iuranWajibPerBulan,
                      financeConfig.iuranWajibPerBulan * 6,
                      financeConfig.iuranWajibPerBulan * 12,
                      5000000,
                      10000000,
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTrxNominal(preset)}
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px]"
                      >
                        {formatRupiah(preset)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tanggal Transaksi</label>
                    <input
                      type="date"
                      required
                      value={trxTanggal}
                      onChange={(e) => setTrxTanggal(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor Referensi Bukti</label>
                    <input
                      type="text"
                      placeholder="WS96-KAS-..."
                      value={trxReferensi}
                      onChange={(e) => setTrxReferensi(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Pihak / Personel Terkait</label>
                    <input
                      type="text"
                      placeholder="Contoh: Nama Personel / Bank / Vendor"
                      value={trxPihak}
                      onChange={(e) => setTrxPihak(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NRP Terkait (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 74090001"
                      value={trxNrp}
                      onChange={(e) => setTrxNrp(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Keterangan / Referensi</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Rincian lengkap sumber penerimaan atau keperluan pengeluaran kas..."
                    value={trxKeterangan}
                    onChange={(e) => setTrxKeterangan(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-lg text-white font-bold shadow-md transition-colors ${
                    trxJenis === 'MASUK'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Simpan {trxJenis === 'MASUK' ? 'Saldo Masuk' : 'Saldo Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: CATAT DANA INVESTASI BARU (BENDAHARA & SUPERADMIN)    */}
      {/* ============================================================== */}
      {isAssetModalOpen && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-blue-900 p-4 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-300" />
                Catat Dana Investasi (Rupiah — Investasi di Apa / Aset Apa)
              </h3>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Instrumen / Aset</label>
                  <select
                    value={astKategori}
                    onChange={(e) => {
                      const nextCat = e.target.value as AssetCategory;
                      setAstKategori(nextCat);
                      setAstSatuan(ASSET_CATEGORY_LABELS[nextCat].defaultSatuan);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-blue-950"
                  >
                    <option value="SURAT_BERHARGA">Deposito / SBN / Usaha Bersama</option>
                    <option value="LOGAM_MULIA_ASET">Logam Mulia / Emas / Aset Riil</option>
                    <option value="VALUTA_ASING">Valuta Asing (USD / SGD / EUR)</option>
                    <option value="CRYPTO">Aset Digital / Crypto (BTC / USDT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Unit (Opsional)</label>
                  <select
                    value={astSatuan}
                    onChange={(e) => setAstSatuan(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  >
                    {SATUAN_OPTIONS_BY_CATEGORY[astKategori].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Investasi di Apa / Nama Aset</label>
                <input
                  type="text"
                  required
                  placeholder={ASSET_CATEGORY_LABELS[astKategori].placeholderNama}
                  value={astNama}
                  onChange={(e) => setAstNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah ({astSatuan})</label>
                  <input
                    type="number"
                    required
                    step="any"
                    min={0.0001}
                    value={astJumlah}
                    onChange={(e) => setAstJumlah(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dana Investasi Awal (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={astNilaiBeli}
                    onChange={(e) => setAstNilaiBeli(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nilai Saat Ini (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={astEstimasiIdr}
                    onChange={(e) => setAstEstimasiIdr(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pengelola / Bank / Kustodian</label>
                  <input
                    type="text"
                    required
                    placeholder={ASSET_CATEGORY_LABELS[astKategori].placeholderKustodian}
                    value={astKustodian}
                    onChange={(e) => setAstKustodian(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Bilyet / Ref (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Opsional (No. Seri / Ref)"
                    value={astNomorSeri}
                    onChange={(e) => setAstNomorSeri(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Anggota yang Ikut (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Jatuh tempo Oktober 2027 / Kupon 6.25% p.a. / Peserta sukarela"
                  value={astKeterangan}
                  onChange={(e) => setAstKeterangan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold shadow-md transition-colors"
                >
                  Simpan Dana Investasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3A: BUAT / EDIT PROGRAM MILESTONE DANA SOSIAL            */}
      {/* ============================================================== */}
      {isCampaignModalOpen && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-emerald-950 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>🎯</span>
                  {editingCampaignId ? 'Edit Program / Milestone Dana Sosial' : 'Buat Program / Milestone Baru'}
                </h3>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Atur judul, kategori, target milestone (Rp), dana terkumpul, dan status program.
                </p>
              </div>
              <button onClick={() => setIsCampaignModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Program</label>
                  <select
                    value={cmpCategory}
                    onChange={(e) => setCmpCategory(e.target.value as CampaignCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                  >
                    <option value="ANAK_YATIM">🤲 Anak Yatim</option>
                    <option value="ANGGOTA_SAKIT">🏥 Anggota Sakit</option>
                    <option value="ANGGOTA_MD">🕊️ Dana Duka</option>
                    <option value="EVENT_BAKSOS">🤝 Event &amp; Baksos</option>
                    <option value="LAINNYA">🎯 Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Program</label>
                  <select
                    value={cmpStatus}
                    onChange={(e) => setCmpStatus(e.target.value as 'AKTIF' | 'TERCAPAI' | 'SELESAI')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                  >
                    <option value="AKTIF">● AKTIF MENGGALANG</option>
                    <option value="TERCAPAI">🏆 MILESTONE TERCAPAI</option>
                    <option value="SELESAI">SELESAI / DITUTUP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Program / Event Penggalangan Dana</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Santunan Anak Yatim / Bantuan Medis / Milestone Baksos WS96"
                  value={cmpTitle}
                  onChange={(e) => setCmpTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Target Milestone (Rp) — {formatRupiah(cmpTarget)}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={cmpTarget}
                    onChange={(e) => setCmpTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-emerald-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Tanggal / Batas Waktu</label>
                  <input
                    type="date"
                    value={cmpDeadline}
                    onChange={(e) => setCmpDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Dana Terkumpul (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cmpCollected}
                    onChange={(e) => setCmpCollected(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Telah Disalurkan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={cmpDisbursed}
                    onChange={(e) => setCmpDisbursed(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Jumlah Donatur</label>
                  <input
                    type="number"
                    min={0}
                    value={cmpDonors}
                    onChange={(e) => setCmpDonors(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi &amp; Tujuan Penggalangan Dana</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan peruntukan dana sosial atau milestone event ini..."
                  value={cmpDesc}
                  onChange={(e) => setCmpDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingCampaignId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(editingCampaignId)}
                    className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Program
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCampaignModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md"
                  >
                    Simpan Milestone
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3B: CATAT DONASI / SALURKAN DANA PADA MILESTONE          */}
      {/* ============================================================== */}
      {milestoneActionModal && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div
              className={`p-4 text-white flex items-center justify-between ${
                milestoneActionModal.mode === 'DONASI' ? 'bg-emerald-800' : 'bg-amber-600 text-slate-950'
              }`}
            >
              <div>
                <h3 className="text-sm font-extrabold">
                  {milestoneActionModal.mode === 'DONASI'
                    ? 'Catat Donasi Masuk ke Milestone'
                    : 'Salurkan Dana dari Milestone'}
                </h3>
                <p className="text-[11px] opacity-85 mt-0.5">{milestoneActionModal.campaign.title}</p>
              </div>
              <button onClick={() => setMilestoneActionModal(null)} className="opacity-80 hover:opacity-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMilestoneAction} className="p-5 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Nominal (Rupiah)</label>
                  <span className="font-extrabold text-emerald-700">{formatRupiah(mlsNominal)}</span>
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={mlsNominal}
                  onChange={(e) => setMlsNominal(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-black text-slate-900"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[500000, 1000000, 2500000, 5000000, 10000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMlsNominal(preset)}
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px]"
                    >
                      {formatRupiah(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {milestoneActionModal.mode === 'DONASI'
                    ? 'Pilih Anggota Donatur (Atau Ketik Nama)'
                    : 'Nama Penerima Manfaat / Tujuan Penyaluran'}
                </label>
                <input
                  type="text"
                  placeholder="Cari nama personel / NRP..."
                  value={mlsMemberQuery}
                  onChange={(e) => setMlsMemberQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs mb-1.5"
                />
                <select
                  value={mlsNrp}
                  onChange={(e) => {
                    const nrp = e.target.value;
                    setMlsNrp(nrp);
                    const found = alumniMembers.find((m) => m.nrp === nrp);
                    if (found) {
                      setMlsPihak(found.namaLengkap);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold mb-2"
                >
                  <option value="">-- Pilih dari Direktori WS96 (Opsional) --</option>
                  {alumniMembers
                    .filter(
                      (m) =>
                        !mlsMemberQuery.trim() ||
                        m.namaLengkap.toLowerCase().includes(mlsMemberQuery.toLowerCase()) ||
                        m.nrp.includes(mlsMemberQuery.trim())
                    )
                    .slice(0, 200)
                    .map((m) => (
                      <option key={m.nrp} value={m.nrp}>
                        {m.namaLengkap} ({m.nrp})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Nama Donatur / Penerima Manfaat"
                  value={mlsPihak}
                  onChange={(e) => setMlsPihak(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan (Otomatis Tercatat di Buku Kas)</label>
                <textarea
                  rows={2}
                  required
                  value={mlsKeterangan}
                  onChange={(e) => setMlsKeterangan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMilestoneActionModal(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-lg font-extrabold shadow-md ${
                    milestoneActionModal.mode === 'DONASI'
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  }`}
                >
                  Simpan &amp; Sinkron Buku Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3C: CATAT PARTISIPAN DANA INVESTASI (BAGI YANG MAU IKUT) */}
      {/* ============================================================== */}
      {isInvestModalOpen && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-indigo-950 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-300" />
                  {editingInvestId
                    ? 'Edit Partisipan Dana Investasi'
                    : 'Catat Partisipan Dana Investasi (Bagi yang Mau Ikut)'}
                </h3>
                <p className="text-[11px] text-indigo-200/80 mt-0.5">
                  Kepesertaan bersifat sukarela bagi rekan leting yang berminat ikut serta.
                </p>
              </div>
              <button onClick={() => setIsInvestModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvestment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cari &amp; Pilih Anggota yang Ikut Investasi</label>
                <input
                  type="text"
                  placeholder="Ketik nama atau NRP untuk memfilter daftar..."
                  value={invMemberQuery}
                  onChange={(e) => setInvMemberQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs mb-1.5"
                />
                <select
                  value={invNrp}
                  onChange={(e) => {
                    const selectedNrp = e.target.value;
                    setInvNrp(selectedNrp);
                    const found = alumniMembers.find((m) => m.nrp === selectedNrp);
                    if (found) {
                      setInvNama(found.namaLengkap);
                      setInvPangkat(found.pangkat);
                      setInvPolda(found.polda);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  <option value="">-- Pilih dari Direktori Personel WS96 --</option>
                  {alumniMembers
                    .filter(
                      (m) =>
                        !invMemberQuery.trim() ||
                        m.namaLengkap.toLowerCase().includes(invMemberQuery.toLowerCase()) ||
                        m.nrp.includes(invMemberQuery.trim())
                    )
                    .slice(0, 250)
                    .map((m) => (
                      <option key={m.nrp} value={m.nrp}>
                        {m.namaLengkap} ({m.pangkat} — {m.polda})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Partisipan</label>
                  <input
                    type="text"
                    required
                    value={invNama}
                    onChange={(e) => setInvNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pangkat</label>
                  <input
                    type="text"
                    value={invPangkat}
                    onChange={(e) => setInvPangkat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Program / Instrumen Investasi</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pool Investasi SBN / Usaha Bersama WS96"
                    value={invProgram}
                    onChange={(e) => setInvProgram(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Bergabung</label>
                  <input
                    type="date"
                    value={invTanggal}
                    onChange={(e) => setInvTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Modal Penyertaan (Rp) — {formatRupiah(invNominal)}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={invNominal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setInvNominal(val);
                      if (!editingInvestId) setInvEstimasi(val);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-indigo-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Estimasi Nilai Saat Ini (Rp) — {formatRupiah(invEstimasi)}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={invEstimasi}
                    onChange={(e) => setInvEstimasi(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-black text-emerald-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan / Keterangan Bagi Hasil (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Penyertaan Tahap I / Bagi hasil per semester"
                  value={invCatatan}
                  onChange={(e) => setInvCatatan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {!editingInvestId && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invRecordToKas}
                    onChange={(e) => setInvRecordToKas(e.target.checked)}
                    className="rounded border-indigo-400 text-indigo-700"
                  />
                  <span className="text-[11px] font-bold text-indigo-950">
                    Catat otomatis setoran modal ini ke Buku Kas Masuk (Kategori: Penyertaan Dana Investasi)
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvestModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold shadow-md"
                >
                  Simpan Partisipan Investasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: PENGATURAN MASTER KATEGORI KAS MASUK & KAS KELUAR     */}
      {/* ============================================================== */}
      {isConfigModalOpen && canInputKas && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber-400" />
                  Pengaturan Master Kategori Kas Masuk &amp; Kas Keluar
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Kelola daftar sub-kategori penerimaan dan penyaluran pada Buku Kas (Dana Sosial &amp; Dana Investasi).
                </p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinanceConfig} className="p-5 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Master Sub-Kategori Saldo Masuk & Saldo Keluar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sub-Kategori Saldo Masuk */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="font-extrabold text-emerald-950 flex items-center justify-between">
                    <span>1. Kategori Kas Masuk</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {draftSubMasuk.length} Kategori
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {draftSubMasuk.map((cat) => (
                      <div
                        key={cat.code}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200/80"
                      >
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">{cat.label}</span>
                          <span className="font-mono text-[9px] text-slate-400">{cat.code}</span>
                        </div>
                        {draftSubMasuk.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubKategori('MASUK', cat.code)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Hapus Sub-Kategori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Tambah sub-kategori masuk..."
                      value={newMasukLabel}
                      onChange={(e) => setNewMasukLabel(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSubKategori('MASUK')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah
                    </button>
                  </div>
                </div>

                {/* Sub-Kategori Saldo Keluar */}
                <div className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3">
                  <div className="font-extrabold text-red-950 flex items-center justify-between">
                    <span>2. Kategori Kas Keluar</span>
                    <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                      {draftSubKeluar.length} Kategori
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {draftSubKeluar.map((cat) => (
                      <div
                        key={cat.code}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-red-200/80"
                      >
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">{cat.label}</span>
                          <span className="font-mono text-[9px] text-slate-400">{cat.code}</span>
                        </div>
                        {draftSubKeluar.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubKategori('KELUAR', cat.code)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Hapus Sub-Kategori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Tambah sub-kategori keluar..."
                      value={newKeluarLabel}
                      onChange={(e) => setNewKeluarLabel(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-red-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSubKategori('KELUAR')}
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-xs inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  Terakhir diperbarui: <b>{financeConfig.updatedBy}</b>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-md transition-colors"
                  >
                    {isSavingConfig ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

