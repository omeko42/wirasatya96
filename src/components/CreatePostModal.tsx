'use client';

import React, { useState } from 'react';
import { AuthUser, FeedPost } from '@/types';
import { PRESET_POST_IMAGES } from '@/data/mockPosts';
import { getAvatarUrl } from '@/lib/avatarUtils';
import { processSecureImageUpload } from '@/lib/mediaSecurity';
import { 
  X, 
  Image as ImageIcon, 
  Smile, 
  Globe, 
  MessageSquare, 
  Sparkles,
  Check,
  Tag
} from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  initialOpenImagePicker?: boolean;
  onSubmitPost: (post: Omit<FeedPost, 'id' | 'createdAt' | 'likesCount' | 'repostsCount' | 'comments'>) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialOpenImagePicker = false,
  onSubmitPost,
}) => {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(initialOpenImagePicker);
  const [selectedCategory, setSelectedCategory] = useState<FeedPost['category']>('MOTIVASI');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setShowImagePicker(initialOpenImagePicker);
    }
  }, [isOpen, initialOpenImagePicker]);

  if (!isOpen) return null;

  const quickEmojis = ['🇮🇩', '⭐', '🤝', '👮', '🙏', '💪', '🔥', '👏', '❤️'];

  const quickTags = [
    '#WiraSatya96',
    '#SelaluBahagia',
    '#SolidaritasLeting',
    '#PengabdianPolri',
    '#KenaikanPangkat',
    '#Baksos96',
  ];

  const handleAddTag = (tag: string) => {
    if (!content.includes(tag)) {
      setContent((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => `${prev} ${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploadingImage(true);
    try {
      const processed = await processSecureImageUpload(file, {
        preset: 'POST',
        actorNrp: currentUser.nrp,
        ownerNrp: currentUser.nrp,
      });
      setSelectedImage(processed.dataUrl);
      setCustomImageUrl('');
    } catch {
      // Never fallback to raw uncompressed FileReader to prevent multi-MB base64 DB bloat
    } finally {
      setIsUploadingImage(false);
    }
  };

  const imageToUse = customImageUrl.trim() || selectedImage;
  const canSubmit = Boolean(content.trim() || imageToUse);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Extract hashtags from content
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const extractedTags = content.match(hashtagRegex) || ['#WiraSatya96', '#SelaluBahagia'];

    onSubmitPost({
      authorName: currentUser.nama.replace(/\(.*?\)/g, '').trim(),
      authorPangkat: currentUser.pangkat,
      authorJabatan: currentUser.satker || 'Mabes Polri',
      authorAvatar: getAvatarUrl(currentUser.fotoUrl),
      authorNrp: currentUser.nrp,
      badgeLabel:
        currentUser.role === 'SUPERADMIN'
          ? 'Admin'
          : currentUser.role === 'KETUA'
          ? 'Ketua'
          : currentUser.role === 'BENDAHARA'
          ? 'Bendahara'
          : currentUser.role === 'SEKRETARIAT'
          ? 'Sekretaris'
          : 'Anggota',
      content: content.trim(),
      imageUrl: imageToUse || undefined,
      tags: Array.from(new Set(extractedTags)),
      category: selectedCategory,
    });

    // Reset and close
    setContent('');
    setSelectedImage('');
    setCustomImageUrl('');
    setShowImagePicker(false);
    onClose();
  };

  const cleanUserName = currentUser.nama.split('(')[0].trim();

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto flex items-start sm:items-center justify-center p-2.5 pt-16 pb-20 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100dvh-5.5rem)] sm:max-h-[90vh] my-auto animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarUrl(currentUser.fotoUrl)}
              alt={cleanUserName}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-slate-200 shadow-sm bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{cleanUserName}</span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-normal">({currentUser.pangkat})</span>
              </div>

              {/* LinkedIn Audience Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-300 text-slate-700 bg-slate-50">
                  <Globe className="w-3 h-3 text-red-800" />
                  <span>Semua Anggota</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-300 text-slate-700 bg-slate-50">
                  <MessageSquare className="w-3 h-3 text-slate-500" />
                  <span>Komentar: Terbuka</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
          {/* Rich Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis informasi, kegiatan, atau keterangan foto..."
            className="w-full h-24 sm:h-28 resize-none text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-0 leading-relaxed font-normal shrink-0"
          />

          {/* Active Image Preview (ALWAYS visible whenever an image is selected/uploaded) */}
          {imageToUse && (
            <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/80 bg-slate-900 max-h-56 group shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageToUse}
                alt="Lampiran Foto"
                className="w-full h-52 object-cover"
              />
              <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                <Check className="w-3 h-3" />
                <span>Foto Siap Diposting</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage('');
                  setCustomImageUrl('');
                }}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 transition-colors shadow-md"
                title="Hapus foto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hapus Foto</span>
              </button>
            </div>
          )}

          {/* Category Selector */}
          <div className="flex items-center gap-1.5 pt-1 text-xs flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Kategori:</span>
            {[
              { key: 'MOTIVASI', label: '⭐ Motivasi' },
              { key: 'KENAIKAN_PANGKAT', label: '🎖️ Kenaikan Pangkat' },
              { key: 'BAKSOS', label: '🤝 Baksos & Peduli' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key as FeedPost['category'])}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Hashtag Chips */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Tag className="w-3 h-3 text-red-800" />
              <span>Tag Cepat:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                    content.includes(tag)
                      ? 'bg-red-50 text-red-900 border-red-300 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload & Picker */}
          {showImagePicker && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-red-800" />
                  Unggah Foto atau Pilih Dokumentasi:
                </span>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(false)}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold"
                >
                  Sembunyikan
                </button>
              </div>

              {/* Upload File From Device */}
              <div>
                <label className="w-full py-2.5 px-3 rounded-lg border-2 border-dashed border-red-800 bg-white hover:bg-red-50 text-red-900 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    {isUploadingImage
                      ? 'Memproses foto...'
                      : selectedImage
                      ? 'Ganti File Foto dari Perangkat...'
                      : 'Pilih File Foto dari Perangkat...'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_POST_IMAGES.map((preset) => (
                  <div
                    key={preset.label}
                    onClick={() => {
                      setSelectedImage(preset.url);
                      setCustomImageUrl('');
                    }}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedImage === preset.url
                        ? 'border-red-800 ring-2 ring-red-200 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full h-20 object-cover"
                    />
                    <div className="p-1.5 bg-white text-[10px] font-bold text-slate-800 truncate">
                      {preset.label}
                    </div>
                    {selectedImage === preset.url && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-red-800 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Custom Image URL Option */}
              <div className="pt-1">
                <input
                  type="url"
                  placeholder="Atau tempel URL gambar eksternal (https://...)"
                  value={customImageUrl}
                  onChange={(e) => {
                    setCustomImageUrl(e.target.value);
                    if (e.target.value) setSelectedImage('');
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-red-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Emoji Popover */}
          {showEmojiPicker && (
            <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg border border-slate-200 animate-fadeIn">
              {quickEmojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => handleAddEmoji(e)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Bottom Bar: Quick Icons & Post Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
            {/* Quick Media Icons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowImagePicker(!showImagePicker)}
                className={`p-2 rounded-full transition-colors ${
                  showImagePicker || selectedImage || customImageUrl
                    ? 'bg-red-100 text-red-900'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
                title="Tambahkan foto"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 rounded-full transition-colors ${
                  showEmojiPicker
                    ? 'bg-amber-100 text-amber-600'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
                title="Tambahkan emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAddTag('#SelaluBahagia');
                  handleAddTag('#WiraSatya96');
                }}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-amber-600 transition-colors"
                title="Slogan #SelaluBahagia"
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
              </button>
            </div>

            {/* Right: Character count & Post Button */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 font-mono">
                {content.length}/1000
              </span>

              <button
                type="submit"
                disabled={!canSubmit || isUploadingImage}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                  canSubmit && !isUploadingImage
                    ? 'bg-red-800 hover:bg-red-900 text-white cursor-pointer hover:shadow'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Postingan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
