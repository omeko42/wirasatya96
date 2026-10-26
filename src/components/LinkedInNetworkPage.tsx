'use client';

import React, { useState } from 'react';
import { AuthUser, AnggotaWiraSatya } from '@/types';
import { isSuperadminAccount, detectStatusKedinasan } from '@/lib/avatarUtils';
import { 
  Users, 
  Shield, 
  Phone, 
  Building,
  UserPlus,
  Edit3,
  Search,
  Building2,
  Calendar,
  HeartHandshake,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LinkedInNetworkPageProps {
  currentUser: AuthUser;
  members: AnggotaWiraSatya[];
  onSelectMember: (member: AnggotaWiraSatya) => void;
  onEditMember?: (member: AnggotaWiraSatya) => void;
  onAddNewMember?: () => void;
  onOpenChat?: (member: AnggotaWiraSatya) => void;
}

export const LinkedInNetworkPage: React.FC<LinkedInNetworkPageProps> = ({
  currentUser,
  members,
  onSelectMember,
  onEditMember,
  onAddNewMember,
  onOpenChat,
}) => {
  const [searchPolda, setSearchPolda] = useState('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpenKelola, setMobileOpenKelola] = useState(false);
  const [mobileOpenAkses, setMobileOpenAkses] = useState(false);

  // Check role permission: SUPERADMIN, KETUA, and SEKRETARIAT have full editing rights
  const isLeadership = ['SUPERADMIN', 'KETUA', 'SEKRETARIAT'].includes(currentUser.role);

  const alumniMembers = members.filter(
    (m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
  );

  const filteredMembers = alumniMembers.filter((m) => {
    const matchPolda = 
      searchPolda === 'SEMUA' || 
      m.polda.toUpperCase() === searchPolda.toUpperCase() ||
      (searchPolda === 'MABES POLRI' && m.polda.toUpperCase().includes('MABES'));

    const q = searchQuery.toLowerCase().trim();
    const matchQuery = 
      !q ||
      m.namaLengkap.toLowerCase().includes(q) ||
      m.nrp.includes(q) ||
      m.jabatanTerakhir.toLowerCase().includes(q) ||
      m.satuanKerja.toLowerCase().includes(q) ||
      (m.subSatker && m.subSatker.toLowerCase().includes(q)) ||
      m.polda.toLowerCase().includes(q) ||
      (m.namaIstri && m.namaIstri.toLowerCase().includes(q)) ||
      (m.daftarAnak && m.daftarAnak.some((a) => a.nama.toLowerCase().includes(q)));

    return matchPolda && matchQuery;
  });

  const activeAndPurnaMembers = filteredMembers.filter(
    (m) =>
      detectStatusKedinasan(
        m.statusKedinasan || m.statusDinas,
        m.jabatanTerakhir || m.jabatan,
        m.jenisAnggota
      ) !== 'ALMARHUM'
  );

  const almarhumMembers = filteredMembers.filter(
    (m) =>
      detectStatusKedinasan(
        m.statusKedinasan || m.statusDinas,
        m.jabatanTerakhir || m.jabatan,
        m.jenisAnggota
      ) === 'ALMARHUM'
  );

  return (
    <div className="max-w-7xl mx-auto py-2 font-sans text-slate-900 pb-20">
      
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ============================================================ */}
        {/* LEFT RAIL (lg:col-span-4): FILTER JARINGAN & STATUS           */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
            <div
              onClick={() => setMobileOpenKelola((prev) => !prev)}
              className="flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <h3 className="text-sm font-bold text-slate-900">
                Kelola Jaringan Leting
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {currentUser.role}
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenKelola ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            <div className={`${mobileOpenKelola ? 'block' : 'hidden'} lg:block pt-2.5 mt-2.5 border-t border-slate-100 space-y-1 text-xs`}>
              <button 
                onClick={() => setSearchPolda('SEMUA')}
                className={`w-full py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors ${
                  searchPolda === 'SEMUA' ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-red-800" />
                  <span>Seluruh Koneksi Leting</span>
                </div>
                <span className="font-bold text-slate-900">{alumniMembers.length}</span>
              </button>

              <button 
                onClick={() => setSearchPolda('POLDA METRO JAYA')}
                className={`w-full py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors ${
                  searchPolda === 'POLDA METRO JAYA' ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span>Polda Metro Jaya</span>
                </div>
                <span className="font-bold text-slate-900">
                  {alumniMembers.filter(m => m.polda.includes('METRO')).length || 18}
                </span>
              </button>

              <button 
                onClick={() => setSearchPolda('MABES POLRI')}
                className={`w-full py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors ${
                  searchPolda === 'MABES POLRI' ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Mabes Polri</span>
                </div>
                <span className="font-bold text-slate-900">
                  {alumniMembers.filter(m => m.polda.includes('MABES')).length || 32}
                </span>
              </button>

              <div className="w-full py-2 px-2.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Agenda Reuni &amp; Temu Letting</span>
                </div>
                <span className="font-bold text-slate-900">3 Acara</span>
              </div>

              <div className="w-full py-2 px-2.5 flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2.5">
                  <HeartHandshake className="w-4 h-4 text-red-500" />
                  <span>Yayasan Wira Satya 96</span>
                </div>
                <span className="font-bold text-slate-900">Aktif</span>
              </div>
            </div>
          </div>

          {/* Slogan Banner (Tampil di PC) */}
          <div className="hidden lg:block p-4 bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 text-white rounded-xl shadow-sm text-center space-y-1">
            <span className="text-[11px] font-black text-amber-300 tracking-wider">
              BATALYON WIRA SATYA AKPOL 1996
            </span>
            <p className="text-xs font-medium text-slate-200">
              Guyub, Peduli, dan Mengabdi Untuk Negeri #SelaluBahagia
            </p>
          </div>

          {/* Hak Akses Info */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div
              onClick={() => setMobileOpenAkses((prev) => !prev)}
              className="font-bold text-slate-800 flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-800" />
                <span>Kewenangan Akses ({currentUser.role})</span>
              </span>
              <span className="lg:hidden text-slate-400">
                {mobileOpenAkses ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </div>
            <p className={`${mobileOpenAkses ? 'block' : 'hidden'} lg:block text-[11px] text-slate-500 leading-relaxed pt-2 mt-2 border-t border-slate-200/70`}>
              {isLeadership
                ? 'Sebagai Pengurus / Pimpinan, Anda memiliki wewenang untuk melihat, memverifikasi, dan mengedit data seluruh anggota leting se-Indonesia.'
                : 'Sebagai Anggota, Anda dapat melihat direktori seluruh rekan leting dan hanya dapat memperbarui data profil Anda sendiri.'}
            </p>
          </div>

        </div>

        {/* ============================================================ */}
        {/* CENTER / MAIN CONTENT (lg:col-span-8): DIREKTORI JARINGAN    */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-red-800" />
                  <span className="sm:hidden">Direktori Jaringan ({filteredMembers.length})</span>
                  <span className="hidden sm:inline">Direktori Jaringan Leting Wira Satya 96</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="sm:hidden">Perwira leting Akpol 1996 di seluruh wilayah penugasan.</span>
                  <span className="hidden sm:inline">
                    Menampilkan <b>{filteredMembers.length}</b> perwira leting Akpol 1996 di seluruh wilayah penugasan.
                  </span>
                </p>
              </div>

              {/* Action: Add member button (Only for Sekretariat, Ketua, Superadmin) */}
              {isLeadership && onAddNewMember && (
                <button
                  onClick={onAddNewMember}
                  title="Input Anggota Baru"
                  className="px-3.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="sm:hidden">Tambah</span>
                  <span className="hidden sm:inline">Input Anggota Baru</span>
                </button>
              )}
            </div>

            {/* Search Input Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NRP, jabatan, satker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-800"
                />
              </div>

              {searchPolda !== 'SEMUA' && (
                <button
                  onClick={() => setSearchPolda('SEMUA')}
                  className="text-xs text-red-600 font-bold hover:underline px-2 whitespace-nowrap"
                >
                  <span className="sm:hidden">Reset</span>
                  <span className="hidden sm:inline">Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid of Connection Cards (Aktif & Purna Tugas) */}
          {activeAndPurnaMembers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeAndPurnaMembers.map((member) => {
                const isSelf = currentUser.nrp === member.nrp;
                const canEditThisMember = isLeadership || isSelf;

                return (
                  <div
                    key={member.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col text-center"
                  >
                    {/* Top Cover */}
                    <div className="h-14 relative overflow-hidden bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/default-cover.jpg"
                        alt="Sampul"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 right-2 px-2 py-0.5 rounded-full bg-black/50 text-[9px] font-bold text-amber-300">
                        {member.pangkat}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-3 pt-0 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Avatar */}
                        <div 
                          onClick={() => onSelectMember(member)}
                          className="w-14 h-14 rounded-full border-2 border-white shadow mx-auto -mt-7 overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={member.fotoUrl || '/default-avatar.png'}
                            alt={member.namaLengkap}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <h4 
                          onClick={() => onSelectMember(member)}
                          className="text-xs font-bold text-slate-900 hover:text-red-900 cursor-pointer mt-2 line-clamp-1"
                          title={member.namaLengkap}
                        >
                          {member.namaLengkap.split(',')[0]}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
                          {member.jabatanTerakhir}
                        </p>
                        <p className="text-[10px] font-semibold text-red-900 mt-0.5 truncate">
                          {member.satuanKerja}
                        </p>

                        <div className="mt-1.5 flex items-center justify-center">
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-900 border border-red-200 text-[9px] font-bold">
                            {member.kompi || 'KOMPI A'} &bull; {member.pleton || 'PLETON 1'}
                          </span>
                        </div>

                        <div className="mt-1.5 text-[10px] text-slate-400">
                          <span>Alumni Akpol 1996 &bull; Purna {member.tahunPurnaTugas}</span>
                        </div>
                      </div>

                      {/* Action Buttons: Kirim WA, Chat, Profil, and Edit */}
                      <div className="pt-3 mt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`https://wa.me/${member.noHp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="py-1 px-2 rounded-full border border-red-800 text-red-900 hover:bg-red-50 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors flex-1"
                          title="Kirim Pesan WhatsApp"
                        >
                          <Phone className="w-3 h-3" />
                          <span>WA</span>
                        </a>

                        {!isSelf && onOpenChat && (
                          <button
                            onClick={() => onOpenChat(member)}
                            className="py-1 px-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors flex-1"
                            title="Buka Obrolan Leting Langsung"
                          >
                            <MessageSquare className="w-3 h-3 text-amber-400" />
                            <span>Chat</span>
                          </button>
                        )}
                        
                        <button
                          onClick={() => onSelectMember(member)}
                          className="py-1 px-2.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                          title="Lihat Profil Lengkap"
                        >
                          Profil
                        </button>

                        {/* EDIT BUTTON: Only shown if user is Ketua, Sekretariat, Superadmin, OR editing self */}
                        {canEditThisMember && onEditMember && (
                          <button
                            onClick={() => onEditMember(member)}
                            className="py-1 px-2.5 rounded-full bg-red-800 hover:bg-red-900 text-white text-[11px] font-bold transition-colors flex items-center gap-1 shadow-xs"
                            title={isSelf ? 'Perbarui Profil Saya' : `Edit Data Anggota (${currentUser.role})`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grup Khusus In Memoriam — Keluarga Besar Almarhum Wira Satya 96 */}
          {almarhumMembers.length > 0 && (
            <div className="space-y-3.5 pt-2">
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-amber-400/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                    <span>🕊️ In Memoriam — Keluarga Besar Almarhum Wira Satya 96</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Dikelompokkan tersendiri untuk silaturahmi, pendataan Istri / Ahli Waris, serta Putra-Putri rekan leting Almarhum.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold self-start sm:self-auto shrink-0">
                  {almarhumMembers.length} Almarhum
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {almarhumMembers.map((member) => {
                  const canEditThisMember = isLeadership || currentUser.nrp === member.nrp;
                  const kontakKeluarga = member.kontakIstri || member.noHp;
                  const daftarAnak = Array.isArray(member.daftarAnak) ? member.daftarAnak : [];

                  return (
                    <div
                      key={member.id}
                      className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between p-4 space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div
                            onClick={() => onSelectMember(member)}
                            className="w-12 h-12 rounded-full border-2 border-slate-400 overflow-hidden bg-slate-100 shrink-0 cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={member.fotoUrl || '/default-avatar.png'}
                              alt={member.namaLengkap}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-[9px] font-bold">
                                  🕊️ IN MEMORIAM • {member.pangkat}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-900 border border-red-200 text-[9px] font-bold">
                                  {member.kompi || 'KOMPI A'} &bull; {member.pleton || 'PLETON 1'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500">NRP {member.nrp}</span>
                            </div>
                            <h4
                              onClick={() => onSelectMember(member)}
                              className="text-xs font-extrabold text-slate-900 hover:text-red-900 cursor-pointer mt-1 truncate"
                              title={member.namaLengkap}
                            >
                              Alm. {member.namaLengkap}
                            </h4>
                            <p className="text-[10px] text-slate-500 truncate">
                              {member.jabatanTerakhir} • {member.satuanKerja}
                            </p>
                          </div>
                        </div>

                        {/* Ringkasan Keluarga (Istri & Anak) */}
                        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] space-y-1 text-left">
                          <p className="text-amber-950">
                            <b>👩 Istri / Ahli Waris:</b>{' '}
                            {member.namaIstri?.trim() ? (
                              member.namaIstri
                            ) : (
                              <span
                                onClick={() => onEditMember ? onEditMember(member) : onSelectMember(member)}
                                className="text-amber-700 font-semibold italic underline cursor-pointer hover:text-red-800"
                              >
                                Belum Diisi — Klik untuk mendata Istri &amp; Anak
                              </span>
                            )}
                          </p>
                          <p className="text-slate-700">
                            <b>📞 Kontak Keluarga:</b> {kontakKeluarga || '-'}
                          </p>
                          <p className="text-slate-700">
                            <b>🏠 Domisili:</b> {member.alamatTempatTinggal || '-'}
                          </p>
                          <div className="pt-1 border-t border-amber-200/60">
                            <span className="font-bold text-slate-800 block mb-1">
                              🎓 Putra-Putri ({daftarAnak.length || member.jumlahAnak || 0} Anak):
                            </span>
                            {daftarAnak.length > 0 ? (
                              <div className="space-y-1">
                                {daftarAnak.map((anak, idx) => (
                                  <div
                                    key={anak.id || idx}
                                    className="bg-white px-2 py-1 rounded border border-amber-200/70 flex items-center justify-between gap-1 text-[10px]"
                                  >
                                    <span className="font-semibold text-slate-800 truncate">
                                      {idx + 1}. {anak.nama}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-bold shrink-0">
                                      {anak.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Belum ada rincian anak</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        {kontakKeluarga && (
                          <a
                            href={`https://wa.me/${kontakKeluarga.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="py-1 px-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors flex-1"
                            title="Hubungi Keluarga Almarhum via WhatsApp"
                          >
                            <Phone className="w-3 h-3" />
                            <span>WA Keluarga</span>
                          </a>
                        )}

                        <button
                          onClick={() => onSelectMember(member)}
                          className="py-1 px-2.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                        >
                          Profil Keluarga
                        </button>

                        {canEditThisMember && onEditMember && (
                          <button
                            onClick={() => onEditMember(member)}
                            className="py-1 px-2.5 rounded-full bg-slate-800 hover:bg-slate-900 text-amber-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Keluarga</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredMembers.length === 0 && (
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-2">
              <p className="text-slate-600 text-xs">Tidak ada perwira leting yang cocok dengan kriteria pencarian.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchPolda('SEMUA');
                }}
                className="text-xs font-bold text-red-900 hover:underline"
              >
                Reset Semua Filter
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
