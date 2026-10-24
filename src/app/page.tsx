'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar, AppTab } from '@/components/Navbar';
import { BukuSaku } from '@/components/BukuSaku';
import { FormWizard } from '@/components/FormWizard';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { BendaharaPortal } from '@/components/BendaharaPortal';
import { AdminVerificationModal } from '@/components/AdminVerificationModal';
import { RegistrationModal } from '@/components/RegistrationModal';
import { LinkedInChatDock } from '@/components/LinkedInChatDock';
import { LinkedInMessagingPage } from '@/components/LinkedInMessagingPage';
import { LinkedInJobsPage } from '@/components/LinkedInJobsPage';
import { LinkedInNotificationsPage } from '@/components/LinkedInNotificationsPage';
import { LinkedInSettingsPage } from '@/components/LinkedInSettingsPage';
import { LinkedInProfileView } from '@/components/LinkedInProfileView';
import { OfflineSyncBanner } from '@/components/OfflineSyncBanner';
import { isEffectivelyOnline, getOutboxQueue } from '@/lib/offlineSyncEngine';
import { INITIAL_MEMBERS } from '@/data/mockData';
import { PRESET_USERS } from '@/data/mockUsers';
import { PURGED_NON_1996_BASE_NAMES, NON_AKTIF_IURAN_NRPS } from '@/data/akpol1996Alumni';
import { INITIAL_FEED_POSTS } from '@/data/mockPosts';
import { INITIAL_FINANCE_SUMMARY, INITIAL_TRANSACTIONS, INITIAL_IURAN_LIST, INITIAL_ASSETS } from '@/data/mockFinance';
import { AnggotaWiraSatya, AuthUser, KasTransaction, IuranAnggota, FinanceSummary, AssetPortfolioItem, FeedPost, ChatMessage } from '@/types';
import {
  getAvatarUrl,
  resolveAvatarUrl,
  isCustomAvatarUrl,
  getOrBuildUserProfile,
  calculateRetirement58,
  stripRankFromName,
  getActiveAdcSessionFromStorage,
  recordAdcActivityToAuditLog,
  isSuperadminAccount,
} from '@/lib/avatarUtils';

