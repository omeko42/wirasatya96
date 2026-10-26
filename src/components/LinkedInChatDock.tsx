'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Phone,
  ExternalLink,
  ShieldCheck,
  Search,
  CheckCheck,
  Pin,
  Plus,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AnggotaWiraSatya, ChatMessage } from '@/types';
import { getAvatarUrl, formatMemberDisplayName, isSuperadminAccount } from '@/lib/avatarUtils';
import { WSLogo } from './WSLogo';
import { MetaVerifiedBadge } from './MetaVerifiedBadge';

interface LinkedInChatDockProps {
  members: AnggotaWiraSatya[];
  currentUserName: string;
  currentUserNrp?: string;
  onOpenFullMessaging?: () => void;
}

const PINNED_STORAGE_KEY = 'ws96_pinned_chats_v1';

export const LinkedInChatDock: React.FC<LinkedInChatDockProps> = ({
  members,
  currentUserName,
  currentUserNrp = '98010710',
  onOpenFullMessaging,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompactPill, setIsCompactPill] = useState(false);
  const [activeChatMember, setActiveChatMember] = useState<AnggotaWiraSatya | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'pinned'>('active');
  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [pinnedNrps, setPinnedNrps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load pinned chats synced with LinkedInMessagingPage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadPins = () => {
      try {
        const saved = localStorage.getItem(PINNED_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setPinnedNrps(parsed);
        }
      } catch {
        // ignore
      }
    };
    loadPins();
    window.addEventListener('storage', loadPins);
    return () => window.removeEventListener('storage', loadPins);
  }, []);

  const togglePinChat = (nrp: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedNrps((prev) => {
      const next = prev.includes(nrp) ? prev.filter((id) => id !== nrp) : [nrp, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  // Fetch real messages from shared backend /api/messages
  const fetchMessages = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?userNrp=${encodeURIComponent(currentUserNrp)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ws96_messages_cache', JSON.stringify(data.messages));
        }
      }
    } catch {
      // Fallback to cache
    }
  }, [currentUserNrp]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchMessages();
      }
    }, 20000);
    const handleSync = () => fetchMessages();
    window.addEventListener('ws96_messages_updated', handleSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ws96_messages_updated', handleSync);
    };
  }, [fetchMessages]);

  const otherMembers = React.useMemo(
    () =>
      members.filter(
        (m) =>
          m.nrp !== currentUserNrp &&
          !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
      ),
    [members, currentUserNrp]
  );

  // Contacts who have active conversation history with currentUserNrp
  const activeChatMembers = React.useMemo(() => {
    return otherMembers.filter((m) =>
      messages.some(
        (msg) =>
          (msg.senderNrp === currentUserNrp && msg.receiverNrp === m.nrp) ||
          (msg.senderNrp === m.nrp && msg.receiverNrp === currentUserNrp)
      )
    );
  }, [otherMembers, messages, currentUserNrp]);

  const pinnedMembers = React.useMemo(
    () => otherMembers.filter((m) => pinnedNrps.includes(m.nrp)),
    [otherMembers, pinnedNrps]
  );

  const displayedMembers = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (m: AnggotaWiraSatya) =>
      !q ||
      m.namaLengkap.toLowerCase().includes(q) ||
      (m.satuanKerja || '').toLowerCase().includes(q) ||
      (m.polda || '').toLowerCase().includes(q) ||
      m.nrp.includes(q);

    if (showDirectoryPicker || q.length > 0) {
      return otherMembers.filter(matchesSearch);
    }
    if (activeSubTab === 'pinned') {
      return pinnedMembers.filter(matchesSearch);
    }
    return activeChatMembers.filter(matchesSearch);
  }, [
    otherMembers,
    activeChatMembers,
    pinnedMembers,
    activeSubTab,
    showDirectoryPicker,
    searchQuery,
  ]);

  // Active thread messages from real store
  const activeThreadMessages = React.useMemo(() => {
    if (!activeChatMember) return [];
    return messages.filter(
      (m) =>
        (m.senderNrp === currentUserNrp && m.receiverNrp === activeChatMember.nrp) ||
        (m.senderNrp === activeChatMember.nrp && m.receiverNrp === currentUserNrp)
    );
  }, [messages, activeChatMember, currentUserNrp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessages.length, activeChatMember]);

  const handleOpenChat = async (member: AnggotaWiraSatya) => {
    setActiveChatMember(member);
    setShowDirectoryPicker(false);
    try {
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderNrp: member.nrp, receiverNrp: currentUserNrp }),
      });
      window.dispatchEvent(new Event('ws96_messages_updated'));
    } catch {
      // ignore
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChatMember) return;
    const text = inputText.trim();
    setInputText('');

    const optimisticMsg: ChatMessage = {
      id: 'local-' + Date.now(),
      senderNrp: currentUserNrp,
      senderName: currentUserName.replace(/\(.*?\)/g, '').trim(),
      receiverNrp: activeChatMember.nrp,
      receiverName: activeChatMember.namaLengkap,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderNrp: currentUserNrp,
          senderName: currentUserName.replace(/\(.*?\)/g, '').trim(),
          receiverNrp: activeChatMember.nrp,
          receiverName: activeChatMember.namaLengkap,
          text: text,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticMsg.id ? data.message : m)));
        window.dispatchEvent(new Event('ws96_messages_updated'));
      }
    } catch {
      // ignore
    }
  };

  const getWaUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}?text=Halo%20rekan%2C%20mohon%20izin%20menghubungi%20dari%20Portal%20Wira%20Satya%2096`;
  };

  // Count unread incoming messages
  const unreadCount = messages.filter((m) => m.receiverNrp === currentUserNrp && !m.isRead).length;

  return (
    <div className="hidden md:flex fixed bottom-3 lg:bottom-4 right-3 sm:right-5 lg:right-8 xl:right-10 2xl:right-[max(2.5rem,calc((100vw-1720px)/2+3rem))] z-40 items-end gap-2.5 lg:gap-3 font-sans max-w-[calc(100vw-1.5rem)]">
      {/* 1. ACTIVE POPUP CONVERSATION BOX */}
      {activeChatMember && (
        <div className="w-[min(330px,calc(100vw-1.5rem))] lg:w-[348px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[min(440px,calc(100vh-5.5rem))] overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header of Active Chat */}
          <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(activeChatMember.fotoUrl)}
                  alt={activeChatMember.namaLengkap}
                  className="w-8 h-8 rounded-full object-cover border border-amber-400"
                />
                <span className="w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight flex items-center gap-1">
                  <span className="truncate">
                    {formatMemberDisplayName(activeChatMember.pangkat, activeChatMember.namaLengkap)}
                  </span>
                  <MetaVerifiedBadge nrp={activeChatMember.nrp} size="xs" />
                </p>
                <p className="text-[10px] text-amber-300 truncate">
                  {activeChatMember.satuanKerja} • {activeChatMember.polda}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                type="button"
                onClick={(e) => togglePinChat(activeChatMember.nrp, e)}
                className={`p-1 rounded transition-colors ${
                  pinnedNrps.includes(activeChatMember.nrp)
                    ? 'text-amber-400 bg-white/10'
                    : 'hover:text-white hover:bg-white/10'
                }`}
                title={
                  pinnedNrps.includes(activeChatMember.nrp)
                    ? 'Lepas Sematan'
                    : 'Sematkan Obrolan'
                }
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              {activeChatMember.noHp && (
                <a
                  href={getWaUrl(activeChatMember.noHp)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 hover:text-emerald-400 hover:bg-white/10 rounded transition-colors"
                  title="Chat via WhatsApp"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => setActiveChatMember(null)}
                className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Tutup Obrolan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader: Jabatan Polri */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-600">
            <span className="truncate">{activeChatMember.jabatanTerakhir}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[9px] flex-shrink-0">
              NRP {activeChatMember.nrp}
            </span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#f8fafc] text-xs">
            {activeThreadMessages.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-[11px] space-y-1">
                <p className="font-semibold text-slate-600">Belum ada riwayat pesan</p>
                <p>Ketik pesan di bawah untuk memulai percakapan.</p>
              </div>
            ) : (
              activeThreadMessages.map((msg) => {
                const isMe = msg.senderNrp === currentUserNrp;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        isMe
                          ? 'bg-red-800 text-white rounded-br-none shadow-sm'
                          : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-sm'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 px-1">
                      <span>{msg.timestamp}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-blue-500" />}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* WhatsApp Direct Action Bar */}
          {activeChatMember.noHp && (
            <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between">
              <span className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                WA: <b>{activeChatMember.noHp}</b>
              </span>
              <a
                href={getWaUrl(activeChatMember.noHp)}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}

          {/* Chat Input Box */}
          <div className="p-2 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Tulis pesan..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full pl-3 pr-2 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-800 border border-slate-200"
                />
              </div>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. DOCKED MESSAGE BAR LAUNCHER OR POP-UP MESSAGING MODULE */}
      {!isOpen ? (
        isCompactPill ? (
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-full shadow-[0_10px_28px_rgba(15,23,42,0.18)] border-2 border-red-800/30 hover:border-red-800/60 transition-all">
            <button
              type="button"
              onClick={() => {
                setIsCompactPill(false);
                setIsOpen(true);
              }}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-gradient-to-r from-red-800 to-red-900 text-white font-extrabold text-xs shadow-xs hover:brightness-110 transition cursor-pointer"
              title="Buka Obrolan Cepat"
            >
              <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-white/15">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span className="w-2 h-2 bg-emerald-400 border border-red-900 rounded-full absolute -bottom-0.5 -right-0.5" />
              </div>
              <span>Pesan</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-red-900 text-[10px] font-black">
                  {unreadCount}
                </span>
              )}
              <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => setIsOpen(true)}
            className="w-[260px] lg:w-[292px] xl:w-[312px] bg-white hover:bg-slate-50/95 rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.16)] hover:shadow-[0_14px_36px_rgba(153,27,27,0.22)] border-2 border-red-800/25 hover:border-red-800/50 px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-all select-none group"
            title="Klik untuk membuka Obrolan Cepat"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-700 to-red-900 text-white shadow-sm shrink-0">
                <MessageSquare className="w-4 h-4 text-white fill-white/15" />
                <span className="w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-slate-900 truncate leading-tight">
                    Obrolan Cepat
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 min-w-[18px] h-4 flex items-center justify-center rounded-full bg-red-800 text-white text-[9px] font-black shadow-2xs shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-semibold truncate block leading-tight mt-0.5">
                  {activeChatMembers.length > 0
                    ? `${activeChatMembers.length} obrolan aktif • Online`
                    : 'Pesan Leting 96 • Online'}
                </span>
              </div>
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(true);
                  setShowDirectoryPicker(true);
                  setTimeout(() => searchInputRef.current?.focus(), 60);
                }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-800 transition-colors cursor-pointer"
                title="Mulai Obrolan Baru"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {onOpenFullMessaging && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullMessaging();
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Buka Halaman Pesan Penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCompactPill(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Kecilkan ke Tombol Ringkas"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="p-1.5 rounded-xl bg-red-800 group-hover:bg-red-900 text-white shadow-xs transition-colors cursor-pointer"
                title="Buka Daftar Obrolan"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="w-[min(340px,calc(100vw-1.5rem))] sm:w-[350px] max-h-[min(480px,calc(100vh-5.5rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-3 duration-150">
          {/* Pop-up Header with Official Red & White Branding Icon (WSLogo) */}
          <div
            onClick={() => setIsOpen(false)}
            className="bg-white hover:bg-slate-50 px-3.5 py-2.5 flex items-center justify-between cursor-pointer border-b border-slate-200 select-none transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <WSLogo size="xs" />
                <span className="w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs text-slate-900 block leading-tight truncate">
                  Obrolan Cepat
                </span>
                <span className="text-[10px] text-slate-500 font-medium truncate block">
                  {activeChatMembers.length} obrolan aktif • {pinnedMembers.length} disematkan
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              {unreadCount > 0 && (
                <span className="px-1.5 h-5 flex items-center justify-center rounded-full bg-red-800 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
              {onOpenFullMessaging && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onOpenFullMessaging();
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                  title="Buka Halaman Pesan Penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                title="Tutup Daftar Obrolan"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & + Obrolan Bar */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari nama, NRP, atau satker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-6 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDirectoryPicker((prev) => !prev);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors flex-shrink-0 ${
                  showDirectoryPicker
                    ? 'bg-slate-900 text-white'
                    : 'bg-red-800 hover:bg-red-900 text-white'
                }`}
                title="Mulai Obrolan Baru dari Direktori"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Obrolan</span>
              </button>
            </div>

            {/* Sub-Tabs: Obrolan Aktif vs Disematkan (or Direktori mode) */}
            {showDirectoryPicker || searchQuery.trim().length > 0 ? (
              <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-600">
                <span>Direktori Kontak ({displayedMembers.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowDirectoryPicker(false);
                    setSearchQuery('');
                  }}
                  className="text-red-800 hover:underline"
                >
                  Kembali
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('active')}
                  className={`py-1 rounded-md transition-all ${
                    activeSubTab === 'active'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Obrolan Aktif ({activeChatMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('pinned')}
                  className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeSubTab === 'pinned'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Pin className="w-3 h-3 text-amber-600" />
                  <span>Disematkan ({pinnedMembers.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Contact / Active Chat List */}
          <div className="h-72 overflow-y-auto divide-y divide-slate-100 bg-white">
            {displayedMembers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-5 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-800 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {activeSubTab === 'pinned'
                    ? 'Belum ada obrolan disematkan'
                    : 'Belum ada obrolan aktif'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Pilih kontak dari direktori untuk memulai percakapan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDirectoryPicker(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Mulai Obrolan Baru</span>
                </button>
              </div>
            ) : (
              displayedMembers.map((member) => {
                const lastMsg = [...messages]
                  .reverse()
                  .find(
                    (m) =>
                      (m.senderNrp === currentUserNrp && m.receiverNrp === member.nrp) ||
                      (m.senderNrp === member.nrp && m.receiverNrp === currentUserNrp)
                  );
                const unreadFromMember = messages.filter(
                  (m) =>
                    m.senderNrp === member.nrp &&
                    m.receiverNrp === currentUserNrp &&
                    !m.isRead
                ).length;
                const isPinned = pinnedNrps.includes(member.nrp);

                return (
                  <div
                    key={member.nrp}
                    onClick={() => handleOpenChat(member)}
                    className="p-2.5 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors group"
                  >
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(member.fotoUrl)}
                        alt={member.namaLengkap}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <span className="w-2 h-2 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900 truncate leading-tight flex items-center gap-1">
                          <span className="truncate">
                            {formatMemberDisplayName(member.pangkat, member.namaLengkap)}
                          </span>
                          <MetaVerifiedBadge nrp={member.nrp} size="xs" />
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {unreadFromMember > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-red-800 text-white text-[9px] font-bold">
                              {unreadFromMember}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => togglePinChat(member.nrp, e)}
                            className={`p-1 rounded transition-opacity ${
                              isPinned
                                ? 'text-amber-600 opacity-100'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700'
                            }`}
                            title={isPinned ? 'Lepas Sematan' : 'Sematkan'}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {lastMsg ? lastMsg.text : `${member.satuanKerja} • ${member.polda}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
