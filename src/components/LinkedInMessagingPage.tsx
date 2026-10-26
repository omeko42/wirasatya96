'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AuthUser, AnggotaWiraSatya, ChatMessage } from '@/types';
import { getAvatarUrl, isSuperadminAccount } from '@/lib/avatarUtils';
import { processSecureImageUpload } from '@/lib/mediaSecurity';
import { MetaVerifiedBadge } from './MetaVerifiedBadge';
import { 
  Search, 
  Send, 
  Phone, 
  ShieldCheck, 
  CheckCheck, 
  Paperclip,
  UserPlus,
  FileText,
  X,
  ExternalLink,
  MessageSquare,
  Pin
} from 'lucide-react';

interface LinkedInMessagingPageProps {
  currentUser: AuthUser;
  members: AnggotaWiraSatya[];
  initialTargetMember?: AnggotaWiraSatya | null;
  onSelectMember?: (member: AnggotaWiraSatya) => void;
}

export const LinkedInMessagingPage: React.FC<LinkedInMessagingPageProps> = ({
  currentUser,
  members,
  initialTargetMember,
  onSelectMember,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'pinned'>('active');
  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [pendingAttachmentUrl, setPendingAttachmentUrl] = useState<string>('');
  const [pendingAttachmentName, setPendingAttachmentName] = useState<string>('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pinned chats persisted in localStorage under ws96_pinned_chats_v1
  const [pinnedNrps, setPinnedNrps] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ws96_pinned_chats_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.error('Failed to parse pinned chats', e);
      }
    }
    return [];
  });

  const togglePinChat = (nrp: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedNrps((prev) => {
      const next = prev.includes(nrp) ? prev.filter((id) => id !== nrp) : [...prev, nrp];
      if (typeof window !== 'undefined') {
        localStorage.setItem('ws96_pinned_chats_v1', JSON.stringify(next));
      }
      return next;
    });
  };

  // Track contact explicitly selected via + Obrolan or initialTargetMember
  const [selectedNewChatNrp, setSelectedNewChatNrp] = useState<string>(() => {
    if (initialTargetMember && initialTargetMember.nrp !== currentUser.nrp) {
      return initialTargetMember.nrp;
    }
    return '';
  });

  // Active chat partner
  const [activePartnerNrp, setActivePartnerNrp] = useState<string>(() => {
    if (initialTargetMember && initialTargetMember.nrp !== currentUser.nrp) {
      return initialTargetMember.nrp;
    }
    return '';
  });

  // Mobile view toggle ('list' vs 'chat') for < md screens
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(() =>
    initialTargetMember && initialTargetMember.nrp !== currentUser.nrp ? 'chat' : 'list'
  );

  // All messages in state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('ws96_messages_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error('Failed to parse cached messages', e);
        }
      }
    }
    return [];
  });

  // Sync with initialTargetMember when passed from outside
  useEffect(() => {
    if (initialTargetMember && initialTargetMember.nrp !== currentUser.nrp) {
      setSelectedNewChatNrp(initialTargetMember.nrp);
      setActivePartnerNrp(initialTargetMember.nrp);
      setMobileView('chat');
      setShowDirectoryPicker(false);
    }
  }, [initialTargetMember, currentUser.nrp]);

  // Fetch real messages from API on mount, polling, and custom event from ChatDock
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?userNrp=${currentUser.nrp}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.messages) && isMounted) {
          setMessages(data.messages);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ws96_messages_cache', JSON.stringify(data.messages));
          }
        }
      } catch (err) {
        console.log('Error fetching messages from API, using local cache', err);
      }
    };

    fetchMessages();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchMessages();
      }
    }, 15000);
    const handleSync = () => fetchMessages();
    if (typeof window !== 'undefined') {
      window.addEventListener('ws96_messages_updated', handleSync);
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ws96_messages_updated', handleSync);
      }
    };
  }, [currentUser.nrp]);

  // Mark unread messages from activePartnerNrp as read when conversation is opened
  useEffect(() => {
    if (!activePartnerNrp || !currentUser.nrp) return;
    const hasUnread = messages.some(
      (m) => m.senderNrp === activePartnerNrp && m.receiverNrp === currentUser.nrp && !m.isRead
    );
    if (!hasUnread) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.senderNrp === activePartnerNrp && m.receiverNrp === currentUser.nrp
          ? { ...m, isRead: true }
          : m
      )
    );

    fetch('/api/messages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderNrp: activePartnerNrp,
        receiverNrp: currentUser.nrp,
      }),
    })
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ws96_messages_updated'));
        }
      })
      .catch(() => {});
  }, [activePartnerNrp, currentUser.nrp, messages]);

  // Scroll to bottom when new message arrives in active chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activePartnerNrp]);

  // Group messages by contact NRP
  const messagesByContact = React.useMemo(() => {
    const map: Record<string, ChatMessage[]> = {};
    messages.forEach((msg) => {
      const otherNrp = msg.senderNrp === currentUser.nrp ? msg.receiverNrp : msg.senderNrp;
      if (!otherNrp || otherNrp === currentUser.nrp) return;
      if (!map[otherNrp]) map[otherNrp] = [];
      map[otherNrp].push(msg);
    });
    return map;
  }, [messages, currentUser.nrp]);

  // Compute unique conversation partners from messages and ALL members list
  const contacts = React.useMemo(() => {
    const partnerMap = new Map<string, { member: AnggotaWiraSatya; lastMessage?: ChatMessage; unread: number }>();

    // 1. Process all messages to find active chat threads
    const isSuperAdminViewer =
      currentUser.nrp === '98010710' || currentUser.role === 'SUPERADMIN';

    messages.forEach((msg) => {
      const otherNrp = msg.senderNrp === currentUser.nrp ? msg.receiverNrp : msg.senderNrp;
      if (!otherNrp || otherNrp === currentUser.nrp) return;
      if (otherNrp === '98010710' && !isSuperAdminViewer) return;

      const member = members.find((m) => m.nrp === otherNrp) || {
        id: 'ws-' + otherNrp,
        nrp: otherNrp,
        namaLengkap: msg.senderNrp === otherNrp ? msg.senderName : (msg.receiverName || `Perwira NRP ${otherNrp}`),
        pangkat: msg.senderNrp === otherNrp ? (msg.senderPangkat || 'Kombes Pol') : 'Kombes Pol',
        jabatanTerakhir: 'Perwira Alumni Akpol 1996',
        satuanKerja: 'Kepolisian Negara Republik Indonesia',
        polda: 'MABES POLRI',
        noHp: '',
      } as AnggotaWiraSatya;

      const existing = partnerMap.get(otherNrp);
      const isUnread = !msg.isRead && msg.receiverNrp === currentUser.nrp;

      if (!existing) {
        partnerMap.set(otherNrp, {
          member,
          lastMessage: msg,
          unread: isUnread ? 1 : 0,
        });
      } else {
        if (!existing.lastMessage || new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
          existing.lastMessage = msg;
        }
        if (isUnread) {
          existing.unread += 1;
        }
      }
    });

    // 2. Ensure ALL registered alumni members in directory are accessible when searching or picking (exclude Superadmin)
    members.forEach((m) => {
      if (isSuperadminAccount(m.nrp, (m as { role?: string }).role)) return;
      if (m.nrp !== currentUser.nrp && !partnerMap.has(m.nrp)) {
        partnerMap.set(m.nrp, {
          member: m,
          unread: 0,
        });
      }
    });

    return Array.from(partnerMap.values()).sort((a, b) => {
      const aPinned = pinnedNrps.includes(a.member.nrp) ? 1 : 0;
      const bPinned = pinnedNrps.includes(b.member.nrp) ? 1 : 0;
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      if (bPinned !== aPinned) return bPinned - aPinned;
      return a.member.namaLengkap.localeCompare(b.member.namaLengkap);
    });
  }, [messages, currentUser.nrp, currentUser.role, members, pinnedNrps]);

  // Auto-select most recent active conversation if none selected yet
  useEffect(() => {
    if (!activePartnerNrp) {
      const firstActive = contacts.find((c) => (messagesByContact[c.member.nrp]?.length || 0) > 0);
      if (firstActive) {
        setActivePartnerNrp(firstActive.member.nrp);
      }
    }
  }, [contacts, messagesByContact, activePartnerNrp]);

  // Counts for tabs
  const activeChatCount = React.useMemo(
    () =>
      contacts.filter(
        (c) => (messagesByContact[c.member.nrp]?.length || 0) > 0 || c.member.nrp === selectedNewChatNrp
      ).length,
    [contacts, messagesByContact, selectedNewChatNrp]
  );

  const pinnedCount = React.useMemo(
    () => contacts.filter((c) => pinnedNrps.includes(c.member.nrp)).length,
    [contacts, pinnedNrps]
  );

  // Active Partner Profile (only real partner or custom target NRP or null)
  const activePartner: AnggotaWiraSatya | null = React.useMemo(() => {
    const targetNrp = activePartnerNrp || '';
    if (!targetNrp) return null;
    const fromMembers = members.find((m) => m.nrp === targetNrp);
    if (fromMembers) return fromMembers;
    const fromPartners = contacts.find((p) => p.member.nrp === targetNrp);
    if (fromPartners) return fromPartners.member;
    return {
      id: 'ws-' + targetNrp,
      nrp: targetNrp,
      namaLengkap: `Perwira NRP ${targetNrp}`,
      pangkat: 'Kombes Pol',
      jabatanTerakhir: 'Alumni Akpol 1996',
      satuanKerja: 'Polri',
      polda: 'MABES POLRI',
      noHp: '',
      fotoUrl: '/default-avatar.png',
    } as AnggotaWiraSatya;
  }, [activePartnerNrp, members, contacts]);

  // Messages between currentUser and activePartner
  const activeChatMessages = activePartner
    ? messages.filter(
        (m) =>
          (m.senderNrp === currentUser.nrp && m.receiverNrp === activePartner.nrp) ||
          (m.senderNrp === activePartner.nrp && m.receiverNrp === currentUser.nrp)
      )
    : [];

  const handleAttachmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.type.startsWith('image/')) {
      try {
        const processed = await processSecureImageUpload(file, {
          preset: 'POST',
          actorNrp: currentUser.nrp,
          ownerNrp: currentUser.nrp,
        });
        setPendingAttachmentUrl(processed.dataUrl);
        setPendingAttachmentName(file.name);
      } catch {
        // ignore
      }
      return;
    }
    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPendingAttachmentUrl(reader.result);
          setPendingAttachmentName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingAttachmentUrl) || isSending || !activePartner) return;

    const text =
      inputText.trim() || `📎 Melampirkan file: ${pendingAttachmentName || 'Lampiran'}`;
    const attachUrl = pendingAttachmentUrl || undefined;
    const attachName = pendingAttachmentName || undefined;
    setInputText('');
    setPendingAttachmentUrl('');
    setPendingAttachmentName('');
    setIsSending(true);

    const optimisticMsg: ChatMessage = {
      id: 'local-' + Date.now(),
      senderNrp: currentUser.nrp,
      senderName: currentUser.nama.replace(/\(.*?\)/g, '').trim(),
      senderPangkat: currentUser.pangkat,
      receiverNrp: activePartner.nrp,
      receiverName: activePartner.namaLengkap,
      text: text,
      attachmentUrl: attachUrl,
      attachmentName: attachName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // Update locally immediately
    const updated = [...messages, optimisticMsg];
    setMessages(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ws96_messages_cache', JSON.stringify(updated));
    }

    // Send to backend API
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderNrp: currentUser.nrp,
          senderName: currentUser.nama,
          senderPangkat: currentUser.pangkat,
          receiverNrp: activePartner.nrp,
          receiverName: activePartner.namaLengkap,
          text: text,
          attachmentUrl: attachUrl,
          attachmentName: attachName,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        // Replace optimistic msg with confirmed server msg
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? data.message : m))
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ws96_messages_updated'));
        }
      }
    } catch (err) {
      console.log('Saved message to local cache, API sync queued', err);
    } finally {
      setIsSending(false);
    }
  };

  const getWaUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}?text=Halo%20Komandan%2C%20mohon%20izin%20menghubungi%20dari%20Obrolan%20Alumni%20Akpol%201996`;
  };

  const isDirectoryMode = showDirectoryPicker || searchQuery.trim().length > 0;

  // Filtered conversation partners in left rail
  const filteredPartners = contacts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.member.namaLengkap.toLowerCase().includes(q) ||
      p.member.pangkat.toLowerCase().includes(q) ||
      (p.member.satuanKerja || '').toLowerCase().includes(q) ||
      (p.member.jabatanTerakhir || '').toLowerCase().includes(q) ||
      p.member.nrp.includes(q);

    if (!matchesSearch) return false;

    // When showDirectoryPicker is true or searchQuery is non-empty, show matching contacts from all 168 members
    if (showDirectoryPicker || q.length > 0) {
      return true;
    }

    // When showDirectoryPicker is false and searchQuery is empty:
    if (activeTab === 'pinned') {
      return pinnedNrps.includes(p.member.nrp);
    }

    // In 'Obrolan Aktif' tab: ONLY list contacts who have existing chat history OR are currently selected after clicking + Obrolan
    const hasChatHistory = (messagesByContact[p.member.nrp]?.length || 0) > 0;
    const isSelectedFromPicker = p.member.nrp === selectedNewChatNrp;
    return hasChatHistory || isSelectedFromPicker;
  });

  const handleOpenDirectoryPicker = () => {
    setShowDirectoryPicker(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Filter for new chat modal
  const searchableMembers = members.filter((m) => {
    if (m.nrp === currentUser.nrp) return false;
    if (isSuperadminAccount(m.nrp, (m as { role?: string }).role)) return false;
    const q = newChatSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      m.namaLengkap.toLowerCase().includes(q) ||
      m.pangkat.toLowerCase().includes(q) ||
      m.satuanKerja.toLowerCase().includes(q) ||
      m.nrp.includes(q) ||
      m.polda.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto py-2 font-sans text-slate-900">
      
      {/* 2-Column LinkedIn Messenger Layout with Fixed Height & Internal Scroll */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100dvh-165px)] md:h-[calc(100vh-132px)] min-h-[480px] max-h-[860px] 2xl:max-h-[900px]">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: CONVERSATION LIST (md:col-span-5 lg:col-span-4) */}
        {/* ============================================================ */}
        <div
          className={`${
            mobileView === 'chat' && activePartner ? 'hidden md:flex' : 'flex'
          } md:col-span-5 lg:col-span-4 border-r border-slate-200 flex-col h-full overflow-hidden bg-white`}
        >
          
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-red-800" />
              <h3 className="text-sm font-bold text-slate-900">Pesan</h3>
            </div>
            
            <button
              onClick={handleOpenDirectoryPicker}
              className="px-2.5 py-1 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-xs"
              title="Mulai obrolan baru"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Obrolan</span>
            </button>
          </div>

          {/* Search box */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NRP, satker..."
                className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
              {(searchQuery || showDirectoryPicker) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDirectoryPicker(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Tutup pencarian / direktori"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs Filter: Aktif, 📌 Disematkan, and Kontak */}
          <div className="px-3 pt-2 pb-1.5 border-b border-slate-100 flex items-center gap-1 text-xs flex-wrap flex-shrink-0">
            <button
              onClick={() => {
                setActiveTab('active');
                setShowDirectoryPicker(false);
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-full font-bold transition-colors whitespace-nowrap ${
                !isDirectoryMode && activeTab === 'active'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="sm:hidden">Aktif ({activeChatCount})</span>
              <span className="hidden sm:inline">Obrolan Aktif ({activeChatCount})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('pinned');
                setShowDirectoryPicker(false);
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-full font-bold transition-colors whitespace-nowrap ${
                !isDirectoryMode && activeTab === 'pinned'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Disematkan ({pinnedCount})
            </button>
            {isDirectoryMode && (
              <button
                onClick={() => {
                  setShowDirectoryPicker(false);
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 rounded-full font-bold transition-colors whitespace-nowrap bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1"
                title="Klik untuk kembali ke Obrolan Aktif"
              >
                <span className="sm:hidden">Kontak ({contacts.length})</span>
                <span className="hidden sm:inline">Direktori Kontak ({contacts.length})</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Conversation List (Scrollable inside Fixed-Height Card) */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
            {filteredPartners.length === 0 ? (
              <div className="p-6 text-center space-y-3 my-auto flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-800 flex items-center justify-center">
                  {activeTab === 'pinned' && !isDirectoryMode ? (
                    <Pin className="w-6 h-6" />
                  ) : (
                    <MessageSquare className="w-6 h-6" />
                  )}
                </div>
                {activeTab === 'pinned' && !isDirectoryMode ? (
                  <div className="space-y-1 max-w-[240px]">
                    <p className="text-xs font-bold text-slate-800">Belum ada obrolan disematkan</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Klik ikon pin pada obrolan untuk menyematkan kontak prioritas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 max-w-[250px]">
                    <p className="text-xs font-bold text-slate-800">Belum ada obrolan aktif</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Klik Obrolan untuk memulai percakapan baru.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleOpenDirectoryPicker}
                  className="px-3.5 py-1.5 rounded-full bg-red-800 hover:bg-red-900 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Obrolan</span>
                </button>
              </div>
            ) : (
              filteredPartners.map(({ member, lastMessage, unread }) => {
                const isSelected = activePartner?.nrp === member.nrp;
                const isPinned = pinnedNrps.includes(member.nrp);
                return (
                  <div
                    key={member.nrp}
                    onClick={() => {
                      setActivePartnerNrp(member.nrp);
                      setSelectedNewChatNrp(member.nrp);
                      setMobileView('chat');
                      if (showDirectoryPicker) {
                        setShowDirectoryPicker(false);
                        setSearchQuery('');
                        setActiveTab('active');
                      }
                    }}
                    className={`p-3 cursor-pointer transition-colors flex items-start gap-3 hover:bg-slate-50 group ${
                      isSelected ? 'bg-red-50/60 border-l-4 border-red-800' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(member.fotoUrl)}
                        alt={member.namaLengkap}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200"
                      />
                      <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0" title="Aktif" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                          <span className="truncate">{member.namaLengkap.split(',')[0]}</span>
                          <MetaVerifiedBadge nrp={member.nrp} size="sm" />
                          {isPinned && (
                            <span title="Disematkan" className="text-[10px] text-amber-600 flex-shrink-0">
                              📌
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-slate-400">
                            {lastMessage ? lastMessage.timestamp : 'Kontak'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => togglePinChat(member.nrp, e)}
                            className={`p-1 rounded hover:bg-slate-200/70 transition-colors ${
                              isPinned
                                ? 'text-amber-600 opacity-100'
                                : 'text-slate-400 opacity-0 group-hover:opacity-100'
                            }`}
                            title={isPinned ? 'Lepas Sematan (Unpin)' : 'Sematkan Obrolan (Pin)'}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 truncate font-medium">
                        {member.pangkat} &bull; {member.satuanKerja}
                      </p>

                      <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                        {lastMessage ? lastMessage.text : 'Mulai obrolan...'}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-800 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: ACTIVE CHAT CANVAS (md:col-span-7 lg:col-span-8)*/}
        {/* ============================================================ */}
        <div
          className={`${
            mobileView === 'chat' && activePartner ? 'flex' : 'hidden md:flex'
          } md:col-span-7 lg:col-span-8 flex-col h-full overflow-hidden bg-white`}
        >
          {!activePartner ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#f8fafc]">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-900 flex items-center justify-center shadow-xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Pesan</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih kontak di sebelah kiri atau klik Obrolan untuk mengirim pesan.
                </p>
              </div>
              <button
                onClick={handleOpenDirectoryPicker}
                className="px-4 py-2 rounded-full bg-red-800 hover:bg-red-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Obrolan</span>
              </button>
            </div>
          ) : (
            <>
              {/* Top Bar of Active Conversation */}
              <div className="p-3 sm:p-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white z-10 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="md:hidden px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0"
                    title="Kembali ke Daftar Pesan"
                  >
                    &larr;
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAvatarUrl(activePartner.fotoUrl)}
                    alt={activePartner.namaLengkap}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 cursor-pointer flex-shrink-0"
                    onClick={() => onSelectMember && onSelectMember(activePartner)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 
                        onClick={() => onSelectMember && onSelectMember(activePartner)}
                        className="text-xs sm:text-sm font-bold text-slate-900 hover:text-red-900 cursor-pointer flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{activePartner.namaLengkap}</span>
                        <MetaVerifiedBadge nrp={activePartner.nrp} size="md" />
                      </h3>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                      {activePartner.jabatanTerakhir} &bull; {activePartner.satuanKerja} ({activePartner.polda})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => togglePinChat(activePartner.nrp, e)}
                    className={`px-2.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1 transition-colors ${
                      pinnedNrps.includes(activePartner.nrp)
                        ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title={
                      pinnedNrps.includes(activePartner.nrp)
                        ? 'Lepas Sematan Obrolan'
                        : 'Sematkan Obrolan ke Tab Disematkan'
                    }
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">
                      {pinnedNrps.includes(activePartner.nrp) ? 'Disematkan' : 'Sematkan'}
                    </span>
                  </button>

                  {activePartner.noHp && (
                    <a
                      href={getWaUrl(activePartner.noHp)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full border border-red-800 text-red-900 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Hubungi via WhatsApp"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  )}

                  {onSelectMember && (
                    <button
                      onClick={() => onSelectMember(activePartner)}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Lihat Profil Lengkap"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Security & Confidentiality Notice Header */}
              <div className="bg-slate-50 px-4 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pesan Internal Terverifikasi</span>
                </span>
                <span className="text-[10px] font-semibold text-red-900">#SelaluBahagia</span>
              </div>

              {/* Chat Message Stream (Scrollable inside Fixed-Height Card) */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-3 bg-[#f8fafc]">
                {activeChatMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-3 max-w-sm mx-auto">
                    <div className="w-14 h-14 rounded-full bg-red-100 text-red-900 flex items-center justify-center mx-auto shadow-xs">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        Mulai Obrolan dengan {activePartner.namaLengkap.split(',')[0]}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Kirim pesan atau pilih balasan cepat di bawah.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                      {[
                        'Siap Komandan, mohon izin koordinasi.',
                        'Salam hormat, mohon izin menghubungi.',
                        'Mohon info tindak lanjut agenda.',
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInputText(preset)}
                          className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-red-800 text-[11px] font-medium transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  activeChatMessages.map((msg) => {
                    const isMe = msg.senderNrp === currentUser.nrp;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs sm:text-sm shadow-xs ${
                            isMe
                              ? 'bg-red-800 text-white rounded-tr-none'
                              : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                          }`}
                        >
                          {!isMe && (
                            <p className="text-[10px] font-bold text-red-900 mb-1">
                              {msg.senderName} ({msg.senderPangkat || activePartner.pangkat})
                            </p>
                          )}

                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                          {msg.attachmentUrl && (
                            <div className="mt-2">
                              {/^(data:image\/|\/|\S+\.(png|jpe?g|webp|gif|svg))/i.test(
                                msg.attachmentUrl
                              ) ? (
                                <div className="rounded-xl overflow-hidden border border-black/10 max-w-xs bg-slate-900">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.attachmentUrl}
                                    alt={msg.attachmentName || 'Lampiran Foto'}
                                    className="w-full max-h-48 object-cover"
                                  />
                                  {msg.attachmentName && (
                                    <div className="px-2.5 py-1 bg-black/50 text-[10px] text-white truncate">
                                      {msg.attachmentName}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <a
                                  href={msg.attachmentUrl}
                                  download={msg.attachmentName || 'lampiran'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 rounded-lg bg-black/10 hover:bg-black/15 flex items-center gap-2 transition-colors"
                                >
                                  <FileText className="w-4 h-4 shrink-0" />
                                  <span className="text-xs underline truncate">
                                    {msg.attachmentName || 'Dokumen Terlampir'}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}

                          <div
                            className={`text-[9px] mt-1.5 flex items-center justify-end gap-1 ${
                              isMe ? 'text-red-200' : 'text-slate-400'
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            {isMe && <CheckCheck className="w-3.5 h-3.5 text-white/90" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Chat Input Bar */}
              <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  {pendingAttachmentUrl && (
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-red-800 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">
                          {pendingAttachmentName || 'Lampiran siap dikirim'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAttachmentUrl('');
                          setPendingAttachmentName('');
                        }}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Hapus lampiran"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Tulis pesan untuk ${activePartner.namaLengkap.split(',')[0]}...`}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-800"
                    />

                    <label
                      className="p-2 rounded-full text-slate-500 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Lampirkan Foto atau Dokumen (PDF/Word)"
                    >
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleAttachmentFileChange}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={(!inputText.trim() && !pendingAttachmentUrl) || isSending}
                      className="p-2.5 rounded-full bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white transition-all shadow-sm active:scale-95"
                      title="Kirim Pesan"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

      </div>

      {/* ============================================================== */}
      {/* MODAL: PILIH PERWIRA UNTUK MEMULAI OBROLAN BARU                */}
      {/* ============================================================== */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-red-950 text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Mulai Obrolan Baru</h3>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Cari nama, NRP, atau satker..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-800"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {searchableMembers.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs text-slate-500">
                    {newChatSearch.trim()
                      ? `Personel "${newChatSearch}" belum ada di daftar direktori.`
                      : 'Belum ada personel lain di direktori.'}
                  </p>
                  {newChatSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNewChatNrp(newChatSearch.trim());
                        setActivePartnerNrp(newChatSearch.trim());
                        setIsNewChatModalOpen(false);
                        setNewChatSearch('');
                      }}
                      className="px-4 py-2 rounded-full bg-red-800 hover:bg-red-900 text-white text-xs font-bold transition-colors"
                    >
                      Mulai Obrolan dengan NRP / Nama &ldquo;{newChatSearch.trim()}&rdquo;
                    </button>
                  )}
                </div>
              ) : (
                searchableMembers.map((m) => (
                  <div
                    key={m.nrp}
                    onClick={() => {
                      setSelectedNewChatNrp(m.nrp);
                      setActivePartnerNrp(m.nrp);
                      setIsNewChatModalOpen(false);
                      setNewChatSearch('');
                    }}
                    className="p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer flex items-center gap-3 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAvatarUrl(m.fotoUrl)}
                      alt={m.namaLengkap}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                        <span className="truncate">{m.namaLengkap}</span>
                        <MetaVerifiedBadge nrp={m.nrp} size="sm" />
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {m.pangkat} &bull; {m.jabatanTerakhir}
                      </p>
                      <p className="text-[10px] text-red-900 font-semibold truncate">
                        {m.satuanKerja} ({m.polda}) &bull; NRP {m.nrp}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full border border-red-200 flex-shrink-0">
                      Chat
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-500">
                Menampilkan <b>{searchableMembers.length}</b> personel terdaftar
              </span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
