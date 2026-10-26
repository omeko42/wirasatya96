'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  AuthUser,
  AnggotaWiraSatya,
  KasTransaction,
  AssetPortfolioItem,
  FeedPost,
  ChatMessage,
} from '@/types';
import { getAvatarUrl, isSuperadminAccount } from '@/lib/avatarUtils';
import { MetaVerifiedBadge } from '@/components/MetaVerifiedBadge';
import {
  Bell,
  CheckCheck,
  Heart,
  Wallet,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface LinkedInNotificationsPageProps {
  currentUser: AuthUser;
  members?: AnggotaWiraSatya[];
  transactions?: KasTransaction[];
  assets?: AssetPortfolioItem[];
  posts?: FeedPost[];
  messages?: ChatMessage[];
  pendingVerificationCount?: number;
  onNavigateToTab: (tab: string) => void;
  onViewMyProfile?: () => void;
  onSelectMember?: (member: AnggotaWiraSatya) => void;
  onOpenVerificationModal?: () => void;
}

export interface NotificationItem {
  id: string;
  type: 'HEALTH' | 'TREASURY' | 'SOCIAL';
  title: string;
  description: string;
  timeAgo: string;
  isRead: boolean;
  avatarUrl?: string;
  actionLabel?: string;
  targetTab?: string;
  memberNrp?: string;
  openVerification?: boolean;
}

export const LinkedInNotificationsPage: React.FC<LinkedInNotificationsPageProps> = ({
  currentUser,
  members = [],
  transactions = [],
  assets = [],
  posts = [],
  messages = [],
  pendingVerificationCount = 0,
  onNavigateToTab,
  onViewMyProfile,
  onSelectMember,
  onOpenVerificationModal,
}) => {
  const [activeFilter, setActiveFilter] = useState<'semua' | 'health' | 'treasury' | 'social'>('semua');
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`ws96_read_notifs_${currentUser.nrp}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`ws96_read_notifs_${currentUser.nrp}`);
        if (saved) setReadIds(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [currentUser.nrp]);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);

  // Dynamically build real notifications from live data across modules
  const notifications: NotificationItem[] = useMemo(() => {
    const items: NotificationItem[] = [];
    const readSet = new Set(readIds);

    const stripTechNoise = (raw?: string): string =>
      (raw || '')
        .replace(/\[SIMULASI DUMMY\]\s*/gi, '')
        .replace(/\[AKUN SIMULASI[^\]]*\]\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 0. Pending Verification Alert for Admin & Sekretaris
    if (
      (currentUser.role === 'SUPERADMIN' || currentUser.role === 'SEKRETARIAT') &&
      pendingVerificationCount > 0
    ) {
      const id = `notif-verif-${pendingVerificationCount}`;
      items.push({
        id,
        type: 'SOCIAL',
        title: `Verifikasi Akun Baru (${pendingVerificationCount})`,
        description: `${pendingVerificationCount} pendaftar baru menunggu persetujuan akun.`,
        timeAgo: 'Menunggu',
        isRead: readSet.has(id),
        avatarUrl: '/default-avatar.png',
        actionLabel: 'Manajemen User',
        openVerification: true,
      });
    }

    // 1. Incoming Direct Messages to currentUser
    const incomingMsgs = messages
      .filter((m) => m.receiverNrp === currentUser.nrp)
      .slice(-5)
      .reverse();

    incomingMsgs.forEach((msg) => {
      const id = `notif-msg-${msg.id}`;
      items.push({
        id,
        type: 'SOCIAL',
        title: `Pesan Masuk dari ${msg.senderName}`,
        description: `"${stripTechNoise(msg.text)}"`,
        timeAgo: msg.timestamp || 'Baru saja',
        isRead: Boolean(msg.isRead) || readSet.has(id),
        avatarUrl: getAvatarUrl(msg.senderAvatar),
        actionLabel: 'Balas di Menu Pesan',
        targetTab: 'pesan',
      });
    });

    // 2. Health Attention Alerts from Real Member Data (❤️ Kesehatan)
    const healthMembers = members.filter(
      (m) =>
        !isSuperadminAccount(m.nrp, (m as { role?: string }).role) &&
        (m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' ||
          m.kondisiKesehatan === 'SAKIT' ||
          m.adaPenyakitKronis === 'ADA' ||
          (m.daftarPenyakit && m.daftarPenyakit.length > 0))
    );

    healthMembers.forEach((m) => {
      const id = `notif-health-${m.nrp}-${m.kondisiKesehatan}`;
      const isUrgent =
        m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT';
      const diagnosa =
        m.daftarPenyakit && m.daftarPenyakit.length > 0
          ? m.daftarPenyakit.join(', ')
          : m.kondisiSaatIni || m.catatanMedis || 'Pemantauan kondisi medis rutin';
      items.push({
        id,
        type: 'HEALTH',
        title: `${isUrgent ? '🚨 Info Peduli Kesehatan:' : '❤️ Pemantauan Kesehatan:'} ${m.pangkat ? m.pangkat + ' ' : ''}${m.namaLengkap}`,
        description: `${stripTechNoise(diagnosa)}${m.kondisiSaatIni ? ` — ${stripTechNoise(m.kondisiSaatIni)}` : ''}.`,
        timeAgo: 'Info Kesehatan Leting',
        isRead: readSet.has(id),
        avatarUrl: getAvatarUrl(m.fotoUrl),
        actionLabel: 'Lihat Profil & Rekam Medis',
        memberNrp: m.nrp,
      });
    });

    // 3. Treasury & Asset Mutations (💰 Kas)
    transactions.slice(0, 8).forEach((trx) => {
      const id = `notif-trx-${trx.id}`;
      const isMasuk = trx.jenis === 'MASUK';
      const cleanKet = stripTechNoise(trx.keterangan);
      items.push({
        id,
        type: 'TREASURY',
        title: `${isMasuk ? '💰 Dana Sosial Masuk' : '🤝 Penyaluran Dana Sosial'}: ${formatRupiah(trx.nominal)}`,
        description: `${cleanKet}.`,
        timeAgo: trx.tanggal,
        isRead: readSet.has(id),
        avatarUrl: '/default-avatar.png',
        actionLabel: 'Buka Dana Sosial & Investasi',
        targetTab: 'bendahara',
      });
    });

    assets.slice(0, 3).forEach((ast) => {
      const id = `notif-ast-${ast.id}`;
      const cleanNama = stripTechNoise(ast.namaAset);
      items.push({
        id,
        type: 'TREASURY',
        title: `💎 Aset Bersama WS96: ${cleanNama}`,
        description: `${ast.keterangan ? stripTechNoise(ast.keterangan) : cleanNama} (Valuasi ${formatRupiah(ast.estimasiNilaiIdr)}).`,
        timeAgo: ast.tanggalPerolehan || ast.updatedAt.split('T')[0],
        isRead: readSet.has(id),
        avatarUrl: '/default-avatar.png',
        actionLabel: 'Lihat Portofolio Aset',
        targetTab: 'bendahara',
      });
    });

    // 4. Social Feed Posts & Comments (💬 Postingan)
    posts.slice(0, 8).forEach((post) => {
      const id = `notif-post-${post.id}`;
      const cleanContent = stripTechNoise(post.content);
      items.push({
        id,
        type: 'SOCIAL',
        title: `💬 Kabar Leting: ${post.authorName}`,
        description:
          cleanContent.length > 140 ? `${cleanContent.slice(0, 140)}...` : cleanContent,
        timeAgo: post.createdAt,
        isRead: readSet.has(id),
        avatarUrl: getAvatarUrl(post.authorAvatar),
        actionLabel: 'Lihat di Linimasa',
        targetTab: 'direktori',
      });
    });

    return items;
  }, [
    readIds,
    currentUser.role,
    currentUser.nrp,
    pendingVerificationCount,
    messages,
    members,
    transactions,
    assets,
    posts,
  ]);

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ws96_read_notifs_${currentUser.nrp}`, JSON.stringify(next));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ws96_read_notifs_${currentUser.nrp}`, JSON.stringify(allIds));
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (activeFilter === 'health') return n.type === 'HEALTH';
    if (activeFilter === 'treasury') return n.type === 'TREASURY';
    if (activeFilter === 'social') return n.type === 'SOCIAL';
    return true;
  });

  const countByType = {
    semua: notifications.length,
    health: notifications.filter((n) => n.type === 'HEALTH').length,
    treasury: notifications.filter((n) => n.type === 'TREASURY').length,
    social: notifications.filter((n) => n.type === 'SOCIAL').length,
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="w-full py-2 font-sans text-slate-900 pb-20">
      {/* 2-Column LinkedIn Notifications Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT RAIL (lg:col-span-4 xl:col-span-3): USER PROFILE CARD   */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-[96px]">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-center">
            <div className="h-16 relative overflow-hidden bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/default-cover.jpg"
                alt="Sampul"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="px-4 pb-4 relative">
              <div
                onClick={() => onViewMyProfile && onViewMyProfile()}
                className="w-16 h-16 rounded-full border-2 border-white shadow mx-auto -mt-8 overflow-hidden bg-white cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(currentUser.fotoUrl)}
                  alt={currentUser.nama}
                  className="w-full h-full object-cover"
                />
              </div>

              <h3
                onClick={() => onViewMyProfile && onViewMyProfile()}
                className="text-sm font-bold text-slate-900 hover:text-red-900 cursor-pointer mt-2 inline-flex items-center justify-center gap-1"
              >
                <span>{currentUser.nama.split('(')[0].trim()}</span>
                <MetaVerifiedBadge role={currentUser.role} nrp={currentUser.nrp} size="sm" />
              </h3>
              <p className="text-[11px] text-slate-500">
                {currentUser.pangkat} &bull; {currentUser.satker || 'Mabes Polri'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Notifikasi</h4>
              <span className="text-[11px] text-slate-500">{unreadCount} belum dibaca</span>
            </div>
            <button
              onClick={markAllAsRead}
              className="text-red-900 font-bold hover:underline pt-1 flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tandai semua dibaca</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CENTER / MAIN CONTENT (lg:col-span-8 xl:col-span-9): ITEMS  */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Header & Filter Pills */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-700" />
                Notifikasi
              </h2>
              {unreadCount > 0 ? (
                <span className="text-xs text-white bg-red-600 px-3 py-1 rounded-full font-extrabold shadow-[0_0_10px_rgba(220,38,38,0.45)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                  <span>{unreadCount} Baru</span>
                </span>
              ) : (
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-semibold border border-slate-200">
                  0 Baru
                </span>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold pt-1">
              {[
                { key: 'semua', label: `Semua (${countByType.semua})` },
                { key: 'health', label: `❤️ Kesehatan (${countByType.health})` },
                { key: 'treasury', label: `💰 Dana Sosial (${countByType.treasury})` },
                { key: 'social', label: `💬 Linimasa (${countByType.social})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() =>
                    setActiveFilter(f.key as 'semua' | 'health' | 'treasury' | 'social')
                  }
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    activeFilter === f.key
                      ? 'bg-red-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications Stream */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-200/80">
            {filteredNotifs.length > 0 ? (
              filteredNotifs.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-4 sm:p-5 flex items-start justify-between gap-3 transition-all cursor-pointer border-l-4 ${
                    !notif.isRead
                      ? 'bg-gradient-to-r from-rose-100/95 via-red-50/90 to-amber-50/75 hover:from-rose-100 hover:via-red-100/85 border-l-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                      : 'bg-white hover:bg-slate-50 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="relative flex-shrink-0 mt-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={notif.avatarUrl || '/default-avatar.png'}
                        alt="Notifikasi"
                        className={`w-11 h-11 rounded-full object-cover border ${
                          !notif.isRead ? 'border-red-400 ring-2 ring-red-500/25' : 'border-slate-200 opacity-85'
                        }`}
                      />
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center absolute -bottom-1 -right-1 text-white shadow-xs ${
                          notif.type === 'HEALTH'
                            ? 'bg-rose-600'
                            : notif.type === 'TREASURY'
                            ? 'bg-emerald-600'
                            : 'bg-red-800'
                        }`}
                      >
                        {notif.type === 'HEALTH' ? (
                          <Heart className="w-2.5 h-2.5" />
                        ) : notif.type === 'TREASURY' ? (
                          <Wallet className="w-2.5 h-2.5" />
                        ) : notif.openVerification ? (
                          <ShieldAlert className="w-2.5 h-2.5" />
                        ) : (
                          <MessageSquare className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs ${
                            !notif.isRead
                              ? 'font-extrabold text-red-950'
                              : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-extrabold uppercase tracking-wider shadow-[0_0_8px_rgba(220,38,38,0.55)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                            <span>Baru</span>
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          !notif.isRead
                            ? 'font-medium text-slate-900'
                            : 'text-slate-500'
                        }`}
                      >
                        {notif.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] pt-1">
                        <span className={!notif.isRead ? 'font-semibold text-red-700/80' : 'text-slate-400'}>
                          {notif.timeAgo}
                        </span>
                        {notif.actionLabel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notif.id);
                              if (notif.openVerification && onOpenVerificationModal) {
                                onOpenVerificationModal();
                                return;
                              }
                              if (notif.memberNrp && onSelectMember) {
                                const found = members.find((m) => m.nrp === notif.memberNrp);
                                if (found) {
                                  onSelectMember(found);
                                  return;
                                }
                              }
                              if (notif.targetTab) {
                                onNavigateToTab(notif.targetTab);
                              }
                            }}
                            className={`font-bold hover:underline ${
                              !notif.isRead ? 'text-red-700' : 'text-red-900/80'
                            }`}
                          >
                            {notif.actionLabel} &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <span
                      className="w-3 h-3 rounded-full bg-red-600 ring-4 ring-red-500/25 shadow-[0_0_8px_#dc2626] shrink-0 mt-1.5"
                      title="Belum dibaca — Klik untuk tandai sudah dibaca"
                    />
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Belum ada notifikasi pada kategori ini.</p>
                <p className="text-slate-400 text-[11px]">
                  Pemberitahuan terkait kesehatan, kas &amp; aset, dan linimasa akan muncul di sini.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

