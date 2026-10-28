import { NextRequest, NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';
import { UserRole } from '@/types';

// POST /api/auth/verify - Superadmin/Sekretariat approves or rejects registration
export async function POST(req: NextRequest) {
  try {
    await serverStore.ensureSynced();
    const session = serverStore.getSession();
    if (session && session.role !== 'SUPERADMIN' && session.role !== 'SEKRETARIAT') {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya Admin dan Kesekretariatan yang memiliki hak verifikasi pengguna.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, nrp, action, verifierName, role } = body;

    const targetId = id || nrp;
    if (!targetId || typeof targetId !== 'string' || !action || typeof action !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID/NRP dan aksi (APPROVE / REJECT) wajib disertakan berupa teks valid.' },
        { status: 400 }
      );
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { success: false, message: 'Aksi tidak valid. Pilih APPROVE atau REJECT.' },
        { status: 400 }
      );
    }

    const result = serverStore.verifyRegistration(
      targetId,
      action,
      verifierName || 'Admin WS96',
      (role as UserRole) || 'ANGGOTA'
    );

    await serverStore.flushCloud();

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Gagal memproses verifikasi', error },
      { status: 500 }
    );
  }
}
