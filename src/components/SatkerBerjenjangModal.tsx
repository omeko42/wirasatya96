'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  DAFTAR_38_POLDA,
  SATKER_MABES_LIST,
  DAFTAR_KEMEN_LEMBAGA,
  STATUS_PURNA_TUGAS_LIST,
  getSubSatkerForMabes,
} from '@/data/polriStructure';
import { Search, X, ChevronDown, ChevronUp, Check } from 'lucide-react';

export interface SatkerSelectionResult {
  polda: string;
  satkerUtama: string;
  subSatker: string;
  composedSatker: string;
  kodeSatker: string;
}

interface SatkerOption {
  label: string;
  value: string;
  code: string;
}

interface SatkerBerjenjangModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPolda?: string;
  initialSatker?: string;
  initialSubSatker?: string;
  onApply: (result: SatkerSelectionResult) => void;
}

// Official-style Polri Satker prefix codes per Tingkat 1
const POLDA_CODE_MAP: Record<string, string> = {
  'MABES POLRI': '060.01.00',
  'POLDA ACEH': '060.01.01',
  'POLDA SUMATERA UTARA': '060.01.02',
  'POLDA SUMATERA BARAT': '060.01.03',
  'POLDA RIAU': '060.01.04',
  'POLDA KEPULAUAN RIAU': '060.01.05',
  'POLDA JAMBI': '060.01.06',
  'POLDA SUMATERA SELATAN': '060.01.07',
  'POLDA KEP. BANGKA BELITUNG': '060.01.08',
  'POLDA BENGKULU': '060.01.09',
  'POLDA LAMPUNG': '060.01.10',
  'POLDA BANTEN': '060.01.11',
  'POLDA METRO JAYA': '060.01.12',
  'POLDA JAWA BARAT': '060.01.13',
  'POLDA JAWA TENGAH': '060.01.14',
  'POLDA D.I. YOGYAKARTA': '060.01.15',
  'POLDA JAWA TIMUR': '060.01.16',
  'POLDA BALI': '060.01.17',
  'POLDA NUSA TENGGARA BARAT': '060.01.18',
  'POLDA NUSA TENGGARA TIMUR': '060.01.19',
  'POLDA KALIMANTAN BARAT': '060.01.20',
  'POLDA KALIMANTAN TENGAH': '060.01.21',
  'POLDA KALIMANTAN SELATAN': '060.01.22',
  'POLDA KALIMANTAN TIMUR': '060.01.23',
  'POLDA KALIMANTAN UTARA': '060.01.24',
  'POLDA SULAWESI UTARA': '060.01.25',
  'POLDA SULAWESI TENGAH': '060.01.26',
  'POLDA SULAWESI SELATAN': '060.01.27',
  'POLDA SULAWESI TENGGARA': '060.01.28',
  'POLDA SULAWESI BARAT': '060.01.29',
  'POLDA GORONTALO': '060.01.30',
  'POLDA MALUKU': '060.01.31',
  'POLDA MALUKU UTARA': '060.01.32',
  'POLDA PAPUA': '060.01.33',
  'POLDA PAPUA BARAT': '060.01.34',
  'POLDA PAPUA BARAT DAYA': '060.01.35',
  'POLDA PAPUA TENGAH': '060.01.36',
  'POLDA PAPUA SELATAN': '060.01.37',
  'POLDA PAPUA PEGUNUNGAN': '060.01.38',
  'KEMEN/LEMBAGA': '060.90.00',
  'PURNA TUGAS': '060.99.00',
};

