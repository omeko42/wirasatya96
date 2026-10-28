'use client';

import React, { useState } from 'react';
import { DAFTAR_PANGKAT_POLRI } from '@/types';
import { SatkerBerjenjangModal, SatkerSelectionResult } from './SatkerBerjenjangModal';
import { 
  X, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Lock, 
  Building2, 
  Mail
} from 'lucide-react';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [nrp, setNrp] = useState('');
  const [nama, setNama] = useState('');
  const [pangkat, setPangkat] = useState('Kombes Pol');
  const [polda, setPolda] = useState('');
  const [satkerUtama, setSatkerUtama] = useState('');
  const [subSatker, setSubSatker] = useState('');
  const [satker, setSatker] = useState('');
  const [kodeSatker, setKodeSatker] = useState('');
  const [isSatkerModalOpen, setIsSatkerModalOpen] = useState(false);

  const [noHp, setNoHp] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [alasanDaftar, setAlasanDaftar] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleNrpChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '');
    const oldAutoEmail = `${nrp}@polri.go.id`;
    setNrp(digitsOnly);
    if (!email.trim() || email.trim() === oldAutoEmail) {
      setEmail(digitsOnly ? `${digitsOnly}@polri.go.id` : '');
    }
  };

  const handleApplySatker = (result: SatkerSelectionResult) => {
    setPolda(result.polda);
    setSatkerUtama(result.satkerUtama);
    setSubSatker(result.subSatker);
    setSatker(result.composedSatker);
    setKodeSatker(result.kodeSatker);
    setIsSatkerModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!nrp.trim() || !nama.trim()) {
      setErrorMessage('Harap lengkapi NRP dan Nama Lengkap Anda.');
      return;
    }

    if (!satker.trim() || !polda.trim()) {
      setErrorMessage('Silakan pilih Satker Melekat terlebih dahulu melalui tombol Pilih Satker Berjenjang.');
      setIsSatkerModalOpen(true);
      return;
    }

    if (nrp.trim().length < 6) {
      setErrorMessage('Format NRP tidak valid. Minimal 6-8 digit.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: nrp.trim(),
          nama: nama.trim(),
          pangkat,
          satker: satker.trim(),
          polda: polda.trim(),
          noHp: noHp.trim(),
          email: email.trim() || `${nrp.trim()}@polri.go.id`,
          secondaryEmail: secondaryEmail.trim() || undefined,
          alasanDaftar: alasanDaftar.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSubmittedSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(data.message || 'Pendaftaran gagal diproses. Silakan coba kembali.');
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan saat mengirimkan data pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSubmittedSuccess(false);
    setNrp('');
    setNama('');
    setPolda('');
    setSatkerUtama('');
    setSubSatker('');
    setSatker('');
    setKodeSatker('');
    setNoHp('');
    setEmail('');
    setSecondaryEmail('');
    setAlasanDaftar('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-4 sm:p-5 text-white flex items-center justify-between border-b border-red-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-900/60 border border-red-700/50 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Pendaftaran Anggota Alumni WS 1996
              </h3>
              <p className="text-xs text-slate-300">
                Registrasi mandiri khusus Perwira Alumni Batalyon Wira Satya Akpol 1996
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isSubmittedSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                Pendaftaran Berhasil Diajukan!
              </h4>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left text-slate-700 space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Nama Personel:</span>
                  <span className="font-bold text-slate-900">{nama}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">NRP / Pangkat:</span>
                  <span className="font-bold text-slate-900">{nrp} ({pangkat})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Penempatan:</span>
                  <span className="font-bold text-slate-900">{satker} - {polda}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Email Dinas:</span>
                  <span className="font-mono font-bold text-slate-900">{email || `${nrp}@polri.go.id`}</span>
                </div>
                {secondaryEmail && (
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Email Sekunder:</span>
                    <span className="font-semibold text-blue-700">{secondaryEmail}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Akun:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                    Menunggu Verifikasi Superadmin / Sekretaris
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 text-left space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Langkah Selanjutnya:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  1. Berkas Anda akan diverifikasi oleh <strong>Superadmin / Sekretaris Batalyon</strong> demi keamanan data alumni.<br />
                  2. Setelah disetujui, buka halaman Login dan masukkan <strong>NRP Anda ({nrp})</strong>.<br />
                  3. Sistem akan meminta Anda menetapkan <strong>Kata Sandi Baru</strong> untuk mengaktifkan akun secara mandiri.
                </p>
              </div>

              <button
                onClick={handleResetAndClose}
                className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs transition-colors shadow-md"
              >
                Selesai &amp; Kembali
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NRP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NRP / NIP Personel <span className="text-red-700">*</span>
                  </label>
                  <input name="ws96_registrationmodal_nrp_1"
                    type="text"
                    required
                    placeholder="Contoh: 74090123"
                    value={nrp}
                    onChange={(e) => handleNrpChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                  />
                </div>

                {/* Pangkat */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pangkat <span className="text-red-700">*</span>
                  </label>
                  <select name="ws96_registrationmodal_pangkat_2" aria-label="pangkat"
                    value={pangkat}
                    onChange={(e) => setPangkat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                  >
                    {DAFTAR_PANGKAT_POLRI.map((pkt) => (
                      <option key={pkt} value={pkt}>{pkt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nama Lengkap & Gelar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar <span className="text-red-700">*</span>
                </label>
                <input name="ws96_registrationmodal_nama_3"
                  type="text"
                  required
                  placeholder="Contoh: Kombes Pol. Bambang Sugiyono, S.I.K., M.H."
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>

              {/* Satker Melekat (CAS-style Satker Berjenjang Picker) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Satker Melekat (Mabes / Polda / Polres / Direktorat) <span className="text-red-700">*</span>
                </label>
                <div className="flex items-stretch gap-2">
                  <div
                    onClick={() => setIsSatkerModalOpen(true)}
                    className={`flex-1 px-3 py-2.5 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors ${
                      satker
                        ? 'bg-slate-50 border-slate-300 hover:border-blue-400'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {satker ? (
                      <>
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-900 block truncate text-xs">
                            {satker}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                            <span>{polda}</span>
                            {kodeSatker && (
                              <span className="font-mono text-slate-400">({kodeSatker})</span>
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs flex items-center gap-1.5">
                        <span>🔒 — Belum Memilih Satker —</span>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSatkerModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs whitespace-nowrap transition-colors"
                  >
                    Pilih Satker Berjenjang
                  </button>
                </div>
              </div>

              {/* Email Dinas & Email Sekunder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Dinas Polri (@polri.go.id)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input name="ws96_registrationmodal_email_4"
                      type="email"
                      placeholder={nrp ? `${nrp}@polri.go.id` : 'nrp@polri.go.id'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Sekunder / Pribadi <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input name="ws96_registrationmodal_secondaryEmail_5"
                    type="email"
                    placeholder="Contoh: superadmin@example.com"
                    value={secondaryEmail}
                    onChange={(e) => setSecondaryEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* No WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. Handphone / WhatsApp Aktif
                </label>
                <input name="ws96_registrationmodal_noHp_6"
                  type="tel"
                  placeholder="Contoh: 081298765432"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>

              {/* Keterangan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Batalyon (Opsional)
                </label>
                <textarea name="ws96_registrationmodal_alasanDaftar_7"
                  rows={2}
                  placeholder="Catatan leting / pleton Akpol 1996 atau keterangan ADC..."
                  value={alasanDaftar}
                  onChange={(e) => setAlasanDaftar(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-red-800 focus:outline-none resize-none"
                />
              </div>

              {/* Security Notice */}
              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>
                  Data pendaftaran terenkripsi dan diverifikasi langsung oleh Superadmin / Sekretaris Paguyuban Wira Satya 96.
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Mengirim Pendaftaran...' : 'Ajukan Pendaftaran Anggota'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* CAS-Style Pilih Satker Berjenjang Modal */}
      <SatkerBerjenjangModal
        isOpen={isSatkerModalOpen}
        onClose={() => setIsSatkerModalOpen(false)}
        initialPolda={polda}
        initialSatker={satkerUtama}
        initialSubSatker={subSatker}
        onApply={handleApplySatker}
      />
    </div>
  );
};
