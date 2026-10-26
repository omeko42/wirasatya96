import { NextRequest, NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';
import { withRedisCache, cacheInvalidatePrefix } from '@/lib/redisCache';

export async function GET() {
  const { data: posts, cacheMeta } = await withRedisCache(
    'ws96:posts:all',
    45,
    async () => {
      await serverStore.ensureSynced();
      return serverStore.getPosts();
    }
  );

  return NextResponse.json(
    {
      success: true,
      count: posts.length,
      posts,
      cache: cacheMeta,
    },
    {
      headers: {
        'X-WS96-Cache': cacheMeta.status,
        'X-WS96-Cache-Layer': cacheMeta.layer,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    await serverStore.ensureSynced();
    const body = await req.json();
    const { action } = body;

    if (action === 'LIKE' && body.postId) {
      const updated = serverStore.toggleLikePost(body.postId, body.actorNrp, body.reaction);
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: true, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'REPOST' && body.postId) {
      const updated = serverStore.toggleRepost(body.postId, body.actorNrp);
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: true, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'EDIT_POST' && body.postId) {
      const updated = serverStore.editPost(
        body.postId,
        body.actorNrp || '',
        body.actorRole || 'ANGGOTA',
        {
          content: body.content,
          imageUrl: body.imageUrl,
          category: body.category,
          pinned: body.pinned,
          tags: body.tags,
        }
      );
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: !!updated, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'DELETE_POST' && body.postId) {
      const deleted = serverStore.deletePost(
        body.postId,
        body.actorNrp || '',
        body.actorRole || 'ANGGOTA'
      );
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: deleted, posts: serverStore.getPosts() });
    }

    if (action === 'COMMENT' && body.postId) {
      const commentObj = body.comment || {
        id: body.commentId || `c-${Date.now()}`,
        authorName: body.authorName || 'Perwira Wira Satya 96',
        authorPangkat: body.authorPangkat || 'Kombes Pol',
        authorAvatar: body.authorAvatar || '/default-avatar.png',
        authorNrp: body.authorNrp || '',
        content: (body.content || '').trim(),
        imageUrl: body.imageUrl || undefined,
        createdAt: body.createdAt || 'Baru saja',
        likesCount: 0,
        likedBy: [],
        replies: [],
      };
      const updated = serverStore.addCommentToPost(body.postId, commentObj, body.parentCommentId);
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: true, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'EDIT_COMMENT' && body.postId && body.commentId) {
      const updated = serverStore.editCommentOnPost(
        body.postId,
        body.commentId,
        body.actorNrp || '',
        body.actorRole || 'ANGGOTA',
        body.content || '',
        body.parentCommentId
      );
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: !!updated, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'DELETE_COMMENT' && body.postId && body.commentId) {
      const updated = serverStore.deleteCommentOnPost(
        body.postId,
        body.commentId,
        body.actorNrp || '',
        body.actorRole || 'ANGGOTA',
        body.parentCommentId
      );
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: !!updated, post: updated, posts: serverStore.getPosts() });
    }

    if (action === 'LIKE_COMMENT' && body.postId && body.commentId) {
      const updated = serverStore.toggleLikeComment(
        body.postId,
        body.commentId,
        body.actorNrp || '',
        body.parentCommentId
      );
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:posts:');
      return NextResponse.json({ success: !!updated, post: updated, posts: serverStore.getPosts() });
    }

    // Default: CREATE post (allow text, photo, or both)
    if (!body.content?.trim() && !body.imageUrl) {
      return NextResponse.json({ success: false, message: 'Konten atau foto postingan wajib diisi' }, { status: 400 });
    }

    const created = serverStore.addPost({
      id: body.id,
      authorName: body.authorName || 'Perwira Wira Satya 96',
      authorPangkat: body.authorPangkat || 'Kombes Pol',
      authorJabatan: body.authorJabatan || 'Alumni Akpol 1996',
      authorSatker: body.authorSatker || 'Mabes Polri',
      authorPolda: body.authorPolda || 'MABES POLRI',
      authorAvatar: body.authorAvatar || '/default-avatar.png',
      authorNrp: body.authorNrp || '',
      badgeLabel: body.badgeLabel,
      category: body.category || 'MOTIVASI',
      content: (body.content || '').trim(),
      imageUrl: body.imageUrl,
      tags: body.tags,
    });

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:posts:');
    return NextResponse.json({
      success: true,
      post: created,
      posts: serverStore.getPosts(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Gagal memproses postingan beranda', error: String(error) },
      { status: 500 }
    );
  }
}
