import { AuthUser, UserRole } from '@/types';
import { AKPOL_1996_USERS } from './akpol1996Alumni';
import { DUMMY_USERS } from './dummySimulationData';

export const PRESET_USERS: AuthUser[] = [
  {
    id: 'u-superadmin',
    nrp: '98010710',
    nama: 'Eko Agung',
    pangkat: 'Briptu',
    email: 'superadmin@example.com',
    secondaryEmail: 'superadmin.ws96@example.com',
    role: 'SUPERADMIN',
    profileId: 'ws-98010710',
    mfaEnabled: false,
    mfaMethod: 'PIN',
    fotoUrl: '/default-avatar.png',
    bio: 'Personel Bareskrim Polri (S1 Teknik Informatika) yang bertugas sebagai Lead Developer & Superadmin Sistem Informasi Portal Wira Satya 96.',
    satker: 'Bareskrim Polri',
    jabatanTerakhir: 'Staf',
    statusKedinasan: 'AKTIF',
    polda: 'MABES POLRI',
    password: 'WS96@98010710',
    status: 'AKTIF',
  },
  ...DUMMY_USERS,
  ...AKPOL_1996_USERS,
];

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    label: string;
    description: string;
    badgeColor: string;
    canEditAllMembers: boolean;
    canManageUsers: boolean;
    canManageFinance: boolean;
    canRekapFinance: boolean;
    canViewExecutiveAnalytics: boolean;
  }
> = {
  SUPERADMIN: {
    label: 'Superadmin',
    description: 'Otoritas penuh sistem, manajemen & penghapusan seluruh pengguna, pemulihan log audit, verifikasi, dan akses kas/aset.',
    badgeColor: 'bg-red-900 text-amber-300 border border-amber-500/40',
    canEditAllMembers: true,
    canManageUsers: true,
    canManageFinance: true,
    canRekapFinance: true,
    canViewExecutiveAnalytics: true,
  },
  SEKRETARIAT: {
    label: 'Sekretaris',
    description: 'Pengelola pendataan anggota, penambahan/edit user, verifikasi pendaftaran, dan penghapusan akun Anggota (tercatat di Log Audit).',
    badgeColor: 'bg-blue-700 text-white',
    canEditAllMembers: true,
    canManageUsers: true,
    canManageFinance: false,
    canRekapFinance: false,
    canViewExecutiveAnalytics: true,
  },
  KETUA: {
    label: 'Ketua Paguyuban',
    description: 'Pimpinan paguyuban, pengawasan manajemen user & log audit, verifikasi anggota, rekap laporan kas & aset, serta pemantauan anev.',
    badgeColor: 'bg-amber-600 text-white',
    canEditAllMembers: true,
    canManageUsers: true,
    canManageFinance: false,
    canRekapFinance: true,
    canViewExecutiveAnalytics: true,
  },
  BENDAHARA: {
    label: 'Bendahara',
    description: 'Pengelola penginputan arus kas, portofolio aset, pencatatan iuran, dan rekap laporan (tanpa akses manajemen/hapus user).',
    badgeColor: 'bg-emerald-700 text-white',
    canEditAllMembers: false,
    canManageUsers: false,
    canManageFinance: true,
    canRekapFinance: true,
    canViewExecutiveAnalytics: true,
  },
  ANGGOTA: {
    label: 'Anggota',
    description: 'Perwira alumni batalyon & ADC (pengawasan terbuka kas & direktori, tanpa akses manajemen/hapus user).',
    badgeColor: 'bg-slate-700 text-white',
    canEditAllMembers: false,
    canManageUsers: false,
    canManageFinance: false,
    canRekapFinance: false,
    canViewExecutiveAnalytics: false,
  },
};

