'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AuthUser,
  MfaMethod,
  ActiveAdcSession,
  UserAuditLog,
  AnggotaWiraSatya,
} from '@/types';
import { recordAdcActivityToAuditLog, stripRankFromName } from '@/lib/avatarUtils';
import { WSLogo } from '@/components/WSLogo';
import {
  getUserSecurityConfig,
  getActive2FAMethodsCount,
  UserSecurityConfig,
} from '@/components/SecuritySettingsModal';
import {
  Eye,
  EyeOff,
  RotateCw,
  AlertCircle,
  Fingerprint,
  Key,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Check,
  KeyRound,
} from 'lucide-react';

const PRESET_LEGACY_NRPS = new Set([
  '98010710',
  '980107102',
  '980107103',
  '980107104',
  '980107105',
]);

interface CheckboxSecurityCaptchaProps {
  checked: boolean;
  verifying: boolean;
  onToggle: () => void;
}

function CheckboxSecurityCaptcha({
  checked,
  verifying,
  onToggle,
}: CheckboxSecurityCaptchaProps) {
  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`rounded-xl border px-4 py-3 flex items-center justify-between cursor-pointer select-none transition-all ${
        checked
          ? 'bg-slate-50/90 border-emerald-500/60 shadow-2xs'
          : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
      }`}
    >
      {/* Left: Checkbox + "I'm not a robot" */}
      <div className="flex items-center gap-3">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
            verifying
              ? 'border-2 border-slate-300 bg-white'
              : checked
              ? 'border-2 border-emerald-600 bg-emerald-600 text-white shadow-2xs'
              : 'border-2 border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          {verifying ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-red-800 animate-spin" />
          ) : checked ? (
            <Check className="w-4 h-4 stroke-[3]" />
          ) : null}
        </div>
        <span className="text-xs font-medium text-slate-700">
          I&apos;m not a robot
        </span>
      </div>

      {/* Right: Shield Emblem + Captcha / Privasi & Ketentuan */}
      <div className="flex items-center gap-2 pl-3">
        <div className="w-7 h-7 rounded-lg bg-[#0f172a] border border-slate-700 flex items-center justify-center shadow-2xs shrink-0">
          <ShieldCheck className="w-4 h-4 text-red-500" />
        </div>
        <div className="text-left leading-tight">
          <span className="block text-[10px] font-bold text-slate-600">
            Captcha
          </span>
          <span className="block text-[9px] text-slate-400">
            Privasi &amp; Ketentuan
          </span>
        </div>
      </div>
    </div>
  );
}

function isDefaultWs96PasswordMatch(enteredPassword: string, targetNrp: string): boolean {
  if (!enteredPassword || !targetNrp) return false;
  const cleanEntered = enteredPassword.trim();
  const cleanTargetNrp = targetNrp.trim();
  return cleanEntered.toLowerCase() === `ws96@${cleanTargetNrp.toLowerCase()}`;
}

