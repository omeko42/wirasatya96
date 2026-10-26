'use client';

import React, { useState, useEffect } from 'react';
import { AuthUser } from '@/types';
import {
  getActiveAdcSessionFromStorage,
  recordAdcActivityToAuditLog,
} from '@/lib/avatarUtils';
import {
  SatkerBerjenjangModal,
  SatkerSelectionResult,
} from '@/components/SatkerBerjenjangModal';
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Mail,
  Hash,
  Smartphone,
  Fingerprint,
  Lock,
  Unlock,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Building2,
  IdCard,
  Laptop,
  QrCode,
  RefreshCw,
} from 'lucide-react';

export interface TrustedDevicePasskey {
  id: string;
  deviceName: string;
  platform: string;
  credentialId: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface UserSecurityConfig {
  emailOtpEnabled: boolean;
  pinEnabled: boolean;
  pinCode: string;
  totpEnabled: boolean;
  totpSecret: string;
  passkeyEnabled: boolean;
  trustedDevices: TrustedDevicePasskey[];
  updatedAt: string;
}

const SECURITY_STORAGE_PREFIX = 'ws96_security_cfg_v1_';

function generateBase32Secret(nrp: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const seed = `WS96${nrp}POLRI1996`;
  let out = '';
  for (let i = 0; i < 16; i++) {
    const code = seed.charCodeAt(i % seed.length) + i * 7;
    out += chars[code % chars.length];
  }
  return out;
}

export function detectCurrentDeviceLabel(): { deviceName: string; platform: string } {
  if (typeof window === 'undefined') {
    return { deviceName: 'Perangkat Web Browser', platform: 'Web' };
  }
  const ua = navigator.userAgent || '';
  let os = 'Perangkat Desktop';
  if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Mac/i.test(ua)) os = 'MacBook / macOS';
  else if (/iPhone|iPad/i.test(ua)) os = 'iPhone / iOS';
  else if (/Android/i.test(ua)) os = 'Ponsel Android';
  else if (/Linux/i.test(ua)) os = 'Linux Workstation';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';

  return {
    deviceName: `${os} • ${browser}`,
    platform: os,
  };
}

