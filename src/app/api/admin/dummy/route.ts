import { NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';
import { cacheInvalidatePrefix } from '@/lib/redisCache';
import { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = serverStore.getDummyDataStatus();
    return NextResponse.json({
      success: true,
      data: status,
      deletedNrps: serverStore.getDeletedNrps(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal membaca status data dummy',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || '').toUpperCase();
    const actorName = body.actorName || 'Superadmin';
    const actorNrp = body.actorNrp || '98010710';
    const actorRole: UserRole = body.actorRole || 'SUPERADMIN';

    if (actorRole !== 'SUPERADMIN' && actorNrp !== '98010710') {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses Ditolak: Hanya Superadmin yang dapat menjalankan Clearance / Injeksi Data Dummy Simulasi.',
        },
        { status: 403 }
      );
    }

    if (action === 'CLEAR_DUMMY') {
      const result = serverStore.clearDummySimulationData({
        actorName,
        actorNrp,
        actorRole,
      });
      await cacheInvalidatePrefix('ws96:');
      return NextResponse.json({
        success: true,
        action: 'CLEAR_DUMMY',
        message: `Clearance Otomatis berhasil! Seluruh akun dummy_1 s/d dummy_5 beserta postingan, transaksi, aset, dan pesan simulasi telah dibersihkan. Data 261 anggota existing tetap aman & utuh.`,
        data: {
          ...result,
          members: serverStore.getMembers(),
          users: serverStore.getUsers(),
          registrations: serverStore.getRegistrations(),
          posts: serverStore.getPosts(),
          finance: serverStore.getFinance(),
          messages: serverStore.getMessages(),
          auditLogs: serverStore.getAuditLogs(),
        },
      });
    }

    if (action === 'SEED_DUMMY') {
      const result = serverStore.seedDummySimulationData({
        actorName,
        actorNrp,
        actorRole,
      });
      await cacheInvalidatePrefix('ws96:');
      return NextResponse.json({
        success: true,
        action: 'SEED_DUMMY',
        message: `Paket Data Dummy Simulasi (dummy_1 s/d dummy_5) berhasil dimuat ke seluruh fitur tanpa menggunakan figur asli!`,
        data: {
          ...result,
          members: serverStore.getMembers(),
          users: serverStore.getUsers(),
          registrations: serverStore.getRegistrations(),
          posts: serverStore.getPosts(),
          finance: serverStore.getFinance(),
          messages: serverStore.getMessages(),
          auditLogs: serverStore.getAuditLogs(),
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Aksi tidak dikenali. Gunakan CLEAR_DUMMY atau SEED_DUMMY.',
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal memproses operasi data dummy',
      },
      { status: 500 }
    );
  }
}
