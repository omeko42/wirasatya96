import { NextRequest, NextResponse } from 'next/server';
import { getRedisCacheStats, cacheInvalidatePrefix } from '@/lib/redisCache';
import { serverStore } from '@/lib/serverStore';

export async function GET() {
  const stats = getRedisCacheStats();
  const storage = serverStore.getStorageStatsKb();
  return NextResponse.json({
    success: true,
    stats,
    storage,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'CLEANUP_JUNK') {
      const cleanup = await serverStore.compactAndCleanJunkData();
      const removed = await cacheInvalidatePrefix('ws96:');
      const stats = getRedisCacheStats();
      const storage = serverStore.getStorageStatsKb();
      return NextResponse.json({
        success: true,
        message: `Data sampah dibersihkan & JSON dikompresi (${cleanup.beforeKb} KB -> ${cleanup.afterKb} KB).`,
        cleanup,
        removed,
        stats,
        storage,
      });
    }

    const prefix = typeof body?.prefix === 'string' ? body.prefix : 'ws96:';
    const removed = await cacheInvalidatePrefix(prefix);
    const stats = getRedisCacheStats();
    const storage = serverStore.getStorageStatsKb();
    return NextResponse.json({
      success: true,
      message: `Cache Redis berhasil di-flush (${removed} key dibersihkan).`,
      removed,
      stats,
      storage,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Gagal membersihkan cache Redis', error: String(error) },
      { status: 500 }
    );
  }
}
