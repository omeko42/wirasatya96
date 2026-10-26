'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Check, X, Sparkles } from 'lucide-react';

export type UnifiedSortKey =
  | 'DEFAULT'
  | 'PANGKAT_UTAMA'
  | 'STATUS'
  | 'PANGKAT'
  | 'LEVEL_SATKER'
  | 'NRP'
  | 'NAMA'
  | 'ROLE';

export interface UnifiedSortOption {
  key: UnifiedSortKey;
  title: string;
  shortLabel: string;
  mobileLabel: string;
  description: string;
  ascHint: string;
  descHint: string;
  defaultDesc: boolean;
  isCombinedPrimary?: boolean;
}

export const UNIFIED_SORT_OPTIONS: UnifiedSortOption[] = [
  {
    key: 'DEFAULT',
    title: 'Urutan Standar',
    shortLabel: 'Standar',
    mobileLabel: 'Standar',
    description: 'Aktif berdinas di atas, diurutkan menurut Pangkat, Satker, dan NRP.',
    ascHint: 'Pangkat Rendah → Tinggi',
    descHint: 'Pangkat Tinggi → Rendah',
    defaultDesc: true,
    isCombinedPrimary: true,
  },
  {
    key: 'PANGKAT_UTAMA',
    title: 'Pangkat & Satker',
    shortLabel: 'Pangkat & Satker',
    mobileLabel: 'Pangkat',
    description: 'Urut dari Pangkat tertinggi dan tingkat Satker (Mabes ke Kewilayahan).',
    ascHint: 'Rendah → Tinggi',
    descHint: 'Tinggi → Rendah',
    defaultDesc: true,
    isCombinedPrimary: true,
  },
  {
    key: 'STATUS',
    title: 'Status Dinas',
    shortLabel: 'Status Dinas',
    mobileLabel: 'Status',
    description: 'Kelompokkan personel Aktif, Purna Tugas, hingga Almarhum.',
    ascHint: 'Almarhum → Aktif',
    descHint: 'Aktif → Almarhum',
    defaultDesc: true,
  },
  {
    key: 'PANGKAT',
    title: 'Kepangkatan Polri',
    shortLabel: 'Pangkat',
    mobileLabel: 'Pangkat',
    description: 'Urut berdasarkan hierarki pangkat Polri.',
    ascHint: 'Rendah → Tinggi',
    descHint: 'Tinggi → Rendah',
    defaultDesc: true,
  },
  {
    key: 'LEVEL_SATKER',
    title: 'Tingkat Kesatuan (Satker)',
    shortLabel: 'Tingkat Satker',
    mobileLabel: 'Satker',
    description: 'Urut dari Mabes Polri, Polda, Polres, hingga Polsek.',
    ascHint: 'Polsek → Mabes',
    descHint: 'Mabes → Polsek',
    defaultDesc: true,
  },
  {
    key: 'NRP',
    title: 'Nomor Registrasi Pokok (NRP)',
    shortLabel: 'NRP',
    mobileLabel: 'NRP',
    description: 'Urut berdasarkan nomor NRP personel.',
    ascHint: 'Kecil → Besar',
    descHint: 'Besar → Kecil',
    defaultDesc: false,
  },
  {
    key: 'NAMA',
    title: 'Nama Personel (Abjad)',
    shortLabel: 'Nama (A–Z)',
    mobileLabel: 'Nama',
    description: 'Urut berdasarkan abjad nama lengkap.',
    ascHint: 'Abjad A → Z',
    descHint: 'Abjad Z → A',
    defaultDesc: false,
  },
  {
    key: 'ROLE',
    title: 'Pengurus Angkatan',
    shortLabel: 'Pengurus',
    mobileLabel: 'Pengurus',
    description: 'Tampilkan Ketua, Sekretaris, dan Bendahara di urutan atas.',
    ascHint: 'Anggota → Ketua',
    descHint: 'Ketua → Anggota',
    defaultDesc: true,
  },
];