// Representative Polres Jajaran per Polda for realistic Tingkat 2 selection
const POLRES_BY_POLDA: Record<string, string[]> = {
  'POLDA BENGKULU': [
    'POLRESTA BENGKULU',
    'POLRES BENGKULU UTARA',
    'POLRES BENGKULU SELATAN',
    'POLRES BENGKULU TENGAH',
    'POLRES REJANG LEBONG',
    'POLRES KEPAHIANG',
    'POLRES LEBONG',
    'POLRES MUKOMUKO',
    'POLRES SELUMA',
    'POLRES KAUR',
  ],
  'POLDA METRO JAYA': [
    'POLRES METRO JAKARTA PUSAT',
    'POLRES METRO JAKARTA SELATAN',
    'POLRES METRO JAKARTA BARAT',
    'POLRES METRO JAKARTA TIMUR',
    'POLRES METRO JAKARTA UTARA',
    'POLRES METRO TANGERANG KOTA',
    'POLRES METRO BEKASI KOTA',
    'POLRES METRO DEPOK',
    'POLRES PELABUHAN TANJUNG PRIOK',
    'POLRESTA BANDARA SOEKARNO HATTA',
  ],
  'POLDA JAWA BARAT': [
    'POLRESTABES BANDUNG',
    'POLRESTA BOGOR KOTA',
    'POLRESTA BANDUNG',
    'POLRESTA CIREBON',
    'POLRES BOGOR',
    'POLRES GARUT',
    'POLRES KARAWANG',
    'POLRES INDRAMAYU',
  ],
  'POLDA JAWA TENGAH': [
    'POLRESTABES SEMARANG',
    'POLRESTA SURAKARTA',
    'POLRESTA BANYUMAS',
    'POLRESTA CILACAP',
    'POLRESTA MAGELANG',
    'POLRESTA PATI',
  ],
  'POLDA JAWA TIMUR': [
    'POLRESTABES SURABAYA',
    'POLRESTA SIDOARJO',
    'POLRESTA MALANG KOTA',
    'POLRESTA BANYUWANGI',
    'POLRES MALANG',
    'POLRES JEMBER',
  ],
  'POLDA KALIMANTAN TIMUR': [
    'POLRESTA SAMARINDA',
    'POLRESTA BALIKPAPAN',
    'POLRES KUTAI KARTANEGARA',
    'POLRES BERAU',
    'POLRES BONTANG',
    'POLRES PENAJAM PASER UTARA',
  ],
  'POLDA SULAWESI TENGGARA': [
    'POLRESTA KENDARI',
    'POLRES BAUBAU',
    'POLRES KOLAKA',
    'POLRES KONAWE',
    'POLRES MUNA',
  ],
};

function buildTingkat1Options(): SatkerOption[] {
  const list: SatkerOption[] = [
    { label: 'MABES POLRI', value: 'MABES POLRI', code: '060.01.00.00' },
    ...DAFTAR_38_POLDA.map((p) => ({
      label: p,
      value: p,
      code: `${POLDA_CODE_MAP[p] || '060.01.99'}.00`,
    })),
    { label: 'KEMEN/LEMBAGA (LUAR STRUKTUR)', value: 'KEMEN/LEMBAGA', code: '060.90.00.00' },
    { label: 'PURNA TUGAS', value: 'PURNA TUGAS', code: '060.99.00.00' },
  ];
  return list;
}

