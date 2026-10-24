'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AnggotaWiraSatya,
  AuthUser,
  PendingRegistration,
  UserAccountStatus,
  UserRole,
  UserAuditLog,
  UserAuditAction,
  DAFTAR_PANGKAT_POLRI,
  StatusKedinasan,
} from '@/types';
import { ROLE_PERMISSIONS, PRESET_USERS } from '@/data/mockUsers';
import { PURGED_NON_1996_BASE_NAMES, AKPOL_1996_MEMBERS } from '@/data/akpol1996Alumni';
import { SatkerBerjenjangModal, SatkerSelectionResult } from './SatkerBerjenjangModal';
import { SortModalPopup, SortTriggerBar, UnifiedSortKey } from './SortModalPopup';
import { MetaVerifiedBadge, setDynamicRoleMap, updateDynamicUserRole } from './MetaVerifiedBadge';
import { UserTableSkeleton } from './SkeletonLoader';
import {
  getJabatanGroupsForPangkat,
  isStandardPolriJabatan,
  isOfficerRankIpdaUp,
  EXTERNAL_JABATAN_SENTINEL,
} from '@/data/polriJabatan';
import {
  calculateRetirement58,
  deriveBirthDateFromNrp,
  RETIREMENT_AGE_POLRI,
  stripRankFromName,
  getPangkatRankOrder,
  getLevelSatkerOrder,
  getRoleRankOrder,
  detectStatusKedinasan,
  getStatusKedinasanOrder,
} from '@/lib/avatarUtils';
import { 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Search, 
  RotateCw,
  Phone,
  Mail,
  Building2,
  Clock,
  AlertCircle,
  Users,
  UserPlus,
  Trash2,
  FilePlus2,
  KeyRound,
  Pencil,
  Lock,
  Eye,
  EyeOff,
  IdCard,
  Check,
  Info,
  History,
  RotateCcw,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';

interface AdminVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminName: string;
  onVerificationUpdate?: () => void;
  onOpenFullWizard?: () => void;
  onEditMemberByNrp?: (nrp: string) => void;
  onMemberSynced?: (updatedFields: Partial<AnggotaWiraSatya> & { nrp?: string; id?: string; name?: string }) => void;
  initialTab?: 'USERS' | 'VERIFICATION' | 'AUDIT_LOG' | 'ADD_USER';
  asPage?: boolean;
  currentUserRole?: UserRole;
  currentUserNrp?: string;
  onImpersonateUser?: (user: AuthUser) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ANGGOTA', label: 'Anggota (Alumni Wira Satya 96 / ADC)' },
  { value: 'SEKRETARIAT', label: 'Sekretaris (Admin Data & User)' },
  { value: 'BENDAHARA', label: 'Bendahara (Pengelola Kas & Aset)' },
  { value: 'KETUA', label: 'Ketua Paguyuban (Pengurus Pusat)' },
  { value: 'SUPERADMIN', label: 'Superadmin (Administrator Sistem)' },
];

const DELETE_REASON_PRESETS = [
  'Akun duplikat / ganda',
  'Bukan personel terdaftar Wira Satya 96',
  'Penonaktifan akun ADC / staf pendamping',
  'Permintaan koreksi data personel',
];

const PANGKAT_OPTIONS = [...DAFTAR_PANGKAT_POLRI];

