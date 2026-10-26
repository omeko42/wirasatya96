'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  User,
  Users, 
  Briefcase, 
  MessageSquare, 
  Bell, 
  Wallet, 
  BarChart3, 
  Search, 
  LogOut, 
  ChevronDown,
  ShieldCheck,
  Settings,
  LayoutGrid,
  Heart,
  Scale,
  Lock,
  Phone
} from 'lucide-react';
import { AuthUser, UserRole, AnggotaWiraSatya } from '@/types';
import {
  getAvatarUrl,
  resolveAvatarUrl,
  formatJabatanWithSatker,
  getActiveAdcSessionFromStorage,
  isSuperadminAccount,
} from '@/lib/avatarUtils';
import { WSLogo } from './WSLogo';
import { MetaVerifiedBadge } from './MetaVerifiedBadge';

export type AppTab = 
  | 'direktori' 
  | 'purnaTugas' 
  | 'pesan' 
  | 'notifikasi' 
  | 'form' 
  | 'bendahara' 
  | 'dashboard'
  | 'pengaturan'
  | 'users';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  totalMembers: number;
  currentUser: AuthUser;
  members?: AnggotaWiraSatya[];
  onSelectMember?: (member: AnggotaWiraSatya) => void;
  onOpenChat?: (member: AnggotaWiraSatya) => void;
  onOpenAuthModal?: () => void;
  onOpenVerificationModal?: () => void;
  onOpenVerification?: () => void;
  pendingVerificationCount?: number;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  onOpenRegisterModal?: () => void;
  onLogout?: () => void;
  onSearchChange?: (query: string) => void;
  onViewMyProfile?: () => void;
  isViewingOwnProfile?: boolean;
  impersonatorUser?: AuthUser | null;
  onStopImpersonating?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  members = [],
  onSelectMember,
  onOpenChat,
  pendingVerificationCount = 0,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  onLogout,
  onSearchChange,
  onViewMyProfile,
  isViewingOwnProfile = false,
  impersonatorUser,
  onStopImpersonating,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const appsMenuRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const effectiveRole: UserRole = React.useMemo(() => {
    if (currentUser.role && currentUser.role !== 'ANGGOTA') return currentUser.role;
    const cleanNrp = (currentUser.nrp || '').trim();
    if (cleanNrp === '98010710') return 'SUPERADMIN';
    if (cleanNrp === '75060702' || cleanNrp === '74090165') return 'KETUA';
    if (
      cleanNrp === '72080762' ||
      cleanNrp === '74090167' ||
      cleanNrp === '74060709' ||
      cleanNrp === '74090168'
    ) {
      return 'SEKRETARIAT';
    }
    if (
      cleanNrp === '74050716' ||
      cleanNrp === '74090009' ||
      cleanNrp === '74090583' ||
      cleanNrp === '74090072'
    ) {
      return 'BENDAHARA';
    }
    return currentUser.role || 'ANGGOTA';
  }, [currentUser.role, currentUser.nrp]);

  const isLeadership = effectiveRole !== 'ANGGOTA';
  const adcSession = currentUser.activeAdcSession || getActiveAdcSessionFromStorage();

  // Sanitize name for compact single-line display while preserving degrees
  const myMember = React.useMemo(
    () =>
      members.find(
        (m) =>
          m.nrp === currentUser.nrp ||
          (currentUser.oldNrp && m.nrp === currentUser.oldNrp) ||
          (m.oldNrp && m.oldNrp === currentUser.nrp)
      ),
    [members, currentUser.nrp, currentUser.oldNrp]
  );
  const cleanDisplayName = (myMember?.namaLengkap || currentUser.nama)
    .replace(/\(.*?\)/g, '')
    .trim();
  const myPangkat = myMember?.pangkat || currentUser.pangkat;
  const myAvatarUrl = resolveAvatarUrl(myMember?.fotoUrl, currentUser.fotoUrl);

  const roleBadgeColors: Record<UserRole, string> = {
    SUPERADMIN: 'bg-red-100 text-red-900 border-red-300',
    KETUA: 'bg-purple-100 text-purple-900 border-purple-300',
    SEKRETARIAT: 'bg-blue-100 text-blue-900 border-blue-300',
    BENDAHARA: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    ANGGOTA: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  const roleDisplayLabels: Record<UserRole, string> = {
    SUPERADMIN: 'SUPERADMIN',
    KETUA: 'KETUA',
    SEKRETARIAT: 'Sekretaris',
    BENDAHARA: 'BENDAHARA',
    ANGGOTA: 'ANGGOTA',
  };

  const quickSearchResults = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter(
        (m) =>
          !isSuperadminAccount(m.nrp, (m as { role?: string }).role) &&
          (m.namaLengkap.toLowerCase().includes(q) ||
            m.nrp.toLowerCase().includes(q) ||
            (m.jabatanTerakhir || m.jabatan || '').toLowerCase().includes(q) ||
            (m.satuanKerja || m.satker || '').toLowerCase().includes(q) ||
            (m.polda || '').toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [members, searchText]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (appsMenuRef.current && !appsMenuRef.current.contains(e.target as Node)) {
        setIsAppsMenuOpen(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Top Header Bar - Bareskrim Red Accents */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {/* Superadmin Impersonation Banner */}
        {impersonatorUser && (
          <div className="bg-amber-500 text-slate-950 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold flex items-center justify-between gap-2 flex-wrap leading-snug">
            <span className="truncate max-w-full">
              🎭 Mode Impersonate: {cleanDisplayName} ({myPangkat} &bull; {roleDisplayLabels[currentUser.role] || currentUser.role})
            </span>
            {onStopImpersonating && (
              <button
                type="button"
                onClick={onStopImpersonating}
                className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-amber-300 text-[10px] sm:text-[11px] font-extrabold transition-colors shadow-xs shrink-0"
              >
                Kembali ke {impersonatorUser.nama}
              </button>
            )}
          </div>
        )}

        {/* Active Ajudan / ADC Session Banner */}
        {adcSession && (
          <div className="bg-gradient-to-r from-indigo-950 via-blue-900 to-slate-900 text-amber-300 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold flex items-center justify-between gap-2 flex-wrap border-b border-amber-400/30 leading-snug">
            <span className="line-clamp-2 sm:line-clamp-none">
              🎖️ Mode Ajudan / ADC: {adcSession.adcPangkat} {adcSession.adcNama} (NRP {adcSession.adcNrp}) mewakili {adcSession.pimpinanPangkat} {adcSession.pimpinanNama}
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
            
            {/* Left: Brand Logo + Bareskrim Red Search Box */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-md">
              <WSLogo 
                size="sm"
                onClick={() => {
                  setActiveTab('direktori');
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('ws96_reset_beranda'));
                  }
                }}
              />

              {/* Search Bar with Live Quick-Action Results (Mobile & Desktop) */}
              <div className="relative flex-1 min-w-0 max-w-xs" ref={searchBoxRef}>
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Cari perwira, NRP, satker..."
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchText(val);
                    setIsSearchOpen(true);
                    if (onSearchChange) {
                      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = setTimeout(() => {
                        onSearchChange(val);
                      }, 180);
                    }
                  }}
                  className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/70 border border-transparent rounded-lg text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-900/30 focus:border-red-900 transition-all"
                />

                {/* Live Search Dropdown with WA & Obrolan Cepat */}
                {isSearchOpen && searchText.trim().length > 0 && (
                  <div className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto top-14 sm:top-10 z-50 sm:w-[370px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">
                        Hasil Pencarian Perwira ({quickSearchResults.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          setActiveTab('purnaTugas');
                        }}
                        className="text-red-800 font-bold hover:underline"
                      >
                        Lihat di Menu ToD &rarr;
                      </button>
                    </div>

                    {quickSearchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Tidak ditemukan perwira dengan kata kunci &quot;{searchText}&quot;
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {quickSearchResults.map((m) => (
                          <div
                            key={m.nrp}
                            className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                          >
                            <div
                              onClick={() => {
                                setIsSearchOpen(false);
                                if (onSelectMember) onSelectMember(m);
                              }}
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getAvatarUrl(m.fotoUrl)}
                                alt={m.namaLengkap}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-slate-900 truncate hover:text-red-800">
                                  {m.namaLengkap}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {m.pangkat} &bull; NRP {m.nrp}
                                </div>
                                <div className="text-[10px] font-semibold text-red-900 truncate">
                                  {m.jabatanTerakhir || m.jabatan || m.satuanKerja || m.satker} ({m.polda})
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {onOpenChat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSearchOpen(false);
                                    onOpenChat(m);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-900 font-bold text-[10px] flex items-center gap-1 border border-red-200"
                                  title="Obrolan Cepat"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Chat</span>
                                </button>
                              )}
                              {m.noHp && (
                                <a
                                  href={`https://wa.me/${m.noHp.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=Halo%20Komandan%20${encodeURIComponent(m.namaLengkap)}%2C%20salam%20Wira%20Satya%2096`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1"
                                  title="Hubungi via WhatsApp"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>WA</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Stacked Nav Items (Bareskrim Red Active Colors) */}
            {/* Urutan PC: 1. Beranda, 2. Data Diri, 3. Anev, 4. Dana Sosial, 5. Pesan, 6. User, 7. ToD, 8. Notif */}
            <nav className="flex items-center gap-0.5 sm:gap-1.5 lg:gap-2.5 flex-shrink-0">
              
              {/* 1. Beranda */}
              <button
                onClick={() => {
                  setActiveTab('direktori');
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('ws96_reset_beranda'));
                  }
                }}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[52px] text-center transition-all border-b-2 ${
                  activeTab === 'direktori' && !isViewingOwnProfile
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Beranda & Linimasa"
              >
                <div className="relative">
                  <Home className="w-5 h-5" />
                  <span className="w-2 h-2 rounded-full bg-red-800 absolute -top-0.5 -right-0.5" />
                </div>
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Beranda</span>
              </button>

              {/* 2. Data Diri (di HP: RH) */}
              <button
                onClick={() => setActiveTab('form')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[56px] text-center transition-all border-b-2 ${
                  activeTab === 'form' || isViewingOwnProfile
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Data Diri & Riwayat Hidup (RH)"
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Data Diri</span>
              </button>

              {/* 3. Anev */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] text-center transition-all border-b-2 ${
                  activeTab === 'dashboard'
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Analisa & Evaluasi (Anev)"
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Anev</span>
              </button>

              {/* 4. Dana Sosial (di HP: Dansos) */}
              <button
                onClick={() => setActiveTab('bendahara')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[52px] text-center transition-all border-b-2 ${
                  activeTab === 'bendahara'
                    ? 'border-amber-700 text-amber-800 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Dana Sosial & Investasi (Dansos)"
              >
                <Wallet className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Dana Sosial</span>
              </button>

              {/* 5. Pesan */}
              <button
                onClick={() => setActiveTab('pesan')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[52px] text-center transition-all border-b-2 ${
                  activeTab === 'pesan'
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Pesan"
              >
                <div className="relative">
                  <MessageSquare className="w-5 h-5" />
                  {unreadMessagesCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-700 text-white text-[9px] font-bold flex items-center justify-center absolute -top-1 -right-2 ring-2 ring-white">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Pesan</span>
              </button>

              {/* 6. User */}
              <button
                onClick={() => setActiveTab('users')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] text-center transition-all border-b-2 ${
                  activeTab === 'users'
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-600 hover:text-red-900'
                }`}
                title="Direktori Akun & Manajemen User"
              >
                <div className="relative">
                  <Users className="w-5 h-5" />
                  {pendingVerificationCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-700 text-white text-[9px] font-extrabold flex items-center justify-center absolute -top-1 -right-2 ring-2 ring-white animate-pulse">
                      {pendingVerificationCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 whitespace-nowrap">User</span>
              </button>

              {/* 7. ToD (Tour of Duty) */}
              <button
                onClick={() => setActiveTab('purnaTugas')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[48px] text-center transition-all border-b-2 ${
                  activeTab === 'purnaTugas'
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Tour of Duty (ToD) & Sebaran Jabatan"
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">ToD</span>
              </button>

              {/* 8. Notif */}
              <button
                onClick={() => setActiveTab('notifikasi')}
                className={`hidden md:flex flex-col items-center justify-center px-1.5 lg:px-2 py-1 min-w-[46px] lg:min-w-[48px] text-center transition-all border-b-2 ${
                  activeTab === 'notifikasi'
                    ? 'border-red-900 text-red-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
                title="Notifikasi"
              >
                <div className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-700 text-white text-[9px] font-bold flex items-center justify-center absolute -top-1 -right-2 ring-2 ring-white">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 whitespace-nowrap">Notif</span>
              </button>

              {/* Vertical Divider */}
              <div className="h-7 w-px bg-slate-200 hidden sm:block mx-1" />

              {/* 7. Saya (User Menu Popover) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex flex-col sm:flex-row items-center gap-1 p-0.5 sm:px-1.5 sm:py-1 rounded-full sm:rounded-lg hover:bg-slate-100 transition-colors text-slate-700"
                  title="Menu Akun Saya"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={myAvatarUrl}
                    alt={cleanDisplayName}
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-300 flex-shrink-0 bg-white"
                  />
                  <div className="hidden sm:flex items-center gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                      Saya
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </div>
                </button>

                {/* Profile Popover Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 text-xs text-slate-700 animate-fadeIn">
                    
                    {/* Top Mini Card */}
                    <div className="px-4 pb-3 border-b border-slate-100 flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={myAvatarUrl}
                        alt={cleanDisplayName}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0 bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {cleanDisplayName}
                          </h4>
                          <MetaVerifiedBadge role={effectiveRole} nrp={currentUser.nrp} size="sm" />
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {myPangkat} &bull;{' '}
                          {formatJabatanWithSatker(
                            myMember?.jabatanTerakhir === 'Lead Developer'
                              ? 'Staf'
                              : myMember?.jabatanTerakhir || currentUser.jabatanTerakhir || (currentUser.nrp === '98010710' ? 'Staf' : undefined),
                            myMember?.satuanKerja || currentUser.satker || 'Mabes Polri'
                          )}
                        </p>
                        <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border mt-1 ${roleBadgeColors[effectiveRole]}`}>
                          {roleDisplayLabels[effectiveRole]}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 border-b border-slate-100 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onViewMyProfile) onViewMyProfile();
                          else setActiveTab('direktori');
                        }}
                        className={`py-1.5 px-2.5 rounded-full border font-bold text-xs transition-colors text-center ${
                          isViewingOwnProfile
                            ? 'bg-red-800 text-white border-red-800'
                            : 'border-red-800 text-red-900 hover:bg-red-50'
                        }`}
                      >
                        Lihat Profil
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('form');
                        }}
                        className={`py-1.5 px-2.5 rounded-full border font-bold text-xs transition-colors text-center flex items-center justify-center gap-1 ${
                          activeTab === 'form' && !isViewingOwnProfile
                            ? 'bg-red-800 text-white border-red-800'
                            : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-red-800 shrink-0" />
                        <span>Data Diri</span>
                      </button>
                    </div>

                    {/* Section: Akun */}
                    <div className="py-2 border-b border-slate-100">
                      <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Akun
                      </div>
                      
                      {/* Data Diri / Pengkinian Data Mandiri */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('form');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-red-800" />
                          <span className="font-semibold text-slate-900">Data Diri &amp; Pengkinian Profil</span>
                        </span>
                      </button>

                      {/* Pengaturan & Privasi (Opens Settings Page) */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('pengaturan');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="w-3.5 h-3.5 text-red-800" />
                          <span className="font-semibold text-slate-900">Pengaturan</span>
                        </span>
                      </button>

                      {/* User (Tersedia untuk semua akun, mode Kelola/Lihat sesuai Role) */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('users');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-red-50/80 flex items-center justify-between text-slate-700 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-red-800" />
                          <span className="font-semibold text-red-950">User</span>
                        </span>
                        {pendingVerificationCount > 0 &&
                        (effectiveRole === 'SUPERADMIN' ||
                          effectiveRole === 'SEKRETARIAT' ||
                          effectiveRole === 'KETUA') ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-700 text-white animate-pulse">
                            {pendingVerificationCount} Antrean
                          </span>
                        ) : effectiveRole === 'SUPERADMIN' ||
                          effectiveRole === 'SEKRETARIAT' ||
                          effectiveRole === 'KETUA' ? (
                          <span className="text-[10px] font-semibold text-red-800">Kelola</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">Direktori</span>
                        )}
                      </button>
                    </div>

                    {/* Section: Kelola */}
                    <div className="py-2 border-b border-slate-100">
                      <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Menu
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('bendahara');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dana Sosial &amp; Investasi</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('dashboard');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Anev &amp; Statistik</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab('purnaTugas');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <Briefcase className="w-3.5 h-3.5 text-red-800" />
                        <span>ToD (Tour of Duty)</span>
                      </button>
                    </div>

                    {/* Section: Logout */}
                    {onLogout && (
                      <div className="pt-2 px-2">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('ws96_adc_session');
                            }
                            onLogout();
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-700 rounded-lg flex items-center gap-2 font-semibold transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Logout (Keluar)</span>
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* 8. 9-Dots Launcher: Layanan */}
              <div className="relative hidden sm:block" ref={appsMenuRef}>
                <button
                  onClick={() => setIsAppsMenuOpen(!isAppsMenuOpen)}
                  className="flex flex-col items-center justify-center px-1.5 py-1 text-slate-500 hover:text-slate-900 transition-colors"
                  title="Layanan"
                >
                  <LayoutGrid className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5 whitespace-nowrap">Layanan</span>
                </button>

                {isAppsMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 text-xs text-slate-700 animate-fadeIn space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                        <LayoutGrid className="w-4 h-4 text-red-800" />
                        <span>Layanan</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('direktori');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <Home className="w-4 h-4 text-red-800 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">Beranda</div>
                          <div className="text-[10px] text-slate-500 truncate">Linimasa</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('purnaTugas');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <Briefcase className="w-4 h-4 text-amber-700 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">ToD</div>
                          <div className="text-[10px] text-slate-500 truncate">Tour of Duty</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('form');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <User className="w-4 h-4 text-blue-700 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">Data Diri</div>
                          <div className="text-[10px] text-slate-500 truncate">Profil &amp; Pengkinian</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('bendahara');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <Wallet className="w-4 h-4 text-emerald-700 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">Dana Sosial</div>
                          <div className="text-[10px] text-slate-500 truncate">Buku Kas &amp; Investasi</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('dashboard');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <BarChart3 className="w-4 h-4 text-red-800 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">Anev</div>
                          <div className="text-[10px] text-slate-500 truncate">Analisa &amp; Evaluasi</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('users');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all"
                        >
                          <Users className="w-4 h-4 text-indigo-700 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">User</div>
                          <div className="text-[10px] text-slate-500 truncate">Direktori &amp; Otoritas</div>
                        </button>

                        <button
                          onClick={() => {
                            setIsAppsMenuOpen(false);
                            setActiveTab('pengaturan');
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:border-red-800/40 hover:bg-red-50/50 text-left transition-all col-span-2"
                        >
                          <Lock className="w-4 h-4 text-purple-700 mb-1" />
                          <div className="font-bold text-slate-800 text-[11px] truncate">Pengaturan</div>
                          <div className="text-[10px] text-slate-500 truncate">Akun &amp; keamanan</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-1.5 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-red-800" />
                        <span>Dukungan</span>
                      </h4>
                      <div className="space-y-1.5 pt-2 text-[11px]">
                        <div
                          className="p-2 rounded-lg bg-slate-50 flex items-center gap-2"
                          title="Pendampingan medis personel dan keluarga"
                        >
                          <Heart className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">Satgas Kesehatan: </span>
                            <span className="text-slate-500">Pendampingan medis</span>
                          </div>
                        </div>
                        <div
                          className="p-2 rounded-lg bg-slate-50 flex items-center gap-2"
                          title="Advokasi dan konsultasi hukum personel"
                        >
                          <Scale className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">Bantuan Hukum: </span>
                            <span className="text-slate-500">Advokasi &amp; konsultasi</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </nav>

          </div>
        </div>
      </header>

      {/* Bottom Mobile Tab Bar (Tanpa Beranda karena Logo WS di kiri atas sudah ke Beranda) */}
      {/* Urutan HP: 1. RH, 2. Anev, 3. Dansos, 4. Pesan, 5. User, 6. ToD, 7. Notif */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-1 pt-1.5 pb-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-7 gap-0.5 text-[9px] sm:text-[9.5px]">
          {/* 1. RH (Data Diri) */}
          <button
            onClick={() => setActiveTab('form')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'form' || isViewingOwnProfile
                ? 'text-red-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span className="truncate max-w-full">RH</span>
          </button>

          {/* 2. Anev */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'dashboard' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span className="truncate max-w-full">Anev</span>
          </button>

          {/* 3. Dansos (Dana Sosial) */}
          <button
            onClick={() => setActiveTab('bendahara')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'bendahara' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span className="truncate max-w-full">Dansos</span>
          </button>

          {/* 4. Pesan */}
          <button
            onClick={() => setActiveTab('pesan')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'pesan' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {unreadMessagesCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-red-700 text-white text-[8px] font-bold flex items-center justify-center absolute -top-1 -right-2 ring-1 ring-white">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </div>
            <span className="truncate max-w-full">Pesan</span>
          </button>

          {/* 5. User */}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'users' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {pendingVerificationCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-red-700 text-white text-[8px] font-extrabold flex items-center justify-center absolute -top-1 -right-2 ring-1 ring-white animate-pulse">
                  {pendingVerificationCount}
                </span>
              )}
            </div>
            <span className="truncate max-w-full">User</span>
          </button>

          {/* 6. ToD (Tour of Duty) */}
          <button
            onClick={() => setActiveTab('purnaTugas')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'purnaTugas' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span className="truncate max-w-full">ToD</span>
          </button>

          {/* 7. Notif */}
          <button
            onClick={() => setActiveTab('notifikasi')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'notifikasi' ? 'text-red-900 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {unreadNotificationsCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-red-700 text-white text-[8px] font-bold flex items-center justify-center absolute -top-1 -right-2 ring-1 ring-white">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </div>
            <span className="truncate max-w-full">Notif</span>
          </button>
        </div>
      </div>
    </>
  );
};
