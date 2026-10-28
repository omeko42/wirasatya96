import { NextRequest, NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';

export async function POST(req: NextRequest) {
  try {
    await serverStore.ensureSynced();
    const body = await req.json();
    const { nrp, userId, username, identifier, password, mfaMethod, clientOverride } = body;

    const targetId = identifier || username || userId || nrp;
    if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
      return NextResponse.json(
        { success: false, message: 'NRP atau Email dinas diperlukan (harus berupa teks valid)' }, 
        { status: 400 }
      );
    }

    if (password !== undefined && password !== null && typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Format sandi tidak valid (tolak payload non-string)' },
        { status: 401 }
      );
    }

    const authResult = serverStore.authenticate(targetId, password, clientOverride);
    await serverStore.flushCloud();

    // If requires password setup (user was approved by Superadmin, now needs to create initial password)
    if (authResult.requiresPasswordSetup) {
      return NextResponse.json({
        success: false,
        requiresPasswordSetup: true,
        status: authResult.status,
        nrp: authResult.nrp,
        nama: authResult.nama,
        pangkat: authResult.pangkat,
        message: authResult.message,
      }, { status: 200 });
    }

    // If pending verification or rejected or invalid credentials
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        status: authResult.status,
        message: authResult.message,
      }, { status: 401 });
    }

    const user = authResult.user!;
    return NextResponse.json({
      success: true,
      message: `Login berhasil sebagai ${user.nama} (${user.role})`,
      user,
      mfaVerified: !!mfaMethod || user.mfaMethod === 'BIOMETRIC',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server saat login', error }, 
      { status: 500 }
    );
  }
}
