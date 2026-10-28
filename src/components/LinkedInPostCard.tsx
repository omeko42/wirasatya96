'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FeedPost, PostComment, AuthUser, ReactionType } from '@/types';
import { getAvatarUrl, resolveAvatarUrl, formatHumanTimestamp } from '@/lib/avatarUtils';
import { processSecureImageUpload } from '@/lib/mediaSecurity';
import { MetaVerifiedBadge } from './MetaVerifiedBadge';
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  MoreHorizontal,
  Globe,
  Pin,
  Check,
  Copy,
  Bookmark,
  Smile,
  Image as ImageIcon,
  Edit3,
  Trash2,
  X,
  CornerDownRight,
  Flag,
  Hash,
} from 'lucide-react';
import { AnimatedDeleteButton } from './PremiumMicroInteractions';

interface LinkedInPostCardProps {
  post: FeedPost;
  currentUser: AuthUser;
  currentUserAvatar?: string;
  resolveAuthorAvatar?: (authorNrp?: string, authorName?: string, fallback?: string) => string;
  onLikeToggle: (postId: string, reaction?: ReactionType | null) => void;
  onRepost: (postId: string) => void;
  onAddComment: (
    postId: string,
    commentText: string,
    parentCommentId?: string,
    imageUrl?: string
  ) => void;
  onEditPost?: (
    postId: string,
    updates: {
      content?: string;
      imageUrl?: string | null;
      videoUrl?: string | null;
      category?: FeedPost['category'];
      pinned?: boolean;
      isPinned?: boolean;
    }
  ) => void;
  onDeletePost?: (postId: string) => void;
  onEditComment?: (
    postId: string,
    commentId: string,
    content: string,
    parentCommentId?: string
  ) => void;
  onDeleteComment?: (
    postId: string,
    commentId: string,
    parentCommentId?: string
  ) => void;
  onLikeComment?: (
    postId: string,
    commentId: string,
    parentCommentId?: string
  ) => void;
  onAuthorClick?: (authorNrp?: string) => void;
}

const REACTIONS: { key: ReactionType; emoji: string; label: string; color: string }[] = [
  { key: 'like', emoji: '👍', label: 'Suka', color: 'text-red-800' },
  { key: 'celebrate', emoji: '👏', label: 'Rayakan', color: 'text-emerald-600' },
  { key: 'support', emoji: '🤲', label: 'Dukung', color: 'text-purple-600' },
  { key: 'love', emoji: '❤️', label: 'Cinta', color: 'text-rose-600' },
  { key: 'insightful', emoji: '💡', label: 'Berwawasan', color: 'text-amber-500' },
  { key: 'funny', emoji: '😄', label: 'Lucu', color: 'text-cyan-600' },
];

const COMMENT_EMOJIS = ['👍', '❤️', '🔥', '👏', '🙏', '💪', '⭐', '🤝', '😄', '🇮🇩'];

const POST_CATEGORIES: { key: FeedPost['category']; label: string }[] = [
  { key: 'MOTIVASI', label: 'Motivasi' },
  { key: 'KENAIKAN_PANGKAT', label: 'Kenaikan Pangkat' },
  { key: 'BAKSOS', label: 'Baksos' },
];

const QUICK_HASHTAGS = ['#SelaluBahagia', '#WiraSatya96', '#Akpol96', '#PolriPresisi'];

