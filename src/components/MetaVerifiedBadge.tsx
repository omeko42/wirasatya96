'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types';

export interface MetaVerifiedBadgeProps {
  role?: UserRole | string;
  nrp?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const VALID_ROLES: UserRole[] = ['SUPERADMIN', 'KETUA', 'SEKRETARIAT', 'BENDAHARA', 'ANGGOTA'];

const DEFAULT_PENGURUS_ROLE_BY_NRP: Record<string, UserRole> = {
  '98010710': 'SUPERADMIN',
  '75060702': 'KETUA',
  '74090165': 'KETUA',
  '72080762': 'SEKRETARIAT',
  '74090167': 'SEKRETARIAT',
  '74060709': 'SEKRETARIAT',
  '74090168': 'SEKRETARIAT',
  '74050716': 'BENDAHARA',
  '74090009': 'BENDAHARA',
  '74090583': 'BENDAHARA',
  '74090072': 'BENDAHARA',
};

let memoryRoleMap: Record<string, UserRole> | null = null;
const roleBadgeSubscribers = new Set<() => void>();
let globalListenersAttached = false;

function attachGlobalRoleListeners() {
  if (globalListenersAttached || typeof window === 'undefined') return;
  globalListenersAttached = true;

  const notifyAll = () => {
    roleBadgeSubscribers.forEach((cb) => cb());
  };

  window.addEventListener('ws96_roles_updated', notifyAll);
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'ws96_role_map') {
      try {
        const raw = localStorage.getItem('ws96_role_map');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            memoryRoleMap = parsed as Record<string, UserRole>;
          }
        }
      } catch {
        // ignore
      }
      notifyAll();
    }
  });
}

function ensureRoleMapLoaded(): Record<string, UserRole> {
  if (memoryRoleMap !== null) return memoryRoleMap;
  memoryRoleMap = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('ws96_role_map');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          memoryRoleMap = parsed as Record<string, UserRole>;
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }
  return memoryRoleMap;
}

export function setDynamicRoleMap(roleMap: Record<string, UserRole>): void {
  // Skip redundant writes and event dispatches if map content is identical
  if (memoryRoleMap) {
    const prevKeys = Object.keys(memoryRoleMap);
    const nextKeys = Object.keys(roleMap);
    if (
      prevKeys.length === nextKeys.length &&
      nextKeys.every((k) => memoryRoleMap![k] === roleMap[k])
    ) {
      return;
    }
  }
  memoryRoleMap = { ...roleMap };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ws96_role_map', JSON.stringify(memoryRoleMap));
      window.dispatchEvent(new Event('ws96_roles_updated'));
    } catch {
      // ignore localStorage errors
    }
  }
}

export function updateDynamicUserRole(nrp: string, role: UserRole): void {
  const cleanNrp = (nrp || '').trim();
  if (!cleanNrp) return;
  const current = ensureRoleMapLoaded();
  memoryRoleMap = { ...current, [cleanNrp]: role };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ws96_role_map', JSON.stringify(memoryRoleMap));
      window.dispatchEvent(new Event('ws96_roles_updated'));
    } catch {
      // ignore localStorage errors
    }
  }
}

export function getDynamicRoleForNrp(nrp?: string): UserRole | undefined {
  if (!nrp) return undefined;
  const cleanNrp = nrp.trim();
  if (!cleanNrp) return undefined;
  const map = ensureRoleMapLoaded();
  const found = map[cleanNrp];
  if (found && VALID_ROLES.includes(found) && found !== 'ANGGOTA') {
    return found;
  }
  if (DEFAULT_PENGURUS_ROLE_BY_NRP[cleanNrp]) {
    return DEFAULT_PENGURUS_ROLE_BY_NRP[cleanNrp];
  }
  if (found && VALID_ROLES.includes(found)) {
    return found;
  }
  return undefined;
}

