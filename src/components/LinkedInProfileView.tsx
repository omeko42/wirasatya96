'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AnggotaWiraSatya,
  AuthUser,
  FeedPost,
  UserRole,
} from '@/types';
import {
  getAvatarUrl,
  resolveAvatarUrl,
  formatMemberDisplayName,
  cleanJabatanOnly,
  formatJabatanWithSatker,
  calculateRetirement58,
  RETIREMENT_AGE_POLRI,
  DEFAULT_AVATAR_URL,
  DEFAULT_COVER_URL,
  detectStatusKedinasan,
  getActiveAdcSessionFromStorage,
  recordAdcActivityToAuditLog,
  isSuperadminAccount,
} from '@/lib/avatarUtils';
import { MetaVerifiedBadge, resolveRoleForBadge } from '@/components/MetaVerifiedBadge';
import { SecuritySettingsPanel } from '@/components/SecuritySettingsModal';
import {
  Shield,
  MapPin,
  Building2,
  Phone,
  Edit3,
  Heart,
  Users,
  Briefcase,
  GraduationCap,
  Share2,
  Clock,
  Home,
  Award,
  Plus,
  MessageSquare,
  Camera,
  Image as ImageIcon,
  Trash2,
  X,
  Mail,
  Copy,
  Check,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  processSecureImageUpload,
  triggerTrackedDownload,
} from '@/lib/mediaSecurity';

export interface LinkedInProfileViewProps {
  member: AnggotaWiraSatya;
  currentUser: AuthUser;
  memberRole?: UserRole;
  onEditProfile?: (member: AnggotaWiraSatya, initialTab?: 1 | 2 | 3 | 4) => void;
  onUpdateMemberDirect?: (updated: AnggotaWiraSatya) => Promise<void> | void;
  onOpenChat?: (member: AnggotaWiraSatya) => void;
  onClose?: () => void;
  allMembers?: AnggotaWiraSatya[];
  onSelectMember?: (member: AnggotaWiraSatya) => void;
}

const COVER_PRESETS = [
  {
    id: 'preset:bareskrim-dark',
    label: 'Tactical Bareskrim Dark',
    subtitle: 'Hitam Taktis & Aksen Emas Komando',
    previewClass: 'bg-gradient-to-r from-slate-950 via-red-950 to-slate-900',
  },
  {
    id: 'preset:mabes-gold',
    label: 'Presisi Gold Mabes',
    subtitle: 'Marun Presisi & Emas Kehormatan Polri',
    previewClass: 'bg-gradient-to-r from-amber-900 via-red-900 to-slate-950',
  },
  {
    id: 'preset:tactical-navy',
    label: 'Cyber Command Blue',
    subtitle: 'Biru Navy Siber & Infrastruktur Digital',
    previewClass: 'bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950',
  },
  {
    id: DEFAULT_COVER_URL,
    label: 'Klasik Wira Satya',
    subtitle: 'Sampul Resmi Standar Portal',
    previewClass: 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900',
  },
];

