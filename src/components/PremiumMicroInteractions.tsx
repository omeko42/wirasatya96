'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react';

/* ============================================================================
 * 1. PURE WEB AUDIO API SYNTHESIZER (ZERO EXTERNAL .MP3 ASSETS — VIDEO 13)
 * ============================================================================ */
class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Liquid "blop" sound when each letter drops into the trash can (Video 13) */
  playTrashLetterDrop(stepIndex: number = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 260 + stepIndex * 38;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.065);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore audio restrictions
    }
  }

  /** Two-tone confirmation chime when deletion completes (Video 13) */
  playDeleteCompleteChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.09, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.24);
      });
    } catch {
      // ignore
    }
  }

  /** Warm door-close sound effect on Log Out (Video 14) */
  playLogoutDoorChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [440, 329.63].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.07, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.22);
      });
    } catch {
      // ignore
    }
  }

  /** Crisp Apple-style Spotlight open/select tick (Video 12) */
  playTactileTick(pitch: number = 680) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // ignore
    }
  }
}

export const WebAudioFX = new SoundSynthesizer();

/* ============================================================================
 * 2. ANIMATED 3D DOOR EXIT LOGOUT BUTTON (VIDEO 14)
 * ============================================================================ */
interface AnimatedLogoutButtonProps {
  onLogout: () => void;
  className?: string;
  label?: string;
  variant?: 'menu-item' | 'pill';
}

export const AnimatedLogoutButton: React.FC<AnimatedLogoutButtonProps> = ({
  onLogout,
  className = '',
  label = 'Keluar',
  variant = 'menu-item',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isExiting) return;
    setIsExiting(true);
    WebAudioFX.playLogoutDoorChime();
    setTimeout(() => {
      onLogout();
      setIsExiting(false);
    }, 520);
  };

  return (
    <button
      type="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      className={
        variant === 'menu-item'
          ? `w-full px-4 py-2 text-left hover:bg-red-50 text-red-700 flex items-center justify-between gap-2.5 font-semibold transition-all group ${className}`
          : `px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 flex items-center gap-2 font-bold text-xs transition-all ${className}`
      }
      title="Keluar dari sesi portal dengan aman"
    >
      <div className="flex items-center gap-2.5">
        {/* 3D Animated Door & Walking Figure SVG (Video 14) */}
        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5 overflow-visible"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            {/* Door Frame */}
            <path
              d="M5 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
              className="text-red-800/40"
            />
            {/* Walking Person Figure */}
            <g
              style={{
                transform: isExiting
                  ? 'translateX(7px) scale(0.75)'
                  : isHovered
                  ? 'translateX(2.5px)'
                  : 'translateX(0px)',
                opacity: isExiting ? 0 : 1,
                transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease',
              }}
            >
              <circle cx="15.5" cy="7.5" r="1.6" fill="currentColor" stroke="none" />
              <path
                d="M13.5 11.5l2-1.5 2.5 1.5M15.5 10v4.5l-2 3.5M15.5 14.5l2.2 3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            {/* 3D Swinging Door Leaf */}
            <path
              d="M5 3l7 1.2v15.6L5 21V3z"
              fill="currentColor"
              className="text-red-700"
              style={{
                transformOrigin: '5px 12px',
                transform: isExiting
                  ? ' scaleX(1.12)'
                  : isHovered
                  ? 'scaleX(0.62)'
                  : 'scaleX(0.85)',
                transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>
        </div>
        <span>{isExiting ? 'Menutup Sesi...' : label}</span>
      </div>
      <span className="text-[10px] font-mono text-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity">
        ESC
      </span>
    </button>
  );
};

/* ============================================================================
 * 3. CONFIRMED DELETE BUTTON WITH LETTER SUCTION & WEB AUDIO API (VIDEO 13)
 * ============================================================================ */
interface AnimatedDeleteButtonProps {
  onDelete: () => void;
  label?: string;
  confirmLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  title?: string;
  disabled?: boolean;
}