export function resolveRoleForBadge(nrp?: string, explicitRole?: UserRole | string): UserRole | undefined {
  if (explicitRole && VALID_ROLES.includes(explicitRole as UserRole) && explicitRole !== 'ANGGOTA') {
    return explicitRole as UserRole;
  }
  if (!nrp) {
    return explicitRole && VALID_ROLES.includes(explicitRole as UserRole)
      ? (explicitRole as UserRole)
      : undefined;
  }
  const cleanNrp = nrp.trim();
  const dynamicRole = getDynamicRoleForNrp(cleanNrp);
  if (dynamicRole && dynamicRole !== 'ANGGOTA') {
    return dynamicRole;
  }
  if (DEFAULT_PENGURUS_ROLE_BY_NRP[cleanNrp]) {
    return DEFAULT_PENGURUS_ROLE_BY_NRP[cleanNrp];
  }
  if (explicitRole && VALID_ROLES.includes(explicitRole as UserRole)) {
    return explicitRole as UserRole;
  }
  return dynamicRole || 'ANGGOTA';
}

/**
 * Meta-style Scalloped Verification Badge:
 * - SUPERADMIN -> Hitam (#0f172a)
 * - KETUA -> Merah (#dc2626)
 * - SEKRETARIAT / BENDAHARA (Pejabat Angkatan) -> Kuning Emas (#eab308 / #d97706)
 * - ANGGOTA / lainnya -> Tanpa Badge (null)
 */
export const MetaVerifiedBadge: React.FC<MetaVerifiedBadgeProps> = React.memo(({
  role,
  nrp,
  size = 'sm',
  className = '',
}) => {
  const [, setRoleTick] = useState(0);

  useEffect(() => {
    attachGlobalRoleListeners();
    const cb = () => setRoleTick((t) => t + 1);
    roleBadgeSubscribers.add(cb);
    return () => {
      roleBadgeSubscribers.delete(cb);
    };
  }, []);

  const effectiveRole = resolveRoleForBadge(nrp, role);

  if (!effectiveRole || effectiveRole === 'ANGGOTA') {
    return null;
  }

  let fillHex = '#0f172a';
  let strokeHex = '#334155';
  let titleText = 'Terverifikasi';

  if (effectiveRole === 'SUPERADMIN') {
    fillHex = '#0f172a'; // Hitam (Superadmin)
    strokeHex = '#475569';
    titleText = 'Verified Superadmin (Administrator Sistem)';
  } else if (effectiveRole === 'KETUA') {
    fillHex = '#dc2626'; // Merah (Ketua)
    strokeHex = '#fca5a5';
    titleText = 'Verified Ketua Batalyon Wira Satya 96';
  } else if (effectiveRole === 'SEKRETARIAT' || effectiveRole === 'BENDAHARA') {
    fillHex = '#eab308'; // Kuning Emas (Pejabat Angkatan: Sekretaris / Bendahara)
    strokeHex = '#fef08a';
    titleText =
      effectiveRole === 'SEKRETARIAT'
        ? 'Verified Pejabat Angkatan (Sekretaris)'
        : 'Verified Pejabat Angkatan (Bendahara)';
  } else {
    return null;
  }

  const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 26,
  };

  const px = sizeMap[size] || 16;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
      title={titleText}
      aria-label={titleText}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-xs"
      >
        {/* Meta-style 10-lobed scalloped seal path */}
        <path
          d="M12 1.5L14.45 3.38L17.5 3.04L18.62 5.91L21.46 7.08L21.07 10.13L22.91 12.61L20.77 14.84L20.79 17.92L17.85 18.88L16.38 21.58L13.38 20.89L10.62 22.34L8.55 20.06L5.5 20.03L4.7 17.05L2.04 15.5L3.02 12.57L1.64 9.81L4.08 7.91L4.38 4.84L7.39 4.18L9.18 1.66L12 2.68L12 1.5Z"
          fill={fillHex}
          stroke={strokeHex}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 2C13.1 2 14.1 2.6 14.6 3.5C15.6 3.1 16.8 3.3 17.6 4.1C18.4 4.9 18.6 6.1 18.2 7.1C19.1 7.6 19.7 8.6 19.7 9.7C19.7 10.8 19.1 11.8 18.2 12.3C18.6 13.3 18.4 14.5 17.6 15.3C16.8 16.1 15.6 16.3 14.6 15.9C14.1 16.8 13.1 17.4 12 17.4"
          fill={fillHex}
        />
        {/* Clean crisp Meta-style scalloped rosette */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill={fillHex}
          stroke="#ffffff"
          strokeWidth="1.2"
        />
        {/* Checkmark */}
        <path
          d="M8.5 12.3L10.8 14.6L15.8 9.4"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
});
MetaVerifiedBadge.displayName = 'MetaVerifiedBadge';