export default function LoginPage() {
  const router = useRouter();

  // Active view: 'login' | 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'forgot'>('login');

  // Login form inputs (Default: Password + Checkbox Captcha)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCaptchaChecked, setIsCaptchaChecked] = useState(false);
  const [isCaptchaVerifying, setIsCaptchaVerifying] = useState(false);

  // Optional 2FA Challenge Modal (only shown if user enabled 2FA in their settings)
  const [pending2FAUser, setPending2FAUser] = useState<AuthUser | null>(null);
  const [pending2FAConfig, setPending2FAConfig] = useState<UserSecurityConfig | null>(null);
  const [selected2FAMethod, setSelected2FAMethod] = useState<MfaMethod>('PIN');
  const [otpInput, setOtpInput] = useState('');

  // Lupa Password / Reset Request Form State
  const [resetNrp, setResetNrp] = useState('');
  const [resetWa, setResetWa] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetSuccessNrp, setResetSuccessNrp] = useState('');

  // First-time Password Activation Modal State
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationData, setActivationData] = useState<{
    nrp: string;
    nama: string;
    pangkat?: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [selectedMfa, setSelectedMfa] = useState<MfaMethod>('PIN');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');

  // FIDO2 / Passkey Browser Modal Simulation State
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyAccount] = useState('superadmin@wirasatya96.polri.go.id');

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');
      if (reason === 'expired' || reason === 'idle') {
        setSessionNotice(
          reason === 'idle'
            ? 'Sesi sebelumnya telah ditutup otomatis demi keamanan karena tidak ada aktivitas lebih dari 1 jam. Silakan masuk kembali.'
            : 'Sesi sebelumnya telah berakhir otomatis demi keamanan karena melewati batas waktu aktif atau tidak ada aktivitas. Silakan masuk kembali.'
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCaptcha = () => {
    if (isCaptchaVerifying) return;
    if (isCaptchaChecked) {
      setIsCaptchaChecked(false);
      return;
    }
    setIsCaptchaVerifying(true);
    setErrorMessage('');
    setTimeout(() => {
      setIsCaptchaVerifying(false);
      setIsCaptchaChecked(true);
    }, 320);
  };

  const resetCaptcha = () => {
    setIsCaptchaChecked(false);
    setIsCaptchaVerifying(false);
  };

  const handleLoginSuccess = (user: AuthUser, mfaMethod?: MfaMethod) => {
    if (user.activeAdcSession) {
      localStorage.setItem('ws96_adc_session', JSON.stringify(user.activeAdcSession));
    } else {
      localStorage.removeItem('ws96_adc_session');
    }
    localStorage.setItem('ws96_auth_user', JSON.stringify(user));
    localStorage.setItem('ws96_active_user', JSON.stringify(user));
    localStorage.setItem('wirasatya96_current_user', JSON.stringify(user));
    localStorage.setItem(
      'ws96_session_meta',
      JSON.stringify({
        nrp: user.nrp,
        loginAt: Date.now(),
        lastActivityAt: Date.now(),
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      })
    );
    localStorage.removeItem('ws96_impersonator_user');
    if (mfaMethod) {
      localStorage.setItem('ws96_mfa_verified', 'true');
    }
    router.push('/');
  };

  const proceedWith2FAOrLogin = (targetUser: AuthUser) => {
    const secCfg = getUserSecurityConfig(targetUser.nrp, targetUser);
    const activeCount = getActive2FAMethodsCount(secCfg);
    let is2FAEnabled = activeCount > 0 || Boolean(targetUser.mfaEnabled);
    try {
      const local2FA = localStorage.getItem(`ws96_2fa_${targetUser.nrp}`);
      if (local2FA !== null) {
        is2FAEnabled = local2FA === 'true' || activeCount > 0;
      }
    } catch {
      // ignore
    }

    if (is2FAEnabled && !targetUser.activeAdcSession) {
      const defaultMethod: MfaMethod = secCfg.pinEnabled
        ? 'PIN'
        : secCfg.passkeyEnabled
        ? 'BIOMETRIC'
        : secCfg.totpEnabled
        ? 'TOTP'
        : secCfg.emailOtpEnabled
        ? 'EMAIL_OTP'
        : targetUser.mfaMethod || 'PIN';
      setPending2FAUser(targetUser);
      setPending2FAConfig(secCfg);
      setSelected2FAMethod(defaultMethod);
      setOtpInput('');
    } else {
      handleLoginSuccess(targetUser, 'PIN');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanIdentifier = username.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier) {
      setErrorMessage('Harap masukkan NRP atau Email dinas Anda.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('Harap masukkan kata sandi akun Anda.');
      return;
    }

    if (!isCaptchaChecked) {
      setErrorMessage('Harap centang kotak verifikasi keamanan "I\'m not a robot" terlebih dahulu.');
      return;
    }

    try {
      const rawDeleted = localStorage.getItem('ws96_deleted_nrps_v1');
      if (rawDeleted) {
        const deletedList: string[] = JSON.parse(rawDeleted);
        const idWithoutDomain = cleanIdentifier.split('@')[0].trim();
        if (
          Array.isArray(deletedList) &&
          (deletedList.includes(cleanIdentifier) || deletedList.includes(idWithoutDomain)) &&
          idWithoutDomain !== '98010710'
        ) {
          fetch(`/api/users?nrp=${encodeURIComponent(idWithoutDomain)}`, { method: 'DELETE' }).catch(() => {});
          setErrorMessage('Akun pengguna ini telah dihapus dari sistem oleh Admin / Sekretaris.');
          setIsCaptchaChecked(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    setLoading(true);

    try {
      const lowerId = cleanIdentifier.toLowerCase();
      const cleanNrpCandidate = cleanIdentifier.split('@')[0].trim();

      // 1. Load local overrides, ADC registry, and member lists
      let parsedOverrides: Record<
        string,
        AuthUser & { oldNrp?: string; jabatanTerakhir?: string; tanggalLahir?: string }
      > = {};
      try {
        const rawOverrides = localStorage.getItem('ws96_user_overrides_v1');
        if (rawOverrides) {
          parsedOverrides = JSON.parse(rawOverrides);
        }
      } catch {
        // ignore
      }

      // Fetch users and members in parallel to support both regular & ADC impersonation login reliably
      const [usersRes, membersRes] = await Promise.all([
        fetch('/api/users').catch(() => null),
        fetch('/api/members').catch(() => null),
      ]);

      let apiUsers: AuthUser[] = [];
      if (usersRes && usersRes.ok) {
        const uJson = await usersRes.json().catch(() => null);
        if (uJson && Array.isArray(uJson.data)) {
          apiUsers = uJson.data;
        }
      }

      let allMembers: AnggotaWiraSatya[] = [];
      if (membersRes && membersRes.ok) {
        const mJson = await membersRes.json().catch(() => null);
        if (mJson && Array.isArray(mJson.data)) {
          allMembers = mJson.data;
        }
      }
      try {
        const rawLocalMembers = localStorage.getItem('wirasatya96_members');
        if (rawLocalMembers) {
          const parsedLocalMembers = JSON.parse(rawLocalMembers);
          if (Array.isArray(parsedLocalMembers) && parsedLocalMembers.length > 0) {
            const byNrp = new Map<string, AnggotaWiraSatya>();
            allMembers.forEach((m) => byNrp.set(m.nrp, m));
            parsedLocalMembers.forEach((m: AnggotaWiraSatya) => {
              if (m && m.nrp) {
                byNrp.set(m.nrp, { ...(byNrp.get(m.nrp) || {}), ...m });
              }
            });
            allMembers = Array.from(byNrp.values());
          }
        }
        const rawMemberOverrides = localStorage.getItem('ws96_member_overrides_v1');
        if (rawMemberOverrides) {
          const parsedMemberOverrides = JSON.parse(rawMemberOverrides);
          if (parsedMemberOverrides && typeof parsedMemberOverrides === 'object') {
            allMembers = allMembers.map((m) =>
              parsedMemberOverrides[m.nrp]
                ? { ...m, ...parsedMemberOverrides[m.nrp] }
                : m
            );
          }
        }
      } catch {
        // ignore
      }

      // 2. Check if cleanIdentifier / cleanNrpCandidate is an ADC (Ajudan) account
      let detectedAdcInfo: {
        adcNrp: string;
        adcNama: string;
        adcPangkat?: string;
        adcNoHp?: string;
        adcCustomPassword?: string;
        pimpinanNrp: string;
        pimpinanNama?: string;
        pimpinanPangkat?: string;
      } | null = null;

      // 2a. Check in parsedOverrides & apiUsers for `isAdcAccount: true` and `adcOfNrp`
      const overrideAdcUser =
        Object.values(parsedOverrides).find(
          (u) =>
            u &&
            u.isAdcAccount &&
            u.adcOfNrp &&
            (u.nrp === cleanIdentifier ||
              u.nrp === cleanNrpCandidate ||
              u.email?.toLowerCase() === lowerId)
        ) ||
        apiUsers.find(
          (u) =>
            u &&
            u.isAdcAccount &&
            u.adcOfNrp &&
            (u.nrp === cleanIdentifier ||
              u.nrp === cleanNrpCandidate ||
              u.email?.toLowerCase() === lowerId)
        );

      if (overrideAdcUser && overrideAdcUser.adcOfNrp) {
        detectedAdcInfo = {
          adcNrp: overrideAdcUser.nrp,
          adcNama: overrideAdcUser.nama,
          adcPangkat: overrideAdcUser.pangkat || 'Briptu',
          adcNoHp: overrideAdcUser.noHp || '',
          adcCustomPassword: overrideAdcUser.password,
          pimpinanNrp: overrideAdcUser.adcOfNrp,
          pimpinanNama: overrideAdcUser.adcOfNama,
          pimpinanPangkat: overrideAdcUser.adcOfPangkat,
        };
      }

      // 2b. Check in `ws96_adc_registry_v1` in localStorage
      if (!detectedAdcInfo) {
        try {
          const rawAdcRegistry = localStorage.getItem('ws96_adc_registry_v1');
          if (rawAdcRegistry) {
            const parsedRegistry = JSON.parse(rawAdcRegistry);
            const entries: any[] = Array.isArray(parsedRegistry)
              ? parsedRegistry
              : parsedRegistry && typeof parsedRegistry === 'object'
              ? Object.values(parsedRegistry).flat()
              : [];

            const matchedReg = entries.find((item: any) => {
              if (!item) return false;
              const itemAdcNrp = String(item.adcNrp || item.nrp || '').trim();
              const itemEmail = String(item.email || item.adcEmail || '').trim().toLowerCase();
              return (
                (itemAdcNrp &&
                  (itemAdcNrp === cleanIdentifier || itemAdcNrp === cleanNrpCandidate)) ||
                (itemEmail && itemEmail === lowerId)
              );
            });

            if (matchedReg) {
              const adcNrpVal = String(matchedReg.adcNrp || matchedReg.nrp || cleanNrpCandidate).trim();
              const pimpinanNrpVal = String(
                matchedReg.pimpinanNrp || matchedReg.adcOfNrp || matchedReg.memberNrp || ''
              ).trim();
              if (pimpinanNrpVal) {
                detectedAdcInfo = {
                  adcNrp: adcNrpVal,
                  adcNama: String(matchedReg.adcNama || matchedReg.nama || `ADC ${pimpinanNrpVal}`).trim(),
                  adcPangkat: matchedReg.adcPangkat || matchedReg.pangkat || 'Briptu',
                  adcNoHp: matchedReg.adcNoHp || matchedReg.noHp || '',
                  adcCustomPassword: matchedReg.password,
                  pimpinanNrp: pimpinanNrpVal,
                  pimpinanNama: matchedReg.pimpinanNama || matchedReg.adcOfNama,
                  pimpinanPangkat: matchedReg.pimpinanPangkat || matchedReg.adcOfPangkat,
                };
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 2c. Check in allMembers (`nrpAdc`, `daftarAdc`, or `kontakAdc`)
      if (!detectedAdcInfo) {
        for (const m of allMembers) {
          if (!m || !m.nrp) continue;
          // Do not treat a member's own NRP as ADC
          if (m.nrp === cleanIdentifier || m.nrp === cleanNrpCandidate) continue;

          if (m.nrpAdc && m.nrpAdc.trim() === cleanNrpCandidate) {
            detectedAdcInfo = {
              adcNrp: cleanNrpCandidate,
              adcNama: m.namaAdc || `ADC ${m.namaLengkap}`,
              adcPangkat: m.pangkatAdc || 'Briptu',
              adcNoHp: m.noHpAdc || m.kontakAdc || '',
              pimpinanNrp: m.nrp,
              pimpinanNama: m.namaLengkap,
              pimpinanPangkat: m.pangkat,
            };
            break;
          }

          if (Array.isArray(m.daftarAdc)) {
            const adcMatch = m.daftarAdc.find(
              (a) =>
                (a.nrp && a.nrp.trim() === cleanNrpCandidate) ||
                (a.email && a.email.trim().toLowerCase() === lowerId)
            );
            if (adcMatch) {
              const resolvedAdcNrp = (adcMatch.nrp || cleanNrpCandidate).trim();
              detectedAdcInfo = {
                adcNrp: resolvedAdcNrp,
                adcNama: (adcMatch.nama || `ADC ${m.namaLengkap}`).trim(),
                adcPangkat: adcMatch.pangkat || 'Briptu',
                adcNoHp: adcMatch.noHp || '',
                pimpinanNrp: m.nrp,
                pimpinanNama: m.namaLengkap,
                pimpinanPangkat: m.pangkat,
              };
              break;
            }
          }

          if (
            cleanNrpCandidate.length >= 6 &&
            typeof m.kontakAdc === 'string' &&
            m.kontakAdc.includes(cleanNrpCandidate)
          ) {
            detectedAdcInfo = {
              adcNrp: cleanNrpCandidate,
              adcNama: m.namaAdc || `ADC ${m.namaLengkap}`,
              adcPangkat: m.pangkatAdc || 'Briptu',
              adcNoHp: m.noHpAdc || m.kontakAdc || '',
              pimpinanNrp: m.nrp,
              pimpinanNama: m.namaLengkap,
              pimpinanPangkat: m.pangkat,
            };
            break;
          }
        }
      }

      // 3. Handle ADC Impersonation Login if detectedAdcInfo is found
      if (detectedAdcInfo) {
        const pimpinanNrp = detectedAdcInfo.pimpinanNrp;
        const pimpinanOverride =
          parsedOverrides[pimpinanNrp] ||
          Object.values(parsedOverrides).find(
            (ov) => ov && !ov.isAdcAccount && (ov.nrp === pimpinanNrp || ov.oldNrp === pimpinanNrp)
          );
        const pimpinanApiUser = apiUsers.find(
          (u) => u && !u.isAdcAccount && u.nrp === pimpinanNrp
        );
        const pimpinanMember = allMembers.find((m) => m && m.nrp === pimpinanNrp);

        const basePimpinanUser: AuthUser = {
          id: pimpinanApiUser?.id || pimpinanOverride?.id || `u-ws-${pimpinanNrp}`,
          nrp: pimpinanNrp,
          nama:
            pimpinanOverride?.nama ||
            pimpinanApiUser?.nama ||
            pimpinanMember?.namaLengkap ||
            detectedAdcInfo.pimpinanNama ||
            `Alumni ${pimpinanNrp}`,
          pangkat:
            pimpinanOverride?.pangkat ||
            pimpinanApiUser?.pangkat ||
            pimpinanMember?.pangkat ||
            detectedAdcInfo.pimpinanPangkat ||
            'Kombes Pol',
          email:
            pimpinanOverride?.email ||
            pimpinanApiUser?.email ||
            pimpinanMember?.email ||
            `${pimpinanNrp}@polri.go.id`,
          noHp:
            pimpinanOverride?.noHp ||
            pimpinanApiUser?.noHp ||
            pimpinanMember?.noHp ||
            '',
          role: pimpinanOverride?.role || pimpinanApiUser?.role || 'ANGGOTA',
          profileId:
            pimpinanOverride?.profileId ||
            pimpinanApiUser?.profileId ||
            pimpinanMember?.id ||
            `ws-${pimpinanNrp}`,
          mfaEnabled: false,
          mfaMethod: 'PIN',
          satker:
            pimpinanOverride?.satker ||
            pimpinanApiUser?.satker ||
            pimpinanMember?.satuanKerja ||
            'MABES POLRI',
          polda:
            pimpinanOverride?.polda ||
            pimpinanApiUser?.polda ||
            pimpinanMember?.polda ||
            'MABES POLRI',
          jabatanTerakhir:
            pimpinanOverride?.jabatanTerakhir ||
            pimpinanApiUser?.jabatanTerakhir ||
            pimpinanMember?.jabatanTerakhir ||
            'Perwira Menengah Polri',
          fotoUrl:
            pimpinanOverride?.fotoUrl ||
            pimpinanApiUser?.fotoUrl ||
            pimpinanMember?.fotoUrl ||
            '/default-avatar.png',
          status: 'AKTIF',
        };

        // Validate ADC password:
        // Accept WS96@<ADC_NRP> (case-insensitive), WS96@<PIMPINAN_NRP> (case-insensitive),
        // or custom password configured for ADC or Pimpinan
        const isValidAdcPassword =
          isDefaultWs96PasswordMatch(cleanPassword, detectedAdcInfo.adcNrp) ||
          isDefaultWs96PasswordMatch(cleanPassword, pimpinanNrp) ||
          Boolean(
            detectedAdcInfo.adcCustomPassword &&
              cleanPassword === detectedAdcInfo.adcCustomPassword
          ) ||
          Boolean(pimpinanOverride?.password && cleanPassword === pimpinanOverride.password) ||
          Boolean(pimpinanApiUser?.password && cleanPassword === pimpinanApiUser.password);

        if (!isValidAdcPassword) {
          setErrorMessage(
            'Kata sandi Ajudan (ADC) tidak cocok. Silakan periksa kembali kata sandi Anda.'
          );
          resetCaptcha();
          return;
        }

        const cleanPimpinanDisplayName = stripRankFromName(
          basePimpinanUser.nama,
          basePimpinanUser.pangkat
        );

        const adcSession: ActiveAdcSession = {
          adcNrp: detectedAdcInfo.adcNrp,
          adcNama: stripRankFromName(
            detectedAdcInfo.adcNama,
            detectedAdcInfo.adcPangkat || ''
          ),
          adcPangkat: detectedAdcInfo.adcPangkat || 'Briptu',
          adcNoHp: detectedAdcInfo.adcNoHp || '',
          pimpinanNrp: basePimpinanUser.nrp,
          pimpinanNama: cleanPimpinanDisplayName,
          pimpinanPangkat: basePimpinanUser.pangkat || 'Kombes Pol',
          loginAt: new Date().toISOString(),
        };

        const impersonatedPimpinanUser: AuthUser = {
          ...basePimpinanUser,
          isAdcAccount: false,
          activeAdcSession: adcSession,
        };

        recordAdcActivityToAuditLog({
          action: 'LOGIN_ADC',
          details: `Ajudan (ADC) ${adcSession.adcPangkat ? adcSession.adcPangkat + ' ' : ''}${adcSession.adcNama} (NRP: ${adcSession.adcNrp}) berhasil masuk mewakili akun Pimpinan ${adcSession.pimpinanPangkat} ${adcSession.pimpinanNama} (NRP: ${adcSession.pimpinanNrp}).`,
          adcSession,
        });

        handleLoginSuccess(impersonatedPimpinanUser, 'PIN');
        return;
      }

      // 4. Regular Member / Admin Login
      let matchedClientOverride =
        parsedOverrides[cleanIdentifier] ||
        parsedOverrides[cleanNrpCandidate] ||
        Object.values(parsedOverrides).find(
          (ov) =>
            ov &&
            !ov.isAdcAccount &&
            (ov.nrp === cleanIdentifier ||
              ov.nrp === cleanNrpCandidate ||
              ov.oldNrp === cleanIdentifier ||
              ov.email?.toLowerCase() === lowerId ||
              ov.secondaryEmail?.toLowerCase() === lowerId ||
              ov.nama?.trim().toLowerCase() === lowerId)
        );

      const matchedApiUser = apiUsers.find(
        (u) =>
          u &&
          !u.isAdcAccount &&
          (u.nrp === cleanIdentifier ||
            u.nrp === cleanNrpCandidate ||
            u.email?.toLowerCase() === lowerId ||
            u.secondaryEmail?.toLowerCase() === lowerId ||
            u.nama?.trim().toLowerCase() === lowerId)
      );

      const matchedMember = allMembers.find(
        (m) =>
          m &&
          (m.nrp === cleanIdentifier ||
            m.nrp === cleanNrpCandidate ||
            m.email?.toLowerCase() === lowerId ||
            m.namaLengkap?.trim().toLowerCase() === lowerId)
      );

      const resolvedUserNrp =
        matchedClientOverride?.nrp ||
        matchedApiUser?.nrp ||
        matchedMember?.nrp ||
        cleanNrpCandidate;

      // Verify password against:
      // 1. Custom password in ws96_user_overrides_v1 (`matchedClientOverride?.password`) or `matchedApiUser?.password`
      // 2. Default password `WS96@${resolvedUserNrp}` (case-insensitive on `WS96@`)
      // 3. Legacy preset password (`WiraSatya96!`) ONLY for the 5 preset test accounts
      const matchesCustomPassword =
        Boolean(matchedClientOverride?.password && cleanPassword === matchedClientOverride.password) ||
        Boolean(matchedApiUser?.password && cleanPassword === matchedApiUser.password);
      const matchesDefaultWs96Password = isDefaultWs96PasswordMatch(
        cleanPassword,
        resolvedUserNrp
      );
      const matchesPresetLegacyPassword =
        PRESET_LEGACY_NRPS.has(resolvedUserNrp) && cleanPassword === 'WiraSatya96!';

      const isKnownAccount = Boolean(
        matchedClientOverride || matchedApiUser || matchedMember || PRESET_LEGACY_NRPS.has(resolvedUserNrp)
      );

      if (!isKnownAccount) {
        setErrorMessage('Akun NRP atau Email dinas tidak ditemukan dalam database Batalyon Wira Satya 96.');
        resetCaptcha();
        return;
      }

      if (!matchesCustomPassword && !matchesDefaultWs96Password && !matchesPresetLegacyPassword) {
        setErrorMessage(
          `Kata sandi tidak cocok untuk NRP ${resolvedUserNrp}. Silakan periksa kembali kata sandi Anda atau klik "Lupa Password?" untuk mengajukan reset.`
        );
        resetCaptcha();
        return;
      }

      // Build synthesized active user override so /api/auth/login accepts and syncs cleanly
      const effectiveClientOverride: AuthUser = {
        id:
          matchedClientOverride?.id ||
          matchedApiUser?.id ||
          `u-${matchedMember?.id || `ws-${resolvedUserNrp}`}`,
        nrp: resolvedUserNrp,
        nama:
          matchedClientOverride?.nama ||
          matchedApiUser?.nama ||
          matchedMember?.namaLengkap ||
          `Alumni ${resolvedUserNrp}`,
        pangkat:
          matchedClientOverride?.pangkat ||
          matchedApiUser?.pangkat ||
          matchedMember?.pangkat ||
          'Kombes Pol',
        email:
          matchedClientOverride?.email ||
          matchedApiUser?.email ||
          matchedMember?.email ||
          `${resolvedUserNrp}@polri.go.id`,
        secondaryEmail:
          matchedClientOverride?.secondaryEmail || matchedApiUser?.secondaryEmail,
        noHp:
          matchedClientOverride?.noHp ||
          matchedApiUser?.noHp ||
          matchedMember?.noHp ||
          '',
        role: matchedClientOverride?.role || matchedApiUser?.role || 'ANGGOTA',
        profileId:
          matchedClientOverride?.profileId ||
          matchedApiUser?.profileId ||
          matchedMember?.id ||
          `ws-${resolvedUserNrp}`,
        mfaEnabled: Boolean(
          matchedClientOverride?.mfaEnabled ?? matchedApiUser?.mfaEnabled ?? false
        ),
        mfaMethod:
          matchedClientOverride?.mfaMethod || matchedApiUser?.mfaMethod || 'PIN',
        satker:
          matchedClientOverride?.satker ||
          matchedApiUser?.satker ||
          matchedMember?.satuanKerja ||
          'MABES POLRI',
        polda:
          matchedClientOverride?.polda ||
          matchedApiUser?.polda ||
          matchedMember?.polda ||
          'MABES POLRI',
        kodeSatker:
          matchedClientOverride?.kodeSatker ||
          matchedApiUser?.kodeSatker ||
          matchedMember?.kodeSatker,
        jabatanTerakhir:
          matchedClientOverride?.jabatanTerakhir ||
          matchedApiUser?.jabatanTerakhir ||
          matchedMember?.jabatanTerakhir ||
          'Perwira Menengah Polri',
        fotoUrl:
          matchedClientOverride?.fotoUrl ||
          matchedApiUser?.fotoUrl ||
          matchedMember?.fotoUrl ||
          '/default-avatar.png',
        password: matchedClientOverride?.password || cleanPassword,
        status: 'AKTIF',
      };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resolvedUserNrp,
          password: cleanPassword,
          clientOverride: effectiveClientOverride,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success && data.user) {
        const mergedUser: AuthUser = {
          ...data.user,
          ...effectiveClientOverride,
          nrp: effectiveClientOverride.nrp || data.user.nrp,
          status: 'AKTIF',
          activeAdcSession: undefined,
        };
        proceedWith2FAOrLogin(mergedUser);
      } else {
        // Fallback direct login since password was already verified against known account
        proceedWith2FAOrLogin({
          ...effectiveClientOverride,
          status: 'AKTIF',
          activeAdcSession: undefined,
        });
      }
    } catch {
      setErrorMessage('Terjadi gangguan koneksi ke server. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FAUser) return;
    if (selected2FAMethod !== 'BIOMETRIC') {
      if (otpInput.trim().length < 4) {
        setErrorMessage('Masukkan kode verifikasi 6 digit terlebih dahulu.');
        return;
      }
      if (
        selected2FAMethod === 'PIN' &&
        pending2FAConfig?.pinCode &&
        otpInput.trim() !== pending2FAConfig.pinCode
      ) {
        setErrorMessage('PIN Keamanan 6-digit tidak sesuai.');
        return;
      }
    }
    const userToLogin = pending2FAUser;
    setPending2FAUser(null);
    setPending2FAConfig(null);
    handleLoginSuccess(userToLogin, selected2FAMethod);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanResetNrp = resetNrp.trim();
    const cleanResetWa = resetWa.trim();
    const cleanResetReason = resetReason.trim();

    if (!cleanResetNrp || !cleanResetWa) {
      setErrorMessage('Harap isi NRP / NIP dan Nomor WhatsApp Aktif Anda.');
      return;
    }

    setLoading(true);
    try {
      let matchedUser: Partial<AuthUser> | undefined;

      try {
        const rawOverrides = localStorage.getItem('ws96_user_overrides_v1');
        if (rawOverrides) {
          const parsedOverrides = JSON.parse(rawOverrides);
          matchedUser = parsedOverrides[cleanResetNrp];
        }
      } catch {
        // ignore
      }

      if (!matchedUser) {
        try {
          const resUsers = await fetch('/api/users');
          if (resUsers.ok) {
            const jsonUsers = await resUsers.json();
            if (Array.isArray(jsonUsers.data)) {
              matchedUser = jsonUsers.data.find(
                (u: AuthUser) => u && u.nrp === cleanResetNrp
              );
            }
          }
        } catch {
          // ignore
        }
      }

      if (!matchedUser) {
        try {
          const resMembers = await fetch('/api/members');
          if (resMembers.ok) {
            const jsonMembers = await resMembers.json();
            if (Array.isArray(jsonMembers.data)) {
              const foundMember = jsonMembers.data.find(
                (m: AnggotaWiraSatya) => m && m.nrp === cleanResetNrp
              );
              if (foundMember) {
                matchedUser = {
                  nrp: foundMember.nrp,
                  nama: foundMember.namaLengkap,
                  pangkat: foundMember.pangkat,
                  role: 'ANGGOTA',
                };
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const resetAuditEntry: UserAuditLog = {
        id: `audit-reset-req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorNrp: cleanResetNrp,
        actorName: matchedUser?.nama || `NRP ${cleanResetNrp}`,
        actorNama: matchedUser?.nama || `NRP ${cleanResetNrp}`,
        actorRole: matchedUser?.role || 'ANGGOTA',
        action: 'PERMINTAAN_RESET_PASSWORD',
        targetNrp: cleanResetNrp,
        targetNama: matchedUser?.nama || `NRP ${cleanResetNrp}`,
        targetName: matchedUser?.nama || `NRP ${cleanResetNrp}`,
        details: `Permintaan Reset Password oleh ${
          matchedUser?.pangkat ? matchedUser.pangkat + ' ' : ''
        }${matchedUser?.nama || cleanResetNrp} (NRP: ${cleanResetNrp}). No WA: ${cleanResetWa}. Alasan: ${
          cleanResetReason || 'Lupa kata sandi'
        }. Menunggu persetujuan Sekretaris / Superadmin untuk di-reset ke WS96@${cleanResetNrp}.`,
      };

      try {
        const rawLogs = localStorage.getItem('ws96_audit_logs_v1');
        const existingLogs: UserAuditLog[] = rawLogs ? JSON.parse(rawLogs) : [];
        const updatedLogs = [
          resetAuditEntry,
          ...(Array.isArray(existingLogs) ? existingLogs : []),
        ].slice(0, 500);
        localStorage.setItem('ws96_audit_logs_v1', JSON.stringify(updatedLogs));
      } catch {
        // ignore storage error
      }

      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_PASSWORD_RESET',
          nrp: cleanResetNrp,
          noHp: cleanResetWa,
          alasan: cleanResetReason || 'Lupa kata sandi',
          auditEntry: resetAuditEntry,
        }),
      }).catch(() => {});

      setResetSuccessNrp(cleanResetNrp);
    } finally {
      setLoading(false);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError('');

    if (!newPassword || newPassword.length < 6) {
      setActivationError('Kata sandi baru minimal harus terdiri dari 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setActivationError('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.');
      return;
    }

    setActivationLoading(true);

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: activationData?.nrp,
          password: newPassword,
          mfaMethod: selectedMfa,
        }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setShowActivationModal(false);
        handleLoginSuccess(data.user, selectedMfa);
      } else {
        setActivationError(data.message || 'Gagal menyimpan kata sandi baru.');
      }
    } catch {
      setActivationError('Terjadi gangguan jaringan saat menyimpan kata sandi.');
    } finally {
      setActivationLoading(false);
    }
  };

  const handlePasskeyContinue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '98010710', mfaMethod: 'BIOMETRIC' }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        handleLoginSuccess(data.user, 'BIOMETRIC');
      }
    } catch {
      setErrorMessage('Autentikasi Kunci Sandi gagal.');
    } finally {
      setLoading(false);
      setShowPasskeyModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2ef] flex flex-col justify-between font-sans text-slate-900 antialiased">
      {/* 1. TOP BRAND HEADER */}
      <header className="px-4 py-4 sm:px-12 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <WSLogo size="md" />
          <div>
            <span className="font-extrabold text-lg text-slate-900 tracking-tight block leading-tight">
              Wira Satya <span className="text-red-800">96</span>
            </span>
            <span className="text-[10px] text-slate-500 font-semibold block">
              Portal Alumni Akpol 1996
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Kanal Resmi Batalyon 1996</span>
        </div>
      </header>

      {/* 2. FIRST-TIME ACTIVATION MODAL: BUAT PASSWORD BARU */}
      {showActivationModal && activationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-4 text-slate-900 animate-scaleUp">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                Pendaftaran Disetujui
              </span>
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                Aktivasi Akun &amp; Buat Kata Sandi
              </h3>
              <p className="text-xs text-slate-600">
                Selamat datang, <strong>{activationData.nama}</strong> ({activationData.pangkat}).
                Silakan buat kata sandi pribadi untuk akun NRP <strong>{activationData.nrp}</strong>.
              </p>
            </div>

            {activationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{activationError}</span>
              </div>
            )}

            <form onSubmit={handleActivationSubmit} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Baru <span className="text-red-700">*</span>
                </label>
                <div className="relative">
                  <input autoComplete="new-password" name="ws96_page_newPassword_1"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-red-800 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Premium Password Strength Bar & 5-Point Live Checklist (SOP Video 15) */}
                {newPassword.length > 0 && (() => {
                  const checks = [
                    { label: '6+ Karakter', ok: newPassword.length >= 6 },
                    { label: 'A-Z', ok: /[A-Z]/.test(newPassword) },
                    { label: 'a-z', ok: /[a-z]/.test(newPassword) },
                    { label: '0-9', ok: /[0-9]/.test(newPassword) },
                    { label: '@#$', ok: /[^A-Za-z0-9]/.test(newPassword) },
                  ];
                  const score = checks.filter((c) => c.ok).length;
                  const strengthLabel = score <= 2 ? 'Lemah' : score <= 4 ? 'Sedang' : 'Kuat';
                  const strengthColor =
                    score <= 2 ? 'bg-red-500' : score <= 4 ? 'bg-amber-500' : 'bg-emerald-500';
                  const strengthText =
                    score <= 2 ? 'text-red-600' : score <= 4 ? 'text-amber-600' : 'text-emerald-600';

                  return (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Kekuatan Sandi</span>
                        <span className={strengthText}>{strengthLabel} ({score}/5)</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${strengthColor}`}
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {checks.map((item) => (
                          <span
                            key={item.label}
                            className={`ws96-inline-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-150 ${
                              item.ok
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <span>{item.ok ? '✓' : '○'}</span>
                            <span>{item.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Konfirmasi Kata Sandi Baru <span className="text-red-700">*</span>
                </label>
                <input autoComplete="new-password" name="ws96_page_confirmPassword_2"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilihan Pengamanan Akun (MFA)
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedMfa('PIN')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedMfa === 'PIN'
                        ? 'border-red-800 bg-red-50 text-red-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs">Kata Sandi / PIN</span>
                    <span className="text-[10px] text-slate-500 font-normal">Standar Akses Cepat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMfa('BIOMETRIC')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedMfa === 'BIOMETRIC'
                        ? 'border-red-800 bg-red-50 text-red-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs">FIDO2 / Biometrik</span>
                    <span className="text-[10px] text-slate-500 font-normal">Sidik Jari / Passkey</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowActivationModal(false)}
                  className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={activationLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50"
                >
                  {activationLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Mengaktifkan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan &amp; Masuk Akun</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. GOOGLE PASSWORD MANAGER / FIDO2 MODAL */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1b222d] border border-slate-700/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Fingerprint className="w-8 h-8 text-white" />
                <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full shadow">
                  <Key className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="text-[13px] font-medium text-slate-200 text-center mt-3 leading-snug">
                Gunakan kunci sandi tersimpan untuk <br />
                <span className="font-bold text-white">portal.wirasatya96.id</span>
              </p>
            </div>

            <div
              onClick={handlePasskeyContinue}
              className="flex items-center justify-between p-3 bg-[#242c38] hover:bg-[#2b3543] rounded-xl border border-slate-700/60 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {passkeyAccount}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                      FIDO2
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Pengelola Sandi Google</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setShowPasskeyModal(false)}
                className="px-3 py-2 rounded-full bg-[#27303d] hover:bg-[#323d4e] text-slate-300 font-medium transition-all text-center flex-1 text-[11px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePasskeyContinue}
                className="px-4 py-2 rounded-full bg-[#7be0eb] hover:bg-[#68d1dc] text-slate-950 font-bold transition-all text-center text-xs shadow-md flex-1"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3B. OPTIONAL 2FA MODAL (ONLY WHEN USER SELF-ENABLED 2FA IN SETTINGS) */}
      {pending2FAUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-800 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 text-[10px] font-extrabold uppercase">
                Otentikasi Dua Langkah (2FA)
              </span>
              <h3 className="font-extrabold text-lg text-slate-900">
                Verifikasi Keamanan Mandiri
              </h3>
              <p className="text-xs text-slate-600">
                Akun <strong>{pending2FAUser.nama}</strong> mengaktifkan proteksi 2FA. Pilih metode aktif Anda untuk melanjutkan login.
              </p>
            </div>

            {/* Active 2FA Method Selector Pills */}
            {pending2FAConfig && (
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl text-[11px]">
                {pending2FAConfig.pinEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected2FAMethod('PIN');
                      setOtpInput('');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-bold transition-all ${
                      selected2FAMethod === 'PIN'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    # PIN Keamanan
                  </button>
                )}
                {pending2FAConfig.emailOtpEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected2FAMethod('EMAIL_OTP');
                      setOtpInput('199696');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-bold transition-all ${
                      selected2FAMethod === 'EMAIL_OTP'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✉️ OTP Email
                  </button>
                )}
                {pending2FAConfig.totpEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected2FAMethod('TOTP');
                      setOtpInput('');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-bold transition-all ${
                      selected2FAMethod === 'TOTP'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🛡️ Google Auth (TOTP)
                  </button>
                )}
                {pending2FAConfig.passkeyEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected2FAMethod('BIOMETRIC');
                      setOtpInput('PASSKEY');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-bold transition-all ${
                      selected2FAMethod === 'BIOMETRIC'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔑 Biometrik Passkey
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleVerify2FASubmit} className="space-y-3">
              {selected2FAMethod === 'BIOMETRIC' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <Fingerprint className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="text-xs font-extrabold text-emerald-950">
                    Gawai Biometrik Terpercaya Terdeteksi
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Klik tombol di bawah untuk mengotorisasi login menggunakan Passkey perangkat ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      {selected2FAMethod === 'PIN'
                        ? 'Masukkan 6-Digit PIN Keamanan'
                        : selected2FAMethod === 'TOTP'
                        ? 'Masukkan 6-Digit Kode Google/MS Authenticator'
                        : `Masukkan 6-Digit OTP Email (${pending2FAUser.email || `${pending2FAUser.nrp}@polri.go.id`})`}
                    </label>
                    {selected2FAMethod === 'EMAIL_OTP' && (
                      <button
                        type="button"
                        onClick={() => setOtpInput('199696')}
                        className="ws96-inline-chip px-2 py-0.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-[10px] font-extrabold transition-all"
                      >
                        ⚡ Auto-Fill OTP (199696)
                      </button>
                    )}
                  </div>

                  {/* 6-Box Segmented Premium OTP Visual + Synchronized Input (SOP Video 08-11) */}
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const digit = otpInput[idx] || '';
                      const isActive = otpInput.length === idx || (idx === 5 && otpInput.length === 6);
                      const isComplete = otpInput.length === 6;
                      return (
                        <div
                          key={idx}
                          className={`h-11 rounded-xl border flex items-center justify-center font-mono text-base font-extrabold transition-all duration-150 select-none ${
                            isComplete
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                              : isActive
                              ? 'bg-white border-red-800 ring-2 ring-red-800/20 text-slate-900'
                              : digit
                              ? 'bg-slate-50 border-slate-300 text-slate-900'
                              : 'bg-slate-50/60 border-slate-200 text-slate-400'
                          }`}
                        >
                          {digit ? (selected2FAMethod === 'PIN' ? '•' : digit) : '–'}
                        </div>
                      );
                    })}
                  </div>

                  <input name="ws96_page_otpInput_3"
                    type={selected2FAMethod === 'PIN' ? 'password' : 'text'}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Ketik atau tempel 6 digit kode di sini..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-center font-mono text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPending2FAUser(null);
                    setPending2FAConfig(null);
                  }}
                  className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs shadow-md"
                >
                  {selected2FAMethod === 'BIOMETRIC'
                    ? 'Verifikasi Biometrik & Masuk'
                    : 'Verifikasi & Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MAIN AUTH CARD (MASUK AKUN / LUPA PASSWORD) */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] bg-white p-6 sm:p-8 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-slate-200 space-y-5">
          {/* Top Switcher Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                authMode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('forgot');
                setErrorMessage('');
                setResetSuccessNrp('');
                if (username && /^\d+$/.test(username.trim())) {
                  setResetNrp(username.trim());
                }
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                authMode === 'forgot'
                  ? 'bg-white text-red-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Lupa Password?
            </button>
          </div>

          {sessionNotice && !errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-700" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {authMode === 'login' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Masuk ke Portal
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Kanal resmi alumni Batalyon Wira Satya Akpol 1996
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Input 1: NRP / Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NRP Anggota / NRP Ajudan (ADC) / Email Dinas
                  </label>
                  <input name="ws96_page_username_3"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: 75060702 atau NRP ADC"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-800 transition-all"
                  />
                </div>

                {/* Input 2: Kata Sandi */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kata Sandi
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900"
                      >
                        {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot');
                          setErrorMessage('');
                          setResetSuccessNrp('');
                          if (username && /^\d+$/.test(username.trim())) {
                            setResetNrp(username.trim());
                          }
                        }}
                        className="text-xs font-bold text-red-800 hover:underline"
                      >
                        Lupa Password?
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input autoComplete="current-password" name="ws96_page_password_4"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi Anda"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-red-800 transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Input 3: Verifikasi Keamanan (Checkbox Captcha) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Verifikasi Keamanan
                  </label>
                  <CheckboxSecurityCaptcha
                    checked={isCaptchaChecked}
                    verifying={isCaptchaVerifying}
                    onToggle={handleToggleCaptcha}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-800 hover:bg-red-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <span>Masuk ke Akun</span>
                  )}
                </button>
              </form>

              {/* Bottom Switcher Note */}
              <div className="pt-3 text-center text-xs text-slate-600 border-t border-slate-100">
                <span>Kendala masuk atau lupa kata sandi akun? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot');
                    setErrorMessage('');
                    setResetSuccessNrp('');
                    if (username && /^\d+$/.test(username.trim())) {
                      setResetNrp(username.trim());
                    }
                  }}
                  className="text-red-800 font-bold hover:underline"
                >
                  Ajukan Reset Password
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: LUPA PASSWORD / AJUKAN RESET KE SEKRETARIS & SUPERADMIN */}
          {authMode === 'forgot' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Lupa Password / Ajukan Reset ke Sekretaris &amp; Superadmin
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Ajukan permohonan reset kata sandi akun Anda melalui Sekretaris atau Superadmin Batalyon Wira Satya 96.
                </p>
              </div>

              {resetSuccessNrp ? (
                <div className="py-4 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-base">
                    Permintaan Reset Password Terkirim!
                  </h4>
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 text-left leading-relaxed">
                    Permintaan reset password untuk NRP <strong>{resetSuccessNrp}</strong> telah dikirim ke Sekretaris &amp; Superadmin (tercatat di Riwayat Audit). Pengurus akan menindaklanjuti dan menginformasikan kata sandi melalui nomor WhatsApp Anda.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setUsername(resetSuccessNrp);
                      setResetSuccessNrp('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs transition-colors"
                  >
                    Kembali ke Halaman Masuk
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
                  {/* Input 1: NRP / NIP * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NRP / NIP <span className="text-red-700">*</span>
                    </label>
                    <input name="ws96_page_resetNrp_5"
                      type="text"
                      required
                      placeholder="Contoh: 75060702"
                      value={resetNrp}
                      onChange={(e) => setResetNrp(e.target.value.replace(/\s+/g, ''))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-red-800 focus:outline-none"
                    />
                  </div>

                  {/* Input 2: Nomor WhatsApp Aktif * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp Aktif <span className="text-red-700">*</span>
                    </label>
                    <input name="ws96_page_resetWa_6"
                      type="tel"
                      required
                      placeholder="Contoh: 081234567890"
                      value={resetWa}
                      onChange={(e) => setResetWa(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-800 focus:outline-none"
                    />
                  </div>

                  {/* Input 3: Keterangan / Alasan Reset Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Keterangan / Alasan Reset Password <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input autoComplete="current-password" name="ws96_page_resetReason_7"
                      type="text"
                      placeholder="Contoh: Lupa password setelah ganti HP"
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-800 focus:outline-none"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Mengirim Permintaan...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Kirim Permintaan Reset Password</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 text-center text-xs text-slate-600 border-t border-slate-100">
                    <span>Sudah ingat kata sandi Anda? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMessage('');
                      }}
                      className="text-red-800 font-bold hover:underline"
                    >
                      Masuk ke Akun
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 5. FOOTER */}
      <footer className="py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="font-semibold text-slate-700">Wira Satya 96 &copy; 2026</span>
          <span className="hover:text-slate-900 cursor-pointer">Panduan Leting</span>
          <span className="hover:text-slate-900 cursor-pointer">Kebijakan Privasi</span>
          <span className="hover:text-slate-900 cursor-pointer">Bantuan Angkatan</span>
          <span className="hover:text-slate-900 cursor-pointer">#SelaluBahagia</span>
        </div>
      </footer>
    </div>
  );
}
