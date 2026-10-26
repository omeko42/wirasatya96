'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AnggotaWiraSatya, AuthUser, FeedPost, PostComment, ReactionType, FinanceSummary, IuranAnggota, KasTransaction } from '@/types';
import { INITIAL_FEED_POSTS } from '@/data/mockPosts';
import {
  getAvatarUrl,
  resolveAvatarUrl,
  formatMemberDisplayName,
  cleanJabatanOnly,
  formatJabatanWithSatker,
  getOrBuildUserProfile,
  isSuperadminAccount,
} from '@/lib/avatarUtils';
import { LinkedInProfileView } from './LinkedInProfileView';
import { LinkedInPostCard } from './LinkedInPostCard';
import { CreatePostModal } from './CreatePostModal';
import { MetaVerifiedBadge, resolveRoleForBadge } from './MetaVerifiedBadge';
import { FeedPostSkeleton, DirectoryCardSkeleton } from './SkeletonLoader';
import {
  Phone,
  Heart,
  Image as ImageIcon,
  Wallet,
  Newspaper,
  Video,
  PenSquare,
  Briefcase,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

interface BukuSakuProps {
  members: AnggotaWiraSatya[];
  onAddNew: () => void;
  currentUser: AuthUser;
  onEditMember?: (member: AnggotaWiraSatya, initialTab?: 1 | 2 | 3 | 4) => void;
  onUpdateMemberDirect?: (member: AnggotaWiraSatya) => void;
  onOpenChat?: (member: AnggotaWiraSatya) => void;
  onNavigateToJabatan?: () => void;
  onNavigateToBendahara?: () => void;
  onNavigateToUsers?: () => void;
  onNavigateToHealth?: () => void;
  financeSummary?: FinanceSummary;
  transactions?: KasTransaction[];
  iuranList?: IuranAnggota[];
  externalPosts?: FeedPost[];
  onPostsChange?: (posts: FeedPost[]) => void;
  externalSearch?: string;
  impersonatorUser?: AuthUser | null;
  onStopImpersonating?: () => void;
  onImpersonateUser?: (user: AuthUser) => void;
}

export const BukuSaku: React.FC<BukuSakuProps> = ({
  members,
  currentUser,
  onEditMember,
  onUpdateMemberDirect,
  onOpenChat,
  onNavigateToJabatan,
  onNavigateToBendahara,
  onNavigateToHealth,
  financeSummary,
  transactions = [],
  iuranList = [],
  externalPosts,
  onPostsChange,
  externalSearch = '',
}) => {
  const [selectedMember, setSelectedMember] = useState<AnggotaWiraSatya | null>(null);

  // Cashflow, Milestone Sosial & Investasi widget state fetched from /api/finance
  const [apiKasMasuk, setApiKasMasuk] = useState<number | null>(null);
  const [apiKasKeluar, setApiKasKeluar] = useState<number | null>(null);
  const [apiSaldoKas, setApiSaldoKas] = useState<number | null>(null);
  const [apiNilaiAset, setApiNilaiAset] = useState<number | null>(null);
  const [widgetCampaigns, setWidgetCampaigns] = useState<
    Array<{
      id: string;
      title: string;
      category: string;
      targetAmount: number;
      collectedAmount: number;
      disbursedAmount: number;
      donorCount: number;
      status: string;
    }>
  >([
    {
      id: 'cmp-anak-yatim',
      title: 'Santunan & Beasiswa Anak Yatim WS96',
      category: 'ANAK_YATIM',
      targetAmount: 100000000,
      collectedAmount: 0,
      disbursedAmount: 0,
      donorCount: 0,
      status: 'AKTIF',
    },
    {
      id: 'cmp-anggota-sakit',
      title: 'Bantuan Medis Anggota yang Sakit',
      category: 'ANGGOTA_SAKIT',
      targetAmount: 75000000,
      collectedAmount: 0,
      disbursedAmount: 0,
      donorCount: 0,
      status: 'AKTIF',
    },
    {
      id: 'cmp-anggota-md',
      title: 'Dana Duka',
      category: 'ANGGOTA_MD',
      targetAmount: 100000000,
      collectedAmount: 0,
      disbursedAmount: 0,
      donorCount: 0,
      status: 'AKTIF',
    },
  ]);
  const [widgetInvestTotal, setWidgetInvestTotal] = useState<number>(0);
  const [widgetInvestCount, setWidgetInvestCount] = useState<number>(0);
  const [showTodWidgetInfo, setShowTodWidgetInfo] = useState<boolean>(false);
  const [showDanaWidgetInfo, setShowDanaWidgetInfo] = useState<boolean>(false);

  // Mobile (< lg) collapsible card states: Header-only by default on HP, expand downward on click
  const [mobileOpenProfile, setMobileOpenProfile] = useState<boolean>(false);
  const [mobileOpenTod, setMobileOpenTod] = useState<boolean>(false);
  const [mobileOpenHealth, setMobileOpenHealth] = useState<boolean>(false);
  const [mobileOpenDana, setMobileOpenDana] = useState<boolean>(false);

  // Infinite feed scroll state so scrolling inside the feed container continuously loads more posts
  const [feedRepeatCount, setFeedRepeatCount] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    fetch('/api/finance')
      .then((res) => res.json())
      .then((res) => {
        if (!mounted || !res) return;
        const payload = res.data || res;
        if (typeof payload.totalKasMasuk === 'number') {
          setApiKasMasuk(payload.totalKasMasuk);
        } else if (Array.isArray(payload.transactions)) {
          const inflow = payload.transactions
            .filter((t: KasTransaction) => t.jenis === 'MASUK')
            .reduce((s: number, t: KasTransaction) => s + (Number(t.nominal) || 0), 0);
          setApiKasMasuk(inflow);
        }

        if (typeof payload.totalKasKeluar === 'number') {
          setApiKasKeluar(payload.totalKasKeluar);
        } else if (Array.isArray(payload.transactions)) {
          const outflow = payload.transactions
            .filter((t: KasTransaction) => t.jenis === 'KELUAR')
            .reduce((s: number, t: KasTransaction) => s + (Number(t.nominal) || 0), 0);
          setApiKasKeluar(outflow);
        }

        if (payload.summary?.saldoUtama !== undefined) {
          setApiSaldoKas(payload.summary.saldoUtama);
        }
        if (payload.summary?.totalValuasiAset !== undefined) {
          setApiNilaiAset(payload.summary.totalValuasiAset);
        } else if (typeof payload.totalValuasiAset === 'number') {
          setApiNilaiAset(payload.totalValuasiAset);
        }

        const serverCfg = payload.financeConfig || res.financeConfig;
        if (serverCfg) {
          if (Array.isArray(serverCfg.campaigns) && serverCfg.campaigns.length > 0) {
            setWidgetCampaigns(serverCfg.campaigns);
          }
          if (Array.isArray(serverCfg.investmentParticipants)) {
            const activeInv = serverCfg.investmentParticipants.filter(
              (p: { statusPartisipasi?: string }) => p.statusPartisipasi !== 'CAIR'
            );
            setWidgetInvestCount(activeInv.length);
            setWidgetInvestTotal(
              activeInv.reduce(
                (s: number, p: { estimasiNilaiSaatIni?: number; nominalPenyertaan?: number }) =>
                  s + (Number(p.estimasiNilaiSaatIni ?? p.nominalPenyertaan) || 0),
                0
              )
            );
          }
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [financeSummary, transactions.length]);

  useEffect(() => {
    const syncLocalCfg = () => {
      try {
        const rawCfg = localStorage.getItem('ws96_finance_config_v1');
        if (rawCfg) {
          const parsed = JSON.parse(rawCfg);
          if (parsed && Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0) {
            setWidgetCampaigns(parsed.campaigns);
          }
          if (parsed && Array.isArray(parsed.investmentParticipants)) {
            const activeInv = parsed.investmentParticipants.filter(
              (p: { statusPartisipasi?: string }) => p.statusPartisipasi !== 'CAIR'
            );
            setWidgetInvestCount(activeInv.length);
            setWidgetInvestTotal(
              activeInv.reduce(
                (s: number, p: { estimasiNilaiSaatIni?: number; nominalPenyertaan?: number }) =>
                  s + (Number(p.estimasiNilaiSaatIni ?? p.nominalPenyertaan) || 0),
                0
              )
            );
          }
        }
      } catch {
        // ignore
      }
    };
    syncLocalCfg();
    window.addEventListener('ws96_finance_updated', syncLocalCfg);
    return () => window.removeEventListener('ws96_finance_updated', syncLocalCfg);
  }, []);

  const computedKasMasuk = useMemo(() => {
    if (transactions.length > 0) {
      return transactions
        .filter((t) => t.jenis === 'MASUK')
        .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
    }
    if (apiKasMasuk !== null) return apiKasMasuk;
    return financeSummary?.totalPemasukanBulanIni || 0;
  }, [transactions, apiKasMasuk, financeSummary]);

  const computedKasKeluar = useMemo(() => {
    if (transactions.length > 0) {
      return transactions
        .filter((t) => t.jenis === 'KELUAR')
        .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
    }
    if (apiKasKeluar !== null) return apiKasKeluar;
    return Math.abs(financeSummary?.totalPengeluaranBulanIni || 0);
  }, [transactions, apiKasKeluar, financeSummary]);

  const displaySaldoKas = financeSummary?.saldoUtama ?? apiSaldoKas ?? 0;
  const displayNilaiAset = financeSummary?.totalValuasiAset ?? apiNilaiAset ?? 0;

  // Social Feed States
  const [posts, setPosts] = useState<FeedPost[]>(() => {
    if (externalPosts && externalPosts.length > 0) return externalPosts;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wirasatya96_feed_posts');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((p: FeedPost) => ({
              ...p,
              authorAvatar: getAvatarUrl(p.authorAvatar),
            }));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return INITIAL_FEED_POSTS;
  });

  useEffect(() => {
    if (externalPosts && externalPosts.length > 0) {
      setPosts(externalPosts);
    }
  }, [externalPosts]);

  const [feedCategoryFilter, setFeedCategoryFilter] = useState<string>('SEMUA');
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [openCreatePostWithImage, setOpenCreatePostWithImage] = useState(false);
  const [memberOverrides, setMemberOverrides] = useState<Record<string, AnggotaWiraSatya>>({});

  useEffect(() => {
    const handleResetBeranda = () => {
      setSelectedMember(null);
    };
    window.addEventListener('ws96_reset_beranda', handleResetBeranda);
    return () => window.removeEventListener('ws96_reset_beranda', handleResetBeranda);
  }, []);

  useEffect(() => {
    setMemberOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      for (const m of members) {
        if (next[m.nrp]) next[m.nrp] = m;
        if (next[m.id]) next[m.id] = m;
      }
      return next;
    });
    setSelectedMember((prev) => {
      if (!prev) return null;
      const found = members.find((m) => m.nrp === prev.nrp || m.id === prev.id);
      return found ? found : prev;
    });
  }, [members]);

  const effectiveMembers = useMemo(
    () => members.map((m) => memberOverrides[m.nrp] || memberOverrides[m.id] || m),
    [members, memberOverrides]
  );

  // Public directory members (always exclude behind-the-scenes Superadmin from alumni directory & counts)
  const publicMembers = useMemo(
    () =>
      effectiveMembers.filter(
        (m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
      ),
    [effectiveMembers]
  );

  // Current logged in member profile
  const currentMemberObj = useMemo(
    () => getOrBuildUserProfile(currentUser, effectiveMembers),
    [currentUser, effectiveMembers]
  );

  const syncPosts = (updated: FeedPost[]) => {
    setPosts(updated);
    if (onPostsChange) onPostsChange(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wirasatya96_feed_posts', JSON.stringify(updated));
      } catch {
        // Ignore storage quota overflow if base64 image is large
      }
    }
  };

  // Feed Actions (Persisted to /api/posts)
  const handleCreatePost = async (
    newPostData: Omit<FeedPost, 'id' | 'createdAt' | 'likesCount' | 'repostsCount' | 'comments'>
  ) => {
    const newPost: FeedPost = {
      ...newPostData,
      id: `post-${Date.now()}`,
      createdAt: 'Baru saja',
      likesCount: 0,
      isLiked: false,
      likedBy: [],
      reactionsByNrp: {},
      repostsCount: 0,
      isReposted: false,
      repostedBy: [],
      impressionsCount: 1,
      comments: [],
    };
    const updated = [newPost, ...posts];
    syncPosts(updated);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE', id: newPost.id, ...newPostData }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        syncPosts(data.posts);
      }
    } catch {
      // fallback to local state
    }
  };

  const handleLikeToggle = async (postId: string, reaction?: ReactionType | null) => {
    const userNrp = currentUser.nrp;
    const updated = posts.map((p) => {
      if (p.id !== postId) return p;
      const likedBy = Array.isArray(p.likedBy) ? [...p.likedBy] : p.isLiked ? [userNrp] : [];
      const reactionsByNrp = { ...(p.reactionsByNrp || {}) };
      const idx = likedBy.indexOf(userNrp);

      if (reaction === null) {
        if (idx !== -1) {
          likedBy.splice(idx, 1);
          delete reactionsByNrp[userNrp];
          return {
            ...p,
            isLiked: false,
            userReaction: null,
            likedBy,
            reactionsByNrp,
            likesCount: Math.max(0, p.likesCount - 1),
          };
        }
        return p;
      }

      if (reaction) {
        reactionsByNrp[userNrp] = reaction;
        if (idx === -1) {
          likedBy.push(userNrp);
          return {
            ...p,
            isLiked: true,
            userReaction: reaction,
            likedBy,
            reactionsByNrp,
            likesCount: p.likesCount + 1,
          };
        }
        return {
          ...p,
          isLiked: true,
          userReaction: reaction,
          likedBy,
          reactionsByNrp,
        };
      }

      if (idx !== -1) {
        likedBy.splice(idx, 1);
        delete reactionsByNrp[userNrp];
        return {
          ...p,
          isLiked: false,
          userReaction: null,
          likedBy,
          reactionsByNrp,
          likesCount: Math.max(0, p.likesCount - 1),
        };
      } else {
        likedBy.push(userNrp);
        reactionsByNrp[userNrp] = 'like';
        return {
          ...p,
          isLiked: true,
          userReaction: 'like' as ReactionType,
          likedBy,
          reactionsByNrp,
          likesCount: p.likesCount + 1,
        };
      }
    });
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LIKE',
          postId,
          actorNrp: userNrp,
          userNrp,
          reaction,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleRepost = async (postId: string) => {
    const userNrp = currentUser.nrp;
    const updated = posts.map((p) => {
      if (p.id !== postId) return p;
      const repostedBy = Array.isArray(p.repostedBy) ? [...p.repostedBy] : p.isReposted ? [userNrp] : [];
      const idx = repostedBy.indexOf(userNrp);
      if (idx !== -1) {
        repostedBy.splice(idx, 1);
        return {
          ...p,
          isReposted: false,
          repostedBy,
          repostsCount: Math.max(0, p.repostsCount - 1),
        };
      } else {
        repostedBy.push(userNrp);
        return {
          ...p,
          isReposted: true,
          repostedBy,
          repostsCount: p.repostsCount + 1,
        };
      }
    });
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPOST',
          postId,
          actorNrp: userNrp,
          userNrp,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleEditPost = async (
    postId: string,
    updates: {
      content?: string;
      imageUrl?: string | null;
      category?: FeedPost['category'];
      pinned?: boolean;
      isPinned?: boolean;
    }
  ) => {
    const nextPinned =
      updates.pinned !== undefined
        ? updates.pinned
        : updates.isPinned !== undefined
        ? updates.isPinned
        : undefined;

    const updated = posts.map((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        content: updates.content !== undefined ? updates.content : p.content,
        category: updates.category !== undefined ? updates.category : p.category,
        imageUrl:
          updates.imageUrl === null
            ? undefined
            : updates.imageUrl !== undefined
            ? updates.imageUrl
            : p.imageUrl,
        pinned: nextPinned !== undefined ? nextPinned : p.pinned,
        isPinned: nextPinned !== undefined ? nextPinned : p.isPinned ?? p.pinned,
        isEdited:
          updates.content !== undefined ||
          updates.imageUrl !== undefined ||
          updates.category !== undefined
            ? true
            : p.isEdited,
        updatedAt: 'Diedit baru saja',
      };
    });
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EDIT_POST',
          postId,
          actorNrp: currentUser.nrp,
          actorRole: currentUser.role,
          ...updates,
          pinned: nextPinned,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleDeletePost = async (postId: string) => {
    const updated = posts.filter((p) => p.id !== postId);
    syncPosts(updated);

    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('ws96_deleted_post_ids_v1');
        const parsedDel: string[] = rawDel ? JSON.parse(rawDel) : [];
        if (!parsedDel.includes(postId)) {
          parsedDel.push(postId);
          localStorage.setItem('ws96_deleted_post_ids_v1', JSON.stringify(parsedDel));
        }
      } catch {
        // ignore
      }
    }

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_POST',
          postId,
          actorNrp: currentUser.nrp,
          actorRole: currentUser.role,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleAddComment = async (
    postId: string,
    commentText: string,
    parentCommentId?: string,
    imageUrl?: string
  ) => {
    const newComment: PostComment = {
      id: `c-${Date.now()}`,
      authorName: currentUser.nama.replace(/\(.*?\)/g, '').trim(),
      authorPangkat: currentUser.pangkat,
      authorAvatar: resolveAvatarUrl(currentMemberObj?.fotoUrl, currentUser.fotoUrl),
      authorNrp: currentUser.nrp,
      content: commentText,
      imageUrl: imageUrl || undefined,
      createdAt: 'Baru saja',
      likesCount: 0,
      likedBy: [],
      replies: [],
    };

    const insertReplyRecursive = (list: PostComment[]): PostComment[] =>
      list.map((c) => {
        if (c.id === parentCommentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newComment],
          };
        }
        if (Array.isArray(c.replies) && c.replies.length > 0) {
          return {
            ...c,
            replies: insertReplyRecursive(c.replies),
          };
        }
        return c;
      });

    const updated = posts.map((p) => {
      if (p.id !== postId) return p;
      if (parentCommentId) {
        return {
          ...p,
          comments: insertReplyRecursive(p.comments),
        };
      }
      return {
        ...p,
        comments: [...p.comments, newComment],
      };
    });
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMMENT',
          postId,
          parentCommentId,
          comment: newComment,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleEditComment = async (
    postId: string,
    commentId: string,
    content: string,
    parentCommentId?: string
  ) => {
    const editRecursive = (list: PostComment[]): PostComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            content,
            isEdited: true,
            updatedAt: 'Diedit',
          };
        }
        if (Array.isArray(c.replies) && c.replies.length > 0) {
          return {
            ...c,
            replies: editRecursive(c.replies),
          };
        }
        return c;
      });

    const updated = posts.map((p) => (p.id === postId ? { ...p, comments: editRecursive(p.comments) } : p));
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EDIT_COMMENT',
          postId,
          commentId,
          parentCommentId,
          actorNrp: currentUser.nrp,
          actorRole: currentUser.role,
          content,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleDeleteComment = async (
    postId: string,
    commentId: string,
    parentCommentId?: string
  ) => {
    const deleteRecursive = (list: PostComment[]): PostComment[] =>
      list
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: Array.isArray(c.replies) ? deleteRecursive(c.replies) : c.replies,
        }));

    const updated = posts.map((p) => (p.id === postId ? { ...p, comments: deleteRecursive(p.comments) } : p));
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_COMMENT',
          postId,
          commentId,
          parentCommentId,
          actorNrp: currentUser.nrp,
          actorRole: currentUser.role,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleLikeComment = async (
    postId: string,
    commentId: string,
    parentCommentId?: string
  ) => {
    const userNrp = currentUser.nrp;
    const toggleLikeRecursive = (list: PostComment[]): PostComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const likedBy = Array.isArray(c.likedBy) ? [...c.likedBy] : [];
          const idx = likedBy.indexOf(userNrp);
          const currentCount = typeof c.likesCount === 'number' ? c.likesCount : likedBy.length;
          if (idx !== -1) {
            likedBy.splice(idx, 1);
            return { ...c, likedBy, likesCount: Math.max(0, currentCount - 1) };
          } else {
            likedBy.push(userNrp);
            return { ...c, likedBy, likesCount: currentCount + 1 };
          }
        }
        if (Array.isArray(c.replies) && c.replies.length > 0) {
          return { ...c, replies: toggleLikeRecursive(c.replies) };
        }
        return c;
      });

    const updated = posts.map((p) => (p.id === postId ? { ...p, comments: toggleLikeRecursive(p.comments) } : p));
    syncPosts(updated);

    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LIKE_COMMENT',
          postId,
          commentId,
          parentCommentId,
          actorNrp: userNrp,
          userNrp,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleAuthorClick = (authorNrp?: string) => {
    if (!authorNrp) return;
    if (authorNrp === currentUser.nrp) {
      setSelectedMember(getOrBuildUserProfile(currentUser, members));
      return;
    }
    const found = members.find((m) => m.nrp === authorNrp);
    if (found) setSelectedMember(found);
  };

  const resolveLiveAuthorAvatar = useMemo(() => {
    const myBaseName = (currentMemberObj?.namaLengkap || currentUser.nama || '')
      .replace(/\(.*?\)/g, '')
      .split(',')[0]
      .trim()
      .toLowerCase();

    return (authorNrp?: string, authorName?: string, fallbackAvatar?: string): string => {
      const cleanNrp = (authorNrp || '').trim();
      const cleanName = (authorName || '')
        .replace(/\(.*?\)/g, '')
        .split(',')[0]
        .trim()
        .toLowerCase();

      if (
        (cleanNrp &&
          (cleanNrp === currentUser.nrp ||
            (currentUser.oldNrp && cleanNrp === currentUser.oldNrp))) ||
        (cleanName && myBaseName && cleanName === myBaseName)
      ) {
        return resolveAvatarUrl(
          currentMemberObj?.fotoUrl || currentUser.fotoUrl,
          fallbackAvatar
        );
      }

      const foundMember = effectiveMembers.find((m) => {
        if (cleanNrp && (m.nrp === cleanNrp || m.oldNrp === cleanNrp)) return true;
        if (!cleanName) return false;
        const mBase = (m.namaLengkap || '').split(',')[0].trim().toLowerCase();
        return Boolean(mBase && mBase === cleanName);
      });

      return resolveAvatarUrl(foundMember?.fotoUrl, fallbackAvatar);
    };
  }, [currentMemberObj, currentUser, effectiveMembers]);

  const filteredPosts = useMemo(() => {
    const enrichCommentsWithLiveAvatar = (comments?: PostComment[]): PostComment[] => {
      if (!Array.isArray(comments)) return [];
      return comments.map((c) => ({
        ...c,
        authorAvatar: resolveLiveAuthorAvatar(c.authorNrp, c.authorName, c.authorAvatar),
        replies: Array.isArray(c.replies)
          ? enrichCommentsWithLiveAvatar(c.replies)
          : c.replies,
      }));
    };

    const list = (
      feedCategoryFilter === 'SEMUA'
        ? posts
        : posts.filter((p) => p.category === feedCategoryFilter)
    ).map((p) => ({
      ...p,
      authorAvatar: resolveLiveAuthorAvatar(p.authorNrp, p.authorName, p.authorAvatar),
      comments: enrichCommentsWithLiveAvatar(p.comments),
    }));

    return [...list].sort((a, b) => (b.isPinned || b.pinned ? 1 : 0) - (a.isPinned || a.pinned ? 1 : 0));
  }, [posts, feedCategoryFilter, resolveLiveAuthorAvatar]);

  const infiniteFeedPosts = useMemo(() => {
    if (filteredPosts.length === 0) return [];
    const result: Array<{ post: FeedPost; renderKey: string }> = [];
    for (let cycle = 0; cycle < feedRepeatCount; cycle++) {
      for (const p of filteredPosts) {
        result.push({
          post: cycle === 0 ? p : { ...p, isPinned: false, pinned: false },
          renderKey: `${p.id}-cycle-${cycle}`,
        });
      }
    }
    return result;
  }, [filteredPosts, feedRepeatCount]);

  const handleFeedScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 180) {
      setFeedRepeatCount((prev) => Math.min(prev + 1, 3));
    }
  };

  const todSummary = useMemo(() => {
    let mabes = 0;
    let polda = 0;
    let luar = 0;
    for (const m of publicMembers) {
      if (m.tipeSatker === 'KEMEN/LEMBAGA' || m.polda === 'LUAR STRUKTUR POLRI') luar++;
      else if (m.polda === 'MABES POLRI' || m.tipeSatker === 'MABES') mabes++;
      else polda++;
    }
    return { mabes, polda, luar };
  }, [publicMembers]);

  // Quick search results when user types in top navbar search
  const quickSearchResults = useMemo(() => {
    const q = externalSearch.trim().toLowerCase();
    if (!q) return [];
    return publicMembers
      .filter(
        (m) =>
          m.namaLengkap.toLowerCase().includes(q) ||
          m.nrp.includes(q) ||
          m.jabatanTerakhir.toLowerCase().includes(q) ||
          m.satuanKerja.toLowerCase().includes(q) ||
          m.polda.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [publicMembers, externalSearch]);

  const formatWaUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}?text=Halo%20Komandan%2C%20mohon%20izin%20menghubungi%20dari%20Portal%20Alumni%20Akpol%201996%20Wira%20Satya`;
  };

  const formatRupiah = (val?: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Find members needing health attention
  const healthAttentionMembers = useMemo(() => {
    return publicMembers
      .filter(
        (m) =>
          m.adaPenyakitKronis === 'ADA' ||
          (m.daftarPenyakit && m.daftarPenyakit.length > 0) ||
          m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' ||
          m.kondisiKesehatan === 'SAKIT'
      )
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          'PERLU PERHATIAN KHUSUS': 1,
          SAKIT: 2,
          CUKUP: 3,
          BAIK: 4,
          'SANGAT BAIK': 5,
        };
        const pA = priorityOrder[a.kondisiKesehatan] || 99;
        const pB = priorityOrder[b.kondisiKesehatan] || 99;
        return pA - pB;
      });
  }, [publicMembers]);

  if (selectedMember) {
    const extraProfileProps = {
      memberRole: selectedMember.nrp === currentUser?.nrp ? currentUser?.role : undefined,
      onUpdateMemberDirect: async (updated: AnggotaWiraSatya) => {
        setMemberOverrides((prev) => ({
          ...prev,
          [updated.nrp]: updated,
          [updated.id]: updated,
        }));
        setSelectedMember(updated);
        if (onUpdateMemberDirect) {
          onUpdateMemberDirect(updated);
        }
        if (typeof window !== 'undefined' && updated.nrp === currentUser?.nrp) {
          const nextUser: AuthUser & Record<string, unknown> = {
            ...currentUser,
            nama: updated.namaLengkap,
            pangkat: updated.pangkat,
            fotoUrl: updated.fotoUrl,
            coverUrl: updated.coverUrl,
            bio: updated.bio,
            satker: updated.satuanKerja,
            polda: updated.polda,
            jabatanTerakhir: updated.jabatanTerakhir,
            statusKedinasan: updated.statusKedinasan || updated.statusDinas,
            kompi: updated.kompi,
            pleton: updated.pleton,
            kategoriUsaha: updated.kategoriUsaha,
            namaUsahaYayasan: updated.namaUsahaYayasan,
            peranUsahaYayasan: updated.peranUsahaYayasan,
            kesehatanLainLain: updated.kesehatanLainLain,
            email: updated.email || currentUser.email,
            secondaryEmail: updated.secondaryEmail,
            noHp: updated.noHp,
            golonganDarah: updated.golonganDarah,
            ukuranBaju: updated.ukuranBaju,
            ukuranCelana: updated.ukuranCelana,
            ukuranSepatu: updated.ukuranSepatu,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem('ws96_auth_user', JSON.stringify(nextUser));
          localStorage.setItem('ws96_active_user', JSON.stringify(nextUser));
          localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextUser));
          window.dispatchEvent(new Event('ws96_user_updated'));
        }
      },
    };
    return (
      <LinkedInProfileView
        member={selectedMember}
        currentUser={currentUser}
        onClose={() => setSelectedMember(null)}
        onEditProfile={(member, initialTab) =>
          onEditMember && onEditMember(member || selectedMember, initialTab)
        }
        onOpenChat={onOpenChat}
        allMembers={publicMembers}
        onSelectMember={(m) => setSelectedMember(m)}
        {...(extraProfileProps as Record<string, unknown>)}
      />
    );
  }

  const miniCardCoverUrl = currentMemberObj?.coverUrl || currentUser?.coverUrl;
  const myResolvedAvatarUrl = resolveAvatarUrl(
    currentMemberObj?.fotoUrl,
    currentUser.fotoUrl
  );
  const myEffectiveRole = resolveRoleForBadge(currentUser?.nrp, currentUser?.role) || currentUser?.role;

  return (
    <div className="font-sans text-slate-900 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ============================================================ */}
        {/* 1. LEFT RAIL (lg:col-span-3): PROFIL SAYA & TOUR OF DUTY     */}
        {/* ============================================================ */}
        <div className="order-1 lg:order-1 lg:col-span-3 space-y-3 sm:space-y-4">
          {/* Card 1: Profil Saya (Kiri Atas) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Mobile Compact Header (muncul Header doang di HP, klik muncul detail & navigasi ke bawah) */}
            <div
              onClick={() => setMobileOpenProfile((prev) => !prev)}
              className="lg:hidden flex items-center justify-between gap-2.5 p-3.5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={myResolvedAvatarUrl}
                  alt={currentUser.nama}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 bg-white"
                />
                <div className="min-w-0 text-left">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1 truncate">
                    <span className="truncate">
                      {(currentMemberObj?.namaLengkap || currentUser.nama).replace(/\(.*?\)/g, '').trim()}
                    </span>
                    <MetaVerifiedBadge role={currentUser?.role} nrp={currentUser?.nrp} size="sm" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {currentMemberObj?.pangkat || currentUser.pangkat} &bull; Profil Saya
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  Profil
                </span>
                {mobileOpenProfile ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Desktop Cover & Avatar Header */}
            <div className="hidden lg:block text-center">
              <div className="h-16 bg-gradient-to-r from-red-950 via-slate-900 to-red-900 relative overflow-hidden">
                {miniCardCoverUrl !== 'none' && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={miniCardCoverUrl || '/default-cover.jpg'}
                    alt="Sampul Polri"
                    className="w-full h-full object-cover object-center"
                  />
                )}
              </div>

              <div className="px-4 relative">
                <div
                  onClick={() => setSelectedMember(currentMemberObj)}
                  className="w-16 h-16 rounded-full border-2 border-white shadow-md mx-auto -mt-8 overflow-hidden bg-white cursor-pointer group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={myResolvedAvatarUrl}
                    alt={currentUser.nama}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                <h3
                  onClick={() => setSelectedMember(currentMemberObj)}
                  className="text-sm font-bold text-slate-900 hover:text-red-900 cursor-pointer mt-2 leading-tight flex items-center justify-center gap-1"
                >
                  <span className="truncate">
                    {(currentMemberObj?.namaLengkap || currentUser.nama).replace(/\(.*?\)/g, '').trim()}
                  </span>
                  <MetaVerifiedBadge role={currentUser?.role} nrp={currentUser?.nrp} size="md" />
                </h3>
                <p
                  className="text-[11px] text-slate-500 mt-0.5 line-clamp-2"
                  title={`${currentMemberObj?.pangkat || currentUser.pangkat} • ${formatJabatanWithSatker(currentMemberObj?.jabatanTerakhir, currentMemberObj?.satuanKerja || currentUser.satker)}`}
                >
                  {`${currentMemberObj?.pangkat || currentUser.pangkat} • ${formatJabatanWithSatker(currentMemberObj?.jabatanTerakhir, currentMemberObj?.satuanKerja || currentUser.satker)}`}
                </p>
              </div>
            </div>

            {/* Expandable Details & Navigation (Terbuka saat di-klik di HP, selalu tampil di Desktop) */}
            <div className={`${mobileOpenProfile ? 'block ws96-accordion-body' : 'hidden'} lg:block px-4 pb-4`}>
              <div className="pt-3 border-t border-slate-100 lg:mt-3 text-left space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>NRP:</span>
                  <span className="font-mono font-bold text-slate-800">{currentUser.nrp}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-500">
                  <span className="shrink-0">Jabatan Polri:</span>
                  <span
                    className="font-bold text-slate-800 truncate text-right"
                    title={cleanJabatanOnly(currentMemberObj?.jabatanTerakhir) || currentUser.satker || '-'}
                  >
                    {cleanJabatanOnly(currentMemberObj?.jabatanTerakhir) || currentUser.satker || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-500">
                  <span className="shrink-0">Satker / Wilayah:</span>
                  <span
                    className="font-bold text-slate-700 truncate text-right"
                    title={currentMemberObj?.satuanKerja || currentUser.polda || 'MABES POLRI'}
                  >
                    {currentMemberObj?.satuanKerja || currentUser.polda || 'MABES POLRI'}
                  </span>
                </div>
                {(myEffectiveRole === 'KETUA' ||
                  myEffectiveRole === 'SEKRETARIAT' ||
                  myEffectiveRole === 'BENDAHARA') && (
                  <div className="flex items-center justify-between gap-2 text-slate-500">
                    <span className="shrink-0">Jabatan Angkatan:</span>
                    <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                      {myEffectiveRole === 'KETUA' ? (
                        'Ketua Angkatan'
                      ) : myEffectiveRole === 'SEKRETARIAT' ? (
                        <>
                          <span className="sm:hidden">Sekretaris</span>
                          <span className="hidden sm:inline">Sekretaris Angkatan</span>
                        </>
                      ) : (
                        <>
                          <span className="sm:hidden">Bendahara</span>
                          <span className="hidden sm:inline">Bendahara Angkatan</span>
                        </>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-500">
                  <span>Hak Akses:</span>
                  <span className="font-bold text-slate-900">
                    {myEffectiveRole === 'SEKRETARIAT' ? 'Sekretaris' : myEffectiveRole}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedMember(currentMemberObj)}
                className="w-full mt-3 py-1.5 px-3 rounded-lg border border-red-800 text-red-900 hover:bg-red-50 font-bold text-xs transition-colors"
              >
                <span className="lg:hidden">Buka Profil Saya →</span>
                <span className="hidden lg:inline">Lihat Profil Saya</span>
              </button>
            </div>
          </div>

          {/* Card 2: Tour of Duty / TOD (Kiri Bawah) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4 text-xs">
            <div
              onClick={() => setMobileOpenTod((prev) => !prev)}
              className="flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-red-800 shrink-0" />
                <span>Tour of Duty</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTodWidgetInfo((prev) => !prev);
                  }}
                  title="Sebaran penempatan personel aktif di Mabes Polri, 38 Polda, dan Luar Struktur"
                  className="text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full">
                  {publicMembers.length} Personel
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenTod ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            {showTodWidgetInfo && (
              <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                Sebaran penempatan personel aktif di Mabes Polri, 38 Polda, dan Luar Struktur.
              </div>
            )}

            <div className={`${mobileOpenTod ? 'block ws96-accordion-body' : 'hidden'} lg:block pt-2.5 mt-2.5 border-t border-slate-100 space-y-2.5`}>
              {/* Ringkasan angka penempatan khusus saat di-expand di HP */}
              <div className="lg:hidden grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-xs font-extrabold text-slate-900">{todSummary.mabes}</div>
                  <div className="text-[10px] text-slate-500">Mabes</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-xs font-extrabold text-slate-900">{todSummary.polda}</div>
                  <div className="text-[10px] text-slate-500">38 Polda</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-xs font-extrabold text-slate-900">{todSummary.luar}</div>
                  <div className="text-[10px] text-slate-500">Luar Struktur</div>
                </div>
              </div>

              {onNavigateToJabatan && (
                <button
                  onClick={onNavigateToJabatan}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors"
                >
                  Lihat Direktori →
                </button>
              )}
            </div>
          </div>

          {/* Slogan Banner khusus tampilan PC (di kolom kiri seperti semula) */}
          <div className="hidden lg:block p-3 ws96-gold-card rounded-xl border border-amber-300/60 text-center">
            <span className="text-[11px] font-extrabold text-amber-900 tracking-wider">
              #SELALUBAHAGIA
            </span>
            <p className="text-[10px] text-amber-800 mt-0.5">
              Guyub, Peduli, &amp; Mengabdi Sejak 1996
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. RIGHT RAIL (lg:col-span-3, order-2 di HP): ATENSI & DANA  */}
        {/* ============================================================ */}
        <div className="order-2 lg:order-3 lg:col-span-3 space-y-3 sm:space-y-4">
          {/* Card 3: Atensi Kesehatan (Kanan Atas) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
            <div
              onClick={() => setMobileOpenHealth((prev) => !prev)}
              className="flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-500 shrink-0 ws96-heartbeat" />
                <span>Atensi Kesehatan</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-extrabold border border-red-200">
                  {healthAttentionMembers.filter(
                    (m) => m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT'
                  ).length || healthAttentionMembers.length}{' '}
                  Prioritas
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenHealth ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            <div className={`${mobileOpenHealth ? 'block ws96-accordion-body' : 'hidden'} lg:block pt-3 mt-2.5 border-t border-slate-100 space-y-2.5`}>
              {healthAttentionMembers.length > 0 ? (
                <div className="space-y-2.5">
                  {healthAttentionMembers.map((m) => {
                    const isUrgent =
                      m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT';
                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isUrgent ? 'bg-red-50/70 border-red-200/90 shadow-sm' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            onClick={() => setSelectedMember(m)}
                            className="text-xs font-bold text-slate-900 hover:text-red-900 cursor-pointer truncate max-w-[140px] flex items-center gap-1"
                            title={m.namaLengkap}
                          >
                            <span className="truncate">{m.namaLengkap.split(',')[0]}</span>
                            <MetaVerifiedBadge nrp={m.nrp} size="xs" />
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 ${
                              isUrgent ? 'bg-red-600 text-white shadow-sm' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            {isUrgent ? (
                              <>
                                <span className="sm:hidden">ATENSI</span>
                                <span className="hidden sm:inline">ATENSI KHUSUS</span>
                              </>
                            ) : (
                              'TERPANTAU'
                            )}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 line-clamp-2">
                          <span className="text-slate-500 font-semibold">Diagnosa: </span>
                          <b>{(m.daftarPenyakit || []).join(', ') || 'Dalam Pemulihan'}</b>
                        </div>

                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/60">
                          <a
                            href={formatWaUrl(m.noHp)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span className="sm:hidden">Kirim Doa</span>
                            <span className="hidden sm:inline">Kirim Doa &amp; Semangat</span>
                          </a>
                          <button
                            onClick={() => setSelectedMember(m)}
                            className="text-[10px] font-bold text-red-900 hover:underline"
                          >
                            <span className="sm:hidden">Detail →</span>
                            <span className="hidden sm:inline">Detail Medis →</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                  Tidak ada personel yang membutuhkan atensi medis khusus.
                </div>
              )}

              {onNavigateToHealth && (
                <button
                  onClick={onNavigateToHealth}
                  className="lg:hidden w-full py-1.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 font-bold text-xs transition-colors"
                >
                  Buka Menu Kesehatan →
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Dana Sosial & Investasi (Kanan Bawah) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4 text-xs">
            <div
              onClick={() => setMobileOpenDana((prev) => !prev)}
              className="flex items-center justify-between cursor-pointer lg:cursor-default select-none"
            >
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Dana Sosial &amp; Investasi</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDanaWidgetInfo((prev) => !prev);
                  }}
                  title="Program Penggalangan Dana Sosial (Anak Yatim, Anggota Sakit, Dana Duka, Event), Dana Investasi, dan Buku Kas"
                  className="text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Sukarela
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileOpenDana ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            {showDanaWidgetInfo && (
              <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                Program Penggalangan Dana Sosial (Anak Yatim, Anggota Sakit, Dana Duka, Event), Dana Investasi, dan Buku Kas.
              </div>
            )}

            <div className={`${mobileOpenDana ? 'block ws96-accordion-body' : 'hidden'} lg:block pt-3 mt-2.5 border-t border-slate-100 space-y-3`}>
              {/* Active Milestone Programs (Kitabisa / Saweria style) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    1. Milestone Dana Sosial
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {widgetCampaigns.filter((c) => c.status !== 'SELESAI').length} Program
                  </span>
                </div>
                <div className="space-y-2">
                  {widgetCampaigns.slice(0, 3).map((cmp) => {
                    const pct =
                      cmp.targetAmount > 0
                        ? Math.min(100, Math.round((Number(cmp.collectedAmount || 0) / cmp.targetAmount) * 100))
                        : 0;
                    const icon =
                      cmp.category === 'ANAK_YATIM'
                        ? '🤲'
                        : cmp.category === 'ANGGOTA_SAKIT'
                        ? '🏥'
                        : cmp.category === 'ANGGOTA_MD'
                        ? '🕊️'
                        : '🤝';
                    return (
                      <div
                        key={cmp.id}
                        onClick={() => onNavigateToBendahara && onNavigateToBendahara()}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="font-bold text-slate-800 truncate text-[11px]">
                            {icon} {cmp.title}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-700 shrink-0">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all ws96-progress-fill"
                            style={{ width: `${Math.max(pct, cmp.collectedAmount > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>
                            Terkumpul: <strong className="text-slate-800">{formatRupiah(cmp.collectedAmount || 0)}</strong>
                          </span>
                          <span>Target: {formatRupiah(cmp.targetAmount || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dana Investasi & Buku Kas */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  2. Dana Investasi &amp; Buku Kas
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Dana Investasi / Aset:</span>
                  <span className="font-bold text-indigo-700">
                    {formatRupiah(displayNilaiAset + widgetInvestTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Saldo Buku Kas:</span>
                  <span className="font-bold text-slate-900">{formatRupiah(displaySaldoKas)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                  <span className="text-emerald-700 font-semibold">+ {formatRupiah(computedKasMasuk)}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-red-700 font-semibold">- {formatRupiah(computedKasKeluar)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                {onNavigateToBendahara && (
                  <button
                    onClick={onNavigateToBendahara}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition-colors"
                  >
                    <span className="sm:hidden">Buka Bendahara →</span>
                    <span className="hidden sm:inline">Buka Dana Sosial &amp; Investasi →</span>
                  </button>
                )}
                <span
                  className="text-[11px] text-slate-400 flex items-center justify-center gap-1"
                  title="Penggalangan dana sosial (milestone), dana investasi, dan buku kas dikelola oleh Bendahara."
                >
                  <span>Dikelola oleh Bendahara</span>
                  <Info className="w-3 h-3 text-slate-400 inline" />
                </span>
              </div>
            </div>
          </div>

          {/* Widget 3: Info Footer khusus tampilan PC (di kolom kanan seperti semula) */}
          <div className="hidden lg:block text-center text-[10px] text-slate-400 space-y-0.5 py-2">
            <p className="font-extrabold text-slate-500 tracking-wide">BATALYON WIRA SATYA 1996</p>
            <p>Akademi Kepolisian Negara Republik Indonesia</p>
            <p>Portal Internal Alumni 1996 &copy; 2026</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. CENTER FEED (lg:col-span-6, order-3 di HP):               */}
        {/*    Card Posting -> Linimasa -> Feed Scroll -> #SELALUBAHAGIA */}
        {/*    -> BATALYON WIRA SATYA 1996 (Paling Bawah di HP)          */}
        {/* ============================================================ */}
        <div className="order-3 lg:order-2 lg:col-span-6 space-y-4 scroll-mt-20">
          {/* Quick Search Results if user typed in Navbar Search */}
          {externalSearch.trim() !== '' && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-red-800 shrink-0" />
                  <span className="truncate">
                    <span className="sm:hidden">Hasil Pencarian: &ldquo;{externalSearch}&rdquo;</span>
                    <span className="hidden sm:inline">Hasil Pencarian Cepat: &ldquo;{externalSearch}&rdquo;</span>
                  </span>
                </span>
                {onNavigateToJabatan && (
                  <button
                    onClick={onNavigateToJabatan}
                    className="text-red-800 font-bold hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    <span className="sm:hidden">Menu ToD</span>
                    <span className="hidden sm:inline">Buka Menu ToD</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {quickSearchResults.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {quickSearchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className="py-2 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAvatarUrl(m.fotoUrl)}
                          alt={m.namaLengkap}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                            <span className="truncate">
                              {formatMemberDisplayName(m.pangkat, m.namaLengkap)}
                            </span>
                            <MetaVerifiedBadge nrp={m.nrp} size="sm" />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            NRP {m.nrp} &bull; {m.jabatanTerakhir}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded flex-shrink-0">
                        <span className="sm:hidden">Profil</span>
                        <span className="hidden sm:inline">Lihat Profil</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">
                  Tidak ditemukan personel dengan kata kunci tersebut.
                </p>
              )}
            </div>
          )}

          {/* Card untuk Posting */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 sm:p-4 space-y-3 scroll-mt-20">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={myResolvedAvatarUrl}
                alt={currentUser.nama}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0 bg-white"
              />
              <button
                onClick={() => {
                  setOpenCreatePostWithImage(false);
                  setIsCreatePostModalOpen(true);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 rounded-full text-left text-xs text-slate-500 font-medium transition-colors border border-slate-200 hover:text-slate-800 truncate"
              >
                Tulis postingan...
              </button>
            </div>

            <div className="flex items-center justify-around pt-2 border-t border-slate-100 text-[11px] sm:text-xs font-semibold text-slate-600 px-0.5 sm:px-2">
              <button
                onClick={() => {
                  setOpenCreatePostWithImage(true);
                  setIsCreatePostModalOpen(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 hover:text-red-900 transition-colors p-1 whitespace-nowrap"
              >
                <ImageIcon className="w-4 h-4 text-red-800 shrink-0" />
                <span>Foto</span>
              </button>
              <button
                onClick={() => {
                  setOpenCreatePostWithImage(true);
                  setIsCreatePostModalOpen(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 hover:text-emerald-600 transition-colors p-1 whitespace-nowrap"
              >
                <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Video</span>
              </button>
              <button
                onClick={() => {
                  setOpenCreatePostWithImage(false);
                  setIsCreatePostModalOpen(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 hover:text-amber-600 transition-colors p-1 whitespace-nowrap"
              >
                <PenSquare className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="sm:hidden">Artikel</span>
                <span className="hidden sm:inline">Tulis Artikel</span>
              </button>
            </div>
          </div>

          {/* Linimasa & Filter Kategori */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 shrink-0">
                <Newspaper className="w-4 h-4 text-red-800 shrink-0" />
                <span>Linimasa ({filteredPosts.length})</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 text-xs">
                {[
                  { key: 'SEMUA', label: 'Semua' },
                  { key: 'MOTIVASI', label: 'Motivasi' },
                  { key: 'KENAIKAN_PANGKAT', label: 'Kenaikan Pangkat' },
                  { key: 'BAKSOS', label: 'Baksos' },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setFeedCategoryFilter(cat.key);
                      setFeedRepeatCount(1);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                      feedCategoryFilter === cat.key
                        ? 'bg-red-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feed-feed yg kalo digulir nambah terus tanpa menghilangkan posisi paling bawah */}
            {members.length === 0 ? (
              <div className="space-y-4">
                <FeedPostSkeleton count={2} />
                <DirectoryCardSkeleton count={3} />
              </div>
            ) : infiniteFeedPosts.length > 0 ? (
              <div
                onScroll={handleFeedScroll}
                className="max-h-[68vh] lg:max-h-none overflow-y-auto lg:overflow-visible pr-1 lg:pr-0 space-y-4 overscroll-contain rounded-xl"
              >
                {infiniteFeedPosts.map(({ post, renderKey }) => (
                  <LinkedInPostCard
                    key={renderKey}
                    post={post}
                    currentUser={currentUser}
                    currentUserAvatar={myResolvedAvatarUrl}
                    resolveAuthorAvatar={resolveLiveAuthorAvatar}
                    onLikeToggle={handleLikeToggle}
                    onRepost={handleRepost}
                    onAddComment={handleAddComment}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                    onEditComment={handleEditComment}
                    onDeleteComment={handleDeleteComment}
                    onLikeComment={handleLikeComment}
                    onAuthorClick={handleAuthorClick}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-2">
                <p className="text-slate-600 text-xs">Belum ada postingan pada kategori ini.</p>
                <button
                  onClick={() => {
                    setOpenCreatePostWithImage(false);
                    setIsCreatePostModalOpen(true);
                  }}
                  className="text-xs font-bold text-red-900 hover:underline"
                >
                  Buat Postingan Baru
                </button>
              </div>
            )}
          </div>

          {/* Di atas tulisan paling bawah (Khusus HP): Card #SELALUBAHAGIA */}
          <div className="lg:hidden p-3 ws96-gold-card rounded-xl border border-amber-300/60 text-center">
            <span className="text-[11px] font-extrabold text-amber-900 tracking-wider">
              #SELALUBAHAGIA
            </span>
            <p className="text-[10px] text-amber-800 mt-0.5">
              Guyub, Peduli, &amp; Mengabdi Sejak 1996
            </p>
          </div>

          {/* Paling Bawah (Khusus HP): Tulisan BATALYON WIRA SATYA 1996 */}
          <div className="lg:hidden text-center text-[10px] text-slate-400 space-y-0.5 py-2">
            <p className="font-extrabold text-slate-500 tracking-wide">BATALYON WIRA SATYA 1996</p>
            <p>Akademi Kepolisian Negara Republik Indonesia</p>
            <p>Portal Internal Alumni 1996 &copy; 2026</p>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => {
          setIsCreatePostModalOpen(false);
          setOpenCreatePostWithImage(false);
        }}
        currentUser={{ ...currentUser, fotoUrl: myResolvedAvatarUrl }}
        onSubmitPost={handleCreatePost}
        initialOpenImagePicker={openCreatePostWithImage}
      />
    </div>
  );
};
