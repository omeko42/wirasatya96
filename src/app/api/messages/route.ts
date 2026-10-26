import { NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';
import { withRedisCache, cacheInvalidatePrefix } from '@/lib/redisCache';

// GET /api/messages?user1=...&user2=... or ?userNrp=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user1 = searchParams.get('user1') || searchParams.get('userNrp') || undefined;
    const user2 = searchParams.get('user2') || undefined;
    const cacheKey = `ws96:messages:u1=${user1 || 'all'}:u2=${user2 || 'all'}`;

    const { data: messages, cacheMeta } = await withRedisCache(
      cacheKey,
      15,
      async () => {
        await serverStore.ensureSynced();
        return serverStore.getMessages(user1, user2);
      }
    );

    return NextResponse.json(
      {
        success: true,
        count: messages.length,
        messages,
        cache: cacheMeta,
      },
      {
        headers: {
          'X-WS96-Cache': cacheMeta.status,
          'X-WS96-Cache-Layer': cacheMeta.layer,
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal memuat pesan obrolan leting', detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/messages
export async function POST(request: Request) {
  try {
    await serverStore.ensureSynced();
    const body = await request.json();
    const {
      senderNrp,
      senderName,
      senderPangkat,
      senderAvatar,
      receiverNrp,
      receiverName,
      text,
      attachmentUrl,
      attachmentName,
    } = body;

    if (!senderNrp || !receiverNrp || !text?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Data pengirim, penerima, dan pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const newMsg = serverStore.addMessage({
      senderNrp,
      senderName: senderName || 'Rekan Wira Satya',
      senderPangkat,
      senderAvatar,
      receiverNrp,
      receiverName,
      text: text.trim(),
      attachmentUrl,
      attachmentName,
    });

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:messages:');

    return NextResponse.json({
      success: true,
      message: newMsg,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengirim pesan obrolan leting', detail: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/messages (Mark as read)
export async function PUT(request: Request) {
  try {
    await serverStore.ensureSynced();
    const body = await request.json();
    const { senderNrp, receiverNrp } = body;

    if (senderNrp && receiverNrp) {
      serverStore.markMessagesAsRead(senderNrp, receiverNrp);
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:messages:');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui status baca pesan' },
      { status: 500 }
    );
  }
}