export const LinkedInPostCard: React.FC<LinkedInPostCardProps> = ({
  post,
  currentUser,
  currentUserAvatar,
  resolveAuthorAvatar,
  onLikeToggle,
  onRepost,
  onAddComment,
  onEditPost,
  onDeletePost,
  onEditComment,
  onDeleteComment,
  onLikeComment,
  onAuthorClick,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentImage, setNewCommentImage] = useState<string>('');
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Edit / Delete Post state
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState(post.content || '');
  const [editPostCategory, setEditPostCategory] = useState<FeedPost['category']>(
    post.category || 'MOTIVASI'
  );
  const [editPostImage, setEditPostImage] = useState<string | null>(post.imageUrl || null);
  const [editPostVideo, setEditPostVideo] = useState<string | null>(post.videoUrl || null);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);

  // Close dropdown menu smoothly on outside click or Escape key
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
        setConfirmDeletePost(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMoreMenu(false);
        setConfirmDeletePost(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMoreMenu]);

  const myLiveAvatar = resolveAvatarUrl(currentUserAvatar, currentUser.fotoUrl);

  const getLiveAvatar = (nrp?: string, name?: string, fallback?: string): string => {
    if (resolveAuthorAvatar) {
      return resolveAuthorAvatar(nrp, name, fallback);
    }
    if (nrp && nrp === currentUser.nrp) {
      return resolveAvatarUrl(myLiveAvatar, fallback);
    }
    return getAvatarUrl(fallback);
  };

  const resolvedPostAuthorAvatar = getLiveAvatar(post.authorNrp, post.authorName, post.authorAvatar);
  const isPostPinned = Boolean(post.pinned || post.isPinned);

  // Comment Reply & Edit state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentParentId, setEditingCommentParentId] = useState<string | undefined>(undefined);
  const [editingCommentText, setEditingCommentText] = useState<string>('');

  // Floating Reaction Menu state
  const [showReactionsBar, setShowReactionsBar] = useState(false);

  const isAdmin =
    currentUser.role === 'SUPERADMIN' ||
    currentUser.nrp === '98010710' ||
    currentUser.role === 'SEKRETARIAT' ||
    currentUser.role === 'KETUA';
  const canManagePost = post.authorNrp === currentUser.nrp || isAdmin;

  // Derive current user's reaction accurately without double-counting
  const userReactionFromPost: ReactionType | null =
    post.reactionsByNrp?.[currentUser.nrp] ||
    (Array.isArray(post.likedBy)
      ? post.likedBy.includes(currentUser.nrp)
        ? post.userReaction || 'like'
        : null
      : post.isLiked
      ? post.userReaction || 'like'
      : null);

  const isRepostedByMe = Array.isArray(post.repostedBy)
    ? post.repostedBy.includes(currentUser.nrp)
    : Boolean(post.isReposted);

  const totalCommentsCount = (post.comments || []).reduce(
    (sum, c) => sum + 1 + (Array.isArray(c.replies) ? c.replies.length : 0),
    0
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleSelectReaction = (reactKey: ReactionType) => {
    if (userReactionFromPost === reactKey) {
      onLikeToggle(post.id, null);
    } else {
      onLikeToggle(post.id, reactKey);
      const match = REACTIONS.find((r) => r.key === reactKey);
      showToast(`Memberikan respon ${match?.emoji} ${match?.label}!`);
    }
    setShowReactionsBar(false);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setIsCopied(true);
      showToast('Tautan postingan berhasil disalin ke clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
      setShowMoreMenu(false);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    showToast(isBookmarked ? 'Postingan dihapus dari simpanan.' : 'Postingan berhasil disimpan!');
    setShowMoreMenu(false);
  };

  const handleRepostClick = () => {
    onRepost(post.id);
    showToast(isRepostedByMe ? 'Bagikan dibatalkan' : 'Postingan dibagikan ke linimasa!');
  };

  const handleStartEditPost = () => {
    setEditPostContent(post.content || '');
    setEditPostCategory(post.category || 'MOTIVASI');
    setEditPostImage(post.imageUrl || null);
    setEditPostVideo(post.videoUrl || null);
    setIsEditingPost(true);
    setShowMoreMenu(false);
    setConfirmDeletePost(false);
  };

  const handleEditPostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const processed = await processSecureImageUpload(file, {
        preset: 'POST',
        actorNrp: currentUser.nrp,
        ownerNrp: currentUser.nrp,
      });
      setEditPostImage(processed.dataUrl);
    } catch {
      showToast('Gagal mengompresi gambar');
    }
  };

  const handleSaveEditPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPostContent.trim() && !editPostImage && !editPostVideo) return;
    if (onEditPost) {
      onEditPost(post.id, {
        content: editPostContent.trim(),
        category: editPostCategory,
        imageUrl: editPostImage,
        videoUrl: editPostVideo,
      });
    }
    setIsEditingPost(false);
    showToast('Postingan berhasil diperbarui!');
  };

  const handleTogglePinPost = () => {
    if (!onEditPost) return;
    const nextPinned = !isPostPinned;
    onEditPost(post.id, { pinned: nextPinned, isPinned: nextPinned });
    setShowMoreMenu(false);
    showToast(nextPinned ? 'Postingan disematkan di teratas!' : 'Sematan postingan dilepas.');
  };

  const handleConfirmDeletePost = () => {
    if (onDeletePost) {
      onDeletePost(post.id);
    }
    setConfirmDeletePost(false);
    setShowMoreMenu(false);
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const processed = await processSecureImageUpload(file, {
        preset: 'POST',
        actorNrp: currentUser.nrp,
        ownerNrp: currentUser.nrp,
      });
      setNewCommentImage(processed.dataUrl);
    } catch {
      showToast('Gagal mengompresi lampiran');
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() && !newCommentImage) return;
    onAddComment(post.id, newCommentText.trim(), undefined, newCommentImage || undefined);
    setNewCommentText('');
    setNewCommentImage('');
    setShowCommentEmoji(false);
    showToast('Komentar ditambahkan');
  };

  const handleReplySubmit = (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onAddComment(post.id, replyText.trim(), parentCommentId);
    setReplyText('');
    setReplyingToId(null);
    setReplyingToName('');
    showToast('Balasan komentar dikirim');
  };

  const handleSaveEditComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommentId || !editingCommentText.trim()) return;
    if (onEditComment) {
      onEditComment(post.id, editingCommentId, editingCommentText.trim(), editingCommentParentId);
    }
    setEditingCommentId(null);
    setEditingCommentParentId(undefined);
    setEditingCommentText('');
    showToast('Komentar diperbarui');
  };

  // Render text with clickable hashtags
  const renderFormattedContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('#')) {
        return (
          <span
            key={idx}
            className="text-red-900 font-bold hover:underline cursor-pointer"
            onClick={() => showToast(`Filter topik: ${part}`)}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const activeReactionObj = REACTIONS.find((r) => r.key === userReactionFromPost);

  const renderCommentItem = (comm: PostComment, parentId?: string) => {
    const canEditComm = comm.authorNrp === currentUser.nrp || isAdmin;
    const canDeleteComm =
      comm.authorNrp === currentUser.nrp || post.authorNrp === currentUser.nrp || isAdmin;
    const isCommLiked = Array.isArray(comm.likedBy) && comm.likedBy.includes(currentUser.nrp);
    const commLikes = comm.likesCount || (Array.isArray(comm.likedBy) ? comm.likedBy.length : 0);
    const isEditingThis = editingCommentId === comm.id;

    return (
      <div key={comm.id} className="space-y-2">
        <div className="flex items-start gap-2.5 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getLiveAvatar(comm.authorNrp, comm.authorName, comm.authorAvatar)}
            alt={comm.authorName}
            onClick={() => onAuthorClick && onAuthorClick(comm.authorNrp)}
            className="w-7 h-7 rounded-full object-cover border border-slate-200 mt-0.5 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-red-800 bg-white"
          />
          <div className="flex-1 min-w-0">
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    onClick={() => onAuthorClick && onAuthorClick(comm.authorNrp)}
                    className="font-bold text-slate-900 hover:text-red-800 cursor-pointer text-[11px] truncate"
                  >
                    {comm.authorName}
                  </span>
                  {comm.authorNrp && <MetaVerifiedBadge nrp={comm.authorNrp} size="xs" />}
                  {comm.authorPangkat && (
                    <span className="text-[9px] text-slate-500 font-semibold hidden sm:inline">
                      &bull; {comm.authorPangkat}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  {formatHumanTimestamp(comm.createdAt)}
                  {comm.isEdited ? ' (diedit)' : ''}
                </span>
              </div>

              {isEditingThis ? (
                <form onSubmit={handleSaveEditComment} className="mt-2 space-y-2">
                  <input name="ws96_linkedinpostcard_editingCommentText_1" aria-label="editingCommentText"
                    type="text"
                    value={editingCommentText}
                    onChange={(e) => setEditingCommentText(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-red-800/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800/30"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(null);
                        setEditingCommentParentId(undefined);
                        setEditingCommentText('');
                      }}
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-800 text-white hover:bg-red-900"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {comm.content && (
                    <p className="text-[11px] text-slate-700 mt-1 leading-relaxed break-words">
                      {comm.content}
                    </p>
                  )}
                  {comm.imageUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-48 max-w-xs bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={comm.imageUrl}
                        alt="Lampiran Komentar"
                        className="w-full h-full object-cover max-h-48"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Comment Action Bar: Suka, Balas, Edit, Hapus */}
            <div className="mt-1 pl-2 flex items-center gap-3 text-[10px] font-semibold text-slate-500 flex-wrap">
              <button
                type="button"
                onClick={() => onLikeComment && onLikeComment(post.id, comm.id, parentId)}
                className={`hover:text-red-800 transition-colors flex items-center gap-1 cursor-pointer ${
                  isCommLiked ? 'text-red-800 font-extrabold' : ''
                }`}
              >
                <span>👍 {isCommLiked ? 'Disukai' : 'Suka'}</span>
                {commLikes > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-50 text-red-800 border border-red-200 text-[9px] font-extrabold">
                    {commLikes}
                  </span>
                )}
              </button>

              <span>&bull;</span>

              <button
                type="button"
                onClick={() => {
                  const targetParentId = parentId || comm.id;
                  if (replyingToId === targetParentId && replyingToName === comm.authorName) {
                    setReplyingToId(null);
                    setReplyingToName('');
                  } else {
                    setReplyingToId(targetParentId);
                    setReplyingToName(comm.authorName);
                    setReplyText(`@${comm.authorName.split(',')[0]} `);
                  }
                }}
                className="hover:text-red-800 transition-colors cursor-pointer"
              >
                Balas
              </button>

              {canEditComm && !isEditingThis && (
                <>
                  <span>&bull;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(comm.id);
                      setEditingCommentParentId(parentId);
                      setEditingCommentText(comm.content);
                    }}
                    className="hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                </>
              )}

              {canDeleteComm && (
                <>
                  <span>&bull;</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteComment) {
                        onDeleteComment(post.id, comm.id, parentId);
                        showToast('Komentar dihapus');
                      }
                    }}
                    className="hover:text-red-600 text-red-600/80 transition-colors cursor-pointer"
                  >
                    Hapus
                  </button>
                </>
              )}
            </div>

            {/* Nested Replies */}
            {!parentId && Array.isArray(comm.replies) && comm.replies.length > 0 && (
              <div className="mt-2 pl-3 sm:pl-5 border-l-2 border-slate-200 space-y-2">
                {comm.replies.map((rep) => renderCommentItem(rep, comm.id))}
              </div>
            )}

            {/* Inline Reply Input */}
            {!parentId && replyingToId === comm.id && (
              <form
                onSubmit={(e) => handleReplySubmit(e, comm.id)}
                className="mt-2 pl-3 sm:pl-5 flex items-center gap-2"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input name="ws96_linkedinpostcard_replyText_2"
                  type="text"
                  placeholder={`Balas ${replyingToName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-800/30 focus:border-red-800"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-red-800 text-white hover:bg-red-900 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Kirim
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(null);
                    setReplyingToName('');
                    setReplyText('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                  title="Batal balas"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-red-900/30 relative">
      {/* Toast popup */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5 animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner (Pinned / Activity Header) */}
      {isPostPinned && (
        <div className="px-4 py-1.5 text-[11px] font-bold text-red-900 flex items-center justify-between border-b border-red-100 bg-gradient-to-r from-red-50/90 via-amber-50/60 to-white">
          <div className="flex items-center gap-1.5">
            <Pin className="w-3 h-3 text-red-800 fill-red-800" />
            <span>Postingan Disematkan</span>
          </div>
          {isAdmin && onEditPost && (
            <button
              type="button"
              onClick={handleTogglePinPost}
              className="text-[10px] font-bold text-slate-500 hover:text-red-800 transition-colors cursor-pointer"
            >
              Lepas
            </button>
          )}
        </div>
      )}

      {/* Post Header: Author info */}
      <div className="p-4 pb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            onClick={() => onAuthorClick && onAuthorClick(post.authorNrp)}
            className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-red-800 transition-all bg-white shadow-2xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedPostAuthorAvatar}
              alt={post.authorName}
              className="w-full h-full object-cover bg-white"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                onClick={() => onAuthorClick && onAuthorClick(post.authorNrp)}
                className="text-xs sm:text-sm font-bold text-slate-900 hover:text-red-800 cursor-pointer hover:underline truncate"
              >
                {post.authorName}
              </h4>
              <MetaVerifiedBadge nrp={post.authorNrp} size="sm" />
              {post.badgeLabel && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  {post.badgeLabel}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
              {post.authorJabatan}
            </p>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 flex-wrap">
              <span>
                {formatHumanTimestamp(post.createdAt)}
                {post.isEdited ? ' (diedit)' : ''}
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium">
                <Globe className="w-2.5 h-2.5 text-red-800" />
                #SelaluBahagia
              </span>
            </div>
          </div>
        </div>

        {/* Modern Fluid Action Menu (...) */}
        <div className="relative flex-shrink-0" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu((prev) => !prev);
              setConfirmDeletePost(false);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showMoreMenu
                ? 'bg-red-50 text-red-900 ring-2 ring-red-800/20'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Opsi Postingan"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div
              style={{ backgroundColor: '#ffffff' }}
              className="absolute right-0 top-9 z-40 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 ring-1 ring-slate-900/5 p-2 text-xs text-slate-800 animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick-Action Pill Row (3 Tombol Cepat) */}
              <div className="grid grid-cols-3 gap-1.5 pb-2 mb-1.5 border-b border-slate-100">
                {canManagePost ? (
                  <button
                    type="button"
                    onClick={handleStartEditPost}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/70 transition-all cursor-pointer group"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold">Edit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBookmark}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-700 border border-slate-200/70 transition-all cursor-pointer group"
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                        isBookmarked ? 'text-amber-500 fill-amber-500' : 'text-amber-600'
                      }`}
                    />
                    <span className="text-[10px] font-bold">
                      {isBookmarked ? 'Tersimpan' : 'Simpan'}
                    </span>
                  </button>
                )}

                {isAdmin && onEditPost ? (
                  <button
                    type="button"
                    onClick={handleTogglePinPost}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border transition-all cursor-pointer group ${
                      isPostPinned
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-700 border-slate-200/70'
                    }`}
                  >
                    <Pin
                      className={`w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform ${
                        isPostPinned ? 'fill-amber-600' : ''
                      }`}
                    />
                    <span className="text-[10px] font-bold">
                      {isPostPinned ? 'Lepas Pin' : 'Sematkan'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBookmark}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-slate-700 border border-slate-200/70 transition-all cursor-pointer group"
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                        isBookmarked ? 'text-amber-500 fill-amber-500' : 'text-amber-600'
                      }`}
                    />
                    <span className="text-[10px] font-bold">
                      {isBookmarked ? 'Tersimpan' : 'Simpan'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200/70 transition-all cursor-pointer group"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="text-[10px] font-bold">
                    {isCopied ? 'Tersalin' : 'Salin Link'}
                  </span>
                </button>
              </div>

              {/* Action Items List */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={handleBookmark}
                  className="w-full px-2.5 py-2 rounded-xl text-left bg-white hover:bg-slate-50 flex items-center gap-2.5 transition-all cursor-pointer group"
                >
                  <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                    <Bookmark
                      className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-purple-600' : ''}`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-xs leading-tight">
                      {isBookmarked ? 'Hapus dari Simpanan' : 'Simpan Postingan'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Simpan ke daftar markah pribadi
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    showToast('Laporan konten diterima oleh Pengurus.');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-left bg-white hover:bg-slate-50 flex items-center gap-2.5 transition-all cursor-pointer group"
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                    <Flag className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-xs leading-tight">
                      Laporkan Konten
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Teruskan atensi ke Sekretariat
                    </div>
                  </div>
                </button>

                {canManagePost && (
                  <div className="pt-1 mt-1 border-t border-slate-100">
                    {!confirmDeletePost ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePost(true)}
                        className="w-full px-2.5 py-2 rounded-xl text-left bg-white hover:bg-red-50 flex items-center gap-2.5 transition-all cursor-pointer group"
                      >
                        <span className="w-7 h-7 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-red-700 text-xs leading-tight">
                            Hapus Postingan
                          </div>
                          <div className="text-[10px] text-red-500 truncate">
                            Hapus permanen dari linimasa
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 space-y-2 animate-fadeIn">
                        <div className="text-[11px] font-extrabold text-red-900 flex items-center justify-between">
                          <span>Hapus postingan ini?</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <AnimatedDeleteButton
                            label="Ya, Hapus"
                            confirmLabel="Konfirmasi!"
                            size="sm"
                            onDelete={handleConfirmDeletePost}
                            className="w-full py-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePost(false)}
                            className="py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Edit Post Mode */}
      {isEditingPost ? (
        <form
          onSubmit={handleSaveEditPost}
          className="mx-3.5 my-2 p-3.5 rounded-2xl bg-slate-50/90 border border-red-900/20 shadow-inner space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-red-800" />
              <span>Edit Postingan</span>
            </span>
            <div className="flex items-center gap-1">
              {POST_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setEditPostCategory(cat.key)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    editPostCategory === cat.key
                      ? 'bg-red-800 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <textarea name="ws96_linkedinpostcard_editPostContent_3"
            value={editPostContent}
            onChange={(e) => setEditPostContent(e.target.value)}
            rows={3}
            placeholder="Tulis pembaruan isi postingan..."
            className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-800/30 focus:border-red-800"
            autoFocus
          />

          {/* Quick Hashtag Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
              <Hash className="w-3 h-3" /> Tag:
            </span>
            {QUICK_HASHTAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (!editPostContent.includes(tag)) {
                    setEditPostContent((prev) => `${prev.trim()} ${tag}`.trim());
                  }
                }}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-red-50 text-red-900 border border-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
              >
                +{tag}
              </button>
            ))}
          </div>

          {editPostImage && (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editPostImage}
                alt="Preview Edit"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={() => setEditPostImage(null)}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hapus Foto</span>
              </button>
            </div>
          )}

          {editPostVideo && (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-60 bg-slate-950">
              <video
                src={editPostVideo}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-52 object-contain bg-black"
              />
              <button
                type="button"
                onClick={() => setEditPostVideo(null)}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hapus Video</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-200/80">
            <label className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
              <ImageIcon className="w-3.5 h-3.5 text-red-800" />
              <span>{editPostImage ? 'Ganti Foto' : 'Tambah Foto'}</span>
              <input name="ws96_linkedinpostcard_input_2" aria-label="input linkedinpostcard 2"
                type="file"
                accept="image/*"
                onChange={handleEditPostImageUpload}
                className="hidden"
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingPost(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!editPostContent.trim() && !editPostImage && !editPostVideo}
                className="px-4 py-1.5 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          {/* Post Text / Caption */}
          {post.content && (
            <div className="px-4 py-2 text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-normal">
              {renderFormattedContent(post.content)}
            </div>
          )}

          {/* Post Attached Video (Playable HTML5 Video or Embedded YouTube) */}
          {post.videoUrl && (
            <div className="mt-2 bg-slate-950 border-y border-slate-800 overflow-hidden max-h-[460px] flex items-center justify-center">
              {/youtube\.com|youtu\.be/i.test(post.videoUrl) ? (
                <iframe
                  src={post.videoUrl
                    .replace('watch?v=', 'embed/')
                    .replace('youtu.be/', 'www.youtube.com/embed/')}
                  title="Video Postingan Wira Satya 96"
                  className="w-full aspect-video max-h-[460px]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={post.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[460px] object-contain bg-black"
                />
              )}
            </div>
          )}

          {/* Post Attached Image */}
          {post.imageUrl && (
            <div className="mt-2 bg-slate-900 border-y border-slate-100 overflow-hidden max-h-[460px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt="Dokumentasi"
                className="w-full h-full object-cover max-h-[460px] hover:opacity-95 transition-opacity"
              />
            </div>
          )}
        </>
      )}

      {/* Engagement Counters (Likes, Comments, Reposts — exact +1/-1, no double-count!) */}
      <div className="px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1 items-center">
            <span className="w-4 h-4 rounded-full bg-red-800 text-white flex items-center justify-center text-[9px] shadow-xs">
              👍
            </span>
            <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] shadow-xs">
              ❤️
            </span>
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] shadow-xs">
              👏
            </span>
          </div>
          <span className="font-semibold text-slate-700">
            {Math.max(0, post.likesCount || 0)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="hover:underline hover:text-red-800 cursor-pointer"
          >
            {totalCommentsCount} komentar
          </button>
          <span>&bull;</span>
          <span>{Math.max(0, post.repostsCount || 0)} dibagikan</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ACTION BUTTONS & MULTI-REACTIONS POPUP                         */}
      {/* ============================================================== */}
      <div className="px-1.5 sm:px-2 py-1 flex items-center justify-around text-[11px] sm:text-xs font-semibold text-slate-600 relative">
        {/* Floating Reactions Bar on Hover / Interaction */}
        {showReactionsBar && (
          <div
            onMouseEnter={() => setShowReactionsBar(true)}
            onMouseLeave={() => setShowReactionsBar(false)}
            className="absolute left-1.5 sm:left-2 -top-12 z-30 bg-white rounded-full shadow-2xl border border-slate-200 px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5 sm:gap-2 max-w-[calc(100vw-2rem)] animate-fadeIn"
          >
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => handleSelectReaction(r.key)}
                className="text-lg sm:text-2xl hover:scale-130 transition-transform active:scale-95 duration-150 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* 1. Like / Reaction Button */}
        <div
          className="flex-1 relative min-w-0"
          onMouseEnter={() => setShowReactionsBar(true)}
          onMouseLeave={() => setShowReactionsBar(false)}
        >
          <button
            type="button"
            onClick={() => handleSelectReaction(userReactionFromPost || 'like')}
            className={`w-full py-2 px-1 sm:px-2 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeReactionObj
                ? `${activeReactionObj.color} font-bold bg-red-50/60`
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            {activeReactionObj ? (
              <span className="text-sm sm:text-base shrink-0">{activeReactionObj.emoji}</span>
            ) : (
              <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            )}
            <span className="truncate">{activeReactionObj ? activeReactionObj.label : 'Suka'}</span>
          </button>
        </div>

        {/* 2. Comment Button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`flex-1 py-2 px-1 sm:px-2 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            showComments ? 'text-red-800 bg-red-50/50 font-bold' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Komentar</span>
        </button>

        {/* 3. Repost Button */}
        <button
          type="button"
          onClick={handleRepostClick}
          className={`flex-1 py-2 px-1 sm:px-2 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            isRepostedByMe
              ? 'text-emerald-700 font-bold bg-emerald-50'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Repeat2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">{isRepostedByMe ? 'Dibagikan' : 'Bagikan'}</span>
        </button>

        {/* 4. Share / Kirim Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex-1 py-2 px-1 sm:px-2 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer whitespace-nowrap min-w-0"
        >
          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Kirim</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <div className="p-4 pt-3 bg-slate-50/70 border-t border-slate-100 space-y-3.5 animate-fadeIn">
          {/* New Comment Input */}
          <form onSubmit={handleCommentSubmit} className="flex items-start gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={myLiveAvatar}
              alt={currentUser.nama}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 mt-0.5 flex-shrink-0 bg-white"
            />
            <div className="flex-1 space-y-2">
              <div className="relative">
                <input name="ws96_linkedinpostcard_newCommentText_5"
                  type="text"
                  placeholder="Tulis komentar..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full pl-3.5 pr-20 py-2 bg-white border border-slate-300 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-800/40 focus:border-red-800"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowCommentEmoji((prev) => !prev)}
                    className={`p-1 rounded-full hover:text-amber-600 transition-colors cursor-pointer ${
                      showCommentEmoji ? 'text-amber-600 bg-amber-50' : ''
                    }`}
                    title="Tambah Emoji"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  <label
                    className="p-1 rounded-full hover:text-red-800 transition-colors cursor-pointer"
                    title="Lampirkan Foto pada Komentar"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <input name="ws96_linkedinpostcard_input_3" aria-label="input linkedinpostcard 3"
                      type="file"
                      accept="image/*"
                      onChange={handleCommentImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {showCommentEmoji && (
                <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200 shadow-xs flex-wrap">
                  {COMMENT_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewCommentText((prev) => `${prev}${em}`)}
                      className="text-base hover:scale-125 transition-transform p-0.5 cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {newCommentImage && (
                <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={newCommentImage}
                    alt="Lampiran Komentar"
                    className="h-32 w-auto object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setNewCommentImage('')}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 hover:bg-red-600 text-white"
                    title="Hapus foto komentar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {(newCommentText.trim() || newCommentImage) && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3.5 py-1 rounded-full text-xs font-bold bg-red-800 text-white hover:bg-red-900 transition-colors shadow-xs cursor-pointer"
                  >
                    Kirim Komentar
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Comments List */}
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-3 pt-1">
              {post.comments.map((comm) => renderCommentItem(comm))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 text-center py-2">
              Belum ada komentar. Jadilah yang pertama berkomentar!
            </p>
          )}
        </div>
      )}
    </div>
  );
};