export const LinkedInProfileView: React.FC<LinkedInProfileViewProps> = ({
  member,
  currentUser,
  memberRole,
  onEditProfile,
  onUpdateMemberDirect,
  onOpenChat,
  onClose,
  allMembers = [],
  onSelectMember,
}) => {
  const [localMember, setLocalMember] = useState<AnggotaWiraSatya>(() => ({
    ...member,
    fotoUrl:
      member.nrp === currentUser.nrp
        ? resolveAvatarUrl(member.fotoUrl, currentUser.fotoUrl)
        : getAvatarUrl(member.fotoUrl),
    coverUrl:
      member.nrp === currentUser.nrp
        ? member.coverUrl && member.coverUrl !== DEFAULT_COVER_URL
          ? member.coverUrl
          : currentUser.coverUrl || member.coverUrl
        : member.coverUrl,
  }));
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);

  // Interactive UI states
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState(member.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const peersSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let fallbackCoverUrl: string | undefined;
    let fallbackBio: string | undefined;
    let fallbackSecondaryEmail: string | undefined;

    if (typeof window !== 'undefined') {
      try {
        const rawMemberOverrides = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMemberOverrides) {
          const parsedMemberOverrides = JSON.parse(rawMemberOverrides);
          const mOv = parsedMemberOverrides?.[member.nrp] || parsedMemberOverrides?.[member.id];
          if (mOv) {
            fallbackCoverUrl = mOv.coverUrl || fallbackCoverUrl;
            fallbackBio = mOv.bio || fallbackBio;
            fallbackSecondaryEmail = mOv.secondaryEmail || fallbackSecondaryEmail;
          }
        }
        const rawUserOverrides = localStorage.getItem('ws96_user_overrides_v1');
        if (rawUserOverrides) {
          const parsedUserOverrides = JSON.parse(rawUserOverrides);
          const uOv = parsedUserOverrides?.[member.nrp];
          if (uOv) {
            fallbackCoverUrl = fallbackCoverUrl || uOv.coverUrl;
            fallbackBio = fallbackBio || uOv.bio;
            fallbackSecondaryEmail = fallbackSecondaryEmail || uOv.secondaryEmail;
          }
        }
      } catch {
        // ignore
      }
    }

    const resolvedSatker =
      member.satuanKerja ||
      member.satker ||
      (member.nrp === currentUser.nrp && currentUser.satker ? currentUser.satker : '');
    const resolvedPangkat =
      member.pangkat ||
      (member.nrp === currentUser.nrp && currentUser.pangkat ? currentUser.pangkat : '');
    const resolvedJabatan =
      member.jabatanTerakhir === 'Lead Developer'
        ? 'Staf'
        : member.jabatanTerakhir || member.jabatan || '';
    const resolvedCover =
      member.coverUrl && member.coverUrl !== DEFAULT_COVER_URL
        ? member.coverUrl
        : fallbackCoverUrl && fallbackCoverUrl !== DEFAULT_COVER_URL
        ? fallbackCoverUrl
        : member.nrp === currentUser.nrp
        ? currentUser.coverUrl || member.coverUrl
        : member.coverUrl;
    const resolvedBio =
      member.bio !== undefined && member.bio !== ''
        ? member.bio
        : fallbackBio || (member.nrp === currentUser.nrp ? currentUser.bio : '');
    const resolvedSecondaryEmail =
      member.secondaryEmail !== undefined && member.secondaryEmail !== ''
        ? member.secondaryEmail
        : fallbackSecondaryEmail || (member.nrp === currentUser.nrp ? currentUser.secondaryEmail : undefined);

    setLocalMember({
      ...member,
      pangkat: resolvedPangkat,
      satuanKerja: resolvedSatker,
      satker: resolvedSatker,
      jabatanTerakhir: resolvedJabatan,
      fotoUrl:
        member.nrp === currentUser.nrp
          ? resolveAvatarUrl(member.fotoUrl, currentUser.fotoUrl)
          : getAvatarUrl(member.fotoUrl),
      coverUrl: resolvedCover,
      bio: resolvedBio,
      secondaryEmail: resolvedSecondaryEmail,
    });
    setDraftBio(resolvedBio || '');
  }, [member, currentUser.nrp, currentUser.pangkat, currentUser.satker, currentUser.fotoUrl, currentUser.coverUrl, currentUser.bio, currentUser.secondaryEmail]);

  const isLeadership = ['SUPERADMIN', 'SEKRETARIAT'].includes(currentUser.role);
  const isOwnProfile = currentUser.nrp === localMember.nrp;
  const isSelf = isOwnProfile;
  const isOwner = isOwnProfile;
  const canEdit = isLeadership || isOwnProfile;
  const canEditProfile = canEdit;
  const canManageProfile = isOwnProfile || canEdit;

  // Accurate Role & Personnel Classification (No dummy Akpol 1996 labels on non-Akpol96 users)
  const effectiveRole = resolveRoleForBadge(localMember.nrp, memberRole);
  const isSuperadminDev =
    localMember.nrp === '98010710' || effectiveRole === 'SUPERADMIN';
  const isNonAkpolRank =
    [
      'Briptu',
      'Brigpol',
      'Bripka',
      'Aipda',
      'Aiptu',
      'Bripda',
      'Bharada',
      'Bharatu',
      'Bharaka',
      'Abripda',
      'Abriptu',
      'Abrip',
      'Ipda',
      'Iptu',
      'AKP',
      'Kompol',
      'Pembina / ASN Polri',
      'Penata / ASN Polri',
      'Pengatur / ASN Polri',
      'ASN / PNS Polri',
    ].includes(localMember.pangkat) ||
    (localMember.jenisAnggota as string) === 'ASN / PNS POLRI' ||
    localMember.pendidikanTerakhir?.toLowerCase().includes('informatika');
  const isAkpol96Alumni = !isSuperadminDev && !isNonAkpolRank;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wirasatya96_feed_posts');
      if (saved) {
        try {
          const parsed: FeedPost[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setUserPosts(parsed.filter((p) => p.authorNrp === localMember.nrp));
          }
        } catch {
          // ignore
        }
      }
    }
  }, [localMember.nrp]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const persistMemberUpdate = async (
    patch: Partial<AnggotaWiraSatya>,
    notificationText: string
  ) => {
    const updated: AnggotaWiraSatya = {
      ...localMember,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setLocalMember(updated);
    setIsSaving(true);

    try {
      if (typeof window !== 'undefined') {
        // Sync ws96_member_overrides_v1
        try {
          const rawMemOv = localStorage.getItem('ws96_member_overrides_v1');
          const memOvMap = rawMemOv ? JSON.parse(rawMemOv) : {};
          memOvMap[updated.nrp] = { ...(memOvMap[updated.nrp] || {}), ...updated };
          if (updated.id) {
            memOvMap[updated.id] = { ...(memOvMap[updated.id] || {}), ...updated };
          }
          localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(memOvMap));
        } catch {
          // ignore
        }

        // Sync ws96_user_overrides_v1 so it is always 100% in sync
        try {
          const rawUserOv = localStorage.getItem('ws96_user_overrides_v1');
          const userOvMap = rawUserOv ? JSON.parse(rawUserOv) : {};
          const existingUOv = userOvMap[updated.nrp] || {};
          userOvMap[updated.nrp] = {
            ...existingUOv,
            nrp: updated.nrp,
            nama: updated.namaLengkap,
            pangkat: updated.pangkat,
            jabatanTerakhir: updated.jabatanTerakhir,
            satker: updated.satuanKerja || updated.satker,
            polda: updated.polda,
            statusKedinasan: updated.statusKedinasan,
            noHp: updated.noHp,
            email: updated.email,
            secondaryEmail: updated.secondaryEmail,
            fotoUrl: updated.fotoUrl,
            coverUrl: updated.coverUrl,
            bio: updated.bio,
            updatedAt: updated.updatedAt,
          };
          localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(userOvMap));
        } catch {
          // ignore
        }

        // Sync wirasatya96_members
        try {
          const rawMembers = localStorage.getItem('wirasatya96_members');
          if (rawMembers) {
            const parsedMembers: AnggotaWiraSatya[] = JSON.parse(rawMembers);
            if (Array.isArray(parsedMembers)) {
              const nextMembers = parsedMembers.map((m) =>
                m.nrp === updated.nrp || m.id === updated.id ? { ...m, ...updated } : m
              );
              localStorage.setItem('wirasatya96_members', JSON.stringify(nextMembers));
            }
          }
        } catch {
          // ignore
        }

        // Sync localStorage auth session if updating own profile
        if (currentUser.nrp === updated.nrp) {
          const rawAuth = localStorage.getItem('ws96_auth_user');
          if (rawAuth) {
            try {
              const parsedAuth = JSON.parse(rawAuth);
              const nextAuth = {
                ...parsedAuth,
                nama: updated.namaLengkap,
                pangkat: updated.pangkat,
                satker: updated.satuanKerja || updated.satker,
                polda: updated.polda,
                fotoUrl: updated.fotoUrl,
                coverUrl: updated.coverUrl,
                bio: updated.bio,
                email: updated.email || parsedAuth.email,
                secondaryEmail: updated.secondaryEmail,
              };
              localStorage.setItem('ws96_auth_user', JSON.stringify(nextAuth));
              localStorage.setItem('ws96_active_user', JSON.stringify(nextAuth));
              localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextAuth));
              window.dispatchEvent(new Event('ws96_user_updated'));
            } catch {
              // ignore
            }
          }
        }
      }

      await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (onUpdateMemberDirect) {
        await onUpdateMemberDirect(updated);
      }

      if (getActiveAdcSessionFromStorage()) {
        recordAdcActivityToAuditLog({
          action: 'AKTIVITAS_ADC',
          details: `Memperbarui profil Pimpinan (${notificationText})`,
        });
      }

      triggerToast(notificationText);
    } catch {
      triggerToast('Perubahan disimpan secara lokal');
    } finally {
      setIsSaving(false);
    }
  };

  // Secure client-side auto-crop, storage compression, and WS-hash_enkripsi-date tracking for Cover Banner
  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const processed = await processSecureImageUpload(file, {
        preset: 'COVER',
        actorNrp: currentUser.nrp,
        ownerNrp: localMember.nrp,
      });
      await persistMemberUpdate(
        { coverUrl: processed.dataUrl },
        `Sampul diperbarui (${processed.encryptedFileName} • ${Math.max(1, Math.round(processed.compressedBytes / 1024))} KB)`
      );
    } catch {
      triggerToast('Gagal memproses file sampul');
    } finally {
      setShowCoverMenu(false);
    }
  };

  // Secure client-side auto-crop, storage compression, and WS-hash_enkripsi-date tracking for Avatar
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const processed = await processSecureImageUpload(file, {
        preset: 'AVATAR',
        actorNrp: currentUser.nrp,
        ownerNrp: localMember.nrp,
      });
      await persistMemberUpdate(
        { fotoUrl: processed.dataUrl },
        `Foto profil diperbarui (${processed.encryptedFileName} • ${Math.max(1, Math.round(processed.compressedBytes / 1024))} KB)`
      );
    } catch {
      triggerToast('Gagal memproses foto profil');
    } finally {
      setShowAvatarMenu(false);
    }
  };

  const cleanMemberNameOnly = (localMember.namaLengkap || '').replace(/\(.*?\)/g, '').trim();

  const displayMemberNameWithRank = formatMemberDisplayName(
    localMember.pangkat,
    localMember.namaLengkap
  );

  const resolvedMemberAvatar =
    localMember.nrp === currentUser.nrp
      ? resolveAvatarUrl(localMember.fotoUrl, currentUser.fotoUrl)
      : getAvatarUrl(localMember.fotoUrl);

  const getWaUrl = (phone?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return `https://wa.me/${clean}?text=Halo%20${encodeURIComponent(
      displayMemberNameWithRank
    )}%2C%20mohon%20izin%20menghubungi%20dari%20Portal%20Wira%20Satya%2096`;
  };

  const getDefaultBioText = (): string => {
    if (isSuperadminDev) {
      return `${displayMemberNameWithRank} (NRP ${localMember.nrp}) bertugas pada ${localMember.satuanKerja} (${localMember.polda}) sebagai ${localMember.jabatanTerakhir}. Berlatar belakang pendidikan ${localMember.pendidikanTerakhir}, bertanggung jawab atas arsitektur sistem, keamanan data, dan pengelolaan infrastruktur digital portal Wira Satya 96.`;
    }
    if (!isAkpol96Alumni) {
      return `${displayMemberNameWithRank} (NRP ${localMember.nrp}) berdinas aktif pada ${localMember.satuanKerja} (${localMember.polda}) dengan jabatan ${localMember.jabatanTerakhir}. Lulusan ${localMember.pendidikanTerakhir || 'Pendidikan Polri'}.`;
    }
    return `${displayMemberNameWithRank} adalah Perwira Polri alumni Akademi Kepolisian Negara Republik Indonesia (Akpol) Tahun 1996 Batalyon Wira Satya yang saat ini mengemban amanah sebagai ${localMember.jabatanTerakhir} pada ${localMember.satuanKerja} (${localMember.polda}).`;
  };

  const displayedBio =
    localMember.bio && localMember.bio.trim().length > 0
      ? localMember.bio
      : getDefaultBioText();

  const getJabatanAngkatanLabel = (role?: UserRole): string => {
    if (role === 'KETUA') return 'Ketua Angkatan';
    if (role === 'SEKRETARIAT') return 'Sekretaris Angkatan';
    if (role === 'BENDAHARA') return 'Bendahara Angkatan';
    if (role === 'SUPERADMIN') return 'Lead Developer / Superadmin';
    return 'Anggota Angkatan';
  };

  const jabatanAngkatanLabel = getJabatanAngkatanLabel(effectiveRole);

  const headlineText = formatJabatanWithSatker(
    localMember.jabatanTerakhir === 'Lead Developer' ? 'Staf' : localMember.jabatanTerakhir,
    localMember.satuanKerja
  );

  const getPersonnelCategoryLabel = (): string => {
    if (isSuperadminDev) return 'PERSONEL POLRI • LEAD DEVELOPER / SUPERADMIN';
    if (effectiveRole === 'KETUA') return 'PERWIRA TINGGI POLRI • KETUA ANGKATAN';
    if (effectiveRole === 'SEKRETARIAT') return 'PERWIRA POLRI • SEKRETARIS ANGKATAN';
    if (effectiveRole === 'BENDAHARA') return 'PERWIRA POLRI • BENDAHARA ANGKATAN';
    if (isAkpol96Alumni) return 'PERWIRA POLRI • ALUMNI AKPOL 1996';
    return `${localMember.jenisAnggota || 'PERSONEL POLRI'} • STAF / PENDUKUNG`;
  };

  const getBadgeStatusDescription = (): { label: string; colorClass: string } => {
    if (effectiveRole === 'SUPERADMIN') {
      return {
        label: 'Badge Hitam — Superadmin',
        colorClass: 'bg-slate-900 text-white border-slate-700',
      };
    }
    if (effectiveRole === 'KETUA') {
      return {
        label: 'Badge Merah — Ketua Angkatan',
        colorClass: 'bg-red-50 text-red-800 border-red-200',
      };
    }
    if (effectiveRole === 'SEKRETARIAT' || effectiveRole === 'BENDAHARA') {
      return {
        label: 'Badge Kuning Emas — Pejabat Angkatan',
        colorClass: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    }
    return {
      label: 'Anggota Terdaftar',
      colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  };

  const officialEmail =
    localMember.email &&
    !(
      /^74090\d{3}@polri\.go\.id$/i.test(localMember.email) &&
      !/^74090\d{3}$/.test(localMember.nrp)
    )
      ? localMember.email
      : `${localMember.nrp}@polri.go.id`;
  const secondaryEmail =
    localMember.secondaryEmail ||
    (localMember.nrp === '98010710' ? 'superadmin@example.com' : '—');

  const copyToClipboard = (key: string, val: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(val);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Find other peers in the same Polda (always exclude behind-the-scenes Superadmin)
  const peersInSamePolda = allMembers
    .filter(
      (m) =>
        m.id !== localMember.id &&
        m.polda === localMember.polda &&
        !isSuperadminAccount(m.nrp, (m as { role?: string }).role)
    )
    .slice(0, 4);

  // Render Cover Banner Visual
  const renderCoverBannerContent = () => {
    const rawCover =
      localMember.coverUrl && localMember.coverUrl !== DEFAULT_COVER_URL
        ? localMember.coverUrl
        : localMember.nrp === currentUser.nrp
        ? currentUser.coverUrl || localMember.coverUrl
        : localMember.coverUrl;
    const cover = rawCover?.trim();

    if (cover === 'none') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative flex items-center justify-center">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
      );
    }

    if (cover === 'preset:bareskrim-dark') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-slate-950 via-red-950 to-slate-900 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      );
    }

    if (cover === 'preset:mabes-gold') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-amber-900 via-red-900 to-slate-950 relative">
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fde68a_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      );
    }

    if (cover === 'preset:tactical-navy') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      );
    }

    const imgSrc = cover && cover.length > 0 ? cover : DEFAULT_COVER_URL;
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imgSrc}
        alt="Sampul Profil"
        className="w-full h-full object-cover object-center"
      />
    );
  };

  const badgeStatus = getBadgeStatusDescription();

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 font-sans text-slate-900 space-y-4 relative">
      {/* Hidden File Inputs for Cover & Avatar */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFileSelect}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileSelect}
      />

      {/* Floating Feedback Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Breadcrumb / Back button if presented inside a modal */}
      {onClose && (
        <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Direktori Personel</span>
            <span>/</span>
            <span className="font-bold text-slate-900 inline-flex items-center gap-1">
              {cleanMemberNameOnly}
              <MetaVerifiedBadge nrp={localMember.nrp} role={effectiveRole} size="xs" />
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <span className="sm:hidden">&larr; Kembali</span>
            <span className="hidden sm:inline">&larr; Kembali ke Direktori</span>
          </button>
        </div>
      )}

      {/* Main Grid: Left Column (Profile Canvas) + Right Column (LinkedIn Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ============================================================== */}
        {/* LEFT / CENTER COLUMN (2 COLS): LINKEDIN MAIN PROFILE FEED      */}
        {/* ============================================================== */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. HERO PROFILE CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible relative">
            {/* Cover Banner Image */}
            <div className="h-44 sm:h-52 w-full bg-slate-900 relative overflow-hidden rounded-t-2xl">
              {renderCoverBannerContent()}

              {/* Top-left dynamic Satker • Polda overlay badge */}
              <div className="absolute top-3 left-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-[10px] sm:text-[11px] font-extrabold text-amber-300 flex items-center gap-1.5 shadow-lg tracking-wide">
                  <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {(localMember.satuanKerja || 'MABES POLRI').toUpperCase()} •{' '}
                    {(localMember.polda || 'MABES POLRI').toUpperCase()}
                  </span>
                </span>
              </div>

              {/* Top-right interactive Edit Sampul button */}
              {canManageProfile && (
                <div className="absolute top-3 right-4 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCoverMenu((prev) => !prev);
                      setShowAvatarMenu(false);
                    }}
                    className="px-3 py-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/25 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
                    title="Ubah atau Hapus Gambar Sampul"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Sampul</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cover Editor Popover / Menu */}
            {canManageProfile && showCoverMenu && (
              <div className="
                absolute top-14 right-4 z-40 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3 text-xs
              ">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-red-800" />
                    Sampul Profil
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCoverMenu(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Upload Sampul</span>
                </button>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tema Sampul:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {COVER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          persistMemberUpdate(
                            { coverUrl: preset.id },
                            `Tema sampul "${preset.label}" diterapkan`
                          );
                          setShowCoverMenu(false);
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left transition-all cursor-pointer"
                      >
                        <div
                          className={`w-10 h-6 rounded-md ${preset.previewClass} border border-white/20 shrink-0 shadow-inner`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs truncate">
                            {preset.label}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {preset.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const coverSrc =
                        localMember.coverUrl &&
                        localMember.coverUrl !== 'none' &&
                        !localMember.coverUrl.startsWith('preset:')
                          ? localMember.coverUrl
                          : DEFAULT_COVER_URL;
                      const fileName = triggerTrackedDownload(coverSrc, {
                        actorNrp: currentUser.nrp,
                        ownerNrp: localMember.nrp,
                        preset: 'COVER',
                        extension: 'jpg',
                      });
                      triggerToast(`Diunduh: ${fileName}`);
                      setShowCoverMenu(false);
                    }}
                    className="text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Unduh dengan nama terenkripsi WS-hash-date"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      persistMemberUpdate(
                        { coverUrl: 'none' },
                        'Gambar sampul berhasil dihapus'
                      );
                      setShowCoverMenu(false);
                    }}
                    className="text-red-700 hover:text-red-900 font-bold flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Sampul</span>
                  </button>
                  {isSaving && (
                    <span className="text-[11px] text-slate-400 italic">Menyimpan...</span>
                  )}
                </div>
              </div>
            )}

            {/* Avatar & Headline Info Section */}
            <div className="px-6 pb-6 pt-0 relative">
              {/* Profile Avatar overlapping banner */}
              <div className="flex justify-between items-end -mt-16 sm:-mt-20 mb-4">
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedMemberAvatar}
                    alt={localMember.namaLengkap}
                    onClick={() => {
                      if (canManageProfile) {
                        setShowAvatarMenu((prev) => !prev);
                        setShowCoverMenu(false);
                      }
                    }}
                    className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white shadow-xl bg-white ${
                      canManageProfile ? 'cursor-pointer group-hover:brightness-95 transition-all' : ''
                    }`}
                  />

                  {canManageProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarMenu((prev) => !prev);
                        setShowCoverMenu(false);
                      }}
                      className="w-9 h-9 rounded-full bg-slate-900 hover:bg-red-900 text-white flex items-center justify-center absolute bottom-1.5 right-1.5 border-2 border-white shadow-lg transition-colors cursor-pointer"
                      title="Ubah atau Hapus Foto Profil"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                    </button>
                  )}

                  {/* Avatar Popover Menu */}
                  {canManageProfile && showAvatarMenu && (
                    <div className="absolute left-0 top-full mt-2 z-40 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-900">Foto Profil</span>
                        <button
                          type="button"
                          onClick={() => setShowAvatarMenu(false)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ganti Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const fileName = triggerTrackedDownload(resolvedMemberAvatar, {
                            actorNrp: currentUser.nrp,
                            ownerNrp: localMember.nrp,
                            preset: 'AVATAR',
                            extension: 'jpg',
                          });
                          triggerToast(`Diunduh: ${fileName}`);
                          setShowAvatarMenu(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 transition-colors cursor-pointer"
                        title="Unduh dengan nama terenkripsi WS-hash-date"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          persistMemberUpdate(
                            { fotoUrl: DEFAULT_AVATAR_URL },
                            'Foto profil direset ke standar'
                          );
                          setShowAvatarMenu(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-bold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isSelf && (
                    <button
                      type="button"
                      onClick={() => setShowSecurityModal(true)}
                      className="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      title="Pengaturan Profil & Keamanan (2FA, PIN, TOTP, Passkey)"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span className="sm:hidden">Keamanan</span>
                      <span className="hidden sm:inline">Pengaturan &amp; Keamanan</span>
                    </button>
                  )}
                  {canEditProfile && (
                    <button
                      type="button"
                      onClick={() => onEditProfile && onEditProfile(localMember, 1)}
                      className="p-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      title="Edit Profil"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Name & Headline */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight inline-flex items-center gap-1.5">
                      <span>{cleanMemberNameOnly}</span>
                      <MetaVerifiedBadge
                        nrp={localMember.nrp}
                        role={effectiveRole}
                        size="lg"
                      />
                    </h1>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      NRP {localMember.nrp}
                    </span>
                    {(() => {
                      const st = detectStatusKedinasan(
                        localMember.statusKedinasan || localMember.statusDinas,
                        localMember.jabatanTerakhir || localMember.jabatan,
                        localMember.jenisAnggota
                      );
                      if (st === 'ALMARHUM') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            <span className="sm:hidden">🕊️ Almarhum</span>
                            <span className="hidden sm:inline">🕊️ Almarhum / Gugur</span>
                          </span>
                        );
                      }
                      if (st === 'PURNA_TUGAS') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="sm:hidden">🎖️ Purna Tugas</span>
                            <span className="hidden sm:inline">🎖️ Purna Tugas Polri</span>
                          </span>
                        );
                      }
                      if (st === 'PTDH') {
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            ⚠️ PTDH
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <p className="text-sm font-semibold text-slate-700 leading-snug">
                    {localMember.pangkat} &bull; {headlineText}
                  </p>

                  {(effectiveRole === 'SUPERADMIN' ||
                    effectiveRole === 'KETUA' ||
                    effectiveRole === 'SEKRETARIAT' ||
                    effectiveRole === 'BENDAHARA') && (
                    <div className="pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[10px] font-extrabold uppercase tracking-wider ${
                          effectiveRole === 'SUPERADMIN'
                            ? 'bg-slate-900 text-white border-slate-700'
                            : effectiveRole === 'KETUA'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {effectiveRole === 'SUPERADMIN' ? (
                          <span>SUPERADMIN</span>
                        ) : (
                          <>
                            <span className="sm:hidden">🎖️ {jabatanAngkatanLabel}</span>
                            <span className="hidden sm:inline">🎖️ Jabatan Angkatan: {jabatanAngkatanLabel}</span>
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {localMember.polda} • NRP {localMember.nrp}
                    </span>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setShowContactModal(true)}
                      className="text-red-900 font-bold hover:underline cursor-pointer"
                    >
                      <span className="sm:hidden">Kontak</span>
                      <span className="hidden sm:inline">Info Kontak</span>
                    </button>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-4 mt-2 border-t border-slate-100">
                {localMember.noHp && (
                  <a
                    href={getWaUrl(localMember.noHp)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 sm:px-5 py-2 rounded-full bg-red-800 hover:bg-red-900 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {!isSelf && onOpenChat && (
                  <button
                    onClick={() => onOpenChat(localMember)}
                    className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span className="sm:hidden">Pesan</span>
                    <span className="hidden sm:inline">Kirim Pesan</span>
                  </button>
                )}

                {canEditProfile ? (
                  <button
                    type="button"
                    onClick={() => onEditProfile && onEditProfile(localMember, 1)}
                    className="px-4 py-2 rounded-full bg-red-800 hover:bg-red-900 text-white font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="sm:hidden">Edit</span>
                    <span className="hidden sm:inline">Edit Profil</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 font-medium px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                    Mode Lihat
                  </span>
                )}

                {isSelf && (
                  <button
                    type="button"
                    onClick={() => setShowSecurityModal(true)}
                    className="px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Pengaturan Keamanan & 2FA"
                  >
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="sm:hidden">2FA</span>
                    <span className="hidden sm:inline">Keamanan &amp; 2FA</span>
                  </button>
                )}

                {localMember.kontakAdc && (
                  <a
                    href={getWaUrl(localMember.kontakAdc)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>ADC: {localMember.namaAdc || 'Ajudan'}</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="sm:hidden">Kontak</span>
                  <span className="hidden sm:inline">Info Kontak</span>
                </button>
              </div>

              {/* Status Purna & Kesehatan Highlights Card (alumni only; Superadmin shows only authority status) */}
              {!isSuperadminDev && (
                <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {detectStatusKedinasan(
                    localMember.statusKedinasan || localMember.statusDinas,
                    localMember.jabatanTerakhir || localMember.jabatan,
                    localMember.jenisAnggota
                  ) === 'ALMARHUM' || localMember.statusKedinasan === 'ALMARHUM' ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🕊️</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Status Kehormatan:
                        </span>
                        <span className="font-extrabold text-slate-900">
                          🕊️ In Memoriam (Almarhum)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Purna Tugas (BUP {RETIREMENT_AGE_POLRI} Thn):
                        </span>
                        <span className="font-bold text-slate-900">
                          {localMember.tahunPurnaTugas} ({localMember.sisaTahunDinas} Thn Lagi)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Kesehatan &amp; Gol. Darah:
                      </span>
                      <span className="font-bold text-emerald-700">
                        {localMember.kondisiKesehatan} • Gol. {localMember.golonganDarah || 'O'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Status Otoritas:
                      </span>
                      <span className="font-bold text-amber-800 inline-flex items-center gap-1">
                        <span>{badgeStatus.label}</span>
                        <MetaVerifiedBadge
                          nrp={localMember.nrp}
                          role={effectiveRole}
                          size="xs"
                        />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KARTU KHUSUS IN MEMORIAM: DATA KELUARGA & AHLI WARIS ALMARHUM */}
          {(detectStatusKedinasan(
            localMember.statusKedinasan || localMember.statusDinas,
            localMember.jabatanTerakhir || localMember.jabatan,
            localMember.jenisAnggota
          ) === 'ALMARHUM' ||
            localMember.statusKedinasan === 'ALMARHUM') && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl border-2 border-amber-400/60 shadow-lg p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3.5">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                    In Memoriam • Solidaritas &amp; Santunan Keluarga Besar Wira Satya 96
                  </span>
                  <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                    <span>🕊️ Data Keluarga &amp; Ahli Waris Almarhum (Istri &amp; Putra-Putri)</span>
                  </h2>
                </div>
                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => onEditProfile && onEditProfile(localMember, 2)}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Update Data Keluarga Almarhum</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                  <span className="text-[10px] text-amber-200 uppercase font-bold block">
                    Nama Istri / Ahli Waris
                  </span>
                  <span className="font-extrabold text-white text-sm block mt-0.5">
                    {localMember.namaIstri?.trim() ? localMember.namaIstri : 'Belum Terdata'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                  <span className="text-[10px] text-amber-200 uppercase font-bold block">
                    No. HP / WA Keluarga
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-extrabold text-emerald-300 text-sm">
                      {localMember.kontakIstri?.trim() || localMember.noHp?.trim() || 'Belum Terdata'}
                    </span>
                    {(localMember.kontakIstri || localMember.noHp) && (
                      <a
                        href={getWaUrl(localMember.kontakIstri || localMember.noHp)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                      >
                        Hubungi WA
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                  <span className="text-[10px] text-amber-200 uppercase font-bold block">
                    Alamat Domisili Keluarga
                  </span>
                  <span className="font-bold text-white block mt-0.5">
                    {localMember.alamatTempatTinggal || 'Belum Terdata'} (
                    {localMember.statusTempatTinggal || 'MILIK PRIBADI'})
                  </span>
                  {localMember.statusTempatTinggal === 'SEWA/KONTRAK' &&
                    (localMember.biayaSewaTempatTinggal || localMember.detailSewaTempatTinggal) && (
                      <span className="text-[10px] text-amber-300 block mt-0.5">
                        Sewa: {localMember.biayaSewaTempatTinggal || '-'}{' '}
                        {localMember.detailSewaTempatTinggal ? `• ${localMember.detailSewaTempatTinggal}` : ''}
                      </span>
                    )}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                    Daftar Putra-Putri Almarhum ({localMember.daftarAnak?.length || 0} Anak)
                  </span>
                </div>

                {localMember.daftarAnak && localMember.daftarAnak.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-white/15 bg-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/10 text-amber-200 text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">No</th>
                          <th className="py-2.5 px-3 font-bold">Nama Lengkap Anak</th>
                          <th className="py-2.5 px-3 font-bold">Tempat / Tgl Lahir</th>
                          <th className="py-2.5 px-3 font-bold">Status Pendidikan / Bekerja</th>
                          <th className="py-2.5 px-3 font-bold">Estimasi Biaya Pendidikan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {localMember.daftarAnak.map((anak, idx) => (
                          <tr key={anak.id || idx} className="hover:bg-white/5">
                            <td className="py-2.5 px-3 font-bold text-amber-300">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              {anak.nama || `Anak ke-${idx + 1}`}
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">
                              {[anak.tempatLahir, anak.tanggalLahir].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30 font-bold text-[10px]">
                                {anak.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-amber-200">
                              {anak.biayaPendidikanTahunan || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/5 border border-dashed border-white/20 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Data putra-putri almarhum belum dilengkapi. Silakan klik tombol Update Data Keluarga Almarhum untuk menambahkan.
                    </span>
                    {canEditProfile && (
                      <button
                        type="button"
                        onClick={() => onEditProfile && onEditProfile(localMember, 2)}
                        className="text-amber-300 hover:underline font-bold cursor-pointer"
                      >
                        + Tambah Data Anak Almarhum
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. SECTION: TENTANG (Fixes Crossed-Out Area #3) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Tentang
              </h2>
              {canManageProfile && !isEditingBio && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftBio(localMember.bio || getDefaultBioText());
                    setIsEditingBio(true);
                  }}
                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-red-800" />
                  <span>Edit Ringkasan</span>
                </button>
              )}
            </div>

            {isEditingBio ? (
              <div className="space-y-3 pt-1">
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={4}
                  placeholder="Tuliskan ringkasan profil, riwayat penugasan, atau bidang keahlian..."
                  className="w-full rounded-xl border border-slate-300 focus:border-red-800 focus:ring-2 focus:ring-red-800/20 p-3 text-xs sm:text-sm text-slate-800 leading-relaxed outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftBio(getDefaultBioText())}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ringkasan Otomatis</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await persistMemberUpdate(
                          { bio: draftBio.trim() },
                          'Ringkasan berhasil disimpan'
                        );
                        setIsEditingBio(false);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {displayedBio}
              </p>
            )}

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                🎓 {localMember.pendidikanTerakhir || 'Pendidikan Polri'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                🛡️ Pangkat: {localMember.pangkat}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                🏛️ {localMember.satuanKerja}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                📍 {localMember.polda}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-800 border border-red-200 font-bold">
                🩸 Gol. Darah: {localMember.golonganDarah || 'O'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                👕 Ukuran Aparel Personel: Baju ({localMember.ukuranBaju || '-'}) • Celana ({localMember.ukuranCelana || '-'}) • Sepatu ({localMember.ukuranSepatu || '-'})
              </span>
            </div>
          </div>

          {/* SECTION: UNGGAHAN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Unggahan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {userPosts.length} unggahan dipublikasikan
                </p>
              </div>

              {isOwner && (
                <button
                  onClick={() => {
                    if (onClose) onClose();
                  }}
                  className="px-4 py-1.5 rounded-full border border-red-800 text-red-900 hover:bg-red-50 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Unggahan</span>
                </button>
              )}
            </div>

            {userPosts.length > 0 ? (
              <div className="space-y-3">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolvedMemberAvatar}
                        alt={localMember.namaLengkap}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-white"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1">
                          <span>{displayMemberNameWithRank}</span>
                          <MetaVerifiedBadge
                            nrp={localMember.nrp}
                            role={effectiveRole}
                            size="sm"
                          />
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {post.createdAt}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        👍 {post.likesCount} suka &bull; {post.comments.length} komentar
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 text-center text-xs text-slate-500">
                Belum ada unggahan dari personel ini.
              </div>
            )}
          </div>

          {/* 3. SECTION: JEJAK KEDINASAN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-polri-navy" />
                Jejak Kedinasan
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Tipe: {localMember.tipeSatker || 'POLDA'}
                </span>
                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => onEditProfile && onEditProfile(localMember, 1)}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Kedinasan</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-polri-navy text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {localMember.jabatanTerakhir}
                  </h3>
                  <p className="text-xs font-semibold text-slate-700">
                    {localMember.satuanKerja}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {localMember.polda} &bull; Sub Satker:{' '}
                    <span className="font-semibold text-blue-700">
                      {localMember.subSatker || '-'}
                    </span>
                  </p>
                  {localMember.namaPolres && (
                    <p className="text-[11px] text-slate-600">
                      Satwil / Komando:{' '}
                      <span className="font-semibold text-slate-800">
                        {localMember.namaPolres}
                      </span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 pt-1">
                    Tempat Tinggal: <b>{localMember.statusTempatTinggal}</b> (
                    {localMember.alamatTempatTinggal})
                  </p>
                  {localMember.statusTempatTinggal === 'SEWA/KONTRAK' && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 space-y-0.5">
                      <p className="font-extrabold text-amber-900">
                        Rincian Sewa / Kontrak Tempat Tinggal Saat Ini:
                      </p>
                      <p>
                        Biaya Sewa / Kontrak:{' '}
                        <span className="font-bold">
                          {localMember.biayaSewaTempatTinggal || 'Belum dirinci'}
                        </span>
                      </p>
                      {localMember.detailSewaTempatTinggal && (
                        <p className="text-amber-800">
                          Keterangan: {localMember.detailSewaTempatTinggal}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. SECTION: KESEHATAN & KEBUGARAN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                Kesehatan &amp; Kebugaran
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    localMember.adaPenyakitKronis === 'ADA' ||
                    localMember.kondisiKesehatan === 'SAKIT' ||
                    localMember.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Kondisi Saat Ini: {localMember.kondisiSaatIni || localMember.kondisiKesehatan || 'SEHAT'}
                </span>
                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => onEditProfile && onEditProfile(localMember, 4)}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Kesehatan</span>
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const extHealth = localMember as unknown as Record<string, unknown>;
              const golonganDarah = localMember.golonganDarah || (extHealth.golonganDarah as string) || 'O';
              const bpjsStatus =
                (extHealth.bpjsStatus as string) ||
                (localMember.asuransiAktif?.includes('BPJS')
                  ? 'AKTIF'
                  : localMember.biayaPengobatanDitanggung || 'AKTIF');
              const asuransiKesehatan = Array.isArray(localMember.asuransiAktif)
                ? localMember.asuransiAktif.join(', ')
                : (extHealth.asuransiAktif as string) || 'BPJS Kesehatan';
              const penyakitKronisText =
                (extHealth.penyakitKronis as string) ||
                (localMember.daftarPenyakit && localMember.daftarPenyakit.length > 0
                  ? localMember.daftarPenyakit.join(', ')
                  : localMember.adaPenyakitKronis === 'ADA'
                  ? 'Ada Riwayat Penyakit Kronis'
                  : 'Tidak Ada');
              const alergiText = (extHealth.alergi as string) || 'Tidak Ada';
              const catatanMedisText =
                localMember.catatanMedis ||
                localMember.kondisiSaatIni ||
                localMember.penangananPengobatan ||
                'Kondisi kebugaran terpantau baik';
              const kontakDaruratNama =
                (extHealth.kontakDaruratNama as string) || localMember.namaIstri || '—';
              const kontakDaruratHubungan =
                (extHealth.kontakDaruratHubungan as string) ||
                (localMember.namaIstri ? 'Pasangan / Keluarga' : 'Keluarga');
              const kontakDaruratHp =
                (extHealth.kontakDaruratHp as string) ||
                localMember.kontakIstri ||
                localMember.noHp ||
                '—';

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Kondisi Kesehatan:</span>
                      <span className="font-bold text-slate-900">
                        {localMember.kondisiKesehatan || 'BAIK'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Golongan Darah:</span>
                      <span className="font-extrabold text-red-700">{golonganDarah}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Ukuran Aparel Personel:</span>
                      <span className="font-bold text-slate-900">
                        Baju ({localMember.ukuranBaju || '-'}) • Celana ({localMember.ukuranCelana || '-'}) • Sepatu ({localMember.ukuranSepatu || '-'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Rutin MCU:</span>
                      <span className="font-semibold text-slate-900">
                        {localMember.rutinMcu === 'YA' ? 'Ya (Rutin)' : 'Tidak'} • MCU:{' '}
                        {localMember.mcuTerakhir || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status BPJS:</span>
                      <span className="font-bold text-emerald-700">{bpjsStatus}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Asuransi Kesehatan:</span>
                      <span className="font-semibold text-slate-900">{asuransiKesehatan}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Alergi:</span>
                      <span className="font-semibold text-slate-900">{alergiText}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block">Riwayat Penyakit / Kondisi Medis:</span>
                      <span className="font-bold text-slate-900">{penyakitKronisText}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-500 block">Kontak Darurat:</span>
                      <span className="font-semibold text-slate-900">
                        {kontakDaruratNama} ({kontakDaruratHubungan}) • {kontakDaruratHp}
                      </span>
                    </div>
                    <div className="sm:col-span-3 pt-1 border-t border-slate-200/70">
                      <span className="text-slate-500 block">Catatan Medis &amp; Penanganan:</span>
                      <span className="font-semibold text-slate-800">{catatanMedisText}</span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Diagnosa Penyakit */}
            {localMember.daftarPenyakit && localMember.daftarPenyakit.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-700 block">
                  Diagnosa Medis:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {localMember.daftarPenyakit.map((p, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 font-bold text-[11px]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {localMember.harapanDukunganLeting && (
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">
                  Catatan Dukungan:
                </span>
                <p className="text-slate-700 italic">
                  &ldquo;{localMember.harapanDukunganLeting}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* 5. SECTION: RENCANA PURNA TUGAS & KEWIRAUSAHAAN (BUP 58 TAHUN) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            {(() => {
              const ret58 = calculateRetirement58(localMember.tanggalLahir, localMember.nrp);
              const extPurna = localMember as unknown as Record<string, unknown>;
              const estimasiTahunPensiun =
                (extPurna.estimasiTahunPensiun as number | string) ||
                ret58.tahunPurnaTugas ||
                localMember.tahunPurnaTugas;
              const rencanaSetelahPensiun =
                (extPurna.rencanaSetelahPensiun as string) ||
                (localMember.rencanaAktivitas || []).join(', ') ||
                'USAHA SENDIRI';
              const targetDomisiliParts = [
                localMember.alamatPurnaTugas,
                extPurna.kotaPurnaTugas as string,
                extPurna.provinsiPurnaTugas as string,
              ].filter(Boolean);
              const targetDomisiliText =
                targetDomisiliParts.length > 0 ? targetDomisiliParts.join(', ') : '—';
              const bidangUsahaText =
                (extPurna.bidangUsaha as string) || localMember.jenisUsaha || '—';
              const jenisUsahaText = localMember.jenisUsaha || (extPurna.bidangUsaha as string) || '—';
              const statusUsahaText = localMember.statusUsaha || 'MASIH RENCANA';
              const lokasiUsahaText =
                (extPurna.lokasiUsaha as string) || localMember.alamatPurnaTugas || '—';
              const keahlianKhususText =
                (extPurna.keahlianKhusus as string) ||
                (localMember.kebutuhanPembekalan || []).join(', ') ||
                '—';
              const minatKomunitasText =
                (extPurna.minatKomunitas as string) ||
                (localMember.sumberPenghasilanPasca || []).join(', ') ||
                '—';

              return (
                <>
                  <div className="flex items-center justify-between border-b pb-3 gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Home className="w-5 h-5 text-polri-goldDark" />
                      Rencana Purna Tugas &amp; Kewirausahaan
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Pensiun {estimasiTahunPensiun} • {ret58.sisaMasaDinasLabel}
                      </span>
                      {canEditProfile && (
                        <button
                          type="button"
                          onClick={() => onEditProfile && onEditProfile(localMember, 3)}
                          className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Purna Tugas &amp; Usaha</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Tempat &amp; Tanggal Lahir:</span>
                      <span className="font-extrabold text-slate-900">
                        {localMember.tempatLahir || 'Jakarta'}, {ret58.formattedTanggalLahir}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Usia Saat Ini:</span>
                      <span className="font-extrabold text-polri-navy">
                        {ret58.usiaLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        Estimasi Tahun Pensiun ({RETIREMENT_AGE_POLRI} Thn):
                      </span>
                      <span className="font-extrabold text-amber-800">
                        {estimasiTahunPensiun} ({ret58.formattedTanggalPensiun})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Rencana Purna Tugas:</span>
                      <span className="font-bold text-slate-900">
                        {rencanaSetelahPensiun}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Target Domisili Pensiun:</span>
                      <span className="font-semibold text-slate-900">
                        {targetDomisiliText} ({localMember.statusRumahPurnaTugas || 'MILIK PRIBADI'})
                      </span>
                    </div>
                    {localMember.statusRumahPurnaTugas === 'SEWA/KONTRAK' && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                        <span className="font-extrabold text-amber-900 block">
                          Rincian Biaya &amp; Keterangan Sewa / Kontrak Hunian Purna Tugas:
                        </span>
                        <p>
                          Estimasi Biaya Sewa Tahunan:{' '}
                          <span className="font-bold">
                            {localMember.biayaSewaTahunan || 'Belum dirinci'}
                          </span>
                        </p>
                        {localMember.detailSewaPurnaTugas && (
                          <p className="text-amber-800">
                            Detail Rencana Sewa: {localMember.detailSewaPurnaTugas}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 block">Bidang &amp; Jenis Usaha:</span>
                      <span className="font-bold text-slate-900">
                        {bidangUsahaText !== jenisUsahaText
                          ? `${bidangUsahaText} • ${jenisUsahaText}`
                          : jenisUsahaText}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status &amp; Lokasi Usaha:</span>
                      <span className="font-semibold text-slate-900">
                        {statusUsahaText} • {lokasiUsahaText}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Keahlian Khusus / Pembekalan:</span>
                      <span className="font-semibold text-slate-900">
                        {keahlianKhususText}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Minat Komunitas / Penghasilan Pasca:</span>
                      <span className="font-semibold text-slate-900">
                        {minatKomunitasText}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kesiapan Pensiun:</span>
                      <span className="font-semibold text-slate-900">
                        {localMember.kesiapanPensiun} ({localMember.perasaanPensiun})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Dana Pensiun:</span>
                      <span className="font-semibold text-slate-900">
                        {localMember.kecukupanDanaPensiun}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 6. SECTION: DATA KELUARGA & DOMISILI */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            {(() => {
              const extKel = localMember as unknown as Record<string, unknown>;
              const statusKeluarga =
                (extKel.statusKeluarga as string) || localMember.statusPerkawinan || 'MENIKAH';
              const namaPasangan =
                (extKel.namaPasangan as string) || localMember.namaIstri || '—';
              const noHpPasangan =
                (extKel.noHpPasangan as string) || localMember.kontakIstri || '-';
              const alamatDomisili =
                (extKel.alamatDomisili as string) || localMember.alamatTempatTinggal || '—';
              const kotaDomisili = (extKel.kotaDomisili as string) || '—';
              const provinsiDomisili =
                (extKel.provinsiDomisili as string) || localMember.polda || '—';
              const anakList =
                (extKel.anak as typeof localMember.daftarAnak) || localMember.daftarAnak || [];

              return (
                <>
                  <div className="flex items-center justify-between border-b pb-3 gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-polri-navy" />
                      Data Keluarga &amp; Domisili
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Status: {statusKeluarga}
                      </span>
                      {canEditProfile && (
                        <button
                          type="button"
                          onClick={() => onEditProfile && onEditProfile(localMember, 2)}
                          className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Keluarga &amp; Domisili</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Nama Pasangan:</span>
                      <span className="font-bold text-slate-900">{namaPasangan}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kontak Pasangan:</span>
                      <span className="font-semibold text-slate-900">{noHpPasangan}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Jumlah Anak:</span>
                      <span className="font-bold text-blue-700">
                        {anakList.length || localMember.jumlahAnak || 0} Anak
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tanggungan Lain:</span>
                      <span className="font-semibold text-slate-800">
                        {localMember.tanggunganLain?.jumlah || 0} Orang (
                        {localMember.tanggunganLain?.rincian || 'Tidak ada'})
                      </span>
                    </div>
                    <div className="sm:col-span-2 pt-1.5 border-t border-slate-200/70">
                      <span className="text-slate-500 block">Alamat Domisili Saat Ini:</span>
                      <span className="font-semibold text-slate-900">
                        {alamatDomisili} ({localMember.statusTempatTinggal || 'MILIK PRIBADI'})
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Kota: <b>{kotaDomisili}</b> • Provinsi / Wilayah: <b>{provinsiDomisili}</b>
                      </span>
                      {localMember.statusTempatTinggal === 'SEWA/KONTRAK' && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-0.5">
                          <span className="font-extrabold text-amber-900 block">
                            Rincian Biaya Sewa / Kontrak Tempat Tinggal Saat Ini:
                          </span>
                          <p>
                            Biaya Sewa / Kontrak:{' '}
                            <span className="font-bold">
                              {localMember.biayaSewaTempatTinggal || 'Belum dirinci'}
                            </span>
                          </p>
                          {localMember.detailSewaTempatTinggal && (
                            <p className="text-amber-800">
                              Keterangan: {localMember.detailSewaTempatTinggal}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List of Children */}
                  {anakList && anakList.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Daftar Putra-Putri:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {anakList.map((anak, idx) => (
                          <div
                            key={anak.id || idx}
                            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {anak.nama || `Anak ke-${idx + 1}`}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {anak.status} • Lahir: {anak.tanggalLahir || '-'}
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-200">
                              {anak.biayaPendidikanTahunan
                                ? `Biaya: ${anak.biayaPendidikanTahunan}`
                                : 'Pelajar'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT SIDEBAR (1 COL): LINKEDIN WIDGETS & REKAN DIREKTORI     */}
        {/* ============================================================== */}
        <div className="space-y-4">
          {/* Widget 1: Info Akun (Fixes Crossed-Out Area #4) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2.5">
              <span className="font-bold text-slate-900 text-sm inline-flex items-center gap-1.5">
                <span>Info Akun</span>
                <MetaVerifiedBadge
                  nrp={localMember.nrp}
                  role={effectiveRole}
                  size="sm"
                />
              </span>
              <Shield className="w-4 h-4 text-slate-500" />
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Kategori Personel:
              </span>
              <span className="font-extrabold text-slate-900">
                {getPersonnelCategoryLabel()}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Jabatan Organisasi Polri:
              </span>
              <span className="font-bold text-slate-900">
                {cleanJabatanOnly(localMember.jabatanTerakhir)} ({localMember.satuanKerja})
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Jabatan dalam Angkatan:
              </span>
              <span className="font-extrabold text-amber-800">
                {jabatanAngkatanLabel}
              </span>
            </div>

            {(() => {
              const ret58 = calculateRetirement58(localMember.tanggalLahir, localMember.nrp);
              return (
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    Tanggal Lahir &amp; BUP {RETIREMENT_AGE_POLRI} Tahun:
                  </span>
                  <span className="font-bold text-slate-800 block">
                    {ret58.formattedTanggalLahir} ({ret58.usiaLabel})
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800">
                    Pensiun Thn {ret58.tahunPurnaTugas} • {ret58.sisaMasaDinasLabel}
                  </span>
                </div>
              );
            })()}

            <div>
              <span className="text-slate-500 block text-[11px]">
                Pendidikan Terakhir:
              </span>
              <span className="font-bold text-slate-800">
                {localMember.pendidikanTerakhir || '-'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Email Dinas:</span>
              <span className="font-mono font-semibold text-slate-800 break-all">
                {officialEmail}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Email Sekunder:</span>
              <span className="font-mono font-semibold text-slate-700 break-all">
                {secondaryEmail}
              </span>
            </div>

            <div className="pt-1">
              <span className="text-slate-500 block text-[11px] mb-1">
                Status Verifikasi:
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[11px] ${badgeStatus.colorClass}`}
              >
                <MetaVerifiedBadge
                  nrp={localMember.nrp}
                  role={effectiveRole}
                  size="xs"
                />
                <span>{badgeStatus.label}</span>
              </span>
            </div>
          </div>

          {/* Widget 2: Rekan Direktori */}
          <div
            ref={peersSectionRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                Rekan Direktori
              </span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-500">
              Personel satu wilayah ({localMember.polda}):
            </p>

            <div className="space-y-3 pt-1">
              {peersInSamePolda.length > 0 ? (
                peersInSamePolda.map((peer) => {
                  const peerRole = resolveRoleForBadge(peer.nrp);
                  const peerAngkatanLabel =
                    peerRole === 'KETUA'
                      ? 'Ketua Angkatan'
                      : peerRole === 'SEKRETARIAT'
                      ? 'Sekretaris Angkatan'
                      : peerRole === 'BENDAHARA'
                      ? 'Bendahara Angkatan'
                      : null;

                  return (
                    <div
                      key={peer.id}
                      className="flex items-start gap-2.5 pb-2 border-b border-slate-100 last:border-0 last:pb-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(peer.fotoUrl)}
                        alt={peer.namaLengkap}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0 bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          onClick={() => onSelectMember && onSelectMember(peer)}
                          className="text-xs font-bold text-slate-900 truncate hover:text-red-900 cursor-pointer inline-flex items-center gap-1 max-w-full"
                        >
                          <span className="truncate">
                            {formatMemberDisplayName(peer.pangkat, peer.namaLengkap)}
                          </span>
                          <MetaVerifiedBadge nrp={peer.nrp} size="sm" />
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {peer.jabatanTerakhir} &bull; {peer.satuanKerja}
                        </p>
                        {peerAngkatanLabel && (
                          <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">
                            {peerAngkatanLabel}
                          </span>
                        )}
                        {peer.noHp && (
                          <a
                            href={getWaUrl(peer.noHp)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-900 hover:underline block"
                          >
                            <Phone className="w-2.5 h-2.5" /> Hubungi WA
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Belum ada personel lain di wilayah {localMember.polda}.
                </p>
              )}
            </div>
          </div>

          {/* Widget 3: Direktori & Kas */}
          <div className="bg-gradient-to-br from-slate-900 to-polri-navy rounded-2xl p-5 text-white shadow-md space-y-3 text-xs">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              PORTAL WIRA SATYA 96
            </span>
            <h4 className="font-bold text-sm text-white">
              Direktori & Kas
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Data personel terhubung langsung dengan basis data terpusat Wira Satya 96, komunikasi internal, serta layanan solidaritas anggota.
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-amber-300 font-bold">#SelaluBahagia</span>
              <span className="text-slate-400">Wira Satya 96</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL INFO KONTAK (Fixes Crossed-Out Area #2)                  */}
      {/* ============================================================== */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedMemberAvatar}
                  alt={localMember.namaLengkap}
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shrink-0 bg-white"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate inline-flex items-center gap-1.5">
                    <span className="truncate">{displayMemberNameWithRank}</span>
                    <MetaVerifiedBadge
                      nrp={localMember.nrp}
                      role={effectiveRole}
                      size="sm"
                    />
                  </h3>
                  <p className="text-[11px] text-amber-300 font-semibold">
                    Info Kontak
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-500 block">
                    Nama & Pangkat
                  </span>
                  <span className="font-bold text-slate-900 inline-flex items-center gap-1">
                    {displayMemberNameWithRank}
                    <MetaVerifiedBadge
                      nrp={localMember.nrp}
                      role={effectiveRole}
                      size="xs"
                    />
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                  NRP {localMember.nrp}
                </span>
              </div>

              <div className="pb-2.5 border-b border-slate-100">
                <span className="text-[11px] text-slate-500 block">
                  Satker & Wilayah
                </span>
                <span className="font-bold text-slate-800">
                  {localMember.satuanKerja} • {localMember.polda}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block">
                    Email Dinas
                  </span>
                  <span className="font-mono font-semibold text-slate-900 break-all">
                    {officialEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('email', officialEmail)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0 cursor-pointer"
                  title="Salin Email Dinas"
                >
                  {copiedField === 'email' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-500 block">
                    Email Sekunder
                  </span>
                  <span className="font-mono font-semibold text-slate-800 break-all">
                    {secondaryEmail}
                  </span>
                </div>
                {secondaryEmail !== '—' && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard('secEmail', secondaryEmail)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0 cursor-pointer"
                    title="Salin Email Sekunder"
                  >
                    {copiedField === 'secEmail' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-500 block">
                    WhatsApp / HP
                  </span>
                  <span className="font-bold text-slate-900">
                    {localMember.noHp || '—'}
                  </span>
                </div>
                {localMember.noHp && (
                  <a
                    href={getWaUrl(localMember.noHp)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block">
                  Alamat Domisili
                </span>
                <span className="font-semibold text-slate-800">
                  {localMember.alamatTempatTinggal || '—'} (
                  {localMember.statusTempatTinggal})
                </span>
              </div>

              {((localMember.daftarAdc && localMember.daftarAdc.length > 0) ||
                localMember.kontakAdc) && (
                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Data ADC / Ajudan / Spri
                  </span>
                  {localMember.daftarAdc && localMember.daftarAdc.length > 0 ? (
                    <div className="space-y-2">
                      {localMember.daftarAdc.map((adc, idx) => (
                        <div
                          key={adc.id || idx}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {formatMemberDisplayName(adc.pangkat, adc.nama)}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {adc.jabatan || 'ADC / Ajudan'}
                              {adc.nrp ? ` • NRP ${adc.nrp}` : ''}
                              {adc.noHp ? ` • ${adc.noHp}` : ''}
                            </p>
                          </div>
                          {adc.noHp && (
                            <a
                              href={getWaUrl(adc.noHp)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0"
                            >
                              <Phone className="w-3 h-3" />
                              <span>WA ADC</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-slate-800">{localMember.kontakAdc}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const summary = `${displayMemberNameWithRank} (NRP: ${localMember.nrp})\nSatker: ${localMember.satuanKerja} - ${localMember.polda}\nWA: ${localMember.noHp || '-'}\nEmail Dinas: ${officialEmail}`;
                  copyToClipboard('all', summary);
                  triggerToast('Data kontak disalin');
                }}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-red-800" />
                <span>
                  {copiedField === 'all' ? 'Tersalin!' : 'Salin Kontak'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL PENGATURAN PROFIL & KEAMANAN KEDINASAN (2FA & PASSKEY) */}
      {/* ============================================================ */}
      {showSecurityModal && (
        <SecuritySettingsPanel
          currentUser={currentUser}
          isModal={true}
          onClose={() => setShowSecurityModal(false)}
          onOpenFullWizard={() => {
            setShowSecurityModal(false);
            onEditProfile?.(localMember, 1);
          }}
        />
      )}
    </div>
  );
};