export const AnimatedDeleteButton: React.FC<AnimatedDeleteButtonProps> = ({
  onDelete,
  label = 'Hapus',
  confirmLabel = 'Yakin?',
  size = 'xs',
  className = '',
  title = 'Hapus data dengan konfirmasi aman',
  disabled = false,
}) => {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'sucking' | 'done'>('idle');
  const [activeLetterIdx, setActiveLetterIdx] = useState<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const letters = label.split('');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || phase === 'sucking' || phase === 'done') return;

    if (phase === 'idle') {
      WebAudioFX.playTactileTick(520);
      setPhase('confirm');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPhase((p) => (p === 'confirm' ? 'idle' : p));
      }, 3200);
      return;
    }

    if (phase === 'confirm') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('sucking');
      // Animate letters flying into trash can + Web Audio API liquid blop per letter
      letters.forEach((_, idx) => {
        setTimeout(() => {
          setActiveLetterIdx(idx);
          WebAudioFX.playTrashLetterDrop(idx);
        }, idx * 65);
      });

      const totalDuration = letters.length * 65 + 220;
      setTimeout(() => {
        WebAudioFX.playDeleteCompleteChime();
        setPhase('done');
        setTimeout(() => {
          onDelete();
          setPhase('idle');
          setActiveLetterIdx(-1);
        }, 180);
      }, totalDuration);
    }
  };

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-1 text-[10px] rounded-lg gap-1'
      : size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-xl gap-1.5'
      : 'px-3.5 py-2 text-xs rounded-xl gap-2';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={title}
      className={`ws96-inline-chip relative inline-flex items-center justify-center font-bold border overflow-hidden select-none transition-all ${sizeClasses} ${
        phase === 'done'
          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
          : phase === 'sucking'
          ? 'bg-red-800 border-red-900 text-white shadow-sm scale-[0.98]'
          : phase === 'confirm'
          ? 'bg-red-600 hover:bg-red-700 border-red-700 text-white shadow-xs animate-pulse'
          : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
      } ${className}`}
    >
      {/* Liquid fill background when sucking letters (Video 13) */}
      {phase === 'sucking' && (
        <span
          className="absolute inset-x-0 bottom-0 bg-red-950/40 transition-all duration-100 pointer-events-none"
          style={{
            height: `${Math.min(100, ((activeLetterIdx + 1) / Math.max(1, letters.length)) * 100)}%`,
          }}
        />
      )}

      <span className="relative z-10 flex items-center gap-1">
        {phase === 'done' ? (
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        ) : (
          <Trash2
            className={`w-3.5 h-3.5 transition-transform ${
              phase === 'sucking' ? 'rotate-[-14deg] scale-110' : ''
            }`}
          />
        )}

        {phase === 'confirm' ? (
          <span>{confirmLabel}</span>
        ) : phase === 'done' ? (
          <span>Terhapus</span>
        ) : (
          <span className="inline-flex">
            {letters.map((ch, idx) => {
              const isSucked = phase === 'sucking' && idx <= activeLetterIdx;
              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-block',
                    transform: isSucked
                      ? `translate(-${(idx + 1) * 6}px, -4px) scale(0)`
                      : 'none',
                    opacity: isSucked ? 0 : 1,
                    transition: 'transform 140ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms ease',
                  }}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              );
            })}
          </span>
        )}
      </span>
    </button>
  );
};

/* ============================================================================
 * 4. PREMIUM CUSTOM CALENDAR DATE PICKER (VIDEO 20 — DATE-ONLY BY DEFAULT)
 * ============================================================================ */
interface PremiumDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (newDate: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  includeTime?: boolean;
}

const INDONESIAN_MONTHS = [
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

const SHORT_MONTHS = [
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

const DAY_HEADERS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const PremiumDatePicker: React.FC<PremiumDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pilih Tanggal',
  label,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM-DD safely
  const parsedDate = React.useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m - 1, day: d };
  }, [value]);

  const now = new Date();
  const [viewYear, setViewYear] = useState<number>(parsedDate?.year || now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(
    parsedDate?.month !== undefined ? parsedDate.month : now.getMonth()
  );

  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.year);
      setViewMonth(parsedDate.month);
    }
  }, [parsedDate]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handleSelectDay = (dayNum: number) => {
    WebAudioFX.playTactileTick(740);
    const yyyy = String(viewYear);
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const t = new Date();
    const yyyy = String(t.getFullYear());
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    WebAudioFX.playTactileTick(820);
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const formattedDisplay = parsedDate
    ? `${String(parsedDate.day).padStart(2, '0')} ${SHORT_MONTHS[parsedDate.month]} ${parsedDate.year}`
    : '';

  const yearOptions = React.useMemo(() => {
    const list: number[] = [];
    for (let y = 1945; y <= 2035; y++) list.push(y);
    return list;
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-700 mb-1">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            WebAudioFX.playTactileTick(640);
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 text-xs transition-all ${
          isOpen
            ? 'bg-white border-red-800 ring-2 ring-red-800/20 text-slate-900'
            : 'bg-white hover:bg-slate-50/80 border-slate-300 text-slate-900'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`truncate font-semibold tabular-nums ${
            formattedDisplay ? 'text-slate-900' : 'text-slate-400 font-normal'
          }`}
        >
          {formattedDisplay || placeholder}
        </span>
        <Calendar className="w-3.5 h-3.5 text-red-800 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-[272px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 text-xs text-slate-800 animate-fadeIn">
          {/* Header: Month & Year Selectors + Prev/Next */}
          <div className="flex items-center justify-between gap-1 pb-2.5 mb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={prevMonth}
              className="ws96-inline-chip p-1 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              <select name="ws96_premiummicrointeractions_viewMonth_1" aria-label="viewMonth"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="ws96-inline-chip px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-bold text-[11px] text-slate-800 focus:outline-none focus:border-red-800"
              >
                {INDONESIAN_MONTHS.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select name="ws96_premiummicrointeractions_viewYear_2" aria-label="viewYear"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="ws96-inline-chip px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-bold text-[11px] text-slate-800 tabular-nums focus:outline-none focus:border-red-800"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="ws96-inline-chip p-1 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-slate-400 mb-1">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected =
                parsedDate &&
                parsedDate.year === viewYear &&
                parsedDate.month === viewMonth &&
                parsedDate.day === dayNum;
              const isToday =
                now.getFullYear() === viewYear &&
                now.getMonth() === viewMonth &&
                now.getDate() === dayNum;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`ws96-inline-chip h-7 rounded-lg text-[11px] font-bold tabular-nums transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-red-800 text-white shadow-xs'
                      : isToday
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions: Hari Ini | Hapus | Tutup */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="ws96-inline-chip px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 font-bold transition-colors"
            >
              Hari Ini
            </button>
            <div className="flex items-center gap-1">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="ws96-inline-chip px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold"
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ws96-inline-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