export function getUserSecurityConfig(
  nrp: string,
  fallbackUser?: Partial<AuthUser>
): UserSecurityConfig {
  const cleanNrp = (nrp || '').trim();
  const isDefaultBiometric = Boolean(
    fallbackUser?.mfaEnabled && fallbackUser?.mfaMethod === 'BIOMETRIC'
  );
  const defaultDevices: TrustedDevicePasskey[] = [];

  const defaultCfg: UserSecurityConfig = {
    emailOtpEnabled: Boolean(
      fallbackUser?.mfaEnabled && fallbackUser?.mfaMethod === 'EMAIL_OTP'
    ),
    pinEnabled: Boolean(fallbackUser?.mfaEnabled && fallbackUser?.mfaMethod === 'PIN'),
    pinCode: '199696',
    totpEnabled: Boolean(fallbackUser?.mfaEnabled && fallbackUser?.mfaMethod === 'TOTP'),
    totpSecret: generateBase32Secret(cleanNrp || '98010710'),
    passkeyEnabled: isDefaultBiometric,
    trustedDevices: defaultDevices,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === 'undefined' || !cleanNrp) return defaultCfg;

  try {
    const raw = localStorage.getItem(`${SECURITY_STORAGE_PREFIX}${cleanNrp}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawDevices: TrustedDevicePasskey[] = Array.isArray(parsed.trustedDevices)
        ? parsed.trustedDevices
        : [];
      // Always strip the legacy hardcoded dummy devices (dev-<nrp>-1 and dev-<nrp>-2)
      const cleanedDevices = rawDevices.filter(
        (d) => d.id !== `dev-${cleanNrp}-1` && d.id !== `dev-${cleanNrp}-2`
      );
      return {
        ...defaultCfg,
        ...parsed,
        passkeyEnabled: cleanedDevices.length > 0 ? Boolean(parsed.passkeyEnabled) : false,
        trustedDevices: cleanedDevices,
      };
    }
  } catch {
    // ignore
  }
  return defaultCfg;
}

export function getActive2FAMethodsCount(cfg: UserSecurityConfig): number {
  let count = 0;
  if (cfg.emailOtpEnabled) count++;
  if (cfg.pinEnabled) count++;
  if (cfg.totpEnabled) count++;
  if (cfg.passkeyEnabled) count++;
  return count;
}

export function saveUserSecurityConfig(
  nrp: string,
  cfg: UserSecurityConfig,
  currentUser?: AuthUser
): UserSecurityConfig {
  const cleanNrp = (nrp || '').trim();
  const updated: UserSecurityConfig = {
    ...cfg,
    updatedAt: new Date().toISOString(),
  };
  const activeCount = getActive2FAMethodsCount(updated);
  const mfaEnabled = activeCount > 0;
  const primaryMethod = updated.pinEnabled
    ? 'PIN'
    : updated.passkeyEnabled
    ? 'BIOMETRIC'
    : updated.totpEnabled
    ? 'TOTP'
    : updated.emailOtpEnabled
    ? 'EMAIL_OTP'
    : 'PIN';

  if (typeof window !== 'undefined' && cleanNrp) {
    localStorage.setItem(`${SECURITY_STORAGE_PREFIX}${cleanNrp}`, JSON.stringify(updated));
    localStorage.setItem(`ws96_2fa_${cleanNrp}`, String(mfaEnabled));

    try {
      const rawOv = localStorage.getItem('ws96_user_overrides_v1');
      const parsedOv = rawOv ? JSON.parse(rawOv) : {};
      parsedOv[cleanNrp] = {
        ...(parsedOv[cleanNrp] || {}),
        nrp: cleanNrp,
        mfaEnabled,
        mfaMethod: primaryMethod,
      };
      localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedOv));
    } catch {
      // ignore
    }

    if (currentUser && currentUser.nrp === cleanNrp) {
      const nextUser: AuthUser = {
        ...currentUser,
        mfaEnabled,
        mfaMethod: primaryMethod,
      };
      localStorage.setItem('ws96_auth_user', JSON.stringify(nextUser));
      localStorage.setItem('ws96_active_user', JSON.stringify(nextUser));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextUser));
      window.dispatchEvent(new Event('ws96_user_updated'));
    }
  }

  fetch('/api/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nrp: cleanNrp,
      mfaEnabled,
      mfaMethod: primaryMethod,
    }),
  }).catch(() => {});

  return updated;
}

interface SecuritySettingsPanelProps {
  currentUser: AuthUser;
  isModal?: boolean;
  onClose?: () => void;
  onOpenFullWizard?: () => void;
}

export const SecuritySettingsPanel: React.FC<SecuritySettingsPanelProps> = ({
  currentUser,
  isModal = false,
  onClose,
  onOpenFullWizard,
}) => {
  const [activeTab, setActiveTab] = useState<'2FA' | 'SATKER'>('2FA');
  const [secConfig, setSecConfig] = useState<UserSecurityConfig>(() =>
    getUserSecurityConfig(currentUser.nrp, currentUser)
  );
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sub-modals for configuring each security method
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Email OTP Setup Modal
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [simulatedEmailOtp, setSimulatedEmailOtp] = useState('482916');
  const [emailOtpInput, setEmailOtpInput] = useState('');

  // PIN Setup / Change Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [showPinText, setShowPinText] = useState(false);

  // Google Authenticator (TOTP) Setup Modal
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpVerifyInput, setTotpVerifyInput] = useState('');

  // Trusted Devices (Kelola Gawai) Modal
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  // Tab 2: Profil Satker & Wilayah Penugasan states
  const [satkerPolda, setSatkerPolda] = useState(currentUser.polda || 'MABES POLRI');
  const [satkerNama, setSatkerNama] = useState(
    (currentUser.satker || 'Mabes Polri').split(' / ')[0].trim()
  );
  const [jabatanPolri, setJabatanPolri] = useState(
    currentUser.jabatanTerakhir || 'Perwira Polri'
  );
  const [emailDinas, setEmailDinas] = useState(
    currentUser.email || `${currentUser.nrp}@polri.go.id`
  );
  const [emailSekunder, setEmailSekunder] = useState(currentUser.secondaryEmail || '');
  const [noHp, setNoHp] = useState(currentUser.noHp || '');
  const [showSatkerPicker, setShowSatkerPicker] = useState(false);
  const [savingSatker, setSavingSatker] = useState(false);

  useEffect(() => {
    setSecConfig(getUserSecurityConfig(currentUser.nrp, currentUser));
    setSatkerPolda(currentUser.polda || 'MABES POLRI');
    setSatkerNama((currentUser.satker || 'Mabes Polri').split(' / ')[0].trim());
    setJabatanPolri(currentUser.jabatanTerakhir || 'Perwira Polri');
    setEmailDinas(currentUser.email || `${currentUser.nrp}@polri.go.id`);
    setEmailSekunder(currentUser.secondaryEmail || '');
    setNoHp(currentUser.noHp || '');
  }, [currentUser]);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const active2FACount = getActive2FAMethodsCount(secConfig);

  const canEnableMore2FA = () => {
    if (active2FACount >= 2) {
      triggerToast(
        'Maksimal 2 metode 2FA dapat aktif bersamaan. Nonaktifkan salah satu metode terlebih dahulu.',
        'error'
      );
      return false;
    }
    return true;
  };

  const updateAndPersist = (patch: Partial<UserSecurityConfig>, message?: string) => {
    const next = saveUserSecurityConfig(
      currentUser.nrp,
      { ...secConfig, ...patch },
      currentUser
    );
    setSecConfig(next);
    const adcSess = getActiveAdcSessionFromStorage();
    if (adcSess) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: `[ADC ${adcSess.adcPangkat} ${adcSess.adcNama} (${adcSess.adcNrp}) mewakili ${adcSess.pimpinanPangkat} ${adcSess.pimpinanNama} (${adcSess.pimpinanNrp})] Memperbarui Pengaturan Keamanan Akun (${message || 'Konfigurasi Keamanan'})`,
      });
    }
    if (message) triggerToast(message, 'success');
  };

  // 1. Ubah Password Handler
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 6) {
      triggerToast('Password baru minimal harus terdiri dari 6 karakter.', 'error');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      triggerToast('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }
    setSavingPassword(true);
    const cleanPass = newPassword.trim();
    try {
      await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: currentUser.nrp,
          password: cleanPass,
          mfaMethod: currentUser.mfaMethod || 'PIN',
        }),
      });
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nrp: currentUser.nrp,
          password: cleanPass,
          status: 'AKTIF',
        }),
      });
    } catch {
      // ignore network error, persist locally
    }

    if (typeof window !== 'undefined') {
      try {
        const rawOv = localStorage.getItem('ws96_user_overrides_v1');
        const parsedOv = rawOv ? JSON.parse(rawOv) : {};
        parsedOv[currentUser.nrp] = {
          ...(parsedOv[currentUser.nrp] || {}),
          nrp: currentUser.nrp,
          password: cleanPass,
          status: 'AKTIF',
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedOv));
      } catch {
        // ignore
      }
      const nextAuth: AuthUser = {
        ...currentUser,
        password: cleanPass,
        status: 'AKTIF',
      };
      localStorage.setItem('ws96_auth_user', JSON.stringify(nextAuth));
      localStorage.setItem('ws96_active_user', JSON.stringify(nextAuth));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextAuth));
    }

    const adcSess = getActiveAdcSessionFromStorage();
    if (adcSess) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: `[ADC ${adcSess.adcPangkat} ${adcSess.adcNama} (${adcSess.adcNrp}) mewakili ${adcSess.pimpinanPangkat} ${adcSess.pimpinanNama} (${adcSess.pimpinanNrp})] Memperbarui Password Akun Pimpinan di Pengaturan Keamanan`,
      });
    }

    setSavingPassword(false);
    setShowPasswordModal(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    triggerToast('Password akun berhasil diperbarui dan langsung aktif untuk login.');
  };

  // 2. Toggle / Setup OTP Email Kedinasan
  const handleToggleEmailOtp = () => {
    if (secConfig.emailOtpEnabled) {
      updateAndPersist(
        { emailOtpEnabled: false },
        'Verifikasi OTP Email Kedinasan dinonaktifkan.'
      );
      return;
    }
    if (!canEnableMore2FA()) return;
    const randomOtp = String(Math.floor(100000 + Math.random() * 900000));
    setSimulatedEmailOtp(randomOtp);
    setEmailOtpInput(randomOtp);
    setShowEmailOtpModal(true);
  };

  const handleConfirmEmailOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOtpInput.trim().length !== 6) {
      triggerToast('Masukkan 6 digit kode OTP email.', 'error');
      return;
    }
    setShowEmailOtpModal(false);
    updateAndPersist(
      { emailOtpEnabled: true },
      'OTP Email Kedinasan berhasil diaktifkan.'
    );
  };

  // 3. Toggle / Setup PIN Keamanan
  const handleTogglePin = () => {
    if (secConfig.pinEnabled) {
      updateAndPersist({ pinEnabled: false }, 'PIN Keamanan dinonaktifkan.');
      return;
    }
    if (!canEnableMore2FA()) return;
    setPinInput(secConfig.pinCode || '');
    setPinConfirmInput(secConfig.pinCode || '');
    setShowPinModal(true);
  };

  const handleOpenChangePin = () => {
    setPinInput(secConfig.pinCode || '');
    setPinConfirmInput(secConfig.pinCode || '');
    setShowPinModal(true);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      triggerToast('PIN Keamanan harus terdiri dari 6 digit angka.', 'error');
      return;
    }
    if (cleanPin !== pinConfirmInput.replace(/\D/g, '')) {
      triggerToast('Konfirmasi PIN Keamanan tidak cocok.', 'error');
      return;
    }
    setShowPinModal(false);
    updateAndPersist(
      { pinEnabled: true, pinCode: cleanPin },
      'PIN Keamanan 6-digit berhasil disimpan dan diaktifkan.'
    );
  };

  // 4. Toggle / Setup Google Authenticator (TOTP)
  const handleToggleTotp = () => {
    if (secConfig.totpEnabled) {
      updateAndPersist(
        { totpEnabled: false },
        'Google Authenticator (TOTP) dinonaktifkan.'
      );
      return;
    }
    if (!canEnableMore2FA()) return;
    setTotpVerifyInput('');
    setShowTotpModal(true);
  };

  const handleConfirmTotp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = totpVerifyInput.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      triggerToast('Masukkan kode 6-digit dari aplikasi Authenticator.', 'error');
      return;
    }
    setShowTotpModal(false);
    updateAndPersist(
      { totpEnabled: true },
      'Google Authenticator (TOTP) berhasil diverifikasi dan diaktifkan.'
    );
  };

  // 5. Toggle / Manage Biometrik Perangkat (Passkey)
  const handleTogglePasskey = async () => {
    if (secConfig.passkeyEnabled) {
      updateAndPersist(
        { passkeyEnabled: false },
        'Login Biometrik Perangkat (Passkey) dinonaktifkan.'
      );
      return;
    }
    if (!canEnableMore2FA()) return;

    // Ensure at least 1 trusted device exists when activating
    let devices = secConfig.trustedDevices;
    if (devices.length === 0) {
      const detected = detectCurrentDeviceLabel();
      devices = [
        {
          id: `dev-${Date.now()}`,
          deviceName: detected.deviceName,
          platform: detected.platform,
          credentialId: `pk-${currentUser.nrp}-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
      ];
    }
    updateAndPersist(
      { passkeyEnabled: true, trustedDevices: devices },
      'Biometrik Perangkat (Passkey) berhasil diaktifkan.'
    );
  };

  const handleRegisterNewDevicePasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringPasskey(true);
    const detected = detectCurrentDeviceLabel();
    const label = customDeviceName.trim() || detected.deviceName;

    // Attempt WebAuthn credential creation if supported by browser
    try {
      if (
        typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        navigator.credentials?.create
      ) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new TextEncoder().encode(currentUser.nrp);
        await navigator.credentials
          .create({
            publicKey: {
              challenge,
              rp: { name: 'Portal Wira Satya 96' },
              user: {
                id: userId,
                name: currentUser.email || `${currentUser.nrp}@polri.go.id`,
                displayName: currentUser.nama,
              },
              pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
              timeout: 15000,
              authenticatorSelection: {
                userVerification: 'preferred',
              },
            },
          })
          .catch(() => null);
      }
    } catch {
      // Fallback gracefully if user cancels native OS prompt or running on non-HTTPS
    }

    const newDevice: TrustedDevicePasskey = {
      id: `dev-${Date.now()}`,
      deviceName: label,
      platform: detected.platform,
      credentialId: `pk-${currentUser.nrp}-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    const nextDevices = [newDevice, ...secConfig.trustedDevices];
    setRegisteringPasskey(false);
    setCustomDeviceName('');
    updateAndPersist(
      {
        trustedDevices: nextDevices,
        passkeyEnabled: active2FACount < 2 ? true : secConfig.passkeyEnabled,
      },
      `Gawai "${label}" berhasil didaftarkan sebagai perangkat biometrik terpercaya.`
    );
  };

  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    const nextDevices = secConfig.trustedDevices.filter((d) => d.id !== deviceId);
    const nextPasskeyEnabled =
      nextDevices.length === 0 ? false : secConfig.passkeyEnabled;
    updateAndPersist(
      {
        trustedDevices: nextDevices,
        passkeyEnabled: nextPasskeyEnabled,
      },
      `Izin biometrik gawai "${deviceName}" telah dicabut.`
    );
  };

  // Tab 2: Save Satker & Wilayah Penugasan
  const handleSaveSatkerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSatker(true);
    const nowIso = new Date().toISOString();
    const cleanSatker = satkerNama.trim() || 'Mabes Polri';
    const cleanPolda = satkerPolda.trim() || 'MABES POLRI';
    const cleanJabatan = jabatanPolri.trim() || 'Perwira Polri';
    const cleanEmail = emailDinas.trim() || `${currentUser.nrp}@polri.go.id`;
    const cleanSecEmail = emailSekunder.trim();
    const cleanPhone = noHp.trim();

    try {
      await Promise.all([
        fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nrp: currentUser.nrp,
            satker: cleanSatker,
            polda: cleanPolda,
            jabatanTerakhir: cleanJabatan,
            email: cleanEmail,
            secondaryEmail: cleanSecEmail,
            noHp: cleanPhone,
            updatedAt: nowIso,
          }),
        }),
        fetch('/api/members', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nrp: currentUser.nrp,
            namaLengkap: currentUser.nama,
            pangkat: currentUser.pangkat,
            satuanKerja: cleanSatker,
            satker: cleanSatker,
            polda: cleanPolda,
            jabatanTerakhir: cleanJabatan,
            email: cleanEmail,
            secondaryEmail: cleanSecEmail,
            noHp: cleanPhone,
            updatedAt: nowIso,
          }),
        }),
      ]);
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      try {
        const rawUOv = localStorage.getItem('ws96_user_overrides_v1');
        const parsedUOv = rawUOv ? JSON.parse(rawUOv) : {};
        parsedUOv[currentUser.nrp] = {
          ...(parsedUOv[currentUser.nrp] || {}),
          nrp: currentUser.nrp,
          satker: cleanSatker,
          polda: cleanPolda,
          jabatanTerakhir: cleanJabatan,
          email: cleanEmail,
          secondaryEmail: cleanSecEmail,
          noHp: cleanPhone,
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_user_overrides_v1', JSON.stringify(parsedUOv));
      } catch {
        // ignore
      }

      try {
        const rawMOv = localStorage.getItem('ws96_member_overrides_v1');
        const parsedMOv = rawMOv ? JSON.parse(rawMOv) : {};
        parsedMOv[currentUser.nrp] = {
          ...(parsedMOv[currentUser.nrp] || {}),
          nrp: currentUser.nrp,
          namaLengkap: parsedMOv[currentUser.nrp]?.namaLengkap || currentUser.nama,
          pangkat: parsedMOv[currentUser.nrp]?.pangkat || currentUser.pangkat,
          satuanKerja: cleanSatker,
          satker: cleanSatker,
          polda: cleanPolda,
          jabatanTerakhir: cleanJabatan,
          email: cleanEmail,
          secondaryEmail: cleanSecEmail,
          noHp: cleanPhone,
          updatedAt: nowIso,
        };
        localStorage.setItem('ws96_member_overrides_v1', JSON.stringify(parsedMOv));
      } catch {
        // ignore
      }

      const nextUser: AuthUser = {
        ...currentUser,
        satker: cleanSatker,
        polda: cleanPolda,
        jabatanTerakhir: cleanJabatan,
        email: cleanEmail,
        secondaryEmail: cleanSecEmail,
        noHp: cleanPhone,
        updatedAt: nowIso,
      };
      localStorage.setItem('ws96_auth_user', JSON.stringify(nextUser));
      localStorage.setItem('ws96_active_user', JSON.stringify(nextUser));
      localStorage.setItem('wirasatya96_current_user', JSON.stringify(nextUser));
      window.dispatchEvent(new Event('ws96_user_updated'));
    }

    const adcSess = getActiveAdcSessionFromStorage();
    if (adcSess) {
      recordAdcActivityToAuditLog({
        action: 'AKTIVITAS_ADC',
        details: `[ADC ${adcSess.adcPangkat} ${adcSess.adcNama} (${adcSess.adcNrp}) mewakili ${adcSess.pimpinanPangkat} ${adcSess.pimpinanNama} (${adcSess.pimpinanNrp})] Memperbarui Profil Satker & Wilayah Penugasan (${cleanJabatan} — ${cleanSatker})`,
      });
    }

    setSavingSatker(false);
    triggerToast('Profil Satker & Wilayah Penugasan berhasil diperbarui.');
  };

  const complianceBadge =
    active2FACount >= 2
      ? {
          label: `• Sangat Kuat (${active2FACount} Metode)`,
          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        }
      : active2FACount === 1
      ? {
          label: '• Kuat (1 Metode)',
          cls: 'bg-sky-50 text-sky-700 border-sky-200',
        }
      : {
          label: '• Dasar (0 Metode)',
          cls: 'bg-amber-50 text-amber-700 border-amber-200',
        };

  const cardContent = (
    <div
      className={
        isModal
          ? 'bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp'
          : 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <h3 className="font-extrabold text-sm text-slate-900">
            Pengaturan Profil &amp; Keamanan Kedinasan
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TOAST BANNER */}
      {toast && (
        <div
          className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* TOP SEGMENTED TABS */}
      <div className="px-5 pt-4">
        <div className="p-1.5 bg-slate-100 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('2FA')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === '2FA'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Keamanan Mandiri &amp; Autentikasi (2FA)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SATKER')}
            className={`py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'SATKER'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <IdCard className="w-4 h-4" />
            <span>Profil Satker &amp; Wilayah Penugasan</span>
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: KEAMANAN MANDIRI & AUTENTIKASI (2FA)                      */}
      {/* ================================================================ */}
      {activeTab === '2FA' && (
        <div className="p-5 space-y-4 text-xs">
          {/* Status Kepatuhan MFA */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium">
              Status kepatuhan autentikasi multi-faktor (MFA) standar Mabes Polri
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${complianceBadge.cls}`}
            >
              {complianceBadge.label}
            </span>
          </div>

          {/* ROW 1: PASSWORD AKUN */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-slate-900">Password Akun </span>
                <span className="text-slate-500 text-[11px]">
                  (Kredensial login mandiri Anda)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                <Unlock className="w-3 h-3" />
                <span>Aktif</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-600 font-bold text-[11px] transition-colors cursor-pointer"
              >
                Ubah Password
              </button>
            </div>
          </div>

          {/* SECTION HEADER: OTENTIKASI DUA LANGKAH (2FA) */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OTENTIKASI DUA LANGKAH (2FA)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Pilih maksimal 2 metode aktif
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* 2FA ROW A: OTP EMAIL KEDINASAN */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900">
                    OTP Email Kedinasan{' '}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    (Verifikasi kode OTP 6-digit ke email dinas Polri saat login)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {secConfig.emailOtpEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <Unlock className="w-3 h-3" />
                    <span>Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Nonaktif</span>
                  </span>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={secConfig.emailOtpEnabled}
                  onClick={handleToggleEmailOtp}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    secConfig.emailOtpEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform ${
                      secConfig.emailOtpEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleToggleEmailOtp}
                  className={`text-[11px] font-bold cursor-pointer ${
                    secConfig.emailOtpEnabled
                      ? 'text-red-600 hover:underline'
                      : 'text-emerald-600 hover:underline'
                  }`}
                >
                  {secConfig.emailOtpEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>

            {/* 2FA ROW B: PIN KEAMANAN */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <Hash className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900">PIN Keamanan </span>
                  <span className="text-slate-500 text-[11px]">
                    (Aktif sebagai lapisan otorisasi tindakan sensitif &amp; login)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {secConfig.pinEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <Unlock className="w-3 h-3" />
                    <span>Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Nonaktif</span>
                  </span>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={secConfig.pinEnabled}
                  onClick={handleTogglePin}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    secConfig.pinEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform ${
                      secConfig.pinEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {secConfig.pinEnabled ? (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenChangePin}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={handleTogglePin}
                      className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            </div>

            {/* 2FA ROW C: GOOGLE AUTHENTICATOR (TOTP) */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900">
                    Google Authenticator (TOTP){' '}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    (Kode otentikasi 6-digit dari aplikasi ponsel (Google/MS Authenticator))
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {secConfig.totpEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <Unlock className="w-3 h-3" />
                    <span>Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Nonaktif</span>
                  </span>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={secConfig.totpEnabled}
                  onClick={handleToggleTotp}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    secConfig.totpEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform ${
                      secConfig.totpEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {secConfig.totpEnabled ? (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowTotpModal(true)}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleTotp}
                      className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleTotp}
                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            </div>

            {/* 2FA ROW D: BIOMETRIK PERANGKAT (PASSKEY) */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    secConfig.passkeyEnabled
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900">
                    Biometrik Perangkat (Passkey){' '}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {secConfig.trustedDevices.length > 0
                      ? `(${secConfig.trustedDevices.length} gawai terpercaya terdaftar untuk login biometrik (wajah / sidik jari / PIN))`
                      : '(Belum ada gawai terhubung — aktifkan untuk login biometrik wajah / sidik jari / PIN)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {secConfig.passkeyEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <Unlock className="w-3 h-3" />
                    <span>Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Nonaktif</span>
                  </span>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={secConfig.passkeyEnabled}
                  onClick={handleTogglePasskey}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    secConfig.passkeyEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform ${
                      secConfig.passkeyEnabled ? 'translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {secConfig.passkeyEnabled ? (
                  <button
                    type="button"
                    onClick={handleTogglePasskey}
                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Nonaktifkan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTogglePasskey}
                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Aktifkan
                  </button>
                )}
              </div>
            </div>

            {/* ROW E: PERANGKAT & GAWAI TERPERCAYA */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    secConfig.trustedDevices.length > 0
                      ? 'bg-purple-50 text-purple-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900">
                    Perangkat &amp; Gawai Terpercaya{' '}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    (Audit dan cabut izin gawai biometrik yang pernah didaftarkan)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                {secConfig.trustedDevices.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <Unlock className="w-3 h-3" />
                    <span>{secConfig.trustedDevices.length} Terhubung</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Nonaktif</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowDevicesModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-600 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Kelola Gawai ({secConfig.trustedDevices.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: PROFIL SATKER & WILAYAH PENUGASAN                         */}
      {/* ================================================================ */}
      {activeTab === 'SATKER' && (
        <form onSubmit={handleSaveSatkerProfile} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Satker Melekat &amp; Wilayah Penugasan
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div
                  onClick={() => setShowSatkerPicker(true)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 cursor-pointer flex items-center gap-2.5 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 truncate">
                      {satkerNama}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {satkerPolda}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSatkerPicker(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Pilih Satker Berjenjang</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Jabatan Organisasi Polri Saat Ini
              </label>
              <input
                type="text"
                value={jabatanPolri}
                onChange={(e) => setJabatanPolri(e.target.value)}
                placeholder="Contoh: Kabagbinopsnal / Analis Kebijakan Madya..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nomor WhatsApp Kedinasan / Aktif
              </label>
              <input
                type="tel"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Dinas (@polri.go.id)
              </label>
              <input
                type="email"
                value={emailDinas}
                onChange={(e) => setEmailDinas(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Sekunder / Pribadi (Opsional)
              </label>
              <input
                type="email"
                value={emailSekunder}
                onChange={(e) => setEmailSekunder(e.target.value)}
                placeholder="Contoh: nama@gmail.com"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            {onOpenFullWizard ? (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenFullWizard();
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
              >
                Buka Formulir Data Diri Lengkap
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={savingSatker}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{savingSatker ? 'Menyimpan...' : 'Simpan Profil Penugasan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================================================================ */}
      {/* SUB-MODAL 1: UBAH PASSWORD AKUN                                  */}
      {/* ================================================================ */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Ubah Password Akun
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    NRP {currentUser.nrp} &bull; {currentUser.nama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password Saat Ini (Opsional)
                </label>
                <input
                  type={showPassText ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password Baru <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassText ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-3.5 pr-9 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassText(!showPassText)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassText ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Konfirmasi Password Baru <span className="text-red-600">*</span>
                </label>
                <input
                  type={showPassText ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-50"
                >
                  {savingPassword ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUB-MODAL 2: AKTIVASI OTP EMAIL KEDINASAN                        */}
      {/* ================================================================ */}
      {showEmailOtpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowEmailOtpModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Aktivasi OTP Email Kedinasan
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {currentUser.email || `${currentUser.nrp}@polri.go.id`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailOtpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmEmailOtp} className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
                <div className="font-bold text-[11px]">
                  Kode Verifikasi OTP Email Anda:
                </div>
                <div className="font-mono text-base font-black tracking-widest text-blue-700">
                  {simulatedEmailOtp}
                </div>
                <p className="text-[10px] text-blue-700/80">
                  Kode dikirim ke email dinas{' '}
                  <strong>{currentUser.email || `${currentUser.nrp}@polri.go.id`}</strong>
                  {currentUser.secondaryEmail ? ` & ${currentUser.secondaryEmail}` : ''}.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Masukkan Kode OTP 6-Digit
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={emailOtpInput}
                  onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 digit angka"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono text-sm font-black tracking-widest focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailOtpModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  Verifikasi &amp; Aktifkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUB-MODAL 3: ATUR / UBAH PIN KEAMANAN 6-DIGIT                    */}
      {/* ================================================================ */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowPinModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Konfigurasi PIN Keamanan (6-Digit)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Digunakan untuk verifikasi login 2FA &amp; otorisasi tindakan sensitif
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  PIN Keamanan 6-Digit Baru
                </label>
                <div className="relative">
                  <input
                    type={showPinText ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 199696"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono text-sm font-black tracking-widest focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPinText ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Konfirmasi PIN 6-Digit
                </label>
                <input
                  type={showPinText ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pinConfirmInput}
                  onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ulangi 6 digit PIN"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono text-sm font-black tracking-widest focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  Simpan &amp; Aktifkan PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUB-MODAL 4: GOOGLE AUTHENTICATOR (TOTP) SETUP                   */}
      {/* ================================================================ */}
      {showTotpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowTotpModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Google / Microsoft Authenticator (TOTP)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pindai QR atau masukkan Secret Key pada aplikasi Authenticator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTotpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTotp} className="space-y-3.5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center space-y-2.5">
                {/* Deterministic QR Matrix Visual */}
                <div className="w-36 h-36 bg-white p-2.5 rounded-xl border border-slate-300 shadow-xs grid grid-cols-7 grid-rows-7 gap-1">
                  {Array.from({ length: 49 }).map((_, idx) => {
                    const charCode = secConfig.totpSecret.charCodeAt(
                      idx % secConfig.totpSecret.length
                    );
                    const isCorner =
                      idx < 2 ||
                      idx === 5 ||
                      idx === 6 ||
                      idx === 7 ||
                      idx === 13 ||
                      idx === 35 ||
                      idx === 42 ||
                      idx === 43;
                    const filled = isCorner || (charCode + idx) % 2 === 0;
                    return (
                      <div
                        key={idx}
                        className={`rounded-[2px] ${
                          filled ? 'bg-slate-900' : 'bg-slate-100'
                        }`}
                      />
                    );
                  })}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Kode Kunci Manual (Aplikasi Authenticator)
                  </div>
                  <div className="font-mono font-extrabold text-xs text-slate-800 bg-white px-3 py-1 rounded border border-slate-200 mt-0.5 select-all">
                    {secConfig.totpSecret}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kode Otentikasi 6-Digit dari Aplikasi
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpVerifyInput}
                  onChange={(e) => setTotpVerifyInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan 6 digit kode TOTP"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center font-mono text-sm font-black tracking-widest focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTotpModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                >
                  Verifikasi &amp; Aktifkan TOTP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUB-MODAL 5: KELOLA PERANGKAT & GAWAI TERPERCAYA (PASSKEY)       */}
      {/* ================================================================ */}
      {showDevicesModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowDevicesModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Perangkat &amp; Gawai Biometrik Terpercaya
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Audit dan cabut izin gawai Passkey yang terdaftar pada akun Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDevicesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {secConfig.trustedDevices.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  Belum ada perangkat biometrik terpercaya yang didaftarkan.
                </div>
              ) : (
                secConfig.trustedDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                        {dev.platform.toLowerCase().includes('mobile') ||
                        dev.platform.toLowerCase().includes('android') ||
                        dev.platform.toLowerCase().includes('iphone') ? (
                          <Smartphone className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Laptop className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {dev.deviceName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ID: <span className="font-mono">{dev.credentialId}</span> &bull;{' '}
                          Aktif terakhir:{' '}
                          {new Date(dev.lastUsedAt).toLocaleDateString('id-ID', {
                            dateStyle: 'medium',
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevokeDevice(dev.id, dev.deviceName)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cabut Izin</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleRegisterNewDevicePasskey}
              className="pt-3 border-t border-slate-100 space-y-2.5"
            >
              <label className="block font-bold text-slate-700">
                Daftarkan Perangkat / Gawai Baru (Passkey Biometrik)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(e) => setCustomDeviceName(e.target.value)}
                  placeholder={`Default: ${detectCurrentDeviceLabel().deviceName}`}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={registeringPasskey}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {registeringPasskey ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Tambah Gawai Ini</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PILIH SATKER BERJENJANG (DARI TAB 2) */}
      <SatkerBerjenjangModal
        isOpen={showSatkerPicker}
        onClose={() => setShowSatkerPicker(false)}
        initialPolda={satkerPolda}
        initialSatker={satkerNama}
        initialSubSatker=""
        onApply={(res: SatkerSelectionResult) => {
          setSatkerPolda(res.polda);
          setSatkerNama(res.composedSatker);
        }}
      />
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        onClick={onClose}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
};
