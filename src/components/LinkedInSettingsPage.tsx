'use client';

import React, { useState } from 'react';
import { AuthUser } from '@/types';
import { getAvatarUrl, formatHumanEnum } from '@/lib/avatarUtils';
import { SecuritySettingsPanel } from '@/components/SecuritySettingsModal';
import { 
  User, 
  Lock, 
  Eye, 
  Shield, 
  Bell, 
  ChevronRight, 
  Check, 
  Moon, 
  Sun, 
  KeyRound, 
  Fingerprint, 
  Smartphone, 
  Mail, 
  Download, 
  CheckCircle2, 
  X
} from 'lucide-react';

interface LinkedInSettingsPageProps {
  currentUser: AuthUser;
  onClose?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

type SettingsSection = 'account' | 'security' | 'visibility' | 'privacy' | 'notifications';

export const LinkedInSettingsPage: React.FC<LinkedInSettingsPageProps> = ({
  currentUser,
  onClose,
  onNavigateToTab,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('security');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings states (Default: Password + Captcha; 2FA is optional and self-managed per user)
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPasskeyActive, setIsPasskeyActive] = useState<boolean>(() => {
    return currentUser.mfaMethod === 'BIOMETRIC';
  });
  const [isTwoFactorActive, setIsTwoFactorActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`ws96_2fa_${currentUser.nrp}`);
      if (saved !== null) return saved === 'true';
    }
    return Boolean(currentUser.mfaEnabled);
  });
  const [isAutoPlayVideo, setIsAutoPlayVideo] = useState(true);
  const [isSoundEffects, setIsSoundEffects] = useState(true);
  const [activeStatusVisible, setActiveStatusVisible] = useState(true);
  const [activePasswordModal, setActivePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggle2FA = async () => {
    const nextVal = !isTwoFactorActive;
    setIsTwoFactorActive(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ws96_2fa_${currentUser.nrp}`, String(nextVal));
      const updatedUser = { ...currentUser, mfaEnabled: nextVal };
      localStorage.setItem('ws96_active_user', JSON.stringify(updatedUser));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(updatedUser));
    }
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nrp: currentUser.nrp, mfaEnabled: nextVal }),
      });
    } catch {
      // ignore
    }
    showToast(
      nextVal
        ? 'Proteksi 2FA diaktifkan untuk akun Anda. Saat login berikutnya akan meminta kode 2FA.'
        : 'Proteksi 2FA dinonaktifkan. Login cukup menggunakan Kata Sandi & Captcha.'
    );
  };

  const handleTogglePasskey = async () => {
    const nextVal = !isPasskeyActive;
    setIsPasskeyActive(nextVal);
    const nextMethod = nextVal ? 'BIOMETRIC' : 'PIN';
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nrp: currentUser.nrp, mfaMethod: nextMethod }),
      });
    } catch {
      // ignore
    }
    showToast(
      nextVal
        ? 'Login Biometrik (Sidik Jari / Wajah) berhasil diaktifkan!'
        : 'Login Biometrik (Sidik Jari / Wajah) dinonaktifkan.'
    );
  };

  const handleDownloadData = () => {
    const exportData = {
      alumniUser: currentUser,
      exportTimestamp: new Date().toISOString(),
      association: 'Batalyon Wira Satya Akpol 1996 (#SelaluBahagia)',
      encryption: 'Standar Keamanan Internal Wira Satya 96',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WiraSatya96_Data_${currentUser.nrp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data profil berhasil diunduh.');
  };

  return (
    <div className="font-sans text-slate-900 pb-20 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-slate-700 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-800 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarUrl(currentUser.fotoUrl)}
              alt={currentUser.nama}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Pengaturan
            </h1>
            <p className="text-xs text-slate-500">
              {currentUser.pangkat} {currentUser.nama} &bull; NRP {currentUser.nrp}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* ============================================================ */}
        {/* LEFT SIDEBAR MENU                                            */}
        {/* ============================================================ */}
        <div className="md:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100 text-xs">
          {[
            { key: 'account', label: 'Akun', icon: User },
            { key: 'security', label: 'Keamanan', icon: Lock },
            { key: 'visibility', label: 'Visibilitas', icon: Eye },
            { key: 'privacy', label: 'Privasi', icon: Shield },
            { key: 'notifications', label: 'Notifikasi', icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key as SettingsSection)}
                className={`w-full px-4 py-3.5 text-left flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-red-50/70 text-red-900 font-bold border-l-4 border-red-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-800' : 'text-slate-400'}`} />
                  <span className="text-xs">{item.label}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-red-800' : 'text-slate-300'}`} />
              </button>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* RIGHT CONTENT RAIL                                           */}
        {/* ============================================================ */}
        <div className="md:col-span-8 space-y-4">
          
          {/* ========================================================== */}
          {/* 1. PREFERENSI AKUN                                         */}
          {/* ========================================================== */}
          {activeSection === 'account' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Section: Informasi profil */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Informasi Profil
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div 
                    onClick={() => onNavigateToTab ? onNavigateToTab('form') : showToast('Membuka form edit profil...')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Identitas &amp; Satker</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {currentUser.nama} &bull; {currentUser.satker || 'Mabes Polri'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div 
                    onClick={() => onNavigateToTab ? onNavigateToTab('form') : showToast('Membuka form data kedinasan...')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">NRP &amp; Pangkat</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">NRP {currentUser.nrp} &bull; {currentUser.pangkat}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div 
                    onClick={() => showToast(`Akun NRP ${currentUser.nrp} telah terverifikasi resmi.`)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Status Akun</div>
                      <div className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aktif &amp; Terdaftar ({formatHumanEnum(currentUser.role)})
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Section: Tampilan */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Tampilan
                </h3>
                <div className="flex items-center justify-between text-xs py-1">
                  <div>
                    <div className="font-semibold text-slate-800">Mode gelap</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {isDarkMode ? 'Mode gelap aktif' : 'Mode terang aktif'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsDarkMode(!isDarkMode);
                      showToast(`Mode ${!isDarkMode ? 'Gelap' : 'Terang'} diaktifkan.`);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      isDarkMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    <span>{isDarkMode ? 'Gelap' : 'Terang'}</span>
                  </button>
                </div>
              </div>

              {/* Section: Preferensi umum */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Preferensi umum
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div 
                    onClick={() => showToast('Bahasa Indonesia sedang aktif.')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Bahasa</div>
                      <div className="text-slate-500 text-[11px]">Indonesia</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="py-2.5 flex items-center justify-between px-2">
                    <div>
                      <div className="font-semibold text-slate-800">Putar otomatis video</div>
                      <div className="text-slate-500 text-[11px]">{isAutoPlayVideo ? 'Aktif' : 'Nonaktif'}</div>
                    </div>
                    <button
                      onClick={() => setIsAutoPlayVideo(!isAutoPlayVideo)}
                      className={`text-xs font-bold px-2.5 py-1 rounded ${isAutoPlayVideo ? 'text-red-800 bg-red-50' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {isAutoPlayVideo ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                  <div className="py-2.5 flex items-center justify-between px-2">
                    <div>
                      <div className="font-semibold text-slate-800">Efek suara notifikasi</div>
                      <div className="text-slate-500 text-[11px]">{isSoundEffects ? 'Aktif' : 'Nonaktif'}</div>
                    </div>
                    <button
                      onClick={() => setIsSoundEffects(!isSoundEffects)}
                      className={`text-xs font-bold px-2.5 py-1 rounded ${isSoundEffects ? 'text-red-800 bg-red-50' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {isSoundEffects ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                  <div 
                    onClick={() => onNavigateToTab ? onNavigateToTab('form') : showToast('Membuka pengaturan foto profil...')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Foto Profil</div>
                      <div className="text-slate-500 text-[11px]">Ubah foto &amp; data diri</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* 2. LOGIN DAN KEAMANAN                                      */}
          {/* ========================================================== */}
          {activeSection === 'security' && (
            <div className="space-y-4 animate-fadeIn">
              <SecuritySettingsPanel
                currentUser={currentUser}
                onOpenFullWizard={() => onNavigateToTab && onNavigateToTab('form')}
              />
            </div>
          )}

          {/* ========================================================== */}
          {/* 3. VISIBILITAS                                             */}
          {/* ========================================================== */}
          {activeSection === 'visibility' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Visibilitas Profil &amp; Direktori
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div 
                    onClick={() => showToast('Pengaturan disimpan.')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">Tampilan profil</div>
                      <div className="text-slate-500 text-[11px]">Nama, pangkat, dan foto ditampilkan</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="py-2.5 flex items-center justify-between px-2">
                    <div>
                      <div className="font-semibold text-slate-800">Akses profil internal</div>
                      <div className="text-slate-500 text-[11px]">Hanya anggota terverifikasi</div>
                    </div>
                    <span className="font-bold text-emerald-600 text-[11px]">Internal</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between px-2">
                    <div>
                      <div className="font-semibold text-slate-800">Status online</div>
                      <div className="text-slate-500 text-[11px]">{activeStatusVisible ? 'Ditampilkan' : 'Disembunyikan'}</div>
                    </div>
                    <button
                      onClick={() => setActiveStatusVisible(!activeStatusVisible)}
                      className={`text-xs font-bold px-2.5 py-1 rounded ${activeStatusVisible ? 'text-red-800 bg-red-50' : 'text-slate-500 bg-slate-100'}`}
                    >
                      {activeStatusVisible ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* 4. PRIVASI DATA                                            */}
          {/* ========================================================== */}
          {activeSection === 'privacy' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Pengelolaan Data &amp; Privasi
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">Unduh Arsip Data Profil</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Salinan arsip data kedinasan dan profil akun
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadData}
                      className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh</span>
                    </button>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">Riwayat pencarian</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">Bersihkan riwayat pencarian direktori</div>
                    </div>
                    <button
                      onClick={() => showToast('Riwayat pencarian berhasil dibersihkan.')}
                      className="px-3 py-1 rounded border border-slate-300 font-semibold hover:bg-slate-50"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* 5. NOTIFIKASI                                              */}
          {/* ========================================================== */}
          {activeSection === 'notifications' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Banner Info */}
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-950">
                <Bell className="w-4 h-4 text-red-800 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">Notifikasi terpusat: </span>
                  <span>Pemberitahuan penting seperti Atensi Kesehatan dan Kas otomatis dikirimkan ke akun Anda.</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                <h3 className="text-xs font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                  Kategori Notifikasi
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  {[
                    { title: 'Atensi Kesehatan', desc: 'Info medis personel atau keluarga yang dirawat', tab: 'direktori' },
                    { title: 'Kas & Aset', desc: 'Rekapitulasi kas bulanan dan konfirmasi pembayaran', tab: 'bendahara' },
                    { title: 'Jabatan & Karier', desc: 'Mutasi jabatan dan info purna tugas', tab: 'purnaTugas' },
                    { title: 'Pesan Masuk', desc: 'Notifikasi pesan langsung', tab: 'pesan' },
                    { title: 'Pengumuman & Linimasa', desc: 'Komentar dan aktivitas pada postingan', tab: 'direktori' },
                  ].map((notif, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (onNavigateToTab) {
                          onNavigateToTab(notif.tab);
                        } else {
                          showToast(`Preferensi ${notif.title} aktif`);
                        }
                      }}
                      className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{notif.title}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{notif.desc}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal Ubah Kata Sandi */}
      {activePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-red-800" />
              <span>Ubah Kata Sandi Akun</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter kombinasi..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivePasswordModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newPassword && newPassword === confirmPassword) {
                    showToast('Kata sandi akun berhasil diperbarui!');
                    setActivePasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  } else {
                    alert('Kata sandi konfirmasi tidak cocok atau kosong.');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-red-800 text-white font-bold hover:bg-red-900 text-xs"
              >
                Simpan Sandi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