function buildTingkat2Options(tingkat1: string): SatkerOption[] {
  if (!tingkat1) return [];
  const prefix = POLDA_CODE_MAP[tingkat1] || '060.01.00';

  if (tingkat1 === 'MABES POLRI') {
    return SATKER_MABES_LIST.map((s, idx) => ({
      label: s,
      value: s,
      code: `${prefix}.${String(idx + 1).padStart(2, '0')}.00`,
    }));
  }

  if (tingkat1 === 'KEMEN/LEMBAGA') {
    return DAFTAR_KEMEN_LEMBAGA.map((s, idx) => ({
      label: s,
      value: s,
      code: `${prefix}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  if (tingkat1 === 'PURNA TUGAS') {
    return STATUS_PURNA_TUGAS_LIST.map((s, idx) => ({
      label: s,
      value: s,
      code: `${prefix}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  // Extract region name (e.g. "POLDA BENGKULU" -> "BENGKULU")
  const region = tingkat1.replace(/^POLDA\s+/i, '').trim();

  // Exact CAS-style regionalized Polda Satkers (matching screenshot order & codes)
  const poldaSatkers: SatkerOption[] = [
    { label: `DIT TAHTI ${region}`, value: `DIT TAHTI ${region}`, code: `${prefix}.00.00.25` },
    { label: `DIT RES SIBER ${region}`, value: `DIT RES SIBER ${region}`, code: `${prefix}.00.00.28` },
    { label: `DIT KRIMUM ${region}`, value: `DIT KRIMUM ${region}`, code: `${prefix}.25` },
    { label: `DIT KRIMSUS ${region}`, value: `DIT KRIMSUS ${region}`, code: `${prefix}.26` },
    { label: `DIT NARKOBA ${region}`, value: `DIT NARKOBA ${region}`, code: `${prefix}.27` },
    { label: `DIT INTELKAM ${region}`, value: `DIT INTELKAM ${region}`, code: `${prefix}.24` },
    { label: `DIT LANTAS ${region}`, value: `DIT LANTAS ${region}`, code: `${prefix}.29` },
    { label: `DIT SAMAPTA ${region}`, value: `DIT SAMAPTA ${region}`, code: `${prefix}.30` },
    { label: `DIT BINMAS ${region}`, value: `DIT BINMAS ${region}`, code: `${prefix}.31` },
    { label: `DIT PAMOBVIT ${region}`, value: `DIT PAMOBVIT ${region}`, code: `${prefix}.32` },
    { label: `DIT POLAIRUD ${region}`, value: `DIT POLAIRUD ${region}`, code: `${prefix}.33` },
    { label: `SAT BRIMOB ${region}`, value: `SAT BRIMOB ${region}`, code: `${prefix}.34` },
    { label: `PIMPINAN POLDA (KAPOLDA / WAKAPOLDA) ${region}`, value: `PIMPINAN POLDA ${region}`, code: `${prefix}.01` },
    { label: `ITWASDA ${region}`, value: `ITWASDA ${region}`, code: `${prefix}.10` },
    { label: `RO OPS ${region}`, value: `RO OPS ${region}`, code: `${prefix}.11` },
    { label: `RO RENA ${region}`, value: `RO RENA ${region}`, code: `${prefix}.12` },
    { label: `RO SDM ${region}`, value: `RO SDM ${region}`, code: `${prefix}.13` },
    { label: `RO LOG ${region}`, value: `RO LOG ${region}`, code: `${prefix}.14` },
    { label: `BID PROPAM ${region}`, value: `BID PROPAM ${region}`, code: `${prefix}.15` },
    { label: `BID HUMAS ${region}`, value: `BID HUMAS ${region}`, code: `${prefix}.16` },
    { label: `BID KUM ${region}`, value: `BID KUM ${region}`, code: `${prefix}.17` },
    { label: `BID TIK ${region}`, value: `BID TIK ${region}`, code: `${prefix}.18` },
    { label: `BID DOKKES ${region}`, value: `BID DOKKES ${region}`, code: `${prefix}.19` },
    { label: `BID KEU ${region}`, value: `BID KEU ${region}`, code: `${prefix}.20` },
    { label: `SPN ${region}`, value: `SPN ${region}`, code: `${prefix}.21` },
    { label: `SPRIPIM / ADC PIMPINAN ${region}`, value: `SPRIPIM ${region}`, code: `${prefix}.22` },
  ];

  // Append Polres Jajaran for this Polda
  const customPolres = POLRES_BY_POLDA[tingkat1] || [
    `POLRESTA / POLRESTABES ${region}`,
    `POLRES JAJARAN ${region} I`,
    `POLRES JAJARAN ${region} II`,
  ];

  const polresOptions: SatkerOption[] = customPolres.map((pr, idx) => ({
    label: pr,
    value: pr,
    code: `${prefix}.${String(40 + idx).padStart(2, '0')}`,
  }));

  return [...poldaSatkers, ...polresOptions];
}

function buildTingkat3Options(tingkat1: string, tingkat2: string, parentCode: string): SatkerOption[] {
  if (!tingkat1 || !tingkat2) return [];
  const upper2 = tingkat2.toUpperCase();

  if (tingkat1 === 'MABES POLRI') {
    const specific = getSubSatkerForMabes(upper2);
    const baseList =
      specific.length > 0
        ? [
            'PIMPINAN / PATI SATKER',
            ...specific,
            'PAMEN / ANALIS KEBIJAKAN MADYA',
            'ADC / STAF PRIBADI PIMPINAN',
          ]
        : [
            'PIMPINAN / PATI SATKER',
            'BIRO / DIREKTORAT / BAGIAN UTAMA',
            'PAMEN / ANALIS KEBIJAKAN MADYA',
            'ADC / STAF PRIBADI PIMPINAN',
          ];
    return baseList.map((item, idx) => ({
      label: item,
      value: item,
      code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  if (upper2.startsWith('POLRES')) {
    const resShort = upper2.replace(/^POLRESTABES\s+|^POLRESTA\s+|^POLRES\s+METRO\s+|^POLRES\s+/i, 'RES ');
    const polresUnits = [
      `PIMPINAN (${upper2})`,
      `SAT RESKRIM ${resShort}`,
      `SAT RESNARKOBA ${resShort}`,
      `SAT INTELKAM ${resShort}`,
      `SAT LANTAS ${resShort}`,
      `SAT SAMAPTA ${resShort}`,
      `SAT BINMAS ${resShort}`,
      `SAT TAHTI ${resShort}`,
      `BAG OPS ${resShort}`,
      `BAG SDM ${resShort}`,
      `SI PROPAM ${resShort}`,
      `ADC / AJUDAN KAPOLRES`,
    ];
    return polresUnits.map((u, idx) => ({
      label: u,
      value: u,
      code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  if (upper2.includes('KRIMUM')) {
    const units = [
      `PIMPINAN / DIR (${tingkat2})`,
      'SUBDIT I KAMNEG',
      'SUBDIT II HARDA BANGTAH',
      'SUBDIT III JATANRAS',
      'SUBDIT IV RENAKTA',
      'BAG BINOPSNAL',
      'BAG WASSIDIK',
      'ADC / STAF PIMPINAN',
    ];
    return units.map((u, idx) => ({
      label: u,
      value: u,
      code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  if (upper2.includes('KRIMSUS')) {
    const units = [
      `PIMPINAN / DIR (${tingkat2})`,
      'SUBDIT I INDAGSI',
      'SUBDIT II FISMONDEV',
      'SUBDIT III TIPIDKOR',
      'SUBDIT IV TIPIDTER',
      'BAG BINOPSNAL',
      'BAG WASSIDIK',
      'ADC / STAF PIMPINAN',
    ];
    return units.map((u, idx) => ({
      label: u,
      value: u,
      code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  if (upper2.includes('NARKOBA') || upper2.includes('SIBER')) {
    const units = [
      `PIMPINAN / DIR (${tingkat2})`,
      'SUBDIT I',
      'SUBDIT II',
      'SUBDIT III',
      'BAG BINOPSNAL',
      'BAG WASSIDIK',
      'ADC / STAF PIMPINAN',
    ];
    return units.map((u, idx) => ({
      label: u,
      value: u,
      code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
    }));
  }

  const genericUnits = [
    `PIMPINAN / KEPALA SATKER (${tingkat2})`,
    'WAKIL KEPALA SATKER',
    'SUBDIT / BAGIAN I',
    'SUBDIT / BAGIAN II',
    'SUBDIT / BAGIAN III',
    'SUBBAG RENMIN',
    'ADC / STAF PIMPINAN',
  ];
  return genericUnits.map((u, idx) => ({
    label: u,
    value: u,
    code: `${parentCode}.${String(idx + 1).padStart(2, '0')}`,
  }));
}

export const SatkerBerjenjangModal: React.FC<SatkerBerjenjangModalProps> = ({
  isOpen,
  onClose,
  initialPolda = '',
  initialSatker = '',
  initialSubSatker = '',
  onApply,
}) => {
  const [selectedT1, setSelectedT1] = useState<string>(initialPolda);
  const [selectedT2, setSelectedT2] = useState<string>(initialSatker);
  const [selectedT3, setSelectedT3] = useState<string>(initialSubSatker);

  const [openDropdown, setOpenDropdown] = useState<1 | 2 | 3 | null>(null);
  const [searchT1, setSearchT1] = useState('');
  const [searchT2, setSearchT2] = useState('');
  const [searchT3, setSearchT3] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  const t1Options = useMemo(() => buildTingkat1Options(), []);
  const t2Options = useMemo(() => buildTingkat2Options(selectedT1), [selectedT1]);
  const selectedT2Obj = useMemo(
    () => t2Options.find((o) => o.value === selectedT2),
    [t2Options, selectedT2]
  );
  const t3Options = useMemo(
    () => buildTingkat3Options(selectedT1, selectedT2, selectedT2Obj?.code || '060.01.00'),
    [selectedT1, selectedT2, selectedT2Obj]
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedT1(initialPolda || '');
      setSelectedT2(initialSatker || '');
      setSelectedT3(initialSubSatker || '');
      setSearchT1('');
      setSearchT2('');
      setSearchT3('');
      // Automatically open Tingkat 2 if Tingkat 1 is already selected, else Tingkat 1
      if (initialPolda && !initialSatker) {
        setOpenDropdown(2);
      } else {
        setOpenDropdown(null);
      }
    }
  }, [isOpen, initialPolda, initialSatker, initialSubSatker]);

  if (!isOpen) return null;

  const filteredT1 = t1Options.filter(
    (o) =>
      !searchT1.trim() ||
      o.label.toLowerCase().includes(searchT1.toLowerCase()) ||
      o.code.includes(searchT1.trim())
  );

  const filteredT2 = t2Options.filter(
    (o) =>
      !searchT2.trim() ||
      o.label.toLowerCase().includes(searchT2.toLowerCase()) ||
      o.code.includes(searchT2.trim())
  );

  const filteredT3 = t3Options.filter(
    (o) =>
      !searchT3.trim() ||
      o.label.toLowerCase().includes(searchT3.toLowerCase()) ||
      o.code.includes(searchT3.trim())
  );

  const handleApply = () => {
    if (!selectedT1) return;
    const t1Obj = t1Options.find((o) => o.value === selectedT1);
    const t2Obj = t2Options.find((o) => o.value === selectedT2);
    const t3Obj = t3Options.find((o) => o.value === selectedT3);

    const satkerUtama = selectedT2 || selectedT1;
    const subSatker = selectedT3 || '';
    const isGenericLeader =
      !subSatker ||
      subSatker.startsWith('PIMPINAN') ||
      subSatker === 'Pimpinan / Staf Utama Satker';

    const composedSatker = !isGenericLeader ? `${subSatker} - ${satkerUtama}` : satkerUtama;
    const kodeSatker = t3Obj?.code || t2Obj?.code || t1Obj?.code || '060.01.00';

    onApply({
      polda: selectedT1,
      satkerUtama,
      subSatker,
      composedSatker,
      kodeSatker,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[460px] overflow-hidden animate-scaleUp"
      >
        {/* Header: Exact CAS White Modal Style */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-900">Pilih Satker Berjenjang</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Progressive Cascading Custom Searchable Selects */}
        <div className="px-6 py-2 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* ============================================================ */}
          {/* TINGKAT 1: MABES / POLDA                                     */}
          {/* ============================================================ */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
              Tingkat 1: Mabes / Polda
            </label>

            {/* Custom Select Trigger */}
            <div
              onClick={() => setOpenDropdown(openDropdown === 1 ? null : 1)}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-lg flex items-center justify-between text-xs cursor-pointer transition-all ${
                openDropdown === 1
                  ? 'border-slate-400 ring-2 ring-slate-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={selectedT1 ? 'font-semibold text-slate-800' : 'text-slate-500'}>
                {selectedT1 || '— Pilih Tingkat 1: Mabes / Polda —'}
              </span>
              <div className="flex items-center gap-1.5 text-slate-400">
                {selectedT1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedT1('');
                      setSelectedT2('');
                      setSelectedT3('');
                      setOpenDropdown(1);
                    }}
                    className="hover:text-slate-700 p-0.5"
                    title="Reset Tingkat 1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {openDropdown === 1 ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </div>

            {/* Dropdown Menu for Tingkat 1 */}
            {openDropdown === 1 && (
              <div className="mt-1.5 border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                  <input name="ws96_satkerberjenjangmodal_searchT1_1"
                    type="text"
                    autoFocus
                    value={searchT1}
                    onChange={(e) => setSearchT1(e.target.value)}
                    placeholder="Cari Mabes / Polda..."
                    className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                </div>
                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                  {filteredT1.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Tidak ditemukan Mabes / Polda
                    </div>
                  ) : (
                    filteredT1.map((item) => {
                      const isSelected = selectedT1 === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setSelectedT1(item.value);
                            setSelectedT2('');
                            setSelectedT3('');
                            setSearchT2('');
                            setOpenDropdown(2);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-2 border-slate-700 bg-slate-50 font-bold text-slate-900'
                              : 'hover:bg-slate-50 border-2 border-transparent text-slate-700 font-semibold'
                          }`}
                        >
                          <div className="flex items-baseline gap-2 truncate">
                            <span>{item.label}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              {item.code}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-800 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* TINGKAT 2: DIREKTORAT / SATUAN / POLRES                      */}
          {/* ============================================================ */}
          {selectedT1 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Tingkat 2: Direktorat / Satuan / Polres
              </label>

              {/* Custom Select Trigger */}
              <div
                onClick={() => setOpenDropdown(openDropdown === 2 ? null : 2)}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-lg flex items-center justify-between text-xs cursor-pointer transition-all ${
                  openDropdown === 2
                    ? 'border-slate-400 ring-2 ring-slate-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={selectedT2 ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                  {selectedT2 || '— Pilih Tingkat 2: Direktorat / Satuan / Polres —'}
                </span>
                <div className="flex items-center gap-1.5 text-slate-400">
                  {selectedT2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedT2('');
                        setSelectedT3('');
                        setOpenDropdown(2);
                      }}
                      className="hover:text-slate-700 p-0.5"
                      title="Reset Tingkat 2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {openDropdown === 2 ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Dropdown Menu for Tingkat 2 (Matches Screenshot 100%) */}
              {openDropdown === 2 && (
                <div className="mt-1.5 border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <input name="ws96_satkerberjenjangmodal_searchT2_2"
                      type="text"
                      autoFocus
                      value={searchT2}
                      onChange={(e) => setSearchT2(e.target.value)}
                      placeholder="Ketik untuk mencari Direktorat / Satuan / Polres..."
                      className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                    {filteredT2.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Satker tidak ditemukan
                      </div>
                    ) : (
                      filteredT2.map((item) => {
                        const isSelected = selectedT2 === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setSelectedT2(item.value);
                              setSelectedT3('');
                              setSearchT3('');
                              setOpenDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-all ${
                              isSelected
                                ? 'border-2 border-slate-700 bg-slate-50 font-bold text-slate-900'
                                : 'hover:border-slate-700 hover:bg-slate-50/70 border-2 border-transparent text-slate-800 font-semibold'
                            }`}
                          >
                            <div className="flex items-baseline gap-2 truncate">
                              <span>{item.label}</span>
                              <span className="text-[10px] font-mono text-slate-400 font-normal">
                                {item.code}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TINGKAT 3: SUBDIT / BAGIAN / SATUAN / ADC (OPSIONAL)         */}
          {/* ============================================================ */}
          {selectedT1 && selectedT2 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Tingkat 3: Subdit / Satuan / Bagian / Unit / ADC (Opsional)
              </label>

              <div
                onClick={() => setOpenDropdown(openDropdown === 3 ? null : 3)}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-lg flex items-center justify-between text-xs cursor-pointer transition-all ${
                  openDropdown === 3
                    ? 'border-slate-400 ring-2 ring-slate-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={selectedT3 ? 'font-semibold text-slate-800' : 'text-slate-500'}>
                  {selectedT3 || '— Pilih Tingkat 3: Subdit / Satuan / Unit / ADC (Opsional) —'}
                </span>
                <div className="flex items-center gap-1.5 text-slate-400">
                  {selectedT3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedT3('');
                      }}
                      className="hover:text-slate-700 p-0.5"
                      title="Reset Tingkat 3"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {openDropdown === 3 ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>

              {openDropdown === 3 && (
                <div className="mt-1.5 border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <input name="ws96_satkerberjenjangmodal_searchT3_3"
                      type="text"
                      autoFocus
                      value={searchT3}
                      onChange={(e) => setSearchT3(e.target.value)}
                      placeholder="Ketik untuk mencari Subdit / Satuan / ADC..."
                      className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </div>
                  <div className="max-h-44 overflow-y-auto p-1 space-y-0.5">
                    {filteredT3.map((item) => {
                      const isSelected = selectedT3 === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setSelectedT3(item.value);
                            setOpenDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-2 border-slate-700 bg-slate-50 font-bold text-slate-900'
                              : 'hover:border-slate-700 hover:bg-slate-50/70 border-2 border-transparent text-slate-800 font-semibold'
                          }`}
                        >
                          <div className="flex items-baseline gap-2 truncate">
                            <span>{item.label}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              {item.code}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons: Batal (blue text) + ✓ Terapkan Satker (solid red button) */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!selectedT1}
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Terapkan Satker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