interface SortTriggerBarProps {
  sortBy: UnifiedSortKey;
  sortDesc: boolean;
  onOpenModal: () => void;
  onToggleDirection: () => void;
  compact?: boolean;
}

export const SortTriggerBar: React.FC<SortTriggerBarProps> = ({
  sortBy,
  sortDesc,
  onOpenModal,
  onToggleDirection,
}) => {
  const currentOption =
    UNIFIED_SORT_OPTIONS.find((opt) => opt.key === sortBy) || UNIFIED_SORT_OPTIONS[0];

  const dirLabel =
    sortBy === 'NAMA'
      ? sortDesc
        ? 'Z–A'
        : 'A–Z'
      : sortDesc
      ? 'Turun'
      : 'Naik';

  return (
    <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs shrink-0 max-w-full">
      <button
        type="button"
        onClick={onOpenModal}
        className="flex items-center min-w-0 text-left hover:bg-slate-50 transition-colors focus:outline-none group"
        title={`Urutkan: ${currentOption.title}`}
      >
        <div className="pl-2.5 pr-2 py-1.5 flex items-center gap-1.5 text-red-800 bg-red-50/80 group-hover:bg-red-100/80 border-r border-slate-200 transition-colors shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider">Urut</span>
        </div>
        <div className="px-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-slate-700 truncate">
            <span className="sm:hidden">{currentOption.mobileLabel}</span>
            <span className="hidden sm:inline">{currentOption.shortLabel}</span>
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">▾</span>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleDirection}
        className={`px-2 py-1.5 border-l border-slate-200 font-bold text-[11px] transition-colors whitespace-nowrap flex items-center gap-1 shrink-0 ${
          sortDesc
            ? 'bg-red-50/60 hover:bg-red-100/70 text-red-900'
            : 'bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-900'
        }`}
        title={sortDesc ? currentOption.descHint : currentOption.ascHint}
      >
        {sortDesc ? (
          <ArrowDown className="w-3 h-3 text-red-800 shrink-0" />
        ) : (
          <ArrowUp className="w-3 h-3 text-indigo-700 shrink-0" />
        )}
        <span>{dirLabel}</span>
      </button>
    </div>
  );
};

interface SortModalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  sortBy: UnifiedSortKey;
  sortDesc: boolean;
  onSelectSort: (key: UnifiedSortKey, desc: boolean) => void;
  contextTitle?: string;
}

export const SortModalPopup: React.FC<SortModalPopupProps> = ({
  isOpen,
  onClose,
  sortBy,
  sortDesc,
  onSelectSort,
}) => {
  if (!isOpen) return null;

  const handlePick = (key: UnifiedSortKey, desc: boolean) => {
    onSelectSort(key, desc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 text-white px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <ArrowUpDown className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight">Urutkan Daftar</h3>
              <p className="text-[11px] text-slate-300">Pilih urutan tampilan data</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daftar Pilihan Urutan */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {UNIFIED_SORT_OPTIONS.map((opt) => {
            const isSelected = sortBy === opt.key;
            const isAscSelected = isSelected && !sortDesc;
            const isDescSelected = isSelected && sortDesc;

            return (
              <div
                key={opt.key}
                onClick={() => handlePick(opt.key, opt.defaultDesc)}
                className={`rounded-xl border p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-red-800 bg-red-50/35 ring-1 ring-red-800/15'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {opt.isCombinedPrimary && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                          <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                          <span>Utama</span>
                        </span>
                      )}
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        {opt.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{opt.description}</p>
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handlePick(opt.key, false)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                        isAscSelected
                          ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      <ArrowUp className="w-3 h-3 shrink-0" />
                      <span>{opt.key === 'NAMA' ? 'A–Z' : 'Naik'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePick(opt.key, true)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                        isDescSelected
                          ? 'bg-red-800 text-white border-red-900 shadow-2xs'
                          : 'bg-white hover:bg-red-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      <ArrowDown className="w-3 h-3 shrink-0" />
                      <span>{opt.key === 'NAMA' ? 'Z–A' : 'Turun'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Modal */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handlePick('DEFAULT', true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            Reset ke Standar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