const getFastBasePersonName = (rawName?: string): string =>
  (stripRankFromName(rawName || '') || rawName || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

// Pre-index AKPOL_1996_MEMBERS once at module load for O(1) lookups (instead of .find() per user/sort)
const AKPOL_MEMBER_BY_NRP = new Map<string, AnggotaWiraSatya>();
const AKPOL_MEMBER_BY_BASENAME = new Map<string, AnggotaWiraSatya>();
AKPOL_1996_MEMBERS.forEach((m) => {
  if (m.nrp) AKPOL_MEMBER_BY_NRP.set(m.nrp.trim(), m);
  if (m.oldNrp) AKPOL_MEMBER_BY_NRP.set(m.oldNrp.trim(), m);
  const bName = getFastBasePersonName(m.namaLengkap);
  if (bName && !AKPOL_MEMBER_BY_BASENAME.has(bName)) {
    AKPOL_MEMBER_BY_BASENAME.set(bName, m);
  }
});

let cachedUsersInMemory: AuthUser[] | null = null;
const backgroundSyncedOverrideKeys = new Set<string>();

function getInitialInstantUsers(): AuthUser[] {
  if (cachedUsersInMemory && cachedUsersInMemory.length > 0) {
    return cachedUsersInMemory;
  }
  const initial = PRESET_USERS.filter((u) => {
    const bName = getFastBasePersonName(u.nama);
    return !bName || !PURGED_NON_1996_BASE_NAMES.has(bName);
  });
  return initial;
}

export const AdminVerificationModal: React.FC<AdminVerificationModalProps> = ({
  isOpen,
  onClose,
  adminName,
  onVerificationUpdate,
  onOpenFullWizard,
  onEditMemberByNrp,
  onMemberSynced,
  initialTab = 'USERS',
  asPage = false,
  currentUserRole,
  currentUserNrp,
  onImpersonateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'VERIFICATION' | 'AUDIT_LOG' | 'ADD_USER'>(initialTab);
  const initializedRef = useRef(false);
  const prevInitialTabRef = useRef(initialTab);
  const [users, setUsers] = useState<AuthUser[]>(getInitialInstantUsers);
  const [visibleUserLimit, setVisibleUserLimit] = useState<number>(45);
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserAuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState<'ALL' | UserAuditAction>('ALL');
  const [restoringLogId, setRestoringLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Delete Confirmation Modal State
  const [userPendingDelete, setUserPendingDelete] = useState<AuthUser | null>(null);
  const [deleteReason, setDeleteReason] = useState('Akun duplikat / ganda');
  const [isDeletingConfirmed, setIsDeletingConfirmed] = useState(false);

  // Filters & Sorting for Users tab
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [sortBy, setSortBy] = useState<UnifiedSortKey>('DEFAULT');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [isSortModalOpen, setIsSortModalOpen] = useState<boolean>(false);
  const [updatingUserNrp, setUpdatingUserNrp] = useState<string | null>(null);

  // CAS-style Add User Modal state (when clicking "+ Tambah Pengguna")
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Edit User Modal state (inside Manajemen Pengguna)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editNrp, setEditNrp] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editPangkat, setEditPangkat] = useState('Kombes Pol');
  const [editRole, setEditRole] = useState<UserRole>('ANGGOTA');
  const [editStatusKedinasan, setEditStatusKedinasan] = useState<StatusKedinasan>('AKTIF');
  const [editJabatan, setEditJabatan] = useState('');
  const [editIsExternalJabatan, setEditIsExternalJabatan] = useState(false);
  const [editTanggalLahir, setEditTanggalLahir] = useState('');
  const [editPolda, setEditPolda] = useState('MABES POLRI');
  const [editSatkerUtama, setEditSatkerUtama] = useState('BARESKRIM POLRI');
  const [editSubSatker, setEditSubSatker] = useState('');
  const [editComposedSatker, setEditComposedSatker] = useState('BARESKRIM POLRI');
  const [editKodeSatker, setEditKodeSatker] = useState('060.01.00.01');
  const [editEmail, setEditEmail] = useState('');
  const [editSecondaryEmail, setEditSecondaryEmail] = useState('');
  const [editNoHp, setEditNoHp] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Filters for Verification tab
  const [regSearch, setRegSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | UserAccountStatus>('PENDING_VERIFIKASI');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedApproveRoles, setSelectedApproveRoles] = useState<Record<string, UserRole>>({});

  // Add User Form state (CAS 2-Column Layout + Satker Berjenjang Modal)
  const [newNrp, setNewNrp] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newPangkat, setNewPangkat] = useState('Kombes Pol');
  const [newRole, setNewRole] = useState<UserRole>('ANGGOTA');
  const [newPolda, setNewPolda] = useState('');
  const [newSatkerUtama, setNewSatkerUtama] = useState('');
  const [newSubSatker, setNewSubSatker] = useState('');
  const [newComposedSatker, setNewComposedSatker] = useState('');
  const [newKodeSatker, setNewKodeSatker] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSecondaryEmail, setNewSecondaryEmail] = useState('');
  const [newNoHp, setNewNoHp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // CAS-Style "Pilih Satker Berjenjang" Modal State
  const [satkerPickerMode, setSatkerPickerMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [showUserHeaderInfo, setShowUserHeaderInfo] = useState(false);
  const [showAuditMatrixInfo, setShowAuditMatrixInfo] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const effectiveActorRole: UserRole =
    currentUserRole ||
    (currentUserNrp === '98010710' || adminName.toLowerCase().includes('eko agung')
      ? 'SUPERADMIN'
      : 'SEKRETARIAT');

  const canImpersonate =
    effectiveActorRole === 'SUPERADMIN' ||
    currentUserNrp === '98010710' ||
    adminName.toLowerCase().includes('eko agung');

  // Role Authority Matrix for User Deletion:
  // - SUPERADMIN: can delete anyone except primary Superadmin 98010710
  // - KETUA: can delete ANGGOTA, SEKRETARIAT, BENDAHARA (cannot delete SUPERADMIN or KETUA)
  // - SEKRETARIAT: can ONLY delete ANGGOTA (cannot delete SUPERADMIN, KETUA, or BENDAHARA)
  // - BENDAHARA & ANGGOTA: cannot delete any user
  const getDeleteAuthorityCheck = (target: AuthUser): { allowed: boolean; reason?: string } => {
    if (target.nrp === '98010710') {
      return { allowed: false, reason: 'Akun Superadmin Utama (98010710) dilindungi sistem dan tidak dapat dihapus.' };
    }
    if (target.nrp === currentUserNrp) {
      return { allowed: false, reason: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif login.' };
    }
    if (effectiveActorRole === 'SUPERADMIN') {
      return { allowed: true };
    }
    if (effectiveActorRole === 'KETUA') {
      if (target.role === 'SUPERADMIN' || target.role === 'KETUA') {
        return {
          allowed: false,
          reason: `Ketua Angkatan tidak memiliki otoritas untuk menghapus akun ber-role ${target.role}.`,
        };
      }
      return { allowed: true };
    }
    if (effectiveActorRole === 'SEKRETARIAT') {
      if (target.role !== 'ANGGOTA') {
        return {
          allowed: false,
          reason: `Sekretaris hanya berwenang menghapus akun ANGGOTA. Akun Pejabat Angkatan (${target.role}) hanya dapat dihapus oleh Ketua Angkatan atau Superadmin.`,
        };
      }
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Role ${effectiveActorRole} tidak memiliki otoritas menghapus pengguna.`,
    };
  };

  const appendClientAuditLog = (
    entry: Omit<UserAuditLog, 'id' | 'timestamp' | 'actorName' | 'targetNama' | 'actorRole'> & {
      id?: string;
      timestamp?: string;
      actorName?: string;
      actorNama?: string;
      actorRole?: UserRole | 'ADC';
      targetNama?: string;
      targetName?: string;
    }
  ) => {
    const resolvedActorName = entry.actorName || entry.actorNama || adminName || 'Admin';
    const resolvedTargetNama = entry.targetNama || entry.targetName || entry.targetNrp || '-';
    const newLog: UserAuditLog = {
      id: entry.id || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      action: entry.action,
      actorNrp: entry.actorNrp || currentUserNrp || '98010710',
      actorName: resolvedActorName,
      actorNama: resolvedActorName,
      actorRole: entry.actorRole || effectiveActorRole,
      targetNrp: entry.targetNrp,
      targetNama: resolvedTargetNama,
      targetName: resolvedTargetNama,
      targetPangkat: entry.targetPangkat,
      targetRole: entry.targetRole,
      reason: entry.reason,
      details: entry.details,
      snapshotUser: entry.snapshotUser,
    };
    setAuditLogs((prev) => {
      const merged = [newLog, ...prev.filter((l) => l.id !== newLog.id)].slice(0, 500);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ws96_audit_logs_v1', JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
      return merged;
    });
    return newLog;
  };

  const openSatkerPicker = (mode: 'ADD' | 'EDIT') => {
    setSatkerPickerMode(mode);
  };

  const handleApplySatkerFromModal = (result: SatkerSelectionResult) => {
    if (satkerPickerMode === 'EDIT') {
      setEditPolda(result.polda);
      setEditSatkerUtama(result.satkerUtama);
      setEditSubSatker(result.subSatker);
      setEditComposedSatker(result.composedSatker);
      setEditKodeSatker(result.kodeSatker);
      if (
        result.polda === 'KEMEN/LEMBAGA' ||
        result.satkerUtama?.toUpperCase().includes('LUAR STRUKTUR') ||
        result.satkerUtama?.toUpperCase().includes('EKSTERNAL')
      ) {
        setEditIsExternalJabatan(true);
      }
    } else if (satkerPickerMode === 'ADD') {
      setNewPolda(result.polda);
      setNewSatkerUtama(result.satkerUtama);
      setNewSubSatker(result.subSatker);
      setNewComposedSatker(result.composedSatker);
      setNewKodeSatker(result.kodeSatker);
    }
    setSatkerPickerMode(null);
  };

  const handleNewNrpChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '');
    const oldAutoEmail = `${newNrp}@polri.go.id`;
    setNewNrp(digitsOnly);
    if (!newEmail.trim() || newEmail.trim() === oldAutoEmail) {
      setNewEmail(digitsOnly ? `${digitsOnly}@polri.go.id` : '');
    }
  };

  const handleEditNrpChange = (rawVal: string) => {
    const cleanedVal = rawVal.replace(/\s+/g, '');
    const oldAutoEmail = `${editNrp}@polri.go.id`;
    const origAutoEmail = editingUser ? `${editingUser.nrp}@polri.go.id` : '';
    setEditNrp(cleanedVal);
    if (!editEmail.trim() || editEmail.trim() === oldAutoEmail || editEmail.trim() === origAutoEmail) {
      setEditEmail(cleanedVal ? `${cleanedVal}@polri.go.id` : '');
    }
    if (!editTanggalLahir && cleanedVal.replace(/\D/g, '').length >= 4) {
      setEditTanggalLahir(deriveBirthDateFromNrp(cleanedVal));
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, regRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/auth/register'),
      ]);
      const usersData = await usersRes.json();
      const regData = await regRes.json();

      let deletedSet = new Set<string>();
      let parsedOverrides: Record<string, Partial<AuthUser> & { oldNrp?: string; name?: string; jabatan?: string; avatar?: string }> = {};
      let parsedMemberOverrides: Record<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }> = {};
      let cachedMembers: (Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string })[] = [];
      let regOverrides: Record<string, Partial<PendingRegistration> & { role?: UserRole }> = {};

      if (typeof window !== 'undefined') {
        try {
          const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
          const localDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
          const serverDeleted: string[] = Array.isArray(usersData.deletedNrps) ? usersData.deletedNrps : [];
          deletedSet = new Set(
            [...localDeleted, ...serverDeleted].map((n) => String(n).trim()).filter((n) => n && n !== '98010710')
          );
          if (deletedSet.size > 0) {
            localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(Array.from(deletedSet)));
          }
        } catch {
          deletedSet = new Set();
        }

        try {
          const rawAudit = localStorage.getItem('ws96_audit_logs_v1');
          const localAudit: UserAuditLog[] = rawAudit ? JSON.parse(rawAudit) : [];
          const serverAudit: UserAuditLog[] = Array.isArray(usersData.auditLogs) ? usersData.auditLogs : [];
          const byId = new Map<string, UserAuditLog>();
          [...serverAudit, ...localAudit].forEach((item) => {
            if (item && item.id) byId.set(item.id, item);
          });
          const mergedLogs = Array.from(byId.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setAuditLogs(mergedLogs);
          localStorage.setItem('ws96_audit_logs_v1', JSON.stringify(mergedLogs.slice(0, 500)));
        } catch {
          if (Array.isArray(usersData.auditLogs)) {
            setAuditLogs(usersData.auditLogs);
          }
        }

        try {
          const rawOverrides = localStorage.getItem('ws96_user_overrides_v1');
          if (rawOverrides) {
            parsedOverrides = JSON.parse(rawOverrides) || {};
          }
        } catch {
          parsedOverrides = {};
        }

        try {
          const rawMemberOv = localStorage.getItem('ws96_member_overrides_v1');
          if (rawMemberOv) {
            parsedMemberOverrides = JSON.parse(rawMemberOv) || {};
          }
        } catch {
          parsedMemberOverrides = {};
        }

        try {
          const rawCachedMembers = localStorage.getItem('wirasatya96_members');
          if (rawCachedMembers) {
            const parsedList = JSON.parse(rawCachedMembers);
            if (Array.isArray(parsedList)) {
              cachedMembers = parsedList;
            }
          }
        } catch {
          cachedMembers = [];
        }

        try {
          const rawRegOv = localStorage.getItem('ws96_reg_overrides_v1');
          if (rawRegOv) {
            regOverrides = JSON.parse(rawRegOv) || {};
          }
        } catch {
          regOverrides = {};
        }
      }

      const isUserTombstoned = (u: { nrp?: string; oldNrp?: string; id?: string; isAdcAccount?: boolean; adcOfNrp?: string }) => {
        const cleanNrp = (u.nrp || '').trim();
        const cleanOld = (u.oldNrp || '').trim();
        const cleanFromId = u.id?.startsWith('u-') ? u.id.slice(2).trim() : '';
        const cleanParent = (u.adcOfNrp || '').trim();
        return Boolean(
          (cleanNrp && deletedSet.has(cleanNrp)) ||
          (cleanOld && deletedSet.has(cleanOld)) ||
          (cleanFromId && deletedSet.has(cleanFromId)) ||
          (u.isAdcAccount && cleanParent && deletedSet.has(cleanParent))
        );
      };

      if (usersData.success && Array.isArray(usersData.data)) {
        const rawServerUsers = usersData.data as AuthUser[];

        const getBasePersonName = (rawName?: string) =>
          (stripRankFromName(rawName || '') || rawName || '')
            .split(',')[0]
            .trim()
            .toLowerCase();

        // Filter out tombstoned users & non-Akpol-1996 purged names
        let fetchedUsers = rawServerUsers.filter((u) => {
          const bName = getBasePersonName(u.nama);
          if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) {
            return false;
          }
          if (isUserTombstoned(u)) {
            fetch(`/api/users?nrp=${encodeURIComponent(u.nrp)}`, { method: 'DELETE' }).catch(() => {});
            return false;
          }
          return true;
        });

        // Deduplicate & heal parsedOverrides by baseName so stale oldNrp keys never duplicate a person
        const cleanedOverridesByKey: Record<string, Partial<AuthUser> & { oldNrp?: string; name?: string; jabatan?: string; avatar?: string }> = {};
        const seenOverrideNames = new Map<string, string>();
        Object.entries(parsedOverrides).forEach(([, ov]) => {
          if (!ov || !ov.nrp) return;
          const bName = getBasePersonName(ov.nama || ov.name);
          if (bName && PURGED_NON_1996_BASE_NAMES.has(bName)) return;
          if (bName && seenOverrideNames.has(bName)) {
            const prevKey = seenOverrideNames.get(bName)!;
            cleanedOverridesByKey[prevKey] = { ...cleanedOverridesByKey[prevKey], ...ov };
          } else {
            if (bName) seenOverrideNames.set(bName, ov.nrp);
            cleanedOverridesByKey[ov.nrp] = ov;
          }
        });
        parsedOverrides = cleanedOverridesByKey;

        const consumedOverrideNrps = new Set<string>();

        // Pre-index overrides & cachedMembers in Maps once for O(1) lookup (eliminates O(N^2) .find() loops)
        const uOvByBaseName = new Map<string, Partial<AuthUser> & { oldNrp?: string; name?: string; jabatan?: string; avatar?: string }>();
        const uOvById = new Map<string, Partial<AuthUser> & { oldNrp?: string; name?: string; jabatan?: string; avatar?: string }>();
        const uOvByOldNrp = new Map<string, Partial<AuthUser> & { oldNrp?: string; name?: string; jabatan?: string; avatar?: string }>();
        Object.values(parsedOverrides).forEach((item) => {
          if (!item || !item.nrp) return;
          const bName = getBasePersonName(item.nama || item.name);
          if (bName && !uOvByBaseName.has(bName)) uOvByBaseName.set(bName, item);
          if (item.id) uOvById.set(item.id, item);
          if (item.oldNrp) uOvByOldNrp.set(item.oldNrp.trim(), item);
        });

        const mOvByNrp = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        const mOvById = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        const mOvByBaseName = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        Object.values(parsedMemberOverrides).forEach((item) => {
          if (!item) return;
          if (item.nrp) mOvByNrp.set(item.nrp.trim(), item);
          if (item.oldNrp) mOvByNrp.set(item.oldNrp.trim(), item);
          if (item.id) mOvById.set(item.id, item);
          const bName = getBasePersonName(item.namaLengkap || item.nama || item.name);
          if (bName && !mOvByBaseName.has(bName)) mOvByBaseName.set(bName, item);
        });

        const cachedMemberByNrp = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        const cachedMemberById = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        const cachedMemberByBaseName = new Map<string, Partial<AnggotaWiraSatya> & { nama?: string; name?: string; avatar?: string }>();
        cachedMembers.forEach((item) => {
          if (!item) return;
          if (item.nrp) cachedMemberByNrp.set(item.nrp.trim(), item);
          if (item.oldNrp) cachedMemberByNrp.set(String(item.oldNrp).trim(), item);
          if (item.id) cachedMemberById.set(item.id, item);
          const bName = getBasePersonName(item.namaLengkap || item.nama || item.name);
          if (bName && !cachedMemberByBaseName.has(bName)) cachedMemberByBaseName.set(bName, item);
        });

        const applyMemberAndUserOverridesToUsers = (rawUsers: AuthUser[]): AuthUser[] => {
          return rawUsers.map((u) => {
            const uBaseName = getBasePersonName(u.nama);
            const isAlumniSlot = Boolean(u.id?.startsWith('u-7409'));
            const origFromId = u.id?.startsWith('u-') ? u.id.slice(2).trim() : '';
            const cleanNrp = (u.nrp || '').trim();
            const cleanOld = (u.oldNrp || origFromId || '').trim();

            // 1. O(1) Match User Override by baseName first, then by NRP/id
            let uOv = uBaseName ? uOvByBaseName.get(uBaseName) : undefined;
            if (uOv && uOv.nrp && consumedOverrideNrps.has(uOv.nrp)) {
              uOv = undefined;
            }

            if (!uOv) {
              const candidateByNrp =
                parsedOverrides[cleanNrp] ||
                (cleanOld ? parsedOverrides[cleanOld] || uOvByOldNrp.get(cleanOld) : undefined) ||
                (u.id ? uOvById.get(u.id) : undefined);
              if (
                candidateByNrp &&
                candidateByNrp.nrp &&
                !consumedOverrideNrps.has(candidateByNrp.nrp) &&
                (!isAlumniSlot ||
                  !(candidateByNrp.nama || candidateByNrp.name) ||
                  getBasePersonName(candidateByNrp.nama || candidateByNrp.name) === uBaseName)
              ) {
                uOv = candidateByNrp;
              }
            }

            if (uOv && uOv.nrp) {
              consumedOverrideNrps.add(uOv.nrp);
            }

            // 2. O(1) Match Member Override from ws96_member_overrides_v1
            const mOv =
              mOvByNrp.get(cleanNrp) ||
              (uOv?.nrp ? mOvByNrp.get(uOv.nrp) : undefined) ||
              (cleanOld ? mOvByNrp.get(cleanOld) || mOvById.get(`ws-${cleanOld}`) : undefined) ||
              (u.profileId ? mOvById.get(u.profileId) : undefined) ||
              (!u.isAdcAccount && uBaseName ? mOvByBaseName.get(uBaseName) : undefined);

            // 3. O(1) Match cached Member from wirasatya96_members
            const cachedMember =
              cachedMemberByNrp.get(cleanNrp) ||
              (uOv?.nrp ? cachedMemberByNrp.get(uOv.nrp) : undefined) ||
              (cleanOld ? cachedMemberByNrp.get(cleanOld) || cachedMemberById.get(`ws-${cleanOld}`) : undefined) ||
              (u.profileId ? cachedMemberById.get(u.profileId) : undefined) ||
              (!u.isAdcAccount && uBaseName ? cachedMemberByBaseName.get(uBaseName) : undefined);

            if (!uOv && !mOv && !cachedMember) {
              return u;
            }

            // Order sources by updatedAt ascending so the most recently saved source wins
            const sources: {
              ts: number;
              nrp?: string;
              oldNrp?: string;
              nama?: string;
              pangkat?: string;
              satker?: string;
              polda?: string;
              jabatanTerakhir?: string;
              email?: string;
              secondaryEmail?: string;
              noHp?: string;
              fotoUrl?: string;
              statusKedinasan?: StatusKedinasan;
              tanggalLahir?: string;
            }[] = [];

            if (cachedMember) {
              sources.push({
                ts: cachedMember.updatedAt ? new Date(cachedMember.updatedAt).getTime() || 1 : 1,
                nrp: cachedMember.nrp,
                oldNrp: cachedMember.oldNrp,
                nama: cachedMember.namaLengkap || cachedMember.nama || cachedMember.name,
                pangkat: cachedMember.pangkat,
                satker: cachedMember.satuanKerja || cachedMember.satker,
                polda: cachedMember.polda,
                jabatanTerakhir: cachedMember.jabatanTerakhir || cachedMember.jabatan,
                email: cachedMember.email,
                secondaryEmail: cachedMember.secondaryEmail,
                noHp: cachedMember.noHp,
                fotoUrl: cachedMember.fotoUrl || cachedMember.avatar,
                statusKedinasan: (cachedMember.statusKedinasan || cachedMember.statusDinas) as StatusKedinasan | undefined,
                tanggalLahir: cachedMember.tanggalLahir,
              });
            }

            if (mOv) {
              sources.push({
                ts: mOv.updatedAt ? new Date(mOv.updatedAt).getTime() || 2 : 2,
                nrp: mOv.nrp,
                oldNrp: mOv.oldNrp,
                nama: mOv.namaLengkap || mOv.nama || mOv.name,
                pangkat: mOv.pangkat,
                satker: mOv.satuanKerja || mOv.satker,
                polda: mOv.polda,
                jabatanTerakhir: mOv.jabatanTerakhir || mOv.jabatan,
                email: mOv.email,
                secondaryEmail: mOv.secondaryEmail,
                noHp: mOv.noHp,
                fotoUrl: mOv.fotoUrl || mOv.avatar,
                statusKedinasan: (mOv.statusKedinasan || mOv.statusDinas) as StatusKedinasan | undefined,
                tanggalLahir: mOv.tanggalLahir,
              });
            }

            if (uOv) {
              sources.push({
                ts: uOv.updatedAt ? new Date(uOv.updatedAt).getTime() || 3 : 3,
                nrp: uOv.nrp,
                oldNrp: uOv.oldNrp,
                nama: uOv.nama || uOv.name,
                pangkat: uOv.pangkat,
                satker: uOv.satker,
                polda: uOv.polda,
                jabatanTerakhir: uOv.jabatanTerakhir || uOv.jabatan,
                email: uOv.email,
                secondaryEmail: uOv.secondaryEmail,
                noHp: uOv.noHp,
                fotoUrl: uOv.fotoUrl || uOv.avatar,
                statusKedinasan: uOv.statusKedinasan,
                tanggalLahir: uOv.tanggalLahir,
              });
            }

            sources.sort((a, b) => a.ts - b.ts);

            let enrichedUser: AuthUser = {
              ...u,
              ...(uOv || {}),
            };

            for (const src of sources) {
              if (src.nrp) enrichedUser.nrp = src.nrp;
              if (src.nama) enrichedUser.nama = stripRankFromName(src.nama) || src.nama;
              if (src.pangkat) enrichedUser.pangkat = src.pangkat;
              if (src.satker) enrichedUser.satker = src.satker;
              if (src.polda) enrichedUser.polda = src.polda;
              if (src.jabatanTerakhir) enrichedUser.jabatanTerakhir = src.jabatanTerakhir;
              if (src.email) enrichedUser.email = src.email;
              if (src.secondaryEmail !== undefined && src.secondaryEmail !== '') {
                enrichedUser.secondaryEmail = src.secondaryEmail;
              }
              if (src.noHp) enrichedUser.noHp = src.noHp;
              if (src.fotoUrl) enrichedUser.fotoUrl = src.fotoUrl;
              if (
                src.statusKedinasan === 'AKTIF' ||
                src.statusKedinasan === 'PURNA_TUGAS' ||
                src.statusKedinasan === 'PTDH' ||
                src.statusKedinasan === 'ALMARHUM'
              ) {
                enrichedUser.statusKedinasan = src.statusKedinasan;
              }
              if (src.tanggalLahir) enrichedUser.tanggalLahir = src.tanggalLahir;
            }

            const canonicalOldNrp =
              (u.id?.startsWith('u-7409') ? u.id.slice(2) : undefined) ||
              u.oldNrp ||
              uOv?.oldNrp ||
              mOv?.oldNrp ||
              u.nrp;

            enrichedUser = {
              ...enrichedUser,
              id: u.id,
              profileId: u.profileId,
              oldNrp: canonicalOldNrp,
              nrp: enrichedUser.nrp || u.nrp,
              role: (uOv?.role as UserRole) || u.role,
            };

            // Only background-sync if an explicit user/member override exists AND hasn't been synced yet in this session
            const hasExplicitOverride = Boolean(uOv || mOv);
            const syncKey = `${u.id || u.nrp}:${enrichedUser.nrp}:${enrichedUser.role}:${enrichedUser.pangkat}:${enrichedUser.satker}`;
            const needsServerSync =
              hasExplicitOverride &&
              !backgroundSyncedOverrideKeys.has(syncKey) &&
              ((enrichedUser.nrp && u.nrp !== enrichedUser.nrp) ||
                (enrichedUser.role && u.role !== enrichedUser.role) ||
                (enrichedUser.nama && u.nama !== enrichedUser.nama) ||
                (enrichedUser.pangkat && u.pangkat !== enrichedUser.pangkat) ||
                (enrichedUser.satker && u.satker !== enrichedUser.satker) ||
                (enrichedUser.polda && u.polda !== enrichedUser.polda) ||
                (enrichedUser.jabatanTerakhir && u.jabatanTerakhir !== enrichedUser.jabatanTerakhir));

            if (needsServerSync) {
              backgroundSyncedOverrideKeys.add(syncKey);
              fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...enrichedUser,
                  nrp: u.nrp,
                  originalNrp: canonicalOldNrp,
                  oldNrp: canonicalOldNrp,
                  newNrp: enrichedUser.nrp || u.nrp,
                  id: u.id,
                  profileId: u.profileId,
                  isBackgroundSync: true,
                }),
              }).catch(() => {});
            }

            return enrichedUser;
          });
        };

        fetchedUsers = applyMemberAndUserOverridesToUsers(fetchedUsers);

        // Strict deduplication of fetchedUsers by NRP and by baseName (for non-ADC accounts)
        const dedupedUsers: AuthUser[] = [];
        const seenUserNrps = new Set<string>();
        const seenUserBaseNames = new Set<string>();
        for (const u of fetchedUsers) {
          const cleanNrp = (u.nrp || '').trim();
          const bName = getBasePersonName(u.nama);
          if (!cleanNrp) continue;
          if (seenUserNrps.has(cleanNrp)) continue;
          if (!u.isAdcAccount && bName && seenUserBaseNames.has(bName)) continue;
          seenUserNrps.add(cleanNrp);
          if (!u.isAdcAccount && bName) seenUserBaseNames.add(bName);
          dedupedUsers.push(u);
        }
        fetchedUsers = dedupedUsers;

        // Append any locally created or ADC-generated users missing from a cold-started serverless instance
        const existingNrps = new Set<string>();
        fetchedUsers.forEach((u) => {
          if (u.nrp) existingNrps.add(u.nrp.trim());
          if (u.oldNrp) existingNrps.add(u.oldNrp.trim());
          if (u.id?.startsWith('u-')) existingNrps.add(u.id.slice(2).trim());
        });

        Object.values(parsedOverrides).forEach((ov) => {
          if (!ov || !ov.nrp || !ov.nama) return;
          const cleanOvNrp = ov.nrp.trim();
          const cleanOvOld = (ov.oldNrp || '').trim();
          const bName = getBasePersonName(ov.nama);
          if (consumedOverrideNrps.has(cleanOvNrp)) return;
          if (bName && seenUserBaseNames.has(bName)) return;
          if (isUserTombstoned(ov)) return;
          if (!existingNrps.has(cleanOvNrp) && (!cleanOvOld || !existingNrps.has(cleanOvOld))) {
            existingNrps.add(cleanOvNrp);
            if (bName) seenUserBaseNames.add(bName);
            const reconstructedUser: AuthUser = {
              id: ov.id || `u-${cleanOvNrp}`,
              profileId: ov.profileId || `ws-${cleanOvNrp}`,
              nrp: cleanOvNrp,
              oldNrp: ov.oldNrp,
              nama: ov.nama,
              pangkat: ov.pangkat || 'Kombes Pol',
              role: (ov.role as UserRole) || 'ANGGOTA',
              email: ov.email || `${cleanOvNrp}@polri.go.id`,
              secondaryEmail: ov.secondaryEmail,
              noHp: ov.noHp || '',
              satker: ov.satker || 'Mabes Polri',
              polda: ov.polda || 'MABES POLRI',
              jabatanTerakhir: ov.jabatanTerakhir,
              tanggalLahir: ov.tanggalLahir,
              fotoUrl: ov.fotoUrl || '/default-avatar.png',
              mfaEnabled: ov.mfaEnabled ?? false,
              mfaMethod: ov.mfaMethod || 'PIN',
              status: 'AKTIF',
              password: ov.password || `WS96@${cleanOvNrp}`,
              isAdcAccount: ov.isAdcAccount,
              adcOfNrp: ov.adcOfNrp,
              adcOfNama: ov.adcOfNama,
              adcOfPangkat: ov.adcOfPangkat,
            };
            fetchedUsers.unshift(reconstructedUser);
            fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reconstructedUser),
            }).catch(() => {});
          }
        });

        cachedUsersInMemory = fetchedUsers;
        setUsers(fetchedUsers);
        const map: Record<string, UserRole> = {};
        fetchedUsers.forEach((u) => {
          if (u.nrp && u.role) {
            map[u.nrp.trim()] = u.role;
          }
        });
        setDynamicRoleMap(map);
      }

      if (regData.success && Array.isArray(regData.registrations)) {
        const syncedRegs = (regData.registrations as PendingRegistration[])
          .filter((r) => !deletedSet.has((r.nrp || '').trim()))
          .map((r) => {
            const rOv = regOverrides[r.nrp];
            if (rOv) {
              return { ...r, ...rOv };
            }
            return r;
          });
        setRegistrations(syncedRegs);
      }
    } catch (err) {
      console.error('Failed to fetch user management data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isVisible = Boolean(isOpen || asPage);
    if (isVisible && !initializedRef.current) {
      initializedRef.current = true;
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
      fetchAllData();
    } else if (!isVisible && initializedRef.current) {
      initializedRef.current = false;
    } else if (isVisible && prevInitialTabRef.current !== initialTab) {
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
    }
  }, [isOpen, asPage, initialTab]);

  useEffect(() => {
    if (!isOpen && !asPage) return;
    const handleSyncEvent = () => {
      fetchAllData();
    };
    window.addEventListener('ws96_user_updated', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);
    return () => {
      window.removeEventListener('ws96_user_updated', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, [isOpen, asPage]);

  if (!isOpen && !asPage) return null;

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRoleChange = async (nrp: string, nextRole: UserRole) => {
    const targetUser = users.find((u) => u.nrp === nrp);
    // Immediate optimistic update for 0ms UI & badge response
    setUsers((prev) => prev.map((u) => (u.nrp === nrp ? { ...u, role: nextRole } : u)));
    updateDynamicUserRole(nrp, nextRole);

    if (targetUser) {
      appendClientAuditLog({
        action: 'UBAH_ROLE',
        targetNrp: nrp,
        targetName: stripRankFromName(targetUser.nama) || targetUser.nama,
        targetPangkat: targetUser.pangkat,
        targetRole: nextRole,
        details: `Mengubah role akses dari ${targetUser.role} menjadi ${nextRole}`,
      });
    }

    if (typeof window !== 'undefined') {
      try {
        const rawOverrides = localStorage.getItem('ws96_user_overrides_v1');
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        parsedOverrides[nrp] = {
          ...(targetUser || {}),
          ...(parsedOverrides[nrp] || {}),
          nrp,
          role: nextRole,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedOverrides));
      } catch {
        // ignore
      }
    }

    setUpdatingUserNrp(nrp);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp,
          role: nextRole,
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Role pengguna NRP ${nrp} berhasil diubah menjadi ${nextRole}.`, 'success');
        if (onVerificationUpdate) onVerificationUpdate();
      } else {
        showToast(data.message || 'Gagal mengubah role pengguna.', 'error');
        await fetchAllData();
      }
    } catch {
      showToast(`Role pengguna NRP ${nrp} disimpan secara lokal (${nextRole}).`, 'success');
      if (onVerificationUpdate) onVerificationUpdate();
    } finally {
      setUpdatingUserNrp(null);
    }
  };

  const handleStartEditUser = (u: AuthUser) => {
    const poldaVal = u.polda || 'MABES POLRI';
    const satkerVal = (u.satker || 'BARESKRIM POLRI').split(' / ')[0].trim();
    const origNrpFromId = u.id?.startsWith('u-') ? u.id.slice(2) : undefined;
    const knownOldNrp = u.oldNrp || origNrpFromId;
    const regMatch = registrations.find(
      (r) => r.nrp === u.nrp || (knownOldNrp && r.nrp === knownOldNrp)
    );

    // Lookup member's current jabatanTerakhir, tanggalLahir, noHp & statusKedinasan from u, localStorage cache, and overrides
    let memberJabatan = u.jabatanTerakhir || '';
    let memberBirthDate = u.tanggalLahir || '';
    let memberNoHp = u.noHp || regMatch?.noHp || '';
    const resolvedStatusKedinasan = resolveUserStatusKedinasan(u);
    if (typeof window !== 'undefined') {
      try {
        const rawMembers = localStorage.getItem('wirasatya96_members');
        if (rawMembers) {
          const parsedMembers = JSON.parse(rawMembers);
          if (Array.isArray(parsedMembers)) {
            const matchedMember = parsedMembers.find(
              (m: any) =>
                m.nrp === u.nrp ||
                (knownOldNrp && (m.nrp === knownOldNrp || m.oldNrp === knownOldNrp)) ||
                (u.profileId && m.id === u.profileId) ||
                (knownOldNrp && m.id === `ws-${knownOldNrp}`) ||
                (m.namaLengkap &&
                  u.nama &&
                  stripRankFromName(m.namaLengkap).toLowerCase() === stripRankFromName(u.nama).toLowerCase())
            );
            if (matchedMember) {
              if (matchedMember.jabatanTerakhir) memberJabatan = matchedMember.jabatanTerakhir;
              if (matchedMember.tanggalLahir) memberBirthDate = matchedMember.tanggalLahir;
              if (matchedMember.noHp) memberNoHp = matchedMember.noHp;
            }
          }
        }
        const rawMemberOverrides = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMemberOverrides) {
          const parsedMemberOverrides = JSON.parse(rawMemberOverrides);
          if (parsedMemberOverrides) {
            const mOv =
              parsedMemberOverrides[u.nrp] ||
              (knownOldNrp ? parsedMemberOverrides[knownOldNrp] : undefined) ||
              Object.values(parsedMemberOverrides).find(
                (item: any) =>
                  item &&
                  (item.nrp === u.nrp ||
                    (knownOldNrp && item.oldNrp === knownOldNrp) ||
                    (item.namaLengkap &&
                      u.nama &&
                      stripRankFromName(item.namaLengkap).toLowerCase() === stripRankFromName(u.nama).toLowerCase()))
              );
            if (mOv) {
              if (mOv.jabatanTerakhir) memberJabatan = mOv.jabatanTerakhir;
              if (mOv.tanggalLahir) memberBirthDate = mOv.tanggalLahir;
              if (mOv.noHp) memberNoHp = mOv.noHp;
            }
          }
        }
        const rawUserOverrides = localStorage.getItem('ws96_user_overrides_v1');
        if (rawUserOverrides) {
          const parsedUserOverrides = JSON.parse(rawUserOverrides);
          if (parsedUserOverrides) {
            const uOv =
              parsedUserOverrides[u.nrp] ||
              (knownOldNrp ? parsedUserOverrides[knownOldNrp] : undefined) ||
              Object.values(parsedUserOverrides).find(
                (item: any) =>
                  item &&
                  (item.nrp === u.nrp ||
                    (knownOldNrp && item.oldNrp === knownOldNrp) ||
                    (u.id && item.id === u.id) ||
                    (item.nama &&
                      u.nama &&
                      stripRankFromName(item.nama).toLowerCase() === stripRankFromName(u.nama).toLowerCase()))
              );
            if (uOv) {
              if (uOv.jabatanTerakhir) memberJabatan = uOv.jabatanTerakhir;
              if (uOv.tanggalLahir) memberBirthDate = uOv.tanggalLahir;
              if (uOv.noHp) memberNoHp = uOv.noHp;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!isOfficerRankIpdaUp(u.pangkat) && memberJabatan === 'Lead Developer') {
      memberJabatan = 'Staf';
    }

    const rankGroups = getJabatanGroupsForPangkat(u.pangkat || 'Kombes Pol', u.nrp);
    const defaultJab = memberJabatan || rankGroups[0]?.options[0] || (isOfficerRankIpdaUp(u.pangkat) ? 'Pamen Polri' : 'Staf');
    const calc58 = calculateRetirement58(memberBirthDate || undefined, u.nrp);

    setEditingUser(u);
    setEditNrp(u.nrp);
    setEditNama(stripRankFromName(u.nama) || u.nama);
    setEditPangkat(u.pangkat || 'Kombes Pol');
    setEditRole(u.role);
    setEditStatusKedinasan(resolvedStatusKedinasan);
    setEditJabatan(defaultJab);
    setEditIsExternalJabatan(poldaVal === 'KEMEN/LEMBAGA');
    setEditTanggalLahir(calc58.tanggalLahir);
    setEditPolda(poldaVal);
    setEditSatkerUtama(satkerVal);
    setEditSubSatker('');
    setEditComposedSatker(satkerVal);
    setEditKodeSatker('060.01.00.01');
    setEditEmail(u.email || `${u.nrp}@polri.go.id`);
    setEditSecondaryEmail(u.secondaryEmail || regMatch?.secondaryEmail || '');
    setEditNoHp(memberNoHp);
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const targetNrp = editingUser.nrp;
    const nextNrp = editNrp.trim() || targetNrp;
    if (!nextNrp) {
      showToast('NRP / NIP tidak boleh kosong.', 'error');
      return;
    }

    const cleanNamaNoRank = stripRankFromName(editNama.trim()) || editNama.trim();
    const composedSatker = (
      editComposedSatker ||
      (editSubSatker && editSubSatker !== 'Pimpinan / Staf Utama Satker'
        ? `${editSubSatker} - ${editSatkerUtama}`
        : editSatkerUtama) ||
      'MABES POLRI'
    ).split(' / ')[0].trim();
    const cleanedEmail =
      editEmail.trim() && editEmail.trim() !== `${targetNrp}@polri.go.id`
        ? editEmail.trim()
        : `${nextNrp}@polri.go.id`;
    const cleanedSecondaryEmail = editSecondaryEmail.trim();
    const cleanedNoHp = editNoHp.trim();
    const cleanedJabatan = editJabatan.trim();
    const calc58 = calculateRetirement58(editTanggalLahir || undefined, nextNrp);
    const nowIso = new Date().toISOString();

    const origNrpFromId = editingUser.id?.startsWith('u-') ? editingUser.id.slice(2) : undefined;
    let preservedOldNrp = editingUser.oldNrp || origNrpFromId || targetNrp;
    let effectivePassword = editPassword.trim() || editingUser.password || undefined;

    if (typeof window !== 'undefined') {
      try {
        const rawOverrides = localStorage.getItem('ws96_user_overrides_v1');
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : {};
        const existingOv =
          parsedOverrides[targetNrp] ||
          parsedOverrides[nextNrp] ||
          (preservedOldNrp ? parsedOverrides[preservedOldNrp] : undefined) ||
          Object.values(parsedOverrides).find(
            (item: any) =>
              item &&
              (item.nrp === targetNrp ||
                item.oldNrp === targetNrp ||
                (editingUser.id && item.id === editingUser.id))
          );

        if (existingOv?.oldNrp) {
          preservedOldNrp = existingOv.oldNrp;
        }
        if (!editPassword.trim() && existingOv?.password) {
          effectivePassword = existingOv.password;
        }

        if (nextNrp !== targetNrp) {
          delete parsedOverrides[targetNrp];
        }
        parsedOverrides[nextNrp] = {
          ...(existingOv || {}),
          id: editingUser.id || `u-${preservedOldNrp}`,
          profileId: editingUser.profileId || `ws-${preservedOldNrp}`,
          oldNrp: preservedOldNrp,
          nrp: nextNrp,
          nama: cleanNamaNoRank,
          name: cleanNamaNoRank,
          pangkat: editPangkat,
          role: editRole,
          statusKedinasan: editStatusKedinasan,
          jabatanTerakhir: cleanedJabatan || undefined,
          jabatan: cleanedJabatan || undefined,
          tanggalLahir: calc58.tanggalLahir,
          polda: editPolda || 'MABES POLRI',
          satker: composedSatker,
          email: cleanedEmail,
          secondaryEmail: cleanedSecondaryEmail,
          noHp: cleanedNoHp,
          ...(effectivePassword ? { password: effectivePassword, status: 'AKTIF' } : {}),
          updatedAt: nowIso,
        };

        // Propagate Alumni password & NRP to any ADC accounts generated by this Alumni
        Object.keys(parsedOverrides).forEach((key) => {
          const item = parsedOverrides[key];
          if (
            item?.isAdcAccount &&
            (item.adcOfNrp === targetNrp ||
              item.adcOfNrp === nextNrp ||
              (preservedOldNrp && item.adcOfNrp === preservedOldNrp))
          ) {
            item.adcOfNrp = nextNrp;
            item.adcOfNama = cleanNamaNoRank;
            item.adcOfPangkat = editPangkat;
            if (effectivePassword) {
              item.password = effectivePassword;
              item.status = 'AKTIF';
            }
          }
        });

        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedOverrides));

        // Also update ws96_member_overrides_v1 so page.tsx never overwrites with stale data
        const rawMemberOverrides = localStorage.getItem('ws96_member_overrides_v1');
        const parsedMemberOverrides = rawMemberOverrides ? JSON.parse(rawMemberOverrides) : {};
        const prevMemberOverride =
          parsedMemberOverrides[targetNrp] ||
          parsedMemberOverrides[nextNrp] ||
          (preservedOldNrp ? parsedMemberOverrides[preservedOldNrp] : undefined) ||
          {};
        if (nextNrp !== targetNrp) {
          delete parsedMemberOverrides[targetNrp];
        }
        parsedMemberOverrides[nextNrp] = {
          ...prevMemberOverride,
          id: editingUser.profileId || `ws-${preservedOldNrp}`,
          oldNrp: preservedOldNrp,
          nrp: nextNrp,
          namaLengkap: cleanNamaNoRank,
          pangkat: editPangkat,
          statusKedinasan: editStatusKedinasan,
          statusDinas: editStatusKedinasan,
          satuanKerja: composedSatker,
          satker: composedSatker,
          polda: editPolda || 'MABES POLRI',
          jabatanTerakhir: cleanedJabatan || prevMemberOverride.jabatanTerakhir || 'Staf',
          jabatan: cleanedJabatan || prevMemberOverride.jabatanTerakhir || 'Staf',
          tanggalLahir: calc58.tanggalLahir,
          usia: calc58.usiaTahun,
          tahunPurnaTugas: calc58.tahunPurnaTugas,
          sisaTahunDinas: calc58.sisaTahunDinas,
          email: cleanedEmail,
          secondaryEmail: cleanedSecondaryEmail,
          noHp: cleanedNoHp || prevMemberOverride.noHp,
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(parsedMemberOverrides));

        // Also update wirasatya96_members in localStorage matching by nrp, oldNrp, id, or nama
        const rawMembers = localStorage.getItem('wirasatya96_members');
        if (rawMembers) {
          const parsedMembers = JSON.parse(rawMembers);
          if (Array.isArray(parsedMembers)) {
            const updatedMembers = parsedMembers.map((m: any) =>
              m.nrp === targetNrp ||
              m.nrp === nextNrp ||
              (preservedOldNrp && (m.nrp === preservedOldNrp || m.oldNrp === preservedOldNrp)) ||
              (editingUser.profileId && m.id === editingUser.profileId) ||
              (preservedOldNrp && m.id === `ws-${preservedOldNrp}`) ||
              (m.namaLengkap &&
                editingUser.nama &&
                stripRankFromName(m.namaLengkap).toLowerCase() === stripRankFromName(editingUser.nama).toLowerCase())
                ? {
                    ...m,
                    oldNrp: preservedOldNrp,
                    nrp: nextNrp,
                    namaLengkap: cleanNamaNoRank,
                    pangkat: editPangkat,
                    statusKedinasan: editStatusKedinasan,
                    statusDinas: editStatusKedinasan,
                    satuanKerja: composedSatker,
                    satker: composedSatker,
                    polda: editPolda || 'MABES POLRI',
                    jabatanTerakhir: cleanedJabatan || m.jabatanTerakhir,
                    jabatan: cleanedJabatan || m.jabatan,
                    tanggalLahir: calc58.tanggalLahir,
                    usia: calc58.usiaTahun,
                    tahunPurnaTugas: calc58.tahunPurnaTugas,
                    sisaTahunDinas: calc58.sisaTahunDinas,
                    email: cleanedEmail,
                    secondaryEmail: cleanedSecondaryEmail,
                    noHp: cleanedNoHp || m.noHp,
                    updatedAt: nowIso,
                  }
                : m
            );
            localStorage.setItem('wirasatya96_members', JSON.stringify(updatedMembers));
          }
        }

        // If editing the currently logged-in user, update ws96_auth_user immediately
        const rawAuth = localStorage.getItem('ws96_auth_user');
        if (rawAuth) {
          const parsedAuth = JSON.parse(rawAuth);
          if (
            parsedAuth &&
            (parsedAuth.nrp === targetNrp ||
              parsedAuth.nrp === nextNrp ||
              (preservedOldNrp && parsedAuth.nrp === preservedOldNrp))
          ) {
            const nextAuth = {
              ...parsedAuth,
              oldNrp: preservedOldNrp,
              nrp: nextNrp,
              nama: cleanNamaNoRank,
              pangkat: editPangkat,
              role: editRole,
              statusKedinasan: editStatusKedinasan,
              jabatanTerakhir: cleanedJabatan || parsedAuth.jabatanTerakhir,
              tanggalLahir: calc58.tanggalLahir,
              polda: editPolda || 'MABES POLRI',
              satker: composedSatker,
              email: cleanedEmail,
              secondaryEmail: cleanedSecondaryEmail,
              noHp: cleanedNoHp || parsedAuth.noHp,
              ...(effectivePassword ? { password: effectivePassword, status: 'AKTIF' } : {}),
            };
            localStorage.setItem('ws96_auth_user', JSON.stringify(nextAuth));
            localStorage.setItem('ws96_active_user', JSON.stringify(nextAuth));
            localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextAuth));
          }
        }
        window.dispatchEvent(new Event('ws96_user_updated'));
      } catch {
        // ignore storage error
      }
    }

    if (onMemberSynced) {
      onMemberSynced({
        id: editingUser.profileId || `ws-${preservedOldNrp}`,
        nrp: nextNrp,
        oldNrp: preservedOldNrp,
        name: cleanNamaNoRank,
        namaLengkap: cleanNamaNoRank,
        pangkat: editPangkat,
        statusKedinasan: editStatusKedinasan,
        statusDinas: editStatusKedinasan,
        satuanKerja: composedSatker,
        satker: composedSatker,
        polda: editPolda || 'MABES POLRI',
        jabatanTerakhir: cleanedJabatan || undefined,
        jabatan: cleanedJabatan || undefined,
        tanggalLahir: calc58.tanggalLahir,
        usia: calc58.usiaTahun,
        tahunPurnaTugas: calc58.tahunPurnaTugas,
        sisaTahunDinas: calc58.sisaTahunDinas,
        email: cleanedEmail,
        secondaryEmail: cleanedSecondaryEmail,
        noHp: cleanedNoHp,
        updatedAt: nowIso,
      });
    }

    appendClientAuditLog({
      action: 'EDIT_USER',
      targetNrp: nextNrp,
      targetName: cleanNamaNoRank,
      targetPangkat: editPangkat,
      targetRole: editRole,
      details: `Memperbarui data personel (${editPangkat} • ${cleanedJabatan || composedSatker}${
        nextNrp !== targetNrp ? ` • NRP ${targetNrp} → ${nextNrp}` : ''
      })`,
    });

    // Immediate optimistic update on users state and dynamic badge role map
    setUsers((prev) =>
      prev.map((u) =>
        u.nrp === targetNrp || (preservedOldNrp && u.nrp === preservedOldNrp) || u.id === editingUser.id
          ? {
              ...u,
              oldNrp: preservedOldNrp,
              nrp: nextNrp,
              nama: cleanNamaNoRank,
              pangkat: editPangkat,
              role: editRole,
              statusKedinasan: editStatusKedinasan,
              jabatanTerakhir: cleanedJabatan || u.jabatanTerakhir,
              tanggalLahir: calc58.tanggalLahir,
              polda: editPolda || 'MABES POLRI',
              satker: composedSatker,
              email: cleanedEmail,
              secondaryEmail: cleanedSecondaryEmail,
              noHp: cleanedNoHp,
              ...(effectivePassword ? { password: effectivePassword, status: 'AKTIF' } : {}),
            }
          : u
      )
    );
    updateDynamicUserRole(nextNrp, editRole);
    setUpdatingUserNrp(targetNrp);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          nrp: targetNrp,
          originalNrp: preservedOldNrp,
          oldNrp: preservedOldNrp,
          newNrp: nextNrp,
          nama: cleanNamaNoRank,
          pangkat: editPangkat,
          role: editRole,
          statusKedinasan: editStatusKedinasan,
          jabatanTerakhir: cleanedJabatan || undefined,
          tanggalLahir: calc58.tanggalLahir,
          polda: editPolda || 'MABES POLRI',
          satker: composedSatker,
          email: cleanedEmail,
          secondaryEmail: cleanedSecondaryEmail,
          noHp: cleanedNoHp,
          password: effectivePassword,
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Data pengguna ${cleanNamaNoRank} (NRP ${nextNrp}) berhasil diperbarui.`,
          'success'
        );
        setEditingUser(null);
        await fetchAllData();
        if (onVerificationUpdate) onVerificationUpdate();
      } else {
        showToast(data.message || 'Gagal memperbarui data pengguna.', 'error');
        await fetchAllData();
      }
    } catch {
      showToast(
        `Data pengguna ${cleanNamaNoRank} (NRP ${nextNrp}) disimpan secara lokal.`,
        'success'
      );
      setEditingUser(null);
      if (onVerificationUpdate) onVerificationUpdate();
    } finally {
      setUpdatingUserNrp(null);
    }
  };

  // Opens Confirmation Modal instead of deleting immediately without confirmation
  const handleRequestDeleteUser = (user: AuthUser) => {
    const authCheck = getDeleteAuthorityCheck(user);
    if (!authCheck.allowed) {
      showToast(authCheck.reason || 'Akses ditolak untuk menghapus pengguna ini.', 'error');
      return;
    }
    setUserPendingDelete(user);
    setDeleteReason(
      user.isAdcAccount
        ? 'Penonaktifan akun ADC / staf pendamping'
        : 'Akun duplikat / ganda'
    );
  };

  const handleConfirmDeleteUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userPendingDelete) return;

    const user = userPendingDelete;
    const authCheck = getDeleteAuthorityCheck(user);
    if (!authCheck.allowed) {
      showToast(authCheck.reason || 'Akses ditolak untuk menghapus pengguna ini.', 'error');
      setUserPendingDelete(null);
      return;
    }

    const finalReason = deleteReason.trim() || 'Penghapusan akun melalui Manajemen User';
    const cleanNrp = (user.nrp || '').trim();
    const origFromId = user.id?.startsWith('u-') ? user.id.slice(2).trim() : '';
    const cleanOld = (user.oldNrp || origFromId || '').trim();
    const nrpsToTombstone = new Set<string>([cleanNrp, cleanOld].filter((n) => n && n !== '98010710'));

    // Also include any ADC accounts generated by this user
    users.forEach((u) => {
      if (u.isAdcAccount && (u.adcOfNrp === cleanNrp || (cleanOld && u.adcOfNrp === cleanOld))) {
        if (u.nrp && u.nrp !== '98010710') nrpsToTombstone.add(u.nrp.trim());
      }
    });

    setIsDeletingConfirmed(true);

    // Record to client audit log with full snapshot so user can be restored anytime
    appendClientAuditLog({
      action: 'HAPUS_USER',
      actorNrp: currentUserNrp || '98010710',
      actorName: adminName || 'Admin',
      actorRole: effectiveActorRole,
      targetNrp: user.nrp,
      targetName: stripRankFromName(user.nama) || user.nama,
      targetPangkat: user.pangkat,
      targetRole: user.role,
      reason: finalReason,
      details: `Menghapus akun ${user.pangkat || ''} ${stripRankFromName(user.nama) || user.nama} (NRP ${user.nrp} • Role: ${user.role})`,
      snapshotUser: { ...user },
    });

    if (typeof window !== 'undefined') {
      try {
        // 1. Add to client-side tombstone list ws96_deleted_nrps_v1
        const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
        const parsedDeleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
        const updatedDeleted = Array.from(
          new Set([...parsedDeleted, ...Array.from(nrpsToTombstone)].filter((n) => n && n !== '98010710'))
        );
        localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(updatedDeleted));

        // 2. Remove from ws96_user_overrides_v1
        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        if (rawUOv) {
          const parsedUOv = JSON.parse(rawUOv) || {};
          Object.keys(parsedUOv).forEach((k) => {
            const item = parsedUOv[k];
            if (
              nrpsToTombstone.has(k) ||
              (item?.nrp && nrpsToTombstone.has(item.nrp)) ||
              (item?.oldNrp && nrpsToTombstone.has(item.oldNrp)) ||
              (item?.isAdcAccount && item?.adcOfNrp && nrpsToTombstone.has(item.adcOfNrp))
            ) {
              delete parsedUOv[k];
            }
          });
          localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
        }

        // 3. Remove from ws96_member_overrides_v1
        const rawMOv = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMOv) {
          const parsedMOv = JSON.parse(rawMOv) || {};
          Object.keys(parsedMOv).forEach((k) => {
            const item = parsedMOv[k];
            if (
              nrpsToTombstone.has(k) ||
              (item?.nrp && nrpsToTombstone.has(item.nrp)) ||
              (item?.oldNrp && nrpsToTombstone.has(item.oldNrp))
            ) {
              delete parsedMOv[k];
            }
          });
          localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(parsedMOv));
        }

        // 4. Remove from wirasatya96_members cache
        const rawMembers = localStorage.getItem('wirasatya96_members');
        if (rawMembers) {
          const parsedMembers = JSON.parse(rawMembers);
          if (Array.isArray(parsedMembers)) {
            const filteredMembers = parsedMembers.filter(
              (m: any) =>
                !nrpsToTombstone.has((m.nrp || '').trim()) &&
                !(m.oldNrp && nrpsToTombstone.has(String(m.oldNrp).trim()))
            );
            localStorage.setItem('wirasatya96_members', JSON.stringify(filteredMembers));
          }
        }

        // 5. Notify page.tsx in 0ms
        window.dispatchEvent(
          new CustomEvent('ws96_user_deleted', { detail: { nrps: Array.from(nrpsToTombstone) } })
        );
      } catch {
        // ignore storage errors
      }
    }

    // Immediate 0ms optimistic removal from state so deleted item never flickers back
    setUsers((prev) =>
      prev.filter(
        (u) =>
          !nrpsToTombstone.has((u.nrp || '').trim()) &&
          !(u.oldNrp && nrpsToTombstone.has(u.oldNrp.trim())) &&
          !(u.isAdcAccount && u.adcOfNrp && nrpsToTombstone.has(u.adcOfNrp.trim()))
      )
    );
    setRegistrations((prev) => prev.filter((r) => !nrpsToTombstone.has((r.nrp || '').trim())));
    setUserPendingDelete(null);

    setUpdatingUserNrp(user.nrp);
    try {
      const res = await fetch(`/api/users?nrp=${encodeURIComponent(user.nrp)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: user.nrp,
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
          reason: finalReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Pengguna ${stripRankFromName(user.nama) || user.nama} (NRP ${user.nrp}) dihapus & tercatat di Log Audit.`,
          'success'
        );
        if (onVerificationUpdate) onVerificationUpdate();
      } else {
        showToast(
          data.message || `Pengguna ${stripRankFromName(user.nama) || user.nama} (NRP ${user.nrp}) dihapus & tercatat di Log Audit.`,
          data.message ? 'error' : 'success'
        );
        if (onVerificationUpdate) onVerificationUpdate();
      }
    } catch {
      showToast(
        `Pengguna ${stripRankFromName(user.nama) || user.nama} (NRP ${user.nrp}) dihapus & tercatat di Log Audit.`,
        'success'
      );
      if (onVerificationUpdate) onVerificationUpdate();
    } finally {
      setUpdatingUserNrp(null);
      setIsDeletingConfirmed(false);
    }
  };

  const handleRestoreDeletedUser = async (logEntry: UserAuditLog) => {
    const rawTargetNama = logEntry.targetNama || logEntry.targetName || logEntry.targetNrp;
    const restoredUser: AuthUser = logEntry.snapshotUser || {
      id: `u-${logEntry.targetNrp}`,
      profileId: `ws-${logEntry.targetNrp}`,
      nrp: logEntry.targetNrp,
      nama: stripRankFromName(rawTargetNama) || rawTargetNama,
      pangkat: logEntry.targetPangkat || 'Kombes Pol',
      role: (logEntry.targetRole && logEntry.targetRole !== 'ADC' ? logEntry.targetRole : 'ANGGOTA') as UserRole,
      email: `${logEntry.targetNrp}@polri.go.id`,
      satker: 'Mabes Polri',
      polda: 'MABES POLRI',
      mfaEnabled: false,
      mfaMethod: 'PIN' as const,
      status: 'AKTIF' as const,
    };

    const cleanNrp = restoredUser.nrp.trim();
    const cleanOld = ((restoredUser as AuthUser).oldNrp || '').trim();
    setRestoringLogId(logEntry.id);

    if (typeof window !== 'undefined') {
      try {
        const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
        if (rawDeleted) {
          const parsedDeleted: string[] = JSON.parse(rawDeleted) || [];
          const nextDeleted = parsedDeleted.filter((n) => n !== cleanNrp && (!cleanOld || n !== cleanOld));
          localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(nextDeleted));
        }

        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        const parsedUOv = rawUOv ? JSON.parse(rawUOv) : {};
        parsedUOv[cleanNrp] = {
          ...restoredUser,
          nama: stripRankFromName(restoredUser.nama) || restoredUser.nama,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
      } catch {
        // ignore
      }
    }

    appendClientAuditLog({
      action: 'PULIHKAN_USER',
      actorNrp: currentUserNrp || '98010710',
      actorName: adminName || 'Admin',
      actorRole: effectiveActorRole,
      targetNrp: restoredUser.nrp,
      targetNama: stripRankFromName(restoredUser.nama) || restoredUser.nama,
      targetPangkat: restoredUser.pangkat,
      targetRole: restoredUser.role,
      details: `Memulihkan (Restore) akun pengguna yang sebelumnya dihapus`,
    });

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESTORE_USER',
          snapshotUser: restoredUser,
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
        }),
      });
      const data = await res.json();
      await fetchAllData();
      if (onVerificationUpdate) onVerificationUpdate();
      showToast(
        data.message || `Akun ${stripRankFromName(restoredUser.nama) || restoredUser.nama} (NRP ${restoredUser.nrp}) berhasil dipulihkan!`,
        'success'
      );
    } catch {
      await fetchAllData();
      if (onVerificationUpdate) onVerificationUpdate();
      showToast(
        `Akun ${stripRankFromName(restoredUser.nama) || restoredUser.nama} (NRP ${restoredUser.nrp}) berhasil dipulihkan!`,
        'success'
      );
    } finally {
      setRestoringLogId(null);
    }
  };

  const handleResetUserPassword = async (target: {
    nrp: string;
    nama?: string;
    pangkat?: string;
    role?: UserRole | 'ADC';
  }) => {
    const cleanNrp = (target.nrp || '').trim();
    if (!cleanNrp) return;
    const existingUser = users.find((u) => u.nrp === cleanNrp);
    const cleanNama = stripRankFromName(target.nama || existingUser?.nama || cleanNrp) || target.nama || existingUser?.nama || cleanNrp;
    const cleanPangkat = target.pangkat || existingUser?.pangkat || 'Kombes Pol';
    const cleanRole: UserRole =
      target.role && target.role !== 'ADC'
        ? target.role
        : existingUser?.role || 'ANGGOTA';
    const defaultPwd = `WS96@${cleanNrp}`;
    const nowIso = new Date().toISOString();

    setUsers((prev) =>
      prev.map((u) =>
        u.nrp === cleanNrp
          ? { ...u, password: defaultPwd, status: 'AKTIF', updatedAt: nowIso }
          : u
      )
    );

    if (typeof window !== 'undefined') {
      try {
        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        const parsedUOv = rawUOv ? JSON.parse(rawUOv) : {};
        parsedUOv[cleanNrp] = {
          ...(existingUser || {}),
          ...(parsedUOv[cleanNrp] || {}),
          nrp: cleanNrp,
          nama: cleanNama,
          pangkat: cleanPangkat,
          role: cleanRole,
          password: defaultPwd,
          status: 'AKTIF',
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
      } catch {
        // ignore
      }
    }

    appendClientAuditLog({
      action: 'RESET_PASSWORD',
      actorNrp: currentUserNrp || '98010710',
      actorName: adminName || 'Admin',
      actorRole: effectiveActorRole,
      targetNrp: cleanNrp,
      targetNama: cleanNama,
      targetPangkat: cleanPangkat,
      targetRole: cleanRole,
      details: `Mereset password akun ${cleanPangkat ? cleanPangkat + ' ' : ''}${cleanNama} kembali ke default: ${defaultPwd}`,
    });

    setUpdatingUserNrp(cleanNrp);
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESET_PASSWORD',
          nrp: cleanNrp,
          password: defaultPwd,
          status: 'AKTIF',
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
        }),
      });
    } catch {
      // ignore network error; local override is already saved
    } finally {
      setUpdatingUserNrp(null);
    }

    showToast(`Password ${cleanNama} berhasil di-reset ke default: WS96@${cleanNrp}`, 'success');
    if (onVerificationUpdate) onVerificationUpdate();
  };

  const handleVerify = async (reg: PendingRegistration, action: 'APPROVE' | 'REJECT') => {
    setActionLoadingId(reg.id);
    const assignedRole = selectedApproveRoles[reg.id] || 'ANGGOTA';
    const nextStatus = action === 'APPROVE' ? 'DISETUJUI_BELUM_PASSWORD' : 'DITOLAK';
    const nowIso = new Date().toISOString();
    const cleanRegNama = stripRankFromName(reg.nama) || reg.nama;

    appendClientAuditLog({
      action: 'VERIFIKASI_PENDAFTAR',
      actorNrp: currentUserNrp || '98010710',
      actorName: adminName || 'Admin',
      actorRole: effectiveActorRole,
      targetNrp: reg.nrp,
      targetName: cleanRegNama,
      targetPangkat: reg.pangkat,
      targetRole: assignedRole,
      details:
        action === 'APPROVE'
          ? `Menyetujui pendaftaran akun sebagai ${assignedRole}`
          : `Menolak pengajuan pendaftaran akun`,
    });

    if (typeof window !== 'undefined') {
      try {
        const rawRegOv = localStorage.getItem('ws96_reg_overrides_v1');
        const parsedRegOv = rawRegOv ? JSON.parse(rawRegOv) : {};
        parsedRegOv[reg.nrp] = {
          ...reg,
          nama: cleanRegNama,
          status: nextStatus,
          role: assignedRole,
          verifiedBy: adminName || 'Admin / Sekretaris WS96',
          verifiedAt: nowIso,
        };
        localStorage.setItem('ws96_reg_overrides_v1', JSON.stringify(parsedRegOv));

        if (action === 'APPROVE') {
          const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
          const parsedUOv = rawUOv ? JSON.parse(rawUOv) : {};
          parsedUOv[reg.nrp] = {
            ...(parsedUOv[reg.nrp] || {}),
            id: `u-${reg.nrp}`,
            profileId: `ws-${reg.nrp}`,
            nrp: reg.nrp,
            nama: cleanRegNama,
            pangkat: reg.pangkat || 'Kombes Pol',
            role: assignedRole,
            satker: reg.satker || 'Mabes Polri',
            polda: reg.polda || 'MABES POLRI',
            email: reg.email || `${reg.nrp}@polri.go.id`,
            secondaryEmail: reg.secondaryEmail,
            noHp: reg.noHp || '',
            status: 'DISETUJUI_BELUM_PASSWORD',
            updatedAt: nowIso,
          };
          localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
        }
      } catch {
        // ignore
      }
    }

    setRegistrations((prev) =>
      prev.map((r) =>
        r.id === reg.id || r.nrp === reg.nrp
          ? {
              ...r,
              nama: cleanRegNama,
              status: nextStatus,
              verifiedBy: adminName || 'Admin / Sekretaris WS96',
              verifiedAt: nowIso,
            }
          : r
      )
    );

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reg.id,
          nrp: reg.nrp,
          action,
          role: assignedRole,
          verifierName: adminName || 'Admin / Sekretaris WS96',
        }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(
          action === 'APPROVE' 
            ? `Pendaftaran ${cleanRegNama} disetujui sebagai ${assignedRole}!` 
            : `Pendaftaran ${cleanRegNama} telah ditolak.`,
          'success'
        );
        await fetchAllData();
        if (onVerificationUpdate) onVerificationUpdate();
      } else {
        showToast(
          action === 'APPROVE'
            ? `Pendaftaran ${cleanRegNama} disetujui sebagai ${assignedRole}!`
            : `Pendaftaran ${cleanRegNama} telah ditolak.`,
          'success'
        );
        if (onVerificationUpdate) onVerificationUpdate();
      }
    } catch {
      showToast(
        action === 'APPROVE'
          ? `Pendaftaran ${cleanRegNama} disetujui sebagai ${assignedRole}!`
          : `Pendaftaran ${cleanRegNama} telah ditolak.`,
        'success'
      );
      if (onVerificationUpdate) onVerificationUpdate();
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetAddUserForm = () => {
    setNewNrp('');
    setNewNama('');
    setNewEmail('');
    setNewSecondaryEmail('');
    setNewNoHp('');
    setNewPassword('');
    setNewConfirmPassword('');
    setNewRole('ANGGOTA');
    setNewPolda('');
    setNewSatkerUtama('');
    setNewSubSatker('');
    setNewComposedSatker('');
    setNewKodeSatker('');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNrp.trim() || !newNama.trim()) {
      showToast('NRP dan Nama Lengkap wajib diisi.', 'error');
      return;
    }
    if (!newPolda || !newComposedSatker) {
      showToast('Silakan pilih Satker Melekat terlebih dahulu melalui tombol Pilih Satker Berjenjang.', 'error');
      openSatkerPicker('ADD');
      return;
    }
    if (newPassword.trim() && newConfirmPassword.trim() && newPassword.trim() !== newConfirmPassword.trim()) {
      showToast('Konfirmasi Password tidak cocok dengan Password.', 'error');
      return;
    }

    const cleanNrp = newNrp.trim();
    const cleanNama = stripRankFromName(newNama.trim()) || newNama.trim();
    const cleanSatker = newComposedSatker || newSatkerUtama || 'MABES POLRI';
    const cleanPolda = newPolda || 'MABES POLRI';
    const rawEmail = newEmail.trim();
    const resolvedEmail =
      !rawEmail
        ? `${cleanNrp}@polri.go.id`
        : /^\d+$/.test(rawEmail)
        ? `${rawEmail}@polri.go.id`
        : rawEmail;
    const calc58 = calculateRetirement58(undefined, cleanNrp);
    const nowIso = new Date().toISOString();

    appendClientAuditLog({
      action: 'TAMBAH_USER',
      actorNrp: currentUserNrp || '98010710',
      actorName: adminName || 'Admin',
      actorRole: effectiveActorRole,
      targetNrp: cleanNrp,
      targetName: cleanNama,
      targetPangkat: newPangkat,
      targetRole: newRole,
      details: `Menambahkan pengguna baru pada satker ${cleanSatker} (${cleanPolda})`,
    });

    if (typeof window !== 'undefined') {
      try {
        // 1. Remove from ws96_deleted_nrps_v1 if previously deleted
        const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
        if (rawDeleted) {
          const parsedDeleted: string[] = JSON.parse(rawDeleted);
          const nextDeleted = parsedDeleted.filter((n) => n !== cleanNrp);
          localStorage.setItem('ws96_deleted_nrps_v1', JSON.stringify(nextDeleted));
        }

        // 2. Persist in ws96_user_overrides_v1 so serverless cold starts never lose newly added user
        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        const parsedUOv = rawUOv ? JSON.parse(rawUOv) : {};
        parsedUOv[cleanNrp] = {
          id: `u-${cleanNrp}`,
          profileId: `ws-${cleanNrp}`,
          nrp: cleanNrp,
          nama: cleanNama,
          pangkat: newPangkat,
          role: newRole,
          satker: cleanSatker,
          polda: cleanPolda,
          jabatanTerakhir: isOfficerRankIpdaUp(newPangkat) ? `Perwira ${cleanSatker}` : 'Staf',
          tanggalLahir: calc58.tanggalLahir,
          email: resolvedEmail,
          secondaryEmail: newSecondaryEmail.trim() || undefined,
          noHp: newNoHp.trim(),
          fotoUrl: '/default-avatar.png',
          status: newPassword.trim() ? 'AKTIF' : 'DISETUJUI_BELUM_PASSWORD',
          ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));

        // 3. Persist in ws96_member_overrides_v1 as well
        const rawMOv = localStorage.getItem('ws96_member_overrides_v1');
        const parsedMOv = rawMOv ? JSON.parse(rawMOv) : {};
        parsedMOv[cleanNrp] = {
          id: `ws-${cleanNrp}`,
          nrp: cleanNrp,
          namaLengkap: cleanNama,
          pangkat: newPangkat,
          jabatanTerakhir: isOfficerRankIpdaUp(newPangkat) ? `Perwira ${cleanSatker}` : 'Staf',
          satuanKerja: cleanSatker,
          polda: cleanPolda,
          tipeSatker: cleanPolda === 'MABES POLRI' ? 'MABES' : 'POLDA',
          pendidikanTerakhir: isOfficerRankIpdaUp(newPangkat) ? 'Akpol 1996' : 'Diktukba Polri',
          tempatLahir: 'Jakarta',
          tanggalLahir: calc58.tanggalLahir,
          usia: calc58.usiaTahun,
          jenisKelamin: 'LAKI-LAKI',
          noHp: newNoHp.trim(),
          email: resolvedEmail,
          secondaryEmail: newSecondaryEmail.trim() || undefined,
          fotoUrl: '/default-avatar.png',
          alamatTempatTinggal: cleanPolda,
          statusTempatTinggal: 'MILIK PRIBADI',
          statusPerkawinan: 'MENIKAH',
          jumlahAnak: 0,
          daftarAnak: [],
          tahunPurnaTugas: calc58.tahunPurnaTugas,
          sisaTahunDinas: calc58.sisaTahunDinas,
          alamatPurnaTugas: cleanPolda,
          statusRumahPurnaTugas: 'MILIK PRIBADI',
          sudahPembekalan: 'SUDAH',
          rencanaAktivitas: ['USAHA SENDIRI'],
          sumberPenghasilanPasca: ['DANA PENSIUN'],
          kecukupanDanaPensiun: 'CUKUP',
          kesiapanPensiun: 'SIAP',
          perasaanPensiun: 'OPTIMIS',
          dukunganKeluarga: 'SANGAT MENDUKUNG',
          adaPenyakitKronis: 'TIDAK ADA',
          kondisiKesehatan: 'BAIK',
          daftarPenyakit: [],
          asuransiAktif: ['BPJS'],
          rutinMcu: 'YA',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(parsedMOv));
      } catch {
        // ignore
      }
    }

    setCreatingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: cleanNrp,
          nama: cleanNama,
          pangkat: newPangkat,
          role: newRole,
          satker: cleanSatker,
          polda: cleanPolda,
          email: resolvedEmail,
          secondaryEmail: newSecondaryEmail.trim() || undefined,
          noHp: newNoHp.trim(),
          password: newPassword.trim() || undefined,
          actorNrp: currentUserNrp || '98010710',
          actorName: adminName || 'Admin',
          actorRole: effectiveActorRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Pengguna baru berhasil ditambahkan!', 'success');
        resetAddUserForm();
        setShowAddUserModal(false);
        await fetchAllData();
        if (onVerificationUpdate) onVerificationUpdate();
        setActiveTab('USERS');
      } else {
        showToast(data.message || 'Gagal menambahkan pengguna.', 'error');
      }
    } catch {
      showToast(`Pengguna ${cleanNama} (NRP ${cleanNrp}) berhasil ditambahkan!`, 'success');
      resetAddUserForm();
      setShowAddUserModal(false);
      await fetchAllData();
      if (onVerificationUpdate) onVerificationUpdate();
      setActiveTab('USERS');
    } finally {
      setCreatingUser(false);
    }
  };

  const visibleRoleOptions = useMemo(
    () => ROLE_OPTIONS.filter((r) => r.value !== 'SUPERADMIN'),
    []
  );

  const visibleUsers = useMemo(
    () => users.filter((u) => u.role !== 'SUPERADMIN' && u.nrp !== '98010710'),
    [users]
  );

  // Precompute clean name (without rank) & StatusKedinasan once per `users` update (eliminates 4,500x JSON.parse in .sort)
  const { userStatusByNrpMap, cleanNameByNrpMap } = useMemo(() => {
    const statusMap = new Map<string, StatusKedinasan>();
    const nameMap = new Map<string, string>();
    const isValidStatus = (val: unknown): val is StatusKedinasan =>
      val === 'AKTIF' || val === 'PURNA_TUGAS' || val === 'PTDH' || val === 'ALMARHUM';

    let mOvByNrp = new Map<string, any>();
    let uOvByNrp = new Map<string, any>();
    if (typeof window !== 'undefined') {
      try {
        const rawMemberOv = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMemberOv) {
          const parsed = JSON.parse(rawMemberOv) || {};
          Object.values(parsed).forEach((item: any) => {
            if (!item) return;
            if (item.nrp) mOvByNrp.set(String(item.nrp).trim(), item);
            if (item.oldNrp) mOvByNrp.set(String(item.oldNrp).trim(), item);
          });
        }
      } catch {
        // ignore
      }
      try {
        const rawUserOv = localStorage.getItem('ws96_user_overrides_v1');
        if (rawUserOv) {
          const parsed = JSON.parse(rawUserOv) || {};
          Object.values(parsed).forEach((item: any) => {
            if (!item) return;
            if (item.nrp) uOvByNrp.set(String(item.nrp).trim(), item);
            if (item.oldNrp) uOvByNrp.set(String(item.oldNrp).trim(), item);
          });
        }
      } catch {
        // ignore
      }
    }

    for (const u of users) {
      const cleanNrp = (u.nrp || '').trim();
      const origFromId = u.id?.startsWith('u-') ? u.id.slice(2).trim() : '';
      const cleanOld = (u.oldNrp || origFromId || '').trim();
      const cleanName = stripRankFromName(u.nama) || u.nama;
      nameMap.set(cleanNrp, cleanName);

      const mOv = mOvByNrp.get(cleanNrp) || (cleanOld ? mOvByNrp.get(cleanOld) : undefined);
      const uOv = uOvByNrp.get(cleanNrp) || (cleanOld ? uOvByNrp.get(cleanOld) : undefined);

      const mSt = mOv?.statusKedinasan || mOv?.statusDinas;
      const uSt = uOv?.statusKedinasan;
      let resolved: StatusKedinasan | undefined;

      if (isValidStatus(mSt) && isValidStatus(uSt)) {
        const mTs = mOv?.updatedAt ? new Date(mOv.updatedAt).getTime() || 2 : 2;
        const uTs = uOv?.updatedAt ? new Date(uOv.updatedAt).getTime() || 1 : 1;
        resolved = mTs >= uTs ? mSt : uSt;
      } else if (isValidStatus(mSt)) {
        resolved = mSt;
      } else if (isValidStatus(uSt)) {
        resolved = uSt;
      } else if (isValidStatus(u.statusKedinasan)) {
        resolved = u.statusKedinasan;
      } else {
        const baseName = cleanName.split(',')[0].trim().toLowerCase();
        const matchedMember =
          AKPOL_MEMBER_BY_NRP.get(cleanNrp) ||
          (cleanOld ? AKPOL_MEMBER_BY_NRP.get(cleanOld) : undefined) ||
          (baseName ? AKPOL_MEMBER_BY_BASENAME.get(baseName) : undefined);
        resolved = detectStatusKedinasan(
          matchedMember?.statusKedinasan || matchedMember?.statusDinas,
          mOv?.jabatanTerakhir || uOv?.jabatanTerakhir || u.jabatanTerakhir || matchedMember?.jabatanTerakhir
        );
      }

      statusMap.set(cleanNrp, resolved || 'AKTIF');
    }

    return { userStatusByNrpMap: statusMap, cleanNameByNrpMap: nameMap };
  }, [users]);

  const resolveUserStatusKedinasan = useCallback(
    (u: AuthUser): StatusKedinasan =>
      userStatusByNrpMap.get((u.nrp || '').trim()) || u.statusKedinasan || 'AKTIF',
    [userStatusByNrpMap]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return visibleUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.nama.toLowerCase().includes(q) ||
        u.nrp.toLowerCase().includes(q) ||
        (u.satker || '').toLowerCase().includes(q) ||
        (u.polda || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.secondaryEmail || '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [visibleUsers, userSearch, roleFilter]);

  const sortedUsers = useMemo(() => {
    const cmpStatus = (a: AuthUser, b: AuthUser) =>
      getStatusKedinasanOrder(resolveUserStatusKedinasan(a)) -
      getStatusKedinasanOrder(resolveUserStatusKedinasan(b));
    const cmpPangkat = (a: AuthUser, b: AuthUser) =>
      getPangkatRankOrder(a.pangkat) - getPangkatRankOrder(b.pangkat);
    const cmpLevelSatker = (a: AuthUser, b: AuthUser) =>
      getLevelSatkerOrder(a.satker, a.polda) - getLevelSatkerOrder(b.satker, b.polda);
    const cmpNrp = (a: AuthUser, b: AuthUser) => {
      const digitsA = (a.nrp || '').replace(/\D/g, '');
      const digitsB = (b.nrp || '').replace(/\D/g, '');
      const prefixA = parseInt(digitsA.slice(0, 8) || '0', 10);
      const prefixB = parseInt(digitsB.slice(0, 8) || '0', 10);
      if (prefixA !== prefixB) return prefixA - prefixB;
      return digitsA.localeCompare(digitsB, undefined, { numeric: true });
    };
    const cmpNama = (a: AuthUser, b: AuthUser) => {
      const nameA = cleanNameByNrpMap.get((a.nrp || '').trim()) || a.nama;
      const nameB = cleanNameByNrpMap.get((b.nrp || '').trim()) || b.nama;
      return nameA.localeCompare(nameB, 'id');
    };
    const cmpRole = (a: AuthUser, b: AuthUser) =>
      getRoleRankOrder(a.role) - getRoleRankOrder(b.role);

    return [...filteredUsers].sort((a, b) => {
      if (sortBy === 'NRP') {
        const nrpDiff = sortDesc ? -cmpNrp(a, b) : cmpNrp(a, b);
        return (
          nrpDiff ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b)
        );
      }
      if (sortBy === 'NAMA') {
        const namaDiff = sortDesc ? -cmpNama(a, b) : cmpNama(a, b);
        return (
          namaDiff ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpRole(a, b)
        );
      }

      const dir = sortDesc ? 1 : -1;
      let res = 0;
      if (sortBy === 'PANGKAT_UTAMA') {
        res =
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b) ||
          cmpStatus(a, b);
      } else if (sortBy === 'STATUS') {
        res =
          cmpStatus(a, b) ||
          cmpNrp(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'PANGKAT') {
        res =
          cmpPangkat(a, b) ||
          cmpStatus(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'LEVEL_SATKER') {
        res =
          cmpLevelSatker(a, b) ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      } else if (sortBy === 'ROLE') {
        res =
          cmpRole(a, b) ||
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b);
      } else {
        res =
          cmpStatus(a, b) ||
          cmpPangkat(a, b) ||
          cmpLevelSatker(a, b) ||
          cmpNrp(a, b) ||
          cmpNama(a, b) ||
          cmpRole(a, b);
      }
      return res * dir;
    });
  }, [filteredUsers, sortBy, sortDesc, resolveUserStatusKedinasan, cleanNameByNrpMap]);

  const regByNrpMap = useMemo(() => {
    const map = new Map<string, PendingRegistration>();
    registrations.forEach((r) => {
      if (r.nrp) map.set(r.nrp.trim(), r);
    });
    return map;
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    const q = regSearch.toLowerCase();
    return registrations.filter((r) => {
      if (r.nrp === '98010710') return false;
      const matchesSearch =
        !q ||
        r.nama.toLowerCase().includes(q) ||
        r.nrp.includes(q) ||
        r.satker.toLowerCase().includes(q) ||
        r.polda.toLowerCase().includes(q);
      if (filterStatus === 'ALL') return matchesSearch;
      return matchesSearch && r.status === filterStatus;
    });
  }, [registrations, regSearch, filterStatus]);

  const pendingCount = useMemo(
    () =>
      registrations.filter(
        (r) => r.nrp !== '98010710' && r.status === 'PENDING_VERIFIKASI'
      ).length,
    [registrations]
  );

  // Reset progressive render limit when search or filter changes
  useEffect(() => {
    setVisibleUserLimit(45);
  }, [userSearch, roleFilter, sortBy, sortDesc]);

  // Automatically load next batch when scrolling down the page in asPage mode
  useEffect(() => {
    if (!asPage || activeTab !== 'USERS' || visibleUserLimit >= sortedUsers.length) return;
    const handleWindowScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        setVisibleUserLimit((prev) => Math.min(sortedUsers.length, prev + 60));
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [asPage, activeTab, visibleUserLimit, sortedUsers.length]);

  const isUserAccountActive = (u: AuthUser, regInfo?: PendingRegistration): boolean => {
    if (u.status === 'DITOLAK' || regInfo?.status === 'DITOLAK') return false;
    if (u.status === 'PENDING_VERIFIKASI' || regInfo?.status === 'PENDING_VERIFIKASI') return false;
    // All registered alumni & staff accounts have default password WS96@NRP and are immediately active
    return true;
  };

  // Shared 2-Column CAS Add User Form Content
  const renderCasAddUserForm = (onCancel: () => void) => (
    <form onSubmit={handleAddUser} autoComplete="off" className="space-y-5 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KOLOM KIRI: IDENTITAS & SATKER */}
        <div className="space-y-3.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 pb-1 border-b border-slate-100">
            <IdCard className="w-4 h-4" />
            <span>🪪 IDENTITAS &amp; SATKER</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Nama Lengkap &amp; Gelar <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              name="ws96_new_nama"
              value={newNama}
              onChange={(e) => setNewNama(e.target.value)}
              placeholder="Contoh: Budi Santoso, S.I.K., M.Si. (Tanpa Pangkat)"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              NRP / NIP (wajib angka) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              name="ws96_new_nrp"
              value={newNrp}
              onChange={(e) => handleNewNrpChange(e.target.value)}
              placeholder="Contoh: 74000000"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pangkat</label>
              <select
                value={newPangkat}
                onChange={(e) => setNewPangkat(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              >
                {PANGKAT_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role Akses <span className="text-red-600">*</span>
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              >
                {visibleRoleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SATKER MELEKAT (ALA CAS) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Satker Melekat <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-col gap-2 min-w-0">
              <div
                onClick={() => openSatkerPicker('ADD')}
                className={`w-full min-w-0 overflow-hidden px-3 py-2.5 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors ${
                  newComposedSatker
                    ? 'bg-slate-50 border-slate-200 hover:border-blue-400'
                    : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400'
                }`}
              >
                {newComposedSatker ? (
                  <>
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="font-bold text-slate-900 block truncate text-[11px]">
                        {newComposedSatker}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                        <span className="truncate">{newPolda}</span>
                        {newKodeSatker && (
                          <span className="font-mono text-slate-400 shrink-0">({newKodeSatker})</span>
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1.5">
                    <span>🔒 — Belum Memilih Satker —</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => openSatkerPicker('ADD')}
                className="w-full px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Pilih Satker Berjenjang</span>
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: AKUN & KREDENSIAL */}
        <div className="space-y-3.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 pb-1 border-b border-slate-100">
            <Lock className="w-4 h-4" />
            <span>🔐 AKUN &amp; KREDENSIAL</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Dinas (@polri.go.id)
            </label>
            <input
              type="email"
              autoComplete="off"
              name="ws96_new_email_dinas"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onBlur={() => {
                if (/^\d+$/.test(newEmail.trim())) {
                  setNewEmail(`${newEmail.trim()}@polri.go.id`);
                }
              }}
              placeholder={newNrp ? `${newNrp}@polri.go.id` : 'nrp@polri.go.id'}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Sekunder / Pribadi <span className="text-slate-400 font-normal">(Opsional — misal Gmail, Yahoo)</span>
            </label>
            <input
              type="email"
              autoComplete="off"
              name="ws96_new_email_sekunder"
              value={newSecondaryEmail}
              onChange={(e) => setNewSecondaryEmail(e.target.value)}
              placeholder="Contoh: superadmin@example.com"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
            <input
              type="tel"
              autoComplete="off"
              name="ws96_new_nohp"
              value={newNoHp}
              onChange={(e) => setNewNoHp(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  name="ws96_new_password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kosongkan jika set mandiri"
                  className="w-full pl-3.5 pr-8 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Konfirmasi Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  name="ws96_new_confirm_password"
                  value={newConfirmPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full pl-3.5 pr-8 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
        {onOpenFullWizard ? (
          <button
            type="button"
            onClick={() => {
              setShowAddUserModal(false);
              if (!asPage) onClose();
              onOpenFullWizard();
            }}
            className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-[11px] flex items-center gap-1.5"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span className="sm:hidden">Form Lengkap</span>
            <span className="hidden sm:inline">Form Pendataan Lengkap (5 Tahap)</span>
          </button>
        ) : <span />}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 font-bold text-xs transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={creatingUser}
            className="px-5 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span className="sm:hidden">{creatingUser ? 'Menyimpan...' : 'Simpan'}</span>
            <span className="hidden sm:inline">{creatingUser ? 'Menyimpan...' : 'Simpan Pengguna'}</span>
          </button>
        </div>
      </div>
    </form>
  );

  const innerContent = (
    <div
      data-no-reveal="true"
      className={
        asPage
          ? 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col'
          : 'bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-4 sm:p-5 text-white flex items-center justify-between border-b border-red-900/50 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/60 border border-red-700/50 flex items-center justify-center text-amber-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-1.5 relative">
                <span>User</span>
                <button
                  type="button"
                  onClick={() => setShowUserHeaderInfo((prev) => !prev)}
                  title="Kelola daftar pengguna, hak akses role, verifikasi pendaftaran, serta log audit & pemulihan akun"
                  className="inline-flex items-center text-slate-300 hover:text-white cursor-pointer focus:outline-none"
                >
                  <Info className="w-4 h-4" />
                </button>
                {showUserHeaderInfo && (
                  <div className="absolute left-0 top-7 z-30 w-64 sm:w-80 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-normal text-slate-200 shadow-xl leading-relaxed">
                    Kelola daftar pengguna, hak akses role, verifikasi pendaftaran, serta log audit &amp; pemulihan akun.
                  </div>
                )}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                <span className="sm:hidden">
                  {currentUserRole === 'SUPERADMIN' ? 'Superadmin' : currentUserRole === 'KETUA' ? 'Ketua' : 'Sekretaris'}
                </span>
                <span className="hidden sm:inline">
                  Otoritas: {currentUserRole === 'SUPERADMIN' ? 'Superadmin' : currentUserRole === 'KETUA' ? 'Ketua Angkatan' : 'Sekretaris'}
                </span>
              </span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-700 text-white text-[10px] font-extrabold animate-pulse">
                  <span className="sm:hidden">{pendingCount} Menunggu</span>
                  <span className="hidden sm:inline">{pendingCount} Menunggu Verifikasi</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {!asPage && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-100 px-4 pt-2 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTab('USERS')}
            className={`py-2.5 px-4 border-b-2 text-xs font-semibold flex items-center gap-2 cursor-pointer select-none transition-colors rounded-t-xl whitespace-nowrap ${
              activeTab === 'USERS'
                ? 'bg-white text-red-900 border-red-800 shadow-sm'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Pengguna ({visibleUsers.length})</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTab('VERIFICATION')}
            className={`py-2.5 px-4 border-b-2 text-xs font-semibold flex items-center gap-2 cursor-pointer select-none transition-colors rounded-t-xl whitespace-nowrap ${
              activeTab === 'VERIFICATION'
                ? 'bg-white text-red-900 border-red-800 shadow-sm'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="sm:hidden">Verifikasi</span>
            <span className="hidden sm:inline">Verifikasi Pendaftaran</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-700 text-white text-[10px] font-extrabold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTab('AUDIT_LOG')}
            className={`py-2.5 px-4 border-b-2 text-xs font-semibold flex items-center gap-2 cursor-pointer select-none transition-colors rounded-t-xl whitespace-nowrap ${
              activeTab === 'AUDIT_LOG'
                ? 'bg-white text-red-900 border-red-800 shadow-sm'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Audit ({auditLogs.length})</span>
          </button>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={fetchAllData}
          disabled={loading}
          className="mb-1.5 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-800 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Segarkan data"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-800' : ''}`} />
        </button>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`py-2 px-4 text-xs font-semibold flex items-center gap-2 ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TAB 1: DAFTAR PENGGUNA */}
      {activeTab === 'USERS' && (
        <>
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-2.5">
            {/* Paling Kiri: Sorting Button Trigger -> Membuka Modal Pop-up List dengan Pilihan Ascend / Descend */}
            <SortTriggerBar
              sortBy={sortBy}
              sortDesc={sortDesc}
              onOpenModal={() => setIsSortModalOpen(true)}
              onToggleDirection={() => setSortDesc((prev) => !prev)}
            />

            {/* Searchbox di sebelah kanan tombol Sorting */}
            <div className="relative flex-1 min-w-[180px] sm:min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama, NRP, satker..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto text-xs flex-wrap sm:flex-nowrap shrink-0">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
                className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-800 shrink-0"
              >
                <option value="ALL">Semua Role ({visibleUsers.length})</option>
                {canImpersonate && <option value="SUPERADMIN">Superadmin</option>}
                <option value="KETUA">Ketua Paguyuban</option>
                <option value="SEKRETARIAT">Sekretaris</option>
                <option value="BENDAHARA">Bendahara</option>
                <option value="ANGGOTA">Anggota</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  resetAddUserForm();
                  setShowAddUserModal(true);
                }}
                title="Tambah Pengguna Baru"
                className="px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-white font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-colors shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="sm:hidden">Tambah</span>
                <span className="hidden sm:inline">Tambah Pengguna</span>
              </button>
            </div>
          </div>

          <SortModalPopup
            isOpen={isSortModalOpen}
            onClose={() => setIsSortModalOpen(false)}
            sortBy={sortBy}
            sortDesc={sortDesc}
            onSelectSort={(newKey, newDesc) => {
              setSortBy(newKey);
              setSortDesc(newDesc);
            }}
            contextTitle="Menu User (Daftar Pengguna)"
          />

          <div
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5"
            onScroll={(e) => {
              if (visibleUserLimit >= sortedUsers.length) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
                setVisibleUserLimit((prev) => Math.min(sortedUsers.length, prev + 60));
              }
            }}
          >
            {loading && users.length === 0 ? (
              <UserTableSkeleton rows={6} />
            ) : sortedUsers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-700 text-sm">Tidak ada pengguna ditemukan</p>
              </div>
            ) : (
              <>
                {sortedUsers.slice(0, visibleUserLimit).map((u) => {
                  const regInfo = regByNrpMap.get((u.nrp || '').trim());
                  const isActive = isUserAccountActive(u, regInfo);
                  const statusDinas = resolveUserStatusKedinasan(u);
                  const secondaryEmail = u.secondaryEmail || regInfo?.secondaryEmail;
                  const cleanSatker = (u.satker || 'Mabes Polri').split(' / ')[0].trim();
                  const dynamicJabatanAngkatan =
                    u.role === 'KETUA'
                      ? { short: 'Ketua Angkatan', full: 'Jabatan Angkatan: Ketua' }
                      : u.role === 'SEKRETARIAT'
                      ? { short: 'Sekretaris', full: 'Jabatan Angkatan: Sekretaris' }
                      : u.role === 'BENDAHARA'
                      ? { short: 'Bendahara', full: 'Jabatan Angkatan: Bendahara' }
                      : null;
                  const cleanNameNoRank = cleanNameByNrpMap.get((u.nrp || '').trim()) || stripRankFromName(u.nama) || u.nama;
                  const deleteAuth = getDeleteAuthorityCheck(u);

                  return (
                    <div
                      key={u.nrp}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 84px' }}
                      className="bg-white rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <span>{cleanNameNoRank}</span>
                          <MetaVerifiedBadge role={u.role} nrp={u.nrp} size="sm" />
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                          NRP {u.nrp}
                          {u.pangkat ? ` • ${u.pangkat}` : ''}
                        </span>
                        {dynamicJabatanAngkatan && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 font-bold text-amber-800">
                            <span className="sm:hidden">{dynamicJabatanAngkatan.short}</span>
                            <span className="hidden sm:inline">{dynamicJabatanAngkatan.full}</span>
                          </span>
                        )}
                        {statusDinas === 'ALMARHUM' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>Almarhum</span>
                          </span>
                        ) : statusDinas === 'PURNA_TUGAS' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Purna Tugas</span>
                          </span>
                        ) : statusDinas === 'PTDH' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-800 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>PTDH</span>
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 ml-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 ml-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span>Belum Aktivasi</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cleanSatker} &bull; {u.polda || 'MABES POLRI'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-600">
                            {u.email || `${u.nrp}@polri.go.id`}
                          </span>
                          {secondaryEmail && (
                            <span className="text-slate-400">
                              ({secondaryEmail})
                            </span>
                          )}
                        </span>
                        {(u.noHp || regInfo?.noHp) && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{u.noHp || regInfo?.noHp}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                          <span className="sm:hidden">ROLE</span>
                          <span className="hidden sm:inline">JABATAN ANGKATAN / ROLE</span>
                        </label>
                        <select
                          value={u.role}
                          disabled={updatingUserNrp === u.nrp}
                          onChange={(e) => handleRoleChange(u.nrp, e.target.value as UserRole)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-800 disabled:opacity-50"
                        >
                          {visibleRoleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.value === 'SEKRETARIAT' ? 'SEKRETARIS' : opt.value}
                            </option>
                          ))}
                        </select>
                      </div>

                      {canImpersonate && u.nrp !== '98010710' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onImpersonateUser) {
                              onImpersonateUser(u);
                            }
                          }}
                          disabled={updatingUserNrp === u.nrp}
                          className="mt-4 px-2.5 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Masuk sebagai akun ini (Impersonate Superadmin)"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Impersonate</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleResetUserPassword(u)}
                        disabled={updatingUserNrp === u.nrp}
                        className="mt-4 px-2.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                        title={`Reset password akun ini ke default: WS96@${u.nrp}`}
                      >
                        <span className="sm:hidden">🔑 Reset</span>
                        <span className="hidden sm:inline">🔑 Reset Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEditUser(u)}
                        disabled={updatingUserNrp === u.nrp}
                        className="mt-4 px-2.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Edit Data, Pangkat & Master Satker"
                      >
                        <Pencil className="w-3.5 h-3.5 text-red-800" />
                        <span>Edit</span>
                      </button>

                      {u.nrp !== '98010710' && (
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteUser(u)}
                          disabled={updatingUserNrp === u.nrp}
                          className={`mt-4 p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                            deleteAuth.allowed
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                          }`}
                          title={
                            deleteAuth.allowed
                              ? 'Hapus Pengguna (Dengan Konfirmasi & Pencatatan Log Audit)'
                              : deleteAuth.reason || 'Role Anda tidak memiliki otoritas menghapus pengguna ini'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {visibleUserLimit < sortedUsers.length && (
                <div className="pt-2 pb-1 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-4 py-3 text-xs">
                  <span className="text-slate-600 font-medium">
                    Menampilkan <strong className="text-slate-900">{visibleUserLimit}</strong> dari{' '}
                    <strong className="text-slate-900">{sortedUsers.length}</strong> pengguna
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleUserLimit((prev) => Math.min(sortedUsers.length, prev + 60))}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold transition-colors cursor-pointer"
                    >
                      Muat +60 Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleUserLimit(sortedUsers.length)}
                      className="px-3.5 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-white font-bold transition-colors cursor-pointer"
                    >
                      Tampilkan Semua ({sortedUsers.length})
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: VERIFIKASI PENDAFTARAN */}
      {activeTab === 'VERIFICATION' && (
        <>
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Cari nama, NRP, satker..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-800 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('PENDING_VERIFIKASI')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  filterStatus === 'PENDING_VERIFIKASI'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Menunggu ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('DISETUJUI_BELUM_PASSWORD')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  filterStatus === 'DISETUJUI_BELUM_PASSWORD'
                    ? 'bg-red-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Disetujui
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({registrations.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {filteredRegistrations.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-700 text-sm">Tidak ada pendaftaran dengan kriteria ini</p>
                <p className="text-xs text-slate-400 mt-1">
                  Semua alumni yang mendaftar telah diproses atau belum ada antrean baru.
                </p>
              </div>
            ) : (
              filteredRegistrations.map((reg) => (
                <div 
                  key={reg.id} 
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          {stripRankFromName(reg.nama) || reg.nama}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                          NRP {reg.nrp}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-900 font-bold border border-red-200">
                          {reg.pangkat}
                        </span>

                        {reg.status === 'PENDING_VERIFIKASI' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> <span className="sm:hidden">Menunggu</span><span className="hidden sm:inline">Menunggu Verifikasi</span>
                          </span>
                        )}
                        {reg.status === 'DISETUJUI_BELUM_PASSWORD' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> <span className="sm:hidden">Disetujui</span><span className="hidden sm:inline">Disetujui (Belum Set Password)</span>
                          </span>
                        )}
                        {reg.status === 'AKTIF' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> <span className="sm:hidden">Aktif</span><span className="hidden sm:inline">Akun Aktif</span>
                          </span>
                        )}
                        {reg.status === 'DITOLAK' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Ditolak
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{reg.satker} &bull; {reg.polda}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{reg.noHp || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{reg.email}</span>
                          {reg.secondaryEmail && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              &bull; Sekunder: {reg.secondaryEmail}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Diajukan: {new Date(reg.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                        </div>
                      </div>

                      {reg.alasanDaftar && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                          &quot;{reg.alasanDaftar}&quot;
                        </p>
                      )}

                      {reg.verifiedBy && (
                        <p className="text-[11px] text-slate-400 pt-1">
                          Diverifikasi oleh: <strong className="text-slate-600">{reg.verifiedBy}</strong> pada {new Date(reg.verifiedAt || '').toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col items-stretch sm:items-end gap-2 pt-2 sm:pt-0 flex-shrink-0">
                      {reg.status === 'PENDING_VERIFIKASI' ? (
                        <>
                          <div className="w-full sm:w-44">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              <span className="sm:hidden">Role:</span><span className="hidden sm:inline">Tetapkan Role Saat Disetujui:</span>
                            </label>
                            <select
                              value={selectedApproveRoles[reg.id] || 'ANGGOTA'}
                              onChange={(e) =>
                                setSelectedApproveRoles((prev) => ({
                                  ...prev,
                                  [reg.id]: e.target.value as UserRole,
                                }))
                              }
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                            >
                              {visibleRoleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value === 'SEKRETARIAT' ? 'SEKRETARIS' : opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex sm:flex-row gap-2 w-full sm:w-44">
                            <button
                              type="button"
                              onClick={() => handleVerify(reg, 'APPROVE')}
                              disabled={actionLoadingId === reg.id}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{actionLoadingId === reg.id ? '...' : 'Setujui'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerify(reg, 'REJECT')}
                              disabled={actionLoadingId === reg.id}
                              className="py-1.5 px-3 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </>
                      ) : reg.status === 'DISETUJUI_BELUM_PASSWORD' ? (
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-blue-700 block">Siap Aktivasi</span>
                          <span className="text-[10px] text-slate-400">
                            <span className="sm:hidden">Menunggu login</span>
                            <span className="hidden sm:inline">Menunggu alumni login &amp; buat password</span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* TAB 3: LOG AUDIT & RIWAYAT AKTIVITAS MANAJEMEN USER */}
      {activeTab === 'AUDIT_LOG' && (
        <>
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2.5">
            {/* Filter & Pencarian Log Audit + Tombol Info Matriks Otoritas (Ramah HP) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cari pelaku, target, NRP, keterangan..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-800 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value as 'ALL' | UserAuditAction)}
                  className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-800"
                >
                  <option value="ALL">Semua Aktivitas ({auditLogs.length})</option>
                  <option value="LOGIN_ADC">Login ADC</option>
                  <option value="AKTIVITAS_ADC">Aktivitas ADC</option>
                  <option value="PERMINTAAN_RESET_PASSWORD">Lupa Password</option>
                  <option value="RESET_PASSWORD">Reset Password</option>
                  <option value="HAPUS_USER">Hapus Pengguna</option>
                  <option value="PULIHKAN_USER">Pulihkan Pengguna</option>
                  <option value="TAMBAH_USER">Tambah Pengguna</option>
                  <option value="EDIT_USER">Edit Pengguna</option>
                  <option value="UBAH_ROLE">Ubah Role</option>
                  <option value="VERIFIKASI_PENDAFTAR">Verifikasi</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowAuditMatrixInfo((prev) => !prev)}
                  title="Lihat Matriks Otoritas & Hak Hapus Pengguna"
                  className={`sm:hidden px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 shrink-0 transition-colors ${
                    showAuditMatrixInfo
                      ? 'bg-red-900 text-white border-red-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Otoritas</span>
                </button>
              </div>
            </div>

            <div className={`${showAuditMatrixInfo ? 'block' : 'hidden'} sm:block bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-2 animate-fadeIn`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-red-800" />
                  <span>Matriks Otoritas &amp; Hak Hapus<span className="hidden sm:inline"> Pengguna</span></span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Wajib Konfirmasi + Log Audit
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 text-white">
                  <div className="font-extrabold text-amber-300">1. SUPERADMIN</div>
                  <div className="text-slate-300 mt-0.5">Kelola, hapus, &amp; pulihkan seluruh akun.</div>
                </div>
                <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-950">
                  <div className="font-extrabold text-red-800">2. KETUA</div>
                  <div className="text-red-900/80 mt-0.5">Kelola user, verifikasi, &amp; hapus Anggota / Pengurus di bawahnya.</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-950">
                  <div className="font-extrabold text-amber-900">3. SEKRETARIS</div>
                  <div className="text-amber-900/80 mt-0.5">Kelola user, verifikasi, &amp; hapus akun ANGGOTA.</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <div className="font-extrabold text-slate-800">4. BENDAHARA / ANGGOTA</div>
                  <div className="text-slate-500 mt-0.5">Tidak memiliki akses manajemen/hapus user.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
            {(() => {
              const q = auditSearch.trim().toLowerCase();
              const filteredLogs = auditLogs.filter((log) => {
                if (auditFilterAction !== 'ALL' && log.action !== auditFilterAction) return false;
                if (!q) return true;
                const actorText = (log.actorName || log.actorNama || '').toLowerCase();
                const targetText = (log.targetNama || log.targetName || '').toLowerCase();
                return (
                  actorText.includes(q) ||
                  (log.actorNrp || '').toLowerCase().includes(q) ||
                  targetText.includes(q) ||
                  (log.targetNrp || '').toLowerCase().includes(q) ||
                  (log.details || '').toLowerCase().includes(q)
                );
              });

              if (filteredLogs.length === 0) {
                return (
                  <div className="py-12 text-center">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-700 text-sm">Belum ada catatan aktivitas di Log Audit</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Setiap penghapusan, pemulihan, penambahan, perubahan data, login ADC, atau reset password pengguna akan otomatis tercatat di sini.
                    </p>
                  </div>
                );
              }

              const badgeStyleByAction: Record<UserAuditAction, { label: string; cls: string }> = {
                HAPUS_USER: { label: 'HAPUS USER', cls: 'bg-red-100 text-red-800 border-red-200' },
                PULIHKAN_USER: { label: 'PULIHKAN USER', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                TAMBAH_USER: { label: 'TAMBAH USER', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
                EDIT_USER: { label: 'EDIT USER', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
                UBAH_ROLE: { label: 'UBAH ROLE', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
                VERIFIKASI_PENDAFTAR: { label: 'VERIFIKASI', cls: 'bg-teal-100 text-teal-800 border-teal-200' },
                LOGIN_ADC: { label: 'LOGIN ADC', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                AKTIVITAS_ADC: { label: 'AKTIVITAS ADC', cls: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
                RESET_PASSWORD: { label: 'RESET PASSWORD', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
                PERMINTAAN_RESET_PASSWORD: { label: 'LUPA PASSWORD', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
              };

              return filteredLogs.map((log) => {
                const badge = badgeStyleByAction[log.action] || {
                  label: log.action,
                  cls: 'bg-slate-100 text-slate-700 border-slate-200',
                };
                const isCurrentlyDeleted =
                  log.action === 'HAPUS_USER' &&
                  !users.some((u) => u.nrp === log.targetNrp);
                const resolvedTargetNama = log.targetNama || log.targetName || log.targetNrp;
                const resolvedActorName = log.actorName || log.actorNama || 'Admin';

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          {log.targetPangkat ? `${log.targetPangkat} ` : ''}{stripRankFromName(resolvedTargetNama) || resolvedTargetNama} (NRP {log.targetNrp})
                        </span>
                        {log.targetRole && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600">
                            {log.targetRole === 'SEKRETARIAT' ? 'SEKRETARIS' : log.targetRole}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        {log.details}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-0.5">
                        <span>
                          <span className="sm:hidden">Oleh:</span><span className="hidden sm:inline">Dieksekusi oleh:</span>{' '}
                          <strong className="text-slate-700">
                            {resolvedActorName} ({log.actorNrp ? `${log.actorNrp} • ` : ''}{log.actorRole === 'SEKRETARIAT' ? 'SEKRETARIS' : log.actorRole})
                          </strong>
                        </span>
                        <span>
                          {new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {log.action === 'PERMINTAAN_RESET_PASSWORD' && log.targetNrp && (
                        <button
                          type="button"
                          onClick={() =>
                            handleResetUserPassword({
                              nrp: log.targetNrp,
                              nama: resolvedTargetNama,
                              pangkat: log.targetPangkat,
                              role: log.targetRole,
                            })
                          }
                          disabled={updatingUserNrp === log.targetNrp}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                          title={`Penuhi permintaan lupa password dan reset ke WS96@${log.targetNrp}`}
                        >
                          <span className="sm:hidden">🔑 Reset</span>
                          <span className="hidden sm:inline">🔑 Reset ke WS96@{log.targetNrp}</span>
                        </button>
                      )}

                      {isCurrentlyDeleted && (
                        <button
                          type="button"
                          onClick={() => handleRestoreDeletedUser(log)}
                          disabled={restoringLogId === log.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                          title="Pulihkan kembali akun pengguna yang telah dihapus ini"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{restoringLogId === log.id ? '...' : <><span className="sm:hidden">Pulihkan</span><span className="hidden sm:inline">Pulihkan User</span></>}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}

      {/* TAB 4: TAMBAH PENGGUNA BARU (CAS 2-COLUMN LAYOUT) */}
      {activeTab === 'ADD_USER' && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-amber-900">
                  Penambahan Langsung oleh Pengurus / Sekretaris
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Akun yang ditambahkan di sini langsung terdaftar sebagai pengguna terverifikasi, masuk ke Direktori Anggota, dan terdaftar di Buku Kas/Iuran.
                </p>
              </div>
            </div>
            {renderCasAddUserForm(() => setActiveTab('USERS'))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL KONFIRMASI HAPUS PENGGUNA (DENGAN PENCATATAN LOG AUDIT) */}
      {/* ============================================================ */}
      {userPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-200 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-red-950">
                    Konfirmasi Hapus Pengguna
                  </h4>
                  <p className="text-[11px] text-red-700 font-medium">
                    Tindakan ini akan dicatat ke dalam Log Audit Sistem
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserPendingDelete(null);
                  setDeleteReason('');
                }}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Akun yang Akan Dihapus
                </div>
                <div className="font-extrabold text-sm text-slate-900">
                  {userPendingDelete.pangkat ? `${userPendingDelete.pangkat} ` : ''}
                  {stripRankFromName(userPendingDelete.nama) || userPendingDelete.nama}
                </div>
                <div className="text-slate-600 font-medium">
                  NRP: <span className="font-mono font-bold text-slate-800">{userPendingDelete.nrp}</span> &bull; Role:{' '}
                  <span className="font-bold text-red-800">
                    {userPendingDelete.role === 'SEKRETARIAT' ? 'SEKRETARIS' : userPendingDelete.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Satker: {(userPendingDelete.satker || 'Mabes Polri').split(' / ')[0]} ({userPendingDelete.polda || 'MABES POLRI'})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan Penghapusan <span className="text-slate-400 font-normal">(Tercatat di Log Audit)</span>
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Contoh: Duplikasi data / akun pengujian / koreksi sekretariat..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500/30 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Catatan Keamanan:</strong> Penghapusan ini akan dicatat atas nama{' '}
                <strong>{adminName} ({currentUserRole === 'SEKRETARIAT' ? 'SEKRETARIS' : currentUserRole})</strong>. Apabila diperlukan di kemudian hari, akun dapat dipulihkan kembali melalui tab <strong>Log Audit</strong>.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setUserPendingDelete(null);
                    setDeleteReason('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={updatingUserNrp === userPendingDelete.nrp}
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {updatingUserNrp === userPendingDelete.nrp ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL POPUP CAS: TAMBAH PENGGUNA                             */}
      {/* ============================================================ */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-700">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Tambah Pengguna Baru
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Lengkapi identitas, satker melekat berjenjang, serta email dinas &amp; sekunder personel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[82vh] overflow-y-auto">
              {renderCasAddUserForm(() => setShowAddUserModal(false))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL POPUP CAS: EDIT PENGGUNA & MASTER SATKER BERJENJANG     */}
      {/* ============================================================ */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-700">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Edit Pengguna (NRP {editingUser.nrp})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Perbarui identitas, role akses, satker melekat berjenjang, atau kredensial kontak
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} autoComplete="off" className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* KOLOM KIRI: IDENTITAS & SATKER */}
                <div className="space-y-3.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 pb-1 border-b border-slate-100">
                    <IdCard className="w-4 h-4" />
                    <span>🪪 IDENTITAS &amp; SATKER</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Lengkap &amp; Gelar <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pangkat</label>
                      <select
                        value={editPangkat}
                        onChange={(e) => {
                          const nextRank = e.target.value;
                          setEditPangkat(nextRank);
                          if (!editIsExternalJabatan) {
                            const nextGroups = getJabatanGroupsForPangkat(nextRank, editNrp || editingUser.nrp);
                            const allOpts = nextGroups.flatMap((g) => g.options);
                            if (!allOpts.includes(editJabatan.trim())) {
                              setEditJabatan(allOpts[0] || 'Staf');
                            }
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                      >
                        {PANGKAT_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Role Akses (Angkatan)</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                      >
                        {visibleRoleOptions.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.value === 'SEKRETARIAT' ? 'SEKRETARIS' : r.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* STATUS KEDINASAN PERSONEL */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Kedinasan</label>
                    <select
                      value={editStatusKedinasan}
                      onChange={(e) => setEditStatusKedinasan(e.target.value as StatusKedinasan)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="AKTIF">Aktif Berdinas</option>
                      <option value="PURNA_TUGAS">Purna Tugas / Pensiun</option>
                      <option value="PTDH">PTDH</option>
                      <option value="ALMARHUM">Almarhum / Gugur</option>
                    </select>
                  </div>

                  {/* JABATAN ORGANISASI POLRI (DROPDOWN STANDAR PERPOL 4/2025 + EKSTERNAL) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-slate-700">
                        Jabatan Organisasi Polri
                      </label>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {isOfficerRankIpdaUp(editPangkat) ? `Standar ${editPangkat}` : 'Staf / ADC'}
                      </span>
                    </div>
                    {(() => {
                      const groups = getJabatanGroupsForPangkat(editPangkat, editNrp || editingUser.nrp);
                      const curJab = editJabatan.trim();
                      const isCurInStd = isStandardPolriJabatan(curJab, editPangkat, editNrp || editingUser.nrp);
                      const isOfficer = isOfficerRankIpdaUp(editPangkat);
                      const selectVal = editIsExternalJabatan
                        ? EXTERNAL_JABATAN_SENTINEL
                        : isCurInStd
                        ? curJab
                        : isOfficer && curJab
                        ? curJab
                        : groups[0]?.options[0] || 'Staf';

                      return (
                        <>
                          <select
                            value={selectVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === EXTERNAL_JABATAN_SENTINEL) {
                                setEditIsExternalJabatan(true);
                                if (isStandardPolriJabatan(curJab, editPangkat, editNrp || editingUser.nrp)) {
                                  setEditJabatan('');
                                }
                              } else {
                                setEditIsExternalJabatan(false);
                                setEditJabatan(val);
                              }
                            }}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                          >
                            {!editIsExternalJabatan && isOfficer && curJab && !isCurInStd && (
                              <optgroup label="Jabatan Tersimpan Saat Ini">
                                <option value={curJab}>{curJab}</option>
                              </optgroup>
                            )}
                            {groups.map((grp) => (
                              <optgroup key={grp.group} label={grp.group}>
                                {grp.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                            <optgroup label="Penugasan Luar Struktur (Eksternal Polri)">
                              <option value={EXTERNAL_JABATAN_SENTINEL}>
                                Penugasan Luar Struktur (Eksternal Polri) — Tulis Sendiri
                              </option>
                            </optgroup>
                          </select>

                          {editIsExternalJabatan && (
                            <input
                              type="text"
                              required
                              value={editJabatan}
                              onChange={(e) => setEditJabatan(e.target.value)}
                              placeholder="Ketik nama jabatan eksternal (misal BNN, KPK, BNPT, Kementerian)..."
                              className="w-full px-3.5 py-2 border border-amber-300 bg-amber-50/50 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* TANGGAL LAHIR & BUP 58 TAHUN */}
                  <div>
                    {(() => {
                      const calc = calculateRetirement58(editTanggalLahir, editNrp || editingUser.nrp);
                      return (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-semibold text-slate-700">
                              Tanggal Lahir (BUP {RETIREMENT_AGE_POLRI} Thn)
                            </label>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Usia: {calc.usiaTahun} Thn • Pensiun: {calc.tahunPurnaTugas}
                            </span>
                          </div>
                          <input
                            type="date"
                            value={editTanggalLahir || calc.tanggalLahir}
                            onChange={(e) => setEditTanggalLahir(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                          />
                        </>
                      );
                    })()}
                  </div>

                  {/* SATKER MELEKAT (ALA CAS) */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Satker Melekat</label>
                    <div className="flex flex-col gap-2 min-w-0">
                      <div
                        onClick={() => openSatkerPicker('EDIT')}
                        className="w-full min-w-0 overflow-hidden px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 cursor-pointer flex items-center gap-2 transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <span className="font-bold text-slate-900 block truncate text-[11px]">
                            {editComposedSatker || editSatkerUtama}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                            <span className="truncate">{editPolda}</span>
                            {editKodeSatker && (
                              <span className="font-mono text-slate-400 shrink-0">({editKodeSatker})</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSatkerPicker('EDIT')}
                        className="w-full px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Pilih Satker Berjenjang</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* KOLOM KANAN: AKUN & KREDENSIAL */}
                <div className="space-y-3.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 pb-1 border-b border-slate-100">
                    <Lock className="w-4 h-4" />
                    <span>🔐 AKUN &amp; KREDENSIAL</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">
                        NRP / NIP <span className="text-red-600">*</span>
                      </label>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Dapat Diubah (Superadmin / Sekretaris)
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={editNrp}
                      onChange={(e) => handleEditNrpChange(e.target.value)}
                      placeholder="Masukkan NRP / NIP"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Dinas (@polri.go.id)</label>
                    <input
                      type="email"
                      autoComplete="off"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      onBlur={() => {
                        if (/^\d+$/.test(editEmail.trim())) {
                          setEditEmail(`${editEmail.trim()}@polri.go.id`);
                        }
                      }}
                      placeholder={`${editNrp || editingUser.nrp}@polri.go.id`}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Sekunder / Pribadi <span className="text-slate-400 font-normal">(Opsional &amp; Editable)</span>
                    </label>
                    <input
                      type="email"
                      autoComplete="off"
                      value={editSecondaryEmail}
                      onChange={(e) => setEditSecondaryEmail(e.target.value)}
                      placeholder="Contoh: superadmin@example.com"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. HP / WhatsApp Aktif</label>
                    <input
                      type="tel"
                      autoComplete="off"
                      value={editNoHp}
                      onChange={(e) => setEditNoHp(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Reset / Ganti Password <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Masukkan password baru (opsional)"
                        className="w-full pl-3.5 pr-8 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                {onEditMemberByNrp ? (
                  <button
                    type="button"
                    onClick={() => {
                      const targetNrp = editNrp.trim() || editingUser.nrp;
                      setEditingUser(null);
                      if (!asPage) onClose();
                      onEditMemberByNrp(targetNrp);
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-[11px] flex items-center gap-1.5"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Biodata Lengkap</span>
                    <span className="hidden sm:inline">Edit Biodata Lengkap (4 Tahap)</span>
                  </button>
                ) : <span />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-blue-600 hover:text-blue-800 font-bold text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={updatingUserNrp === editingUser.nrp}
                    className="px-5 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{updatingUserNrp === editingUser.nrp ? 'Menyimpan...' : <><span className="sm:hidden">Simpan</span><span className="hidden sm:inline">Simpan Perubahan</span></>}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL POPUP: PILIH SATKER BERJENJANG (ALA CAS / BDB)         */}
      {/* ============================================================ */}
      <SatkerBerjenjangModal
        isOpen={satkerPickerMode !== null}
        onClose={() => setSatkerPickerMode(null)}
        initialPolda={satkerPickerMode === 'EDIT' ? editPolda : newPolda}
        initialSatker={satkerPickerMode === 'EDIT' ? editSatkerUtama : newSatkerUtama}
        initialSubSatker={satkerPickerMode === 'EDIT' ? editSubSatker : newSubSatker}
        onApply={handleApplySatkerFromModal}
      />

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Otoritas Manajemen Pengguna: <strong>Superadmin &amp; Sekretaris Wira Satya 96</strong></span>
        </div>
        {!asPage && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold transition-colors"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div data-no-reveal="true" className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-4">
        {innerContent}
      </div>
    );
  }

  return (
    <div data-no-reveal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {innerContent}
    </div>
  );
};