const STORAGE_VERSION = 'ws96_akpol96_real_v18';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>('direktori');
  const [members, setMembers] = useState<AnggotaWiraSatya[]>(INITIAL_MEMBERS);
  const [currentUser, setCurrentUser] = useState<AuthUser>(PRESET_USERS[0]); // Default Superadmin
  const [impersonatorUser, setImpersonatorUser] = useState<AuthUser | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [navbarSearchQuery, setNavbarSearchQuery] = useState('');
  const [viewingMember, setViewingMember] = useState<AnggotaWiraSatya | null>(null);
  const [editingMember, setEditingMember] = useState<AnggotaWiraSatya | null | 'NEW'>(null);
  const [editingInitialTab, setEditingInitialTab] = useState<1 | 2 | 3 | 4>(1);
  const [messagingTargetMember, setMessagingTargetMember] = useState<AnggotaWiraSatya | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isOnlineStatus, setIsOnlineStatus] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const syncNetworkBadge = () => {
      setIsOnlineStatus(isEffectivelyOnline());
      setPendingSyncCount(getOutboxQueue().length);
    };
    syncNetworkBadge();
    window.addEventListener('ws96_offline_state_changed', syncNetworkBadge);
    window.addEventListener('online', syncNetworkBadge);
    window.addEventListener('offline', syncNetworkBadge);
    return () => {
      window.removeEventListener('ws96_offline_state_changed', syncNetworkBadge);
      window.removeEventListener('online', syncNetworkBadge);
      window.removeEventListener('offline', syncNetworkBadge);
    };
  }, []);

  // Social Feed & Messaging State
  const [posts, setPosts] = useState<FeedPost[]>(INITIAL_FEED_POSTS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Financial & Asset Portfolio State
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary>(INITIAL_FINANCE_SUMMARY);
  const [transactions, setTransactions] = useState<KasTransaction[]>(INITIAL_TRANSACTIONS);
  const [assets, setAssets] = useState<AssetPortfolioItem[]>(INITIAL_ASSETS);
  const [iuranList, setIuranList] = useState<IuranAnggota[]>(INITIAL_IURAN_LIST);

  // Helper to refresh pending verification count & synced data
  const fetchPendingVerificationCount = useCallback(() => {
    const readDeletedSet = (extraDeleted?: string[]): Set<string> => {
      if (typeof window === 'undefined') return new Set();
      try {
        const raw = localStorage.getItem('ws96_deleted_nrps_v1');
        const parsed: string[] = raw ? JSON.parse(raw) : [];
        const combined = [...parsed, ...(Array.isArray(extraDeleted) ? extraDeleted : [])]
          .map((n) => String(n).trim())
          .filter((n) => n && n !== '98010710');
        const set = new Set(combined);
        if (set.size > 0) {
          localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(Array.from(set)));
        }
        return set;
      } catch {
        return new Set();
      }
    };

    fetch('/api/auth/register')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.registrations)) {
          const deletedSet = readDeletedSet();
          let regOverrides: Record<string, any> = {};
          if (typeof window !== 'undefined') {
            try {
              const rawROv = localStorage.getItem('ws96_reg_overrides_v1');
              if (rawROv) regOverrides = JSON.parse(rawROv) || {};
            } catch {
              regOverrides = {};
            }
          }
          const count = data.registrations
            .filter((r: any) => !deletedSet.has(String(r.nrp || '').trim()))
            .map((r: any) => (regOverrides[r.nrp] ? { ...r, ...regOverrides[r.nrp] } : r))
            .filter((r: any) => r.status === 'PENDING_VERIFIKASI').length;
          setPendingVerificationCount(count);
        }
      })
      .catch(() => {});

    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        const usersList = data.users || data.data;
        if (data.success && Array.isArray(usersList)) {
          const deletedSet = readDeletedSet(data.deletedNrps);
          let userOverrides: Record<string, any> = {};
          if (typeof window !== 'undefined') {
            try {
              const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
              if (rawUOv) userOverrides = JSON.parse(rawUOv) || {};
            } catch {
              userOverrides = {};
            }
          }
          const roleMap: Record<string, string> = {};
          usersList.forEach((u: AuthUser) => {
            if (deletedSet.has((u.nrp || '').trim()) || (u.oldNrp && deletedSet.has(u.oldNrp.trim()))) {
              return;
            }
            const ov =
              userOverrides[u.nrp] ||
              Object.values(userOverrides).find(
                (item: any) =>
                  item &&
                  (item.oldNrp === u.nrp ||
                    (u.id && item.id === u.id) ||
                    (item.nama &&
                      u.nama &&
                      item.nama.trim().toLowerCase() === u.nama.trim().toLowerCase()))
              );
            const effectiveNrp = ov?.nrp || u.nrp;
            const effectiveRole =
              ov?.role && ov.role !== 'ANGGOTA'
                ? ov.role
                : u.role && u.role !== 'ANGGOTA'
                  ? u.role
                  : ov?.role || u.role;
            if (effectiveNrp && effectiveRole && !deletedSet.has(effectiveNrp)) {
              if (!roleMap[effectiveNrp] || roleMap[effectiveNrp] === 'ANGGOTA' || effectiveRole !== 'ANGGOTA') {
                roleMap[effectiveNrp] = effectiveRole;
              }
              if (u.oldNrp && (!roleMap[u.oldNrp] || roleMap[u.oldNrp] === 'ANGGOTA' || effectiveRole !== 'ANGGOTA')) {
                roleMap[u.oldNrp] = effectiveRole;
              }
            }
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('ws96_role_map', JSON.stringify(roleMap));
            window.dispatchEvent(new Event('ws96_roles_updated'));
          }
          setCurrentUser((prev) => {
            const exactNrpMatch = usersList.find((u: AuthUser) => u.nrp === prev.nrp);
            const fallbackMatch = usersList.find(
              (u: AuthUser) =>
                (prev.oldNrp && u.nrp === prev.oldNrp) ||
                (u.oldNrp && u.oldNrp === prev.nrp) ||
                (u.id && u.id === prev.id)
            );
            const matched =
              exactNrpMatch && exactNrpMatch.role !== 'ANGGOTA'
                ? exactNrpMatch
                : fallbackMatch && fallbackMatch.role !== 'ANGGOTA'
                  ? fallbackMatch
                  : exactNrpMatch || fallbackMatch;
            const ov =
              userOverrides[prev.nrp] ||
              (prev.oldNrp ? userOverrides[prev.oldNrp] : undefined);
            if (!matched && !ov) return prev;
            const mergedSource = { ...(matched || {}), ...(ov || {}) };
            const resolvedRole =
              mergedSource.role && mergedSource.role !== 'ANGGOTA'
                ? mergedSource.role
                : prev.role && prev.role !== 'ANGGOTA' && !ov?.role
                  ? prev.role
                  : mergedSource.role || prev.role;
            const nextUser: AuthUser = {
              ...prev,
              ...mergedSource,
              role: resolvedRole,
              nrp: mergedSource.nrp || prev.nrp,
              nama:
                (mergedSource.nrp || prev.nrp) === '98010710' &&
                (mergedSource.nama === 'Eko Agung' || mergedSource.nama === 'Eko Agung')
                  ? 'Eko Agung'
                  : mergedSource.nama || prev.nama,
              pangkat: mergedSource.pangkat || prev.pangkat,
              fotoUrl: resolveAvatarUrl(mergedSource.fotoUrl, prev.fotoUrl),
              coverUrl:
                mergedSource.coverUrl && mergedSource.coverUrl !== '/default-cover.jpg'
                  ? mergedSource.coverUrl
                  : prev.coverUrl || mergedSource.coverUrl,
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem('ws96_auth_user', JSON.stringify(nextUser));
              localStorage.setItem('ws96_active_user', JSON.stringify(nextUser));
              localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextUser));
            }
            return nextUser;
          });
        }
      })
      .catch(() => {});

    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        const list = data.members || data.data;
        if (data.success && Array.isArray(list) && list.length > 0) {
          const deletedSet = readDeletedSet(data.deletedNrps);
          let authUser: AuthUser | null = null;
          let memberOverrides: Record<string, AnggotaWiraSatya> = {};
          let userOverrides: Record<string, any> = {};
          if (typeof window !== 'undefined') {
            const rawAuth = localStorage.getItem('ws96_auth_user');
            if (rawAuth) {
              try {
                authUser = JSON.parse(rawAuth);
              } catch {
                authUser = null;
              }
            }
            const rawOverrides = localStorage.getItem('ws96_member_overrides_v1');
            if (rawOverrides) {
              try {
                memberOverrides = JSON.parse(rawOverrides) || {};
              } catch {
                memberOverrides = {};
              }
            }
            const rawUserOverrides = localStorage.getItem('ws96_user_overrides_v1');
            if (rawUserOverrides) {
              try {
                userOverrides = JSON.parse(rawUserOverrides) || {};
              } catch {
                userOverrides = {};
              }
            }
          }

          const isMemberTombstoned = (m: { nrp?: string; oldNrp?: string; id?: string }) => {
            const cleanNrp = (m.nrp || '').trim();
            const cleanOld = (m.oldNrp || '').trim();
            const cleanFromId = m.id?.startsWith('ws-') ? m.id.slice(3).trim() : '';
            return Boolean(
              (cleanNrp && deletedSet.has(cleanNrp)) ||
              (cleanOld && deletedSet.has(cleanOld)) ||
              (cleanFromId && deletedSet.has(cleanFromId))
            );
          };

          const getBasePersonName = (rawName?: string) =>
            (stripRankFromName(rawName || '') || rawName || '')
              .split(',')[0]
              .trim()
              .toLowerCase();

          // Filter out tombstoned members & purged non-1996 names
          const activeServerList = (list as AnggotaWiraSatya[]).filter((m) => {
            const bName = getBasePersonName(m.namaLengkap);
            if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) {
              return false;
            }
            if (isMemberTombstoned(m)) {
              fetch(`/api/users?nrp=${encodeURIComponent(m.nrp)}`, { method: 'DELETE' }).catch(() => {});
              return false;
            }
            return true;
          });

          const consumedMemberOvNrps = new Set<string>();
          const consumedUserOvNrps = new Set<string>();

          const memberOvByBaseName = new Map<string, AnggotaWiraSatya>();
          Object.values(memberOverrides).forEach((ov) => {
            if (!ov || !ov.nrp) return;
            const bName = getBasePersonName(ov.namaLengkap);
            if (bName && !memberOvByBaseName.has(bName)) memberOvByBaseName.set(bName, ov);
          });

          const userOvByBaseName = new Map<string, any>();
          Object.values(userOverrides).forEach((ov: any) => {
            if (!ov || !ov.nrp) return;
            const bName = getBasePersonName(ov.nama);
            if (bName && !userOvByBaseName.has(bName)) userOvByBaseName.set(bName, ov);
          });

          let sanitizedMembers = activeServerList.map((m: AnggotaWiraSatya) => {
            const mBaseName = getBasePersonName(m.namaLengkap);
            const isAlumniSlot = Boolean(m.id?.startsWith('ws-7409'));

            let localOverride = mBaseName ? memberOvByBaseName.get(mBaseName) : undefined;
            if (localOverride && (!localOverride.nrp || consumedMemberOvNrps.has(localOverride.nrp))) {
              localOverride = undefined;
            }
            if (!localOverride) {
              const cand = memberOverrides[m.nrp] || (m.oldNrp ? memberOverrides[m.oldNrp] : undefined);
              if (
                cand &&
                cand.nrp &&
                !consumedMemberOvNrps.has(cand.nrp) &&
                (!isAlumniSlot || !cand.namaLengkap || getBasePersonName(cand.namaLengkap) === mBaseName)
              ) {
                localOverride = cand;
              }
            }
            if (localOverride?.nrp) consumedMemberOvNrps.add(localOverride.nrp);

            let uOverride = mBaseName ? userOvByBaseName.get(mBaseName) : undefined;
            if (uOverride && (!uOverride.nrp || consumedUserOvNrps.has(uOverride.nrp))) {
              uOverride = undefined;
            }
            if (!uOverride) {
              const candU =
                userOverrides[m.nrp] ||
                (m.oldNrp ? userOverrides[m.oldNrp] : undefined) ||
                (localOverride?.nrp ? userOverrides[localOverride.nrp] : undefined);
              if (
                candU &&
                candU.nrp &&
                !consumedUserOvNrps.has(candU.nrp) &&
                (!isAlumniSlot || !candU.nama || getBasePersonName(candU.nama) === mBaseName)
              ) {
                uOverride = candU;
              }
            }
            if (uOverride?.nrp) consumedUserOvNrps.add(uOverride.nrp);

            const canonicalOldNrp =
              (m.id?.startsWith('ws-7409') ? m.id.slice(3) : undefined) ||
              m.oldNrp ||
              localOverride?.oldNrp ||
              uOverride?.oldNrp ||
              m.nrp;

            let baseMember: AnggotaWiraSatya = localOverride
              ? {
                  ...m,
                  ...localOverride,
                  id: m.id,
                  nrp: localOverride.nrp || m.nrp,
                  oldNrp: canonicalOldNrp,
                  fotoUrl: resolveAvatarUrl(localOverride.fotoUrl, m.fotoUrl),
                  coverUrl:
                    localOverride.coverUrl && localOverride.coverUrl !== '/default-cover.jpg'
                      ? localOverride.coverUrl
                      : m.coverUrl || localOverride.coverUrl,
                }
              : m;

            if (uOverride) {
              const memberOvTime = localOverride?.updatedAt ? new Date(localOverride.updatedAt).getTime() : 0;
              const userOvTime = uOverride?.updatedAt ? new Date(uOverride.updatedAt).getTime() : 0;
              const preferLocalMemberOv = Boolean(localOverride && memberOvTime > userOvTime);

              const effectiveNrp = (preferLocalMemberOv ? baseMember.nrp : uOverride.nrp) || baseMember.nrp;
              const effectiveBirth =
                (preferLocalMemberOv ? baseMember.tanggalLahir : uOverride.tanggalLahir) || baseMember.tanggalLahir;
              const calc58 = calculateRetirement58(effectiveBirth || undefined, effectiveNrp);
              const resolvedStatusKedinasan =
                (preferLocalMemberOv
                  ? baseMember.statusKedinasan || uOverride.statusKedinasan
                  : uOverride.statusKedinasan || baseMember.statusKedinasan) || baseMember.statusDinas;
              baseMember = {
                ...baseMember,
                id: m.id,
                nrp: effectiveNrp,
                oldNrp: canonicalOldNrp,
                namaLengkap: (preferLocalMemberOv ? baseMember.namaLengkap : uOverride.nama) || baseMember.namaLengkap,
                pangkat: (preferLocalMemberOv ? baseMember.pangkat : uOverride.pangkat) || baseMember.pangkat,
                satuanKerja: (preferLocalMemberOv ? baseMember.satuanKerja : uOverride.satker) || baseMember.satuanKerja,
                polda: (preferLocalMemberOv ? baseMember.polda : uOverride.polda) || baseMember.polda,
                jabatanTerakhir:
                  (preferLocalMemberOv ? baseMember.jabatanTerakhir : uOverride.jabatanTerakhir) ||
                  baseMember.jabatanTerakhir,
                ...(resolvedStatusKedinasan
                  ? { statusKedinasan: resolvedStatusKedinasan, statusDinas: resolvedStatusKedinasan }
                  : {}),
                tanggalLahir: calc58.tanggalLahir,
                usia: calc58.usiaTahun,
                tahunPurnaTugas: calc58.tahunPurnaTugas,
                sisaTahunDinas: calc58.sisaTahunDinas,
                email: (preferLocalMemberOv ? baseMember.email : uOverride.email) || baseMember.email,
                secondaryEmail:
                  uOverride.secondaryEmail !== undefined ? uOverride.secondaryEmail : baseMember.secondaryEmail,
                noHp: (preferLocalMemberOv ? baseMember.noHp : uOverride.noHp) || baseMember.noHp,
                bio: (preferLocalMemberOv ? baseMember.bio : uOverride.bio) ?? baseMember.bio,
              };
            }

            if (baseMember.jabatanTerakhir === 'Lead Developer') {
              baseMember = { ...baseMember, jabatanTerakhir: 'Staf' };
            }
            const cleanBaseName = stripRankFromName(baseMember.namaLengkap);
            if (cleanBaseName && cleanBaseName !== baseMember.namaLengkap) {
              baseMember = { ...baseMember, namaLengkap: cleanBaseName };
            }

            if (authUser && (baseMember.nrp === authUser.nrp || (authUser.oldNrp && baseMember.nrp === authUser.oldNrp))) {
              const merged: AnggotaWiraSatya = {
                ...baseMember,
                nrp: authUser.nrp || baseMember.nrp,
                pangkat: authUser.pangkat || baseMember.pangkat,
                satuanKerja: authUser.satker || baseMember.satuanKerja,
                polda: authUser.polda || baseMember.polda,
                fotoUrl: resolveAvatarUrl(baseMember.fotoUrl, authUser.fotoUrl),
                coverUrl:
                  baseMember.coverUrl && baseMember.coverUrl !== '/default-cover.jpg'
                    ? baseMember.coverUrl
                    : authUser.coverUrl || baseMember.coverUrl,
              };
              if (
                localOverride ||
                uOverride ||
                (isCustomAvatarUrl(authUser.fotoUrl) &&
                  (!m.fotoUrl || m.fotoUrl === '/default-avatar.png' || !isCustomAvatarUrl(m.fotoUrl)))
              ) {
                fetch('/api/members', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(merged),
                }).catch(() => {});
              }
              return merged;
            }

            if (localOverride || uOverride) {
              const memberChanged =
                baseMember.nrp !== m.nrp ||
                baseMember.namaLengkap !== m.namaLengkap ||
                baseMember.pangkat !== m.pangkat ||
                baseMember.satuanKerja !== m.satuanKerja ||
                baseMember.jabatanTerakhir !== m.jabatanTerakhir;
              if (memberChanged) {
                fetch('/api/members', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(baseMember),
                }).catch(() => {});
              }
              if (uOverride && memberChanged) {
                fetch('/api/users', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...uOverride,
                    nrp: m.nrp,
                    originalNrp: canonicalOldNrp,
                    oldNrp: canonicalOldNrp,
                    newNrp: baseMember.nrp,
                    id: m.id ? m.id.replace(/^ws-/, 'u-') : undefined,
                    profileId: m.id,
                    isBackgroundSync: true,
                  }),
                }).catch(() => {});
              }
            }

            return {
              ...baseMember,
              fotoUrl: getAvatarUrl(baseMember.fotoUrl),
            };
          });

          // Deduplicate sanitizedMembers by NRP and by baseName
          const dedupedMembers: AnggotaWiraSatya[] = [];
          const seenMemberNrps = new Set<string>();
          const seenMemberBaseNames = new Set<string>();
          for (const sm of sanitizedMembers) {
            const cleanNrp = (sm.nrp || '').trim();
            const bName = getBasePersonName(sm.namaLengkap);
            if (!cleanNrp) continue;
            if (seenMemberNrps.has(cleanNrp)) continue;
            if (bName && seenMemberBaseNames.has(bName)) continue;
            seenMemberNrps.add(cleanNrp);
            if (bName) seenMemberBaseNames.add(bName);
            dedupedMembers.push(sm);
          }
          sanitizedMembers = dedupedMembers;

          // Append any locally created members missing from a cold-started serverless instance
          const existingMemberNrps = new Set<string>(seenMemberNrps);
          sanitizedMembers.forEach((sm) => {
            if (sm.oldNrp) existingMemberNrps.add(sm.oldNrp.trim());
            if (sm.id?.startsWith('ws-')) existingMemberNrps.add(sm.id.slice(3).trim());
          });

          Object.values(memberOverrides).forEach((mOv) => {
            if (!mOv || !mOv.nrp || !mOv.namaLengkap) return;
            const cleanNrp = mOv.nrp.trim();
            const cleanOld = (mOv.oldNrp || '').trim();
            const bName = getBasePersonName(mOv.namaLengkap);
            if (consumedMemberOvNrps.has(cleanNrp)) return;
            if (bName && seenMemberBaseNames.has(bName)) return;
            if (isMemberTombstoned(mOv)) return;
            if (!existingMemberNrps.has(cleanNrp) && (!cleanOld || !existingMemberNrps.has(cleanOld))) {
              existingMemberNrps.add(cleanNrp);
              if (bName) seenMemberBaseNames.add(bName);
              sanitizedMembers.unshift({
                ...mOv,
                fotoUrl: getAvatarUrl(mOv.fotoUrl),
              });
              fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mOv),
              }).catch(() => {});
            }
          });

          setMembers(sanitizedMembers);
          setViewingMember((prev) =>
            prev
              ? sanitizedMembers.find((sm: AnggotaWiraSatya) => sm.nrp === prev.nrp || sm.id === prev.id) || null
              : null
          );
          localStorage.setItem('wirasatya96_members', JSON.stringify(sanitizedMembers));
        }
      })
      .catch(() => {});

    fetch('/api/finance')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          let localFin: any = null;
          if (typeof window !== 'undefined') {
            try {
              const rawFin = localStorage.getItem('wirasatya96_finance');
              if (rawFin) localFin = JSON.parse(rawFin);
            } catch {
              localFin = null;
            }
          }
          const serverTrx: KasTransaction[] = Array.isArray(res.data.transactions) ? res.data.transactions : [];
          const localTrx: KasTransaction[] = Array.isArray(localFin?.transactions) ? localFin.transactions : [];
          // If server cold-started with 0 transactions while local browser has saved transactions, keep local & re-sync
          if (serverTrx.length === 0 && localTrx.length > 0) {
            setTransactions(localTrx);
            if (localFin?.summary) setFinanceSummary(localFin.summary);
          } else {
            if (res.data.summary) setFinanceSummary(res.data.summary);
            if (Array.isArray(res.data.transactions)) setTransactions(res.data.transactions);
          }

          const serverAssets: AssetPortfolioItem[] = Array.isArray(res.data.assets) ? res.data.assets : [];
          const localAssets: AssetPortfolioItem[] = Array.isArray(localFin?.assets) ? localFin.assets : [];
          if (serverAssets.length === 0 && localAssets.length > 0) {
            setAssets(localAssets);
          } else if (Array.isArray(res.data.assets)) {
            setAssets(res.data.assets);
          }

          let savedCfg: any = null;
          if (typeof window !== 'undefined') {
            try {
              const rawCfg = localStorage.getItem('ws96_finance_config_v1');
              if (rawCfg) savedCfg = JSON.parse(rawCfg);
              else if (localFin?.financeConfig) savedCfg = localFin.financeConfig;
            } catch {
              savedCfg = null;
            }
          }

          const serverCfg = res.data.financeConfig || res.financeConfig;
          const isServerDefaultCfg =
            !serverCfg || serverCfg.updatedBy === 'Sistem Default Kebendaharaan WS96';
          const hasCustomLocalCfg =
            savedCfg &&
            Number(savedCfg.iuranWajibPerBulan) > 0 &&
            savedCfg.updatedBy &&
            savedCfg.updatedBy !== 'Sistem Default Kebendaharaan WS96';

          const effectiveIuranPerBulan =
            isServerDefaultCfg && hasCustomLocalCfg
              ? Number(savedCfg.iuranWajibPerBulan)
              : Number(serverCfg?.iuranWajibPerBulan) || 250000;

          if (Array.isArray(res.data.iuranList) && res.data.iuranList.length > 0) {
            const annualTarget = effectiveIuranPerBulan * 12;
            const syncedIuran = res.data.iuranList
              .filter(
                (item: IuranAnggota) =>
                  !isSuperadminAccount(item.nrp) && !NON_AKTIF_IURAN_NRPS.has(item.nrp)
              )
              .map((item: IuranAnggota) => {
                const status: IuranAnggota['status'] =
                  item.totalTerbayar >= annualTarget
                    ? 'LUNAS'
                    : item.totalTerbayar > 0
                    ? 'SEBAGIAN'
                    : 'BELUM_BAYAR';
                return { ...item, totalTagihan: annualTarget, status };
              });
            setIuranList(syncedIuran);
          }

          if (isServerDefaultCfg && hasCustomLocalCfg && savedCfg) {
            fetch('/api/finance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'UPDATE_FINANCE_CONFIG',
                actorRole: 'SUPERADMIN',
                iuranWajibPerBulan: savedCfg.iuranWajibPerBulan,
                tahunBuku: savedCfg.tahunBuku,
                subKategoriMasuk: savedCfg.subKategoriMasuk,
                subKategoriKeluar: savedCfg.subKategoriKeluar,
                updatedBy: savedCfg.updatedBy,
              }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load from localStorage or API on initial mount
  useEffect(() => {
    // Non-destructively record storage version and clean legacy rank prefixes & purged non-1996 names in cached overrides
    const currentVersion = localStorage.getItem('ws96_storage_version');
    if (currentVersion !== STORAGE_VERSION) {
      localStorage.removeItem('wirasatya96_members');
      localStorage.removeItem('wirasatya96_finance');
      try {
        const rawDel = localStorage.getItem('ws96_deleted_nrps_v1');
        if (rawDel) {
          const parsedDel: string[] = JSON.parse(rawDel);
          const cleanedDel = parsedDel.filter(
            (n) => String(n).trim() !== '74060709' && String(n).trim() !== '74090168'
          );
          localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(cleanedDel));
        }
        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        if (rawUOv) {
          const parsedUOv = JSON.parse(rawUOv) || {};
          Object.keys(parsedUOv).forEach((k) => {
            const rawNama = parsedUOv[k]?.nama || '';
            const cleanNama = stripRankFromName(rawNama) || rawNama;
            const bName = cleanNama.split(',')[0].trim().toLowerCase();
            if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) {
              delete parsedUOv[k];
            } else if (parsedUOv[k]?.nama) {
              parsedUOv[k].nama = cleanNama;
              if (bName === 'arief adiharsa' && parsedUOv[k]?.oldNrp === '74090168') {
                parsedUOv[k].oldNrp = '74090260';
              }
              const presetMatch = PRESET_USERS.find(
                (pu) => pu.nrp === parsedUOv[k]?.nrp || pu.nrp === k || (pu.oldNrp && pu.oldNrp === k)
              );
              if (presetMatch && presetMatch.role !== 'ANGGOTA' && parsedUOv[k]?.role === 'ANGGOTA') {
                parsedUOv[k].role = presetMatch.role;
              }
            }
          });
          localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
        }
        const rawMOv = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMOv) {
          const parsedMOv = JSON.parse(rawMOv) || {};
          Object.keys(parsedMOv).forEach((k) => {
            const rawNama = parsedMOv[k]?.namaLengkap || '';
            const cleanNama = stripRankFromName(rawNama) || rawNama;
            const bName = cleanNama.split(',')[0].trim().toLowerCase();
            if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) {
              delete parsedMOv[k];
            } else if (parsedMOv[k]?.namaLengkap) {
              parsedMOv[k].namaLengkap = cleanNama;
              if (bName === 'arief adiharsa' && parsedMOv[k]?.oldNrp === '74090168') {
                parsedMOv[k].oldNrp = '74090260';
              }
            }
          });
          localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(parsedMOv));
        }
      } catch {
        // ignore storage parse error
      }
      localStorage.setItem('ws96_storage_version', STORAGE_VERSION);
    }

    // Load Impersonator User if Superadmin is currently impersonating someone
    const savedImpersonator = localStorage.getItem('ws96_impersonator_user');
    if (savedImpersonator) {
      try {
        const parsedImp = JSON.parse(savedImpersonator);
        if (parsedImp && parsedImp.nrp) {
          setImpersonatorUser({
            ...parsedImp,
            fotoUrl: getAvatarUrl(parsedImp.fotoUrl),
          });
        }
      } catch (err) {
        console.error('Failed to parse impersonator session', err);
      }
    }

    // Load User and sanitize any legacy Unsplash avatar URL
    const savedUser =
      localStorage.getItem('ws96_auth_user') ||
      localStorage.getItem('ws96_active_user') ||
      localStorage.getItem('wirasatya96_current_user');
    let activeNrp = PRESET_USERS[0].nrp;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.nrp) {
          activeNrp = parsed.nrp;
          if (
            parsed.nrp === '98010710' &&
            (parsed.nama === 'Eko Agung' || parsed.nama === 'Eko Agung')
          ) {
            parsed.nama = 'Eko Agung';
            parsed.pangkat = parsed.pangkat || 'Briptu';
          }
          if (parsed.nama) {
            parsed.nama = stripRankFromName(parsed.nama) || parsed.nama;
          }
          const presetUserMatch = PRESET_USERS.find(
            (pu) =>
              pu.nrp === parsed.nrp ||
              (pu.oldNrp && pu.oldNrp === parsed.nrp) ||
              (parsed.oldNrp && pu.nrp === parsed.oldNrp) ||
              (pu.id && pu.id === parsed.id)
          );
          if (presetUserMatch && presetUserMatch.role !== 'ANGGOTA' && (!parsed.role || parsed.role === 'ANGGOTA')) {
            parsed.role = presetUserMatch.role;
          }
          if (parsed.nrp && parsed.email && /^74090\d{3}@polri\.go\.id$/i.test(parsed.email) && !/^74090\d{3}$/.test(parsed.nrp)) {
            parsed.email = `${parsed.nrp}@polri.go.id`;
          }
          const sanitizedUser: AuthUser = {
            ...parsed,
            fotoUrl: getAvatarUrl(parsed.fotoUrl),
            coverUrl: parsed.coverUrl,
          };
          setCurrentUser(sanitizedUser);
          localStorage.setItem('ws96_auth_user', JSON.stringify(sanitizedUser));
          localStorage.setItem('ws96_active_user', JSON.stringify(sanitizedUser));
          localStorage.setItem('wirasatya96_current_user', JSON.stringify(sanitizedUser));
        }
      } catch (err) {
        console.error('Failed to parse user session', err);
      }
    }

    // Load Members while respecting tombstoned NRPs & purged non-1996 names
    const rawDeletedOnMount = localStorage.getItem('ws96_deleted_nrps_v1');
    let deletedOnMount = new Set<string>();
    if (rawDeletedOnMount) {
      try {
        const parsedDel: string[] = JSON.parse(rawDeletedOnMount);
        deletedOnMount = new Set(parsedDel.map((n) => String(n).trim()).filter(Boolean));
      } catch {
        deletedOnMount = new Set();
      }
    }

    const savedMembers = localStorage.getItem('wirasatya96_members');
    if (savedMembers) {
      try {
        const parsed = JSON.parse(savedMembers);
        if (Array.isArray(parsed) && parsed.length >= 10) {
          const sanitizedMembers = parsed
            .filter((m: AnggotaWiraSatya) => {
              const bName = (stripRankFromName(m.namaLengkap || '') || m.namaLengkap || '')
                .split(',')[0]
                .trim()
                .toLowerCase();
              if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) return false;
              return (
                !deletedOnMount.has((m.nrp || '').trim()) &&
                !(m.oldNrp && deletedOnMount.has(m.oldNrp.trim()))
              );
            })
            .map((m: AnggotaWiraSatya) => ({
              ...m,
              namaLengkap: stripRankFromName(m.namaLengkap) || m.namaLengkap,
              fotoUrl: getAvatarUrl(m.fotoUrl),
            }));
          setMembers(sanitizedMembers);
        }
      } catch (err) {
        console.error('Failed to parse saved members', err);
      }
    }

    // Load Finance
    const savedFinance = localStorage.getItem('wirasatya96_finance');
    if (savedFinance) {
      try {
        const parsed = JSON.parse(savedFinance);
        if (parsed.summary) setFinanceSummary(parsed.summary);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.assets) setAssets(parsed.assets);
        if (parsed.iuranList && parsed.iuranList.length >= 10) {
          setIuranList(
            parsed.iuranList.filter(
              (i: IuranAnggota) =>
                !deletedOnMount.has((i.nrp || '').trim()) &&
                !isSuperadminAccount(i.nrp) &&
                !NON_AKTIF_IURAN_NRPS.has(i.nrp)
            )
          );
        }
      } catch (err) {
        console.error('Failed to parse saved finance data', err);
      }
    }

    // Load local feed posts first & merge with API store while respecting deleted post IDs
    let deletedPostIds = new Set<string>();
    try {
      const rawDelPosts = localStorage.getItem('ws96_deleted_post_ids_v1');
      if (rawDelPosts) {
        const parsedDelPosts: string[] = JSON.parse(rawDelPosts);
        deletedPostIds = new Set(parsedDelPosts);
      }
    } catch {
      deletedPostIds = new Set();
    }

    let localFeedPosts: FeedPost[] = [];
    try {
      const rawSavedPosts = localStorage.getItem('wirasatya96_feed_posts');
      if (rawSavedPosts) {
        const parsedPosts = JSON.parse(rawSavedPosts);
        if (Array.isArray(parsedPosts) && parsedPosts.length > 0) {
          localFeedPosts = parsedPosts.filter((p: FeedPost) => p && p.id && !deletedPostIds.has(p.id));
          if (localFeedPosts.length > 0) {
            setPosts(localFeedPosts);
          }
        }
      }
    } catch {
      localFeedPosts = [];
    }

    // Refresh feed posts from API store
    fetch('/api/posts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.posts) && data.posts.length > 0) {
          const serverPosts = (data.posts as FeedPost[]).filter(
            (p) => p && p.id && !deletedPostIds.has(p.id)
          );
          const byId = new Map<string, FeedPost>();
          serverPosts.forEach((p) => byId.set(p.id, p));
          // Preserve locally created/edited posts if serverless instance cold-started
          localFeedPosts.forEach((lp) => {
            if (deletedPostIds.has(lp.id)) return;
            const sp = byId.get(lp.id);
            if (!sp) {
              byId.set(lp.id, lp);
            } else if (lp.isEdited || (lp.comments?.length || 0) > (sp.comments?.length || 0) || lp.likesCount !== sp.likesCount) {
              byId.set(lp.id, lp);
            }
          });
          const mergedPosts = Array.from(byId.values());
          setPosts(mergedPosts);
          try {
            localStorage.setItem('wirasatya96_feed_posts', JSON.stringify(mergedPosts));
          } catch {
            // ignore quota error
          }
        }
      })
      .catch(() => {});

    fetchPendingVerificationCount();

    // Refresh messages for active user
    const refreshMessages = () => {
      fetch(`/api/messages?userNrp=${encodeURIComponent(activeNrp)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(() => {});
    };
    refreshMessages();

    const handleUserUpdatedEvent = () => {
      const latestAuth = localStorage.getItem('ws96_auth_user');
      if (latestAuth) {
        try {
          const parsedLatest = JSON.parse(latestAuth);
          if (parsedLatest && parsedLatest.nrp) {
            setCurrentUser({
              ...parsedLatest,
              fotoUrl: getAvatarUrl(parsedLatest.fotoUrl),
            });
          }
        } catch {
          // ignore
        }
      }
    };

    const handleUserDeletedEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ nrps?: string[] }>;
      const nrps = customEvt.detail?.nrps || [];
      if (nrps.length === 0) return;
      const delSet = new Set(nrps.map((n) => String(n).trim()).filter(Boolean));
      setMembers((prev) =>
        prev.filter(
          (m) => !delSet.has((m.nrp || '').trim()) && !(m.oldNrp && delSet.has(m.oldNrp.trim()))
        )
      );
      setIuranList((prev) => prev.filter((i) => !delSet.has((i.nrp || '').trim())));
      setViewingMember((prev) =>
        prev && (delSet.has((prev.nrp || '').trim()) || (prev.oldNrp && delSet.has(prev.oldNrp.trim())))
          ? null
          : prev
      );
    };

    window.addEventListener('ws96_messages_updated', refreshMessages);
    window.addEventListener('ws96_user_updated', handleUserUpdatedEvent);
    window.addEventListener('ws96_user_deleted', handleUserDeletedEvent);
    return () => {
      window.removeEventListener('ws96_messages_updated', refreshMessages);
      window.removeEventListener('ws96_user_updated', handleUserUpdatedEvent);
      window.removeEventListener('ws96_user_deleted', handleUserDeletedEvent);
    };
  }, [fetchPendingVerificationCount]);

  // Superadmin Impersonate User handler
  const handleImpersonateUser = (targetUser: AuthUser) => {
    const sanitizedTarget: AuthUser = {
      ...targetUser,
      fotoUrl: getAvatarUrl(targetUser.fotoUrl),
    };
    if (!impersonatorUser) {
      setImpersonatorUser(currentUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ws96_impersonator_user', JSON.stringify(currentUser));
      }
    }
    setCurrentUser(sanitizedTarget);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ws96_auth_user', JSON.stringify(sanitizedTarget));
      localStorage.setItem('ws96_active_user', JSON.stringify(sanitizedTarget));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(sanitizedTarget));
    }
    setViewingMember(null);
    setEditingMember(null);
    setIsVerificationModalOpen(false);
    setActiveTab('direktori');

    fetch(`/api/messages?userNrp=${encodeURIComponent(sanitizedTarget.nrp)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  };

  // Stop Impersonating and restore Superadmin session
  const handleStopImpersonating = () => {
    if (!impersonatorUser) return;
    const restoredUser: AuthUser = {
      ...impersonatorUser,
      fotoUrl: getAvatarUrl(impersonatorUser.fotoUrl),
    };
    setCurrentUser(restoredUser);
    setImpersonatorUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ws96_impersonator_user');
      localStorage.setItem('ws96_auth_user', JSON.stringify(restoredUser));
      localStorage.setItem('ws96_active_user', JSON.stringify(restoredUser));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(restoredUser));
    }
    setViewingMember(null);
    fetchPendingVerificationCount();
    fetch(`/api/messages?userNrp=${encodeURIComponent(restoredUser.nrp)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  };

  // Start editing a specific member (Admin/Sekretaris, self, or ADC of that Alumni)
  const handleStartEditMember = (member: AnggotaWiraSatya, initialTab: 1 | 2 | 3 | 4 = 1) => {
    const isAdcOfTarget =
      Boolean(currentUser.isAdcAccount && currentUser.adcOfNrp && currentUser.adcOfNrp === member.nrp);
    if (
      !['SUPERADMIN', 'SEKRETARIAT'].includes(currentUser.role) &&
      member.nrp !== currentUser.nrp &&
      !isAdcOfTarget
    ) {
      return;
    }
    setViewingMember(null);
    setEditingInitialTab(initialTab);
    setEditingMember(member);
    setActiveTab('form');
  };

  // Add a new member (Strictly Admin & Sekretaris only)
  const handleAddNewMember = () => {
    if (!['SUPERADMIN', 'SEKRETARIAT'].includes(currentUser.role)) {
      return;
    }
    setViewingMember(null);
    setEditingInitialTab(1);
    setEditingMember('NEW');
    setActiveTab('form');
  };

  // Open direct chat with an alumnus
  const handleOpenChatWithMember = (member: AnggotaWiraSatya) => {
    setViewingMember(null);
    setMessagingTargetMember(member);
    setActiveTab('pesan');
  };

  // Persist member override in localStorage so Vercel cold-starts never wipe user edits
  const persistMemberOverride = (member: AnggotaWiraSatya) => {
    if (typeof window === 'undefined') return;
    try {
      const nowIso = new Date().toISOString();
      const calc58 = calculateRetirement58(member.tanggalLahir, member.nrp);
      const resolvedStatusKedinasan = member.statusKedinasan || member.statusDinas || 'AKTIF';
      const normalizedMember: AnggotaWiraSatya = {
        ...member,
        statusKedinasan: resolvedStatusKedinasan,
        statusDinas: resolvedStatusKedinasan,
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        updatedAt: nowIso,
      };
      const raw = localStorage.getItem('ws96_member_overrides_v1');
      const map: Record<string, AnggotaWiraSatya> = raw ? JSON.parse(raw) : {};
      if (normalizedMember.oldNrp && normalizedMember.oldNrp !== normalizedMember.nrp) {
        delete map[normalizedMember.oldNrp];
      }
      map[normalizedMember.nrp] = normalizedMember;
      localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(map));

      // Also sync ws96_user_overrides_v1 so Manajemen User ("Edit Pengguna") stays 100% consistent
      const rawUserOv = localStorage.getItem('ws96_user_overrides_v1');
      const userMap: Record<string, any> = rawUserOv ? JSON.parse(rawUserOv) : {};
      const existingUOv =
        userMap[normalizedMember.nrp] ||
        (normalizedMember.oldNrp ? userMap[normalizedMember.oldNrp] : undefined) ||
        {};
      if (normalizedMember.oldNrp && normalizedMember.oldNrp !== normalizedMember.nrp) {
        delete userMap[normalizedMember.oldNrp];
      }
      const parentPassword =
        existingUOv.password ||
        (currentUser.nrp === normalizedMember.nrp ? currentUser.password : undefined);

      userMap[normalizedMember.nrp] = {
        ...existingUOv,
        oldNrp: existingUOv.oldNrp || normalizedMember.oldNrp || normalizedMember.nrp,
        nrp: normalizedMember.nrp,
        nama: normalizedMember.namaLengkap,
        pangkat: normalizedMember.pangkat,
        satker: normalizedMember.satuanKerja,
        polda: normalizedMember.polda,
        jabatanTerakhir: normalizedMember.jabatanTerakhir,
        statusKedinasan: resolvedStatusKedinasan,
        tanggalLahir: calc58.tanggalLahir,
        tempatLahir: normalizedMember.tempatLahir,
        email: normalizedMember.email || existingUOv.email || `${normalizedMember.nrp}@polri.go.id`,
        secondaryEmail:
          normalizedMember.secondaryEmail !== undefined
            ? normalizedMember.secondaryEmail
            : existingUOv.secondaryEmail,
        noHp: normalizedMember.noHp || existingUOv.noHp,
        fotoUrl: normalizedMember.fotoUrl,
        bio: normalizedMember.bio !== undefined ? normalizedMember.bio : existingUOv.bio,
        ...(normalizedMember.coverUrl ? { coverUrl: normalizedMember.coverUrl } : {}),
        ...(parentPassword ? { password: parentPassword, status: 'AKTIF' } : {}),
        updatedAt: nowIso,
      };

      // Also auto-generate / sync ADC accounts in ws96_user_overrides_v1 so ADC can login with NRP ADC + Alumni Password
      const activeAdcNrps = new Set<string>();
      if (Array.isArray(normalizedMember.daftarAdc)) {
        normalizedMember.daftarAdc.forEach((adc) => {
          const cleanAdcNrp = (adc.nrp || '').trim();
          if (!cleanAdcNrp || cleanAdcNrp === normalizedMember.nrp) return;
          activeAdcNrps.add(cleanAdcNrp);
          const existingAdcOv = userMap[cleanAdcNrp] || {};
          userMap[cleanAdcNrp] = {
            ...existingAdcOv,
            id: existingAdcOv.id || `u-adc-${cleanAdcNrp}`,
            profileId: normalizedMember.id || `ws-${normalizedMember.nrp}`,
            nrp: cleanAdcNrp,
            nama: (adc.nama || `ADC ${normalizedMember.namaLengkap}`).trim(),
            pangkat: adc.pangkat || 'Briptu',
            role: 'ANGGOTA',
            jabatanTerakhir: 'ADC',
            tanggalLahir: adc.tanggalLahir,
            satker: normalizedMember.satuanKerja,
            polda: normalizedMember.polda,
            email: (adc.email || `${cleanAdcNrp}@polri.go.id`).trim(),
            noHp: adc.noHp || '',
            fotoUrl: existingAdcOv.fotoUrl || '/default-avatar.png',
            isAdcAccount: true,
            adcOfNrp: normalizedMember.nrp,
            adcOfNama: normalizedMember.namaLengkap,
            adcOfPangkat: normalizedMember.pangkat,
            ...(parentPassword ? { password: parentPassword, status: 'AKTIF' } : {}),
            updatedAt: nowIso,
          };
        });
      }

      // Remove obsolete ADC overrides for this Alumni
      Object.keys(userMap).forEach((key) => {
        const item = userMap[key];
        if (
          item?.isAdcAccount &&
          (item.adcOfNrp === normalizedMember.nrp ||
            (normalizedMember.oldNrp && item.adcOfNrp === normalizedMember.oldNrp)) &&
          !activeAdcNrps.has(item.nrp)
        ) {
          delete userMap[key];
        }
      });

      localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(userMap));
    } catch {
      // ignore
    }
  };

  // Synchronize Feed Posts & Comments author metadata when a member's profile changes
  const syncMemberMetadataAcrossFeedAndIuran = (cleanMember: AnggotaWiraSatya, preservedOldNrp?: string) => {
    const memberStatus = cleanMember.statusKedinasan || cleanMember.statusDinas || 'AKTIF';
    setIuranList((prev) => {
      let nextIuran: IuranAnggota[];
      if (memberStatus !== 'AKTIF') {
        nextIuran = prev.filter(
          (i) => i.nrp !== cleanMember.nrp && (!preservedOldNrp || i.nrp !== preservedOldNrp)
        );
      } else {
        nextIuran = prev.map((i) => {
          if (i.nrp === cleanMember.nrp || (preservedOldNrp && i.nrp === preservedOldNrp)) {
            return {
              ...i,
              nrp: cleanMember.nrp,
              namaLengkap: cleanMember.namaLengkap,
              pangkat: cleanMember.pangkat,
              polda: cleanMember.polda,
            };
          }
          return i;
        });
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wirasatya96_iuran', JSON.stringify(nextIuran));
        } catch {
          // ignore
        }
      }
      return nextIuran;
    });

    setPosts((prevPosts) => {
      let changed = false;
      const matchNrp = (nrp?: string) =>
        Boolean(nrp && (nrp === cleanMember.nrp || (preservedOldNrp && nrp === preservedOldNrp)));
      const nextPosts = prevPosts.map((post) => {
        let updatedPost = post;
        if (matchNrp(post.authorNrp)) {
          changed = true;
          updatedPost = {
            ...updatedPost,
            authorNrp: cleanMember.nrp,
            authorName: cleanMember.namaLengkap,
            authorPangkat: cleanMember.pangkat,
            authorJabatan: cleanMember.jabatanTerakhir,
            authorSatker: cleanMember.satuanKerja,
            authorPolda: cleanMember.polda,
            authorAvatar: getAvatarUrl(cleanMember.fotoUrl),
          };
        }
        if (Array.isArray(updatedPost.comments) && updatedPost.comments.length > 0) {
          const nextComments = updatedPost.comments.map((c) => {
            let nextComment = c;
            if (matchNrp(c.authorNrp)) {
              changed = true;
              nextComment = {
                ...nextComment,
                authorNrp: cleanMember.nrp,
                authorName: cleanMember.namaLengkap,
                authorPangkat: cleanMember.pangkat,
                authorAvatar: getAvatarUrl(cleanMember.fotoUrl),
              };
            }
            if (Array.isArray(nextComment.replies) && nextComment.replies.length > 0) {
              const nextReplies = nextComment.replies.map((r) => {
                if (matchNrp(r.authorNrp)) {
                  changed = true;
                  return {
                    ...r,
                    authorNrp: cleanMember.nrp,
                    authorName: cleanMember.namaLengkap,
                    authorPangkat: cleanMember.pangkat,
                    authorAvatar: getAvatarUrl(cleanMember.fotoUrl),
                  };
                }
                return r;
              });
              nextComment = { ...nextComment, replies: nextReplies };
            }
            return nextComment;
          });
          updatedPost = { ...updatedPost, comments: nextComments };
        }
        return updatedPost;
      });
      if (changed && typeof window !== 'undefined') {
        try {
          localStorage.setItem('wirasatya96_posts', JSON.stringify(nextPosts));
        } catch {
          // ignore
        }
      }
      return changed ? nextPosts : prevPosts;
    });
  };

  // Save member profile (supports per-tab partial save with stayInEditor=true or full save with stayInEditor=false)
  const handleSaveMember = async (newMember: AnggotaWiraSatya, stayInEditor: boolean = false) => {
    const prevEditing = editingMember !== 'NEW' && editingMember ? editingMember : null;
    const calc58 = calculateRetirement58(newMember.tanggalLahir, newMember.nrp);
    const preservedOldNrp =
      newMember.oldNrp ||
      prevEditing?.oldNrp ||
      (prevEditing && prevEditing.nrp !== newMember.nrp ? prevEditing.nrp : undefined);
    const resolvedStatus = newMember.statusKedinasan || newMember.statusDinas || 'AKTIF';

    const cleanMember: AnggotaWiraSatya = {
      ...newMember,
      ...(preservedOldNrp ? { oldNrp: preservedOldNrp } : {}),
      statusKedinasan: resolvedStatus,
      statusDinas: resolvedStatus,
      tanggalLahir: calc58.tanggalLahir,
      usia: calc58.usiaTahun,
      tahunPurnaTugas: calc58.tahunPurnaTugas,
      sisaTahunDinas: calc58.sisaTahunDinas,
      fotoUrl: getAvatarUrl(newMember.fotoUrl),
      updatedAt: new Date().toISOString(),
    };
    const existingIndex = members.findIndex(
      (m) =>
        m.nrp === cleanMember.nrp ||
        (preservedOldNrp && m.nrp === preservedOldNrp) ||
        (cleanMember.id && m.id === cleanMember.id)
    );
    let savedMemberRecord: AnggotaWiraSatya;
    let updatedList: AnggotaWiraSatya[];
    if (existingIndex >= 0) {
      savedMemberRecord = {
        ...members[existingIndex],
        ...cleanMember,
        id: members[existingIndex].id || cleanMember.id || ('ws-' + Date.now()),
      };
      updatedList = [...members];
      updatedList[existingIndex] = savedMemberRecord;
    } else {
      savedMemberRecord = {
        ...cleanMember,
        id: cleanMember.id || ('ws-' + Date.now()),
      };
      updatedList = [savedMemberRecord, ...members];
      if (typeof window !== 'undefined') {
        try {
          const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
          if (rawDeleted) {
            const parsedDeleted: string[] = JSON.parse(rawDeleted);
            const nextDeleted = parsedDeleted.filter((n) => n !== savedMemberRecord.nrp);
            localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(nextDeleted));
          }
        } catch {
          // ignore
        }
      }
    }
    setMembers(updatedList);
    persistMemberOverride(savedMemberRecord);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wirasatya96_members', JSON.stringify(updatedList));
    }

    syncMemberMetadataAcrossFeedAndIuran(savedMemberRecord, preservedOldNrp);

    // If the user updated their own profile, sync currentUser as well (including all contact/bio/status fields)
    if (
      savedMemberRecord.nrp === currentUser.nrp ||
      (preservedOldNrp && preservedOldNrp === currentUser.nrp)
    ) {
      const updatedUser: AuthUser = {
        ...currentUser,
        nrp: savedMemberRecord.nrp,
        ...(preservedOldNrp ? { oldNrp: preservedOldNrp } : {}),
        nama: savedMemberRecord.namaLengkap,
        pangkat: savedMemberRecord.pangkat,
        satker: savedMemberRecord.satuanKerja,
        polda: savedMemberRecord.polda,
        jabatanTerakhir: savedMemberRecord.jabatanTerakhir,
        statusKedinasan: resolvedStatus,
        tanggalLahir: savedMemberRecord.tanggalLahir,
        tempatLahir: savedMemberRecord.tempatLahir,
        email: savedMemberRecord.email || currentUser.email,
        secondaryEmail:
          savedMemberRecord.secondaryEmail !== undefined
            ? savedMemberRecord.secondaryEmail
            : currentUser.secondaryEmail,
        noHp: savedMemberRecord.noHp || currentUser.noHp,
        fotoUrl: getAvatarUrl(savedMemberRecord.fotoUrl),
        coverUrl: savedMemberRecord.coverUrl || currentUser.coverUrl,
        bio: savedMemberRecord.bio !== undefined ? savedMemberRecord.bio : currentUser.bio,
      };
      setCurrentUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ws96_auth_user', JSON.stringify(updatedUser));
        localStorage.setItem('ws96_active_user', JSON.stringify(updatedUser));
        localStorage.setItem('wirasatya96_current_user', JSON.stringify(updatedUser));
      }
    }

    if (stayInEditor) {
      if (editingMember !== null) {
        setEditingMember(savedMemberRecord);
      }
      if (viewingMember && (viewingMember.nrp === savedMemberRecord.nrp || viewingMember.id === savedMemberRecord.id)) {
        setViewingMember(savedMemberRecord);
      }
    } else {
      setEditingMember(null);
      setViewingMember(savedMemberRecord);
      setActiveTab('direktori');
    }

    if (getActiveAdcSessionFromStorage()) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: `Menyimpan pembaruan profil & data kedinasan Pimpinan ${savedMemberRecord.pangkat} ${savedMemberRecord.namaLengkap}`,
      });
    }

    // Try sync with API (/api/members & /api/users)
    try {
      await fetch('/api/members', {
        method: existingIndex >= 0 ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedMemberRecord),
      });
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: savedMemberRecord.nrp,
          oldNrp: preservedOldNrp || savedMemberRecord.oldNrp || savedMemberRecord.nrp,
          nama: savedMemberRecord.namaLengkap,
          pangkat: savedMemberRecord.pangkat,
          satker: savedMemberRecord.satuanKerja,
          polda: savedMemberRecord.polda,
          jabatanTerakhir: savedMemberRecord.jabatanTerakhir,
          statusKedinasan: resolvedStatus,
          tanggalLahir: savedMemberRecord.tanggalLahir,
          tempatLahir: savedMemberRecord.tempatLahir,
          email: savedMemberRecord.email,
          secondaryEmail: savedMemberRecord.secondaryEmail,
          noHp: savedMemberRecord.noHp,
          fotoUrl: savedMemberRecord.fotoUrl,
          coverUrl: savedMemberRecord.coverUrl,
          bio: savedMemberRecord.bio,
        }),
      }).catch(() => {});
    } catch (err) {
      console.log('Saved to local storage, API sync skipped', err);
    }
  };

  // Add new cash transaction (BENDAHARA & SUPERADMIN)
  const handleAddTransaction = async (trxData: Omit<KasTransaction, 'id' | 'createdAt'>) => {
    if (currentUser.role !== 'BENDAHARA' && currentUser.role !== 'SUPERADMIN') return;

    const newTrx: KasTransaction = {
      ...trxData,
      id: 'trx-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    const updatedTrxList = [newTrx, ...transactions];
    setTransactions(updatedTrxList);

    // Update balances
    const updatedSummary = { ...financeSummary };
    if (newTrx.jenis === 'MASUK') {
      updatedSummary.saldoUtama += newTrx.nominal;
      updatedSummary.totalPemasukanBulanIni += newTrx.nominal;
      if (newTrx.kategori === 'SANTUNAN_KESEHATAN' || newTrx.kategori === 'SUMBANGAN_SUKARELA') {
        updatedSummary.kasSosialKesehatan += newTrx.nominal;
      }
    } else {
      updatedSummary.saldoUtama -= newTrx.nominal;
      updatedSummary.totalPengeluaranBulanIni += newTrx.nominal;
      if (newTrx.kategori === 'SANTUNAN_KESEHATAN') {
        updatedSummary.kasSosialKesehatan -= newTrx.nominal;
      } else if (newTrx.kategori === 'SANTUNAN_DUKA_CITA') {
        updatedSummary.kasDukaCita -= newTrx.nominal;
      }
    }
    setFinanceSummary(updatedSummary);

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'wirasatya96_finance',
        JSON.stringify({ summary: updatedSummary, transactions: updatedTrxList, assets, iuranList })
      );
    }

    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trxData, actorRole: currentUser.role }),
      });
    } catch (err) {
      console.log('Saved to local storage, API sync skipped', err);
    }
  };

  // Add new portfolio asset (BENDAHARA & SUPERADMIN)
  const handleAddAsset = async (assetData: Omit<AssetPortfolioItem, 'id' | 'updatedAt'>) => {
    if (currentUser.role !== 'BENDAHARA' && currentUser.role !== 'SUPERADMIN') return;

    const newAsset: AssetPortfolioItem = {
      ...assetData,
      id: 'ast-' + Date.now(),
      updatedAt: new Date().toISOString(),
    };
    const updatedAssets = [newAsset, ...assets];
    setAssets(updatedAssets);

    const totalValuasiAset = updatedAssets.reduce((sum, a) => sum + (Number(a.estimasiNilaiIdr) || 0), 0);
    const updatedSummary: FinanceSummary = {
      ...financeSummary,
      totalValuasiAset,
      danaAbadiInvestasi: totalValuasiAset,
    };
    setFinanceSummary(updatedSummary);

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'wirasatya96_finance',
        JSON.stringify({ summary: updatedSummary, transactions, assets: updatedAssets, iuranList })
      );
    }

    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_ASSET', actorRole: currentUser.role, ...assetData }),
      });
    } catch (err) {
      console.log('Saved asset to local storage, API sync skipped', err);
    }
  };

  // Delete portfolio asset (BENDAHARA & SUPERADMIN)
  const handleDeleteAsset = async (id: string) => {
    if (currentUser.role !== 'BENDAHARA' && currentUser.role !== 'SUPERADMIN') return;

    const updatedAssets = assets.filter((a) => a.id !== id);
    setAssets(updatedAssets);

    const totalValuasiAset = updatedAssets.reduce((sum, a) => sum + (Number(a.estimasiNilaiIdr) || 0), 0);
    const updatedSummary: FinanceSummary = {
      ...financeSummary,
      totalValuasiAset,
      danaAbadiInvestasi: totalValuasiAset,
    };
    setFinanceSummary(updatedSummary);

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'wirasatya96_finance',
        JSON.stringify({ summary: updatedSummary, transactions, assets: updatedAssets, iuranList })
      );
    }

    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_ASSET', actorRole: currentUser.role, id }),
      });
    } catch (err) {
      console.log('Deleted asset in local storage', err);
    }
  };

  // Pay membership dues (BENDAHARA & SUPERADMIN)
  const handlePayIuran = async (nrp: string, nominal: number) => {
    if (currentUser.role !== 'BENDAHARA' && currentUser.role !== 'SUPERADMIN') return;

    const updatedList = iuranList.map((i) => {
      if (i.nrp === nrp) {
        const nextTerbayar = i.totalTerbayar + nominal;
        return {
          ...i,
          totalTerbayar: nextTerbayar,
          terakhirBayar: new Date().toISOString().split('T')[0],
          status: (nextTerbayar >= i.totalTagihan ? 'LUNAS' : 'SEBAGIAN') as 'LUNAS' | 'SEBAGIAN',
          bulanTerbayar: nextTerbayar >= i.totalTagihan ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : i.bulanTerbayar,
        };
      }
      return i;
    });
    setIuranList(updatedList);

    const target = iuranList.find((i) => i.nrp === nrp);
    handleAddTransaction({
      nomorReferensi: 'WS96-IUR-' + Date.now().toString().slice(-4),
      tanggal: new Date().toISOString().split('T')[0],
      jenis: 'MASUK',
      kategori: 'IURAN_WAJIB_BULANAN',
      nominal: nominal,
      keterangan: `Pembayaran Iuran Wajib Leting oleh ${target?.namaLengkap || nrp}`,
      pihakTerkait: target?.namaLengkap || nrp,
      nrpTerkait: nrp,
      dicatatOleh: currentUser.nama,
    });

    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PAY_IURAN', actorRole: currentUser.role, nrp, nominal, dicatatOleh: currentUser.nama }),
      });
    } catch (err) {
      console.log('Saved to local storage, API sync skipped', err);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('ws96_auth_user');
    localStorage.removeItem('ws96_active_user');
    localStorage.removeItem('wirasatya96_current_user');
    localStorage.removeItem('ws96_impersonator_user');
    localStorage.removeItem('ws96_mfa_verified');
    localStorage.removeItem('ws96_adc_session');
    router.push('/login');
  };

  // Find or construct logged-in user profile
  const currentMemberProfile = React.useMemo(
    () => getOrBuildUserProfile(currentUser, members),
    [currentUser, members]
  );

  // Compute live unread messages & notifications count for Navbar
  const unreadMessagesCount = React.useMemo(
    () => messages.filter((m) => m.receiverNrp === currentUser.nrp && !m.isRead).length,
    [messages, currentUser.nrp]
  );

  const unreadNotificationsCount = React.useMemo(() => {
    const healthCount = members.filter(
      (m) =>
        !isSuperadminAccount(m.nrp, (m as { role?: string }).role) &&
        (m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' || m.kondisiKesehatan === 'SAKIT')
    ).length;
    const verifCount =
      currentUser.role === 'SUPERADMIN' || currentUser.role === 'SEKRETARIAT'
        ? pendingVerificationCount
        : 0;
    return healthCount + verifCount + unreadMessagesCount;
  }, [members, currentUser.role, pendingVerificationCount, unreadMessagesCount]);

  // Synchronized live notifications for the top running-text ticker
  const liveTickerNotifications = React.useMemo(() => {
    const items: { id: string; badge: string; text: string; onClick: () => void }[] = [];

    // 1. Pending Verification Alert for Admin & Sekretaris
    if (
      (currentUser.role === 'SUPERADMIN' || currentUser.role === 'SEKRETARIAT') &&
      pendingVerificationCount > 0
    ) {
      items.push({
        id: `ticker-verif-${pendingVerificationCount}`,
        badge: '[Verifikasi User]',
        text: `${pendingVerificationCount} pendaftar baru menunggu persetujuan di menu User`,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('users');
        },
      });
    }

    // 2. Incoming Direct Messages
    const incomingMsgs = messages
      .filter((m) => m.receiverNrp === currentUser.nrp)
      .slice(-3)
      .reverse();
    incomingMsgs.forEach((msg) => {
      items.push({
        id: `ticker-msg-${msg.id}`,
        badge: `[Pesan Masuk • ${msg.senderName}]`,
        text: `"${msg.text}"`,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('pesan');
        },
      });
    });

    // 3. Health Attention Alerts
    const healthMembers = members.filter(
      (m) =>
        !isSuperadminAccount(m.nrp, (m as { role?: string }).role) &&
        (m.kondisiKesehatan === 'PERLU PERHATIAN KHUSUS' ||
          m.kondisiKesehatan === 'SAKIT' ||
          m.adaPenyakitKronis === 'ADA' ||
          (m.daftarPenyakit && m.daftarPenyakit.length > 0))
    );
    healthMembers.forEach((m) => {
      const diagnosa =
        m.daftarPenyakit && m.daftarPenyakit.length > 0
          ? m.daftarPenyakit.join(', ')
          : m.kondisiKesehatan;
      items.push({
        id: `ticker-health-${m.nrp}`,
        badge: '[Atensi Kesehatan]',
        text: `${m.namaLengkap} (${m.polda}) — ${diagnosa}`,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('notifikasi');
        },
      });
    });

    // 4. Recent Treasury Cashflow Transactions
    transactions.slice(0, 4).forEach((trx) => {
      const rp = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(trx.nominal || 0);
      items.push({
        id: `ticker-trx-${trx.id}`,
        badge: trx.jenis === 'MASUK' ? '[Kas Masuk]' : '[Kas Keluar]',
        text: `${rp} — ${trx.keterangan} (${trx.tanggal})`,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('bendahara');
        },
      });
    });

    // 5. Recent Portfolio Assets
    assets.slice(0, 2).forEach((ast) => {
      items.push({
        id: `ticker-ast-${ast.id}`,
        badge: '[Portofolio Aset]',
        text: `${ast.namaAset} (${ast.jumlahUnit} ${ast.satuan})`,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('bendahara');
        },
      });
    });

    // 6. Recent Feed Posts
    posts.slice(0, 3).forEach((post) => {
      const snippet = post.content.length > 70 ? `${post.content.slice(0, 70)}...` : post.content;
      items.push({
        id: `ticker-post-${post.id}`,
        badge: `[Linimasa • ${post.authorName}]`,
        text: snippet,
        onClick: () => {
          setViewingMember(null);
          setActiveTab('direktori');
        },
      });
    });

    if (items.length === 0) {
      items.push({
        id: 'ticker-empty',
        badge: '[Notifikasi]',
        text: 'Belum ada notifikasi baru saat ini — Klik untuk membuka pusat Notifikasi',
        onClick: () => {
          setViewingMember(null);
          setActiveTab('notifikasi');
        },
      });
    }

    return items;
  }, [
    currentUser.role,
    currentUser.nrp,
    pendingVerificationCount,
    messages,
    members,
    transactions,
    assets,
    posts,
  ]);

  // Update active member's jabatan & satker when a new mutation is recorded in Menu Jabatan
  const handleUpdateMemberJabatan = async (
    nrp: string,
    jabatanBaru: string,
    satkerBaru: string,
    poldaBaru: string
  ) => {
    const target = members.find((m) => m.nrp === nrp);
    if (!target) return;
    const updatedMember: AnggotaWiraSatya = {
      ...target,
      jabatanTerakhir: jabatanBaru,
      satuanKerja: satkerBaru,
      polda: poldaBaru,
      updatedAt: new Date().toISOString(),
    };
    const updatedList = members.map((m) => (m.nrp === nrp ? updatedMember : m));
    setMembers(updatedList);
    persistMemberOverride(updatedMember);
    syncMemberMetadataAcrossFeedAndIuran(updatedMember, target.oldNrp);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wirasatya96_members', JSON.stringify(updatedList));
    }
    if (nrp === currentUser.nrp) {
      const nextUser: AuthUser = {
        ...currentUser,
        jabatanTerakhir: jabatanBaru,
        satker: satkerBaru,
        polda: poldaBaru,
      };
      setCurrentUser(nextUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ws96_auth_user', JSON.stringify(nextUser));
        localStorage.setItem('ws96_active_user', JSON.stringify(nextUser));
        localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextUser));
      }
    }
    if (getActiveAdcSessionFromStorage()) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: `Memperbarui jabatan Pimpinan menjadi ${jabatanBaru} pada ${satkerBaru} (${poldaBaru})`,
      });
    }
    try {
      await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMember),
      });
    } catch {
      // ignore
    }
  };

  // Smooth Scroll-Reveal & Staggered Card Entrance Observer
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.add('ws96-reveal-visible');
            el.classList.remove('ws96-reveal-init');
            el.style.transitionDelay = '';
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.01, rootMargin: '24px 0px 0px 0px' }
    );

    const registerCards = () => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return;
      const cards = mainEl.querySelectorAll<HTMLElement>(
        '.bg-white.rounded-xl, .bg-white.rounded-2xl, .ws96-gold-card'
      );
      cards.forEach((card, idx) => {
        if (card.dataset.ws96RevealBound) return;
        card.dataset.ws96RevealBound = '1';
        if (card.closest('[data-no-reveal="true"]') || card.offsetHeight > 900) {
          return;
        }
        card.style.transitionDelay = `${(idx % 5) * 35}ms`;
        card.classList.add('ws96-reveal-init');
        io.observe(card);
      });
    };

    registerCards();
    const mainNode = document.querySelector('main');
    const mo = mainNode
      ? new MutationObserver(() => {
          registerCards();
        })
      : null;
    if (mainNode && mo) {
      mo.observe(mainNode, { childList: true });
    }

    return () => {
      io.disconnect();
      mo?.disconnect();
    };
  }, [activeTab, viewingMember]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f2ee] selection:bg-red-800 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setViewingMember(null);
          if (tab !== 'form') {
            setEditingMember(null);
          }
          setActiveTab(tab);
        }}
        totalMembers={members.filter((m) => !isSuperadminAccount(m.nrp, (m as { role?: string }).role)).length}
        currentUser={currentUser}
        members={members}
        onSelectMember={(m) => setViewingMember(m)}
        onOpenChat={handleOpenChatWithMember}
        onOpenVerificationModal={() => {
          setViewingMember(null);
          setActiveTab('users');
        }}
        pendingVerificationCount={pendingVerificationCount}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        onLogout={handleLogout}
        onSearchChange={setNavbarSearchQuery}
        onViewMyProfile={() => {
          const myProfile = getOrBuildUserProfile(currentUser, members);
          setViewingMember(myProfile);
        }}
        impersonatorUser={impersonatorUser}
        onStopImpersonating={handleStopImpersonating}
      />

      {/* Top Red Ribbon: [Live Sync & Redis Cache Beacon] Online/Offline | Running Text Notifikasi */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b border-red-900/40 text-slate-200 text-xs py-1.5 px-3 sm:px-6 relative z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-[11px]">
          {/* Left: Interactive Lamp Beacon + Online/Offline Sync Status */}
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 shrink-0 hover:opacity-90 transition cursor-pointer"
            title="Klik untuk membuka status Redis Cache & Mode Offline Tersinkronisasi"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOnlineStatus ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isOnlineStatus
                    ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                    : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                }`}
              />
            </span>
            <span
              className={`font-extrabold tracking-wide ${
                isOnlineStatus ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {isOnlineStatus ? 'Online' : 'Mode Offline'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                {pendingSyncCount} Sync
              </span>
            )}
          </button>

          {/* Divider | */}
          <span className="text-red-400/50 font-bold shrink-0 select-none">|</span>

          {/* Right: Synchronized Notification Running Text */}
          <div className="flex-1 overflow-hidden relative">
            <div className="ws96-marquee items-center gap-8 whitespace-nowrap">
              {[...liveTickerNotifications, ...liveTickerNotifications].map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={item.onClick}
                  className="inline-flex items-center gap-1.5 text-slate-200 hover:text-amber-300 transition-colors cursor-pointer text-[11px]"
                  title="Klik untuk membuka detail notifikasi"
                >
                  <span className="font-bold text-amber-300">{item.badge}</span>
                  <span>{item.text}</span>
                  <span className="text-red-400/50 mx-3 select-none">&bull;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Offline Sync Alert Bar & Redis Cache Telemetry Modal */}
      <OfflineSyncBanner
        onSyncCompleted={fetchPendingVerificationCount}
        isModalOpenExternal={isSyncModalOpen}
        onCloseModalExternal={() => setIsSyncModalOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 pb-24 md:pb-6">
        <div key={`${activeTab}-${viewingMember?.nrp || 'main'}`} className="ws96-tab-enter">
        {/* VIEWING SPECIFIC PROFILE (VIA NAVBAR SAYA / CONNECTION CARDS) */}
        {viewingMember ? (
          <LinkedInProfileView
            member={viewingMember}
            currentUser={currentUser}
            memberRole={viewingMember.nrp === currentUser.nrp ? currentUser.role : undefined}
            onClose={() => setViewingMember(null)}
            onEditProfile={(targetMember, initialTab) => {
              handleStartEditMember(targetMember || viewingMember, initialTab || 1);
            }}
            onOpenChat={handleOpenChatWithMember}
            allMembers={members}
            onSelectMember={(m) => setViewingMember(m)}
            onUpdateMemberDirect={(updated) => {
              handleSaveMember(updated, true);
              setViewingMember(updated);
            }}
          />
        ) : (
          <>
            {/* TAB 1: FEED BERANDA */}
            {activeTab === 'direktori' && (
              <BukuSaku
                members={members}
                onAddNew={handleAddNewMember}
                currentUser={currentUser}
                onEditMember={handleStartEditMember}
                onUpdateMemberDirect={(updated) => {
                  handleSaveMember(updated, true);
                }}
                onOpenChat={handleOpenChatWithMember}
                onNavigateToJabatan={() => setActiveTab('purnaTugas')}
                onNavigateToBendahara={() => setActiveTab('bendahara')}
                onNavigateToUsers={() => setActiveTab('users')}
                onNavigateToHealth={() =>
                  setActiveTab(currentUser.role !== 'ANGGOTA' ? 'dashboard' : 'notifikasi')
                }
                financeSummary={financeSummary}
                transactions={transactions}
                iuranList={iuranList}
                externalPosts={posts}
                onPostsChange={setPosts}
                externalSearch={navbarSearchQuery}
                impersonatorUser={impersonatorUser}
                onStopImpersonating={handleStopImpersonating}
                onImpersonateUser={handleImpersonateUser}
              />
            )}

            {/* TAB 2: RIWAYAT JABATAN & PENUGASAN LETING 96 */}
            {activeTab === 'purnaTugas' && (
              <LinkedInJobsPage
                currentUser={currentUser}
                members={members}
                onOpenFormWizard={() => handleStartEditMember(currentMemberProfile, 1)}
                onSelectMember={(m) => setViewingMember(m)}
                onOpenChat={handleOpenChatWithMember}
                onUpdateMemberJabatan={handleUpdateMemberJabatan}
              />
            )}

            {/* TAB 4: PESAN & OBROLAN LETING (MESSAGING) */}
            {activeTab === 'pesan' && (
              <LinkedInMessagingPage
                currentUser={currentUser}
                members={members}
                initialTargetMember={messagingTargetMember}
                onSelectMember={(m) => setViewingMember(m)}
              />
            )}

            {/* TAB 5: NOTIFIKASI ANGKATAN (NOTIFICATIONS) */}
            {activeTab === 'notifikasi' && (
              <LinkedInNotificationsPage
                currentUser={currentUser}
                members={members}
                transactions={transactions}
                assets={assets}
                posts={posts}
                messages={messages}
                pendingVerificationCount={pendingVerificationCount}
                onNavigateToTab={(t) => {
                  setViewingMember(null);
                  setActiveTab(t as AppTab);
                }}
                onViewMyProfile={() => {
                  setViewingMember(getOrBuildUserProfile(currentUser, members));
                }}
                onSelectMember={(m) => setViewingMember(m)}
                onOpenVerificationModal={() => {
                  setViewingMember(null);
                  setActiveTab('users');
                }}
              />
            )}

            {/* TAB 6: DATA MANDIRI / PROFIL */}
            {activeTab === 'form' && (
              <FormWizard
                currentUser={currentUser}
                initialTab={editingInitialTab}
                existingMember={
                  editingMember === 'NEW'
                    ? undefined
                    : editingMember !== null
                    ? editingMember
                    : currentMemberProfile
                }
                onSave={(updatedMember) => handleSaveMember(updatedMember, false)}
                onSaveTab={(updatedMember, _tabNum, stayOpen) =>
                  handleSaveMember(updatedMember, Boolean(stayOpen))
                }
                onCancel={() => {
                  const targetToView =
                    editingMember && editingMember !== 'NEW' ? editingMember : currentMemberProfile;
                  setEditingMember(null);
                  if (targetToView) {
                    setViewingMember(targetToView);
                  }
                  setActiveTab('direktori');
                }}
              />
            )}

            {/* TAB 7: PORTAL KEBENDAHARAAN & PORTOFOLIO ASET */}
            {activeTab === 'bendahara' && (
              <BendaharaPortal
                currentUser={currentUser}
                members={members}
                financeSummary={financeSummary}
                transactions={transactions}
                assets={assets}
                iuranList={iuranList}
                onAddTransaction={handleAddTransaction}
                onPayIuran={handlePayIuran}
                onAddAsset={handleAddAsset}
                onDeleteAsset={handleDeleteAsset}
              />
            )}

            {/* TAB 8: EKSEKUTIF & SEKRETARIS */}
            {activeTab === 'dashboard' && currentUser.role !== 'ANGGOTA' && (
              <ExecutiveDashboard
                members={members}
                currentUser={currentUser}
              />
            )}

            {/* TAB 9: PENGATURAN & PRIVASI (FIDO2 / PASSKEY / KEAMANAN) */}
            {activeTab === 'pengaturan' && (
              <LinkedInSettingsPage
                currentUser={currentUser}
                onClose={() => setActiveTab('direktori')}
                onNavigateToTab={(t) => {
                  setViewingMember(null);
                  setActiveTab(t as AppTab);
                }}
              />
            )}

            {/* TAB 10: MANAJEMEN USER (FULL-PAGE VIEW) */}
            {activeTab === 'users' && (
              <AdminVerificationModal
                isOpen={true}
                asPage={true}
                onClose={() => setActiveTab('direktori')}
                adminName={currentUser.nama}
                currentUserRole={currentUser?.role}
                currentUserNrp={currentUser?.nrp}
                onImpersonateUser={handleImpersonateUser}
                onOpenFullWizard={handleAddNewMember}
                onEditMemberByNrp={(nrp) => {
                  const found = members.find((m) => m.nrp === nrp);
                  if (found) {
                    handleStartEditMember(found, 1);
                  }
                }}
                onMemberSynced={(synced) => {
                  const target = members.find(
                    (m) =>
                      (synced.nrp && (m.nrp === synced.nrp || m.oldNrp === synced.nrp)) ||
                      (synced.oldNrp && (m.nrp === synced.oldNrp || m.oldNrp === synced.oldNrp)) ||
                      (synced.id && m.id === synced.id)
                  );
                  if (target) {
                    handleSaveMember(
                      {
                        ...target,
                        ...synced,
                        namaLengkap: synced.namaLengkap || synced.name || target.namaLengkap,
                        satuanKerja: synced.satuanKerja || synced.satker || target.satuanKerja,
                      } as AnggotaWiraSatya,
                      true
                    );
                  }
                  fetchPendingVerificationCount();
                }}
                onVerificationUpdate={fetchPendingVerificationCount}
              />
            )}
          </>
        )}
        </div>
      </main>

      {/* Manajemen Pengguna & Verifikasi Modal (Fallback if opened as modal when not on 'users' tab) */}
      {activeTab !== 'users' && isVerificationModalOpen && (
        <AdminVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          adminName={currentUser.nama}
          currentUserRole={currentUser?.role}
          currentUserNrp={currentUser?.nrp}
          onImpersonateUser={handleImpersonateUser}
          onOpenFullWizard={handleAddNewMember}
          onEditMemberByNrp={(nrp) => {
            const found = members.find((m) => m.nrp === nrp);
            if (found) {
              handleStartEditMember(found, 1);
            }
          }}
          onMemberSynced={(synced) => {
            const target = members.find(
              (m) =>
                (synced.nrp && (m.nrp === synced.nrp || m.oldNrp === synced.nrp)) ||
                (synced.oldNrp && (m.nrp === synced.oldNrp || m.oldNrp === synced.oldNrp)) ||
                (synced.id && m.id === synced.id)
            );
            if (target) {
              handleSaveMember(
                {
                  ...target,
                  ...synced,
                  namaLengkap: synced.namaLengkap || synced.name || target.namaLengkap,
                  satuanKerja: synced.satuanKerja || synced.satker || target.satuanKerja,
                } as AnggotaWiraSatya,
                true
              );
            }
            fetchPendingVerificationCount();
          }}
          onVerificationUpdate={fetchPendingVerificationCount}
        />
      )}

      {/* Alumnus Registration Modal */}
      <RegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={fetchPendingVerificationCount}
      />

      {/* Floating Messenger Launcher & Pop-up Module at Bottom Right */}
      {activeTab !== 'pesan' && (
        <LinkedInChatDock
          members={members}
          currentUserName={currentUser.nama}
          currentUserNrp={currentUser.nrp}
          onOpenFullMessaging={() => {
            setViewingMember(null);
            setActiveTab('pesan');
          }}
        />
      )}
    </div>
  );
}
