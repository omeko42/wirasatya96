import { NextRequest, NextResponse } from 'next/server';
import { serverStore } from '@/lib/serverStore';
import { withRedisCache, cacheInvalidatePrefix } from '@/lib/redisCache';
import { stripRankFromName } from '@/lib/avatarUtils';
import { AuthUser, StatusKedinasan, UserAuditAction, UserAuditLog, UserRole } from '@/types';

export async function GET() {
  const { data: users, cacheMeta } = await withRedisCache<AuthUser[]>(
    'ws96:users:all',
    90,
    async () => {
      await serverStore.ensureSynced();
      return serverStore.getUsers();
    }
  );

  return NextResponse.json(
    {
      success: true,
      count: users.length,
      data: users,
      users,
      deletedNrps: serverStore.getDeletedNrps(),
      auditLogs: serverStore.getAuditLogs(),
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
    const body: Partial<AuthUser> & {
      action?: string;
      snapshotUser?: AuthUser;
      satker?: string;
      polda?: string;
      password?: string;
      noHp?: string;
      secondaryEmail?: string;
      statusKedinasan?: StatusKedinasan;
      isAdcAccount?: boolean;
      adcOfNrp?: string;
      adcOfNama?: string;
      adcOfPangkat?: string;
      actorRole?: string;
      actorNrp?: string;
      actorName?: string;
      actorNama?: string;
    } = await req.json();

    const callerRole = (req.headers.get('x-ws96-role') || body.actorRole || 'SUPERADMIN') as UserRole;
    if (callerRole && callerRole !== 'SUPERADMIN' && callerRole !== 'SEKRETARIAT' && callerRole !== 'KETUA') {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses Ditolak: Hanya Superadmin, Ketua Angkatan, dan Sekretaris yang dapat mengelola pengguna.',
        },
        { status: 403 }
      );
    }

    if (body.action === 'RESTORE_USER' && (body.snapshotUser || body.nrp)) {
      const targetRestoreNrp = (body.nrp || body.snapshotUser?.nrp || '').trim();
      const restored = serverStore.restoreDeletedUser(targetRestoreNrp, body.snapshotUser, {
        actorNrp: body.actorNrp,
        actorName: body.actorName || body.actorNama,
        actorRole: callerRole,
      });
      if (!restored.success) {
        return NextResponse.json(restored, { status: 400 });
      }
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:users:');
      await cacheInvalidatePrefix('ws96:members:');
      await cacheInvalidatePrefix('ws96:finance:');
      return NextResponse.json({
        ...restored,
        auditLogs: serverStore.getAuditLogs(),
      });
    }

    if (!body.nrp || !body.nama) {
      return NextResponse.json({ success: false, message: 'NRP dan Nama wajib diisi' }, { status: 400 });
    }

    const cleanNrp = body.nrp.trim();
    const cleanNama = stripRankFromName(body.nama.trim()) || body.nama.trim();
    const isAdc = Boolean(body.isAdcAccount);
    const defaultPassword = (body.password && body.password.trim()) || `WS96@${cleanNrp}`;

    const newUser: AuthUser & {
      satker?: string;
      polda?: string;
      password?: string;
      noHp?: string;
      secondaryEmail?: string;
    } = {
      id: isAdc ? `u-adc-${cleanNrp}` : `u-${cleanNrp}`,
      nrp: cleanNrp,
      nama: cleanNama,
      pangkat: body.pangkat || (isAdc ? 'Briptu' : 'Kombes Pol'),
      email: body.email?.trim() || `${cleanNrp}@polri.go.id`,
      secondaryEmail: body.secondaryEmail ? body.secondaryEmail.trim() : undefined,
      role: (body.role as UserRole) || 'ANGGOTA',
      profileId: isAdc && body.adcOfNrp ? `ws-${body.adcOfNrp.trim()}` : `ws-${cleanNrp}`,
      mfaEnabled: body.mfaEnabled ?? false,
      mfaMethod: body.mfaMethod || 'PIN',
      satker: body.satker || 'Mabes Polri',
      polda: body.polda || 'MABES POLRI',
      jabatanTerakhir: body.jabatanTerakhir || (isAdc ? 'ADC' : undefined),
      statusKedinasan: body.statusKedinasan || 'AKTIF',
      tanggalLahir: body.tanggalLahir,
      tempatLahir: body.tempatLahir,
      password: defaultPassword,
      status: 'AKTIF',
      noHp: body.noHp || '',
      ...(isAdc
        ? {
            isAdcAccount: true,
            adcOfNrp: body.adcOfNrp?.trim(),
            adcOfNama: body.adcOfNama?.trim(),
            adcOfPangkat: body.adcOfPangkat?.trim(),
          }
        : {}),
    };

    const created = serverStore.addUser(newUser);
    serverStore.recordAuditLog({
      action: 'TAMBAH_USER',
      actorNrp: body.actorNrp || '98010710',
      actorName: body.actorName || body.actorNama || 'Admin / Sekretaris',
      actorNama: body.actorNama || body.actorName || 'Admin / Sekretaris',
      actorRole: callerRole,
      targetNrp: created.nrp,
      targetNama: created.nama,
      targetName: created.nama,
      targetPangkat: created.pangkat,
      targetRole: created.isAdcAccount ? 'ADC' : created.role,
      details: created.isAdcAccount
        ? `Menambahkan akun ADC pendamping untuk ${created.adcOfPangkat || ''} ${created.adcOfNama || created.adcOfNrp || ''} (Password: ${defaultPassword})`.trim()
        : `Menambahkan pengguna baru pada satker ${created.satker || 'Mabes Polri'} (${created.polda || 'MABES POLRI'}) dengan password standar ${defaultPassword}`,
    });

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:users:');
    await cacheInvalidatePrefix('ws96:members:');
    return NextResponse.json({
      success: true,
      message: `Pengguna ${created.nama} (NRP ${created.nrp}) berhasil ditambahkan.`,
      data: created,
      auditLogs: serverStore.getAuditLogs(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Gagal membuat akun pengguna', error }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await serverStore.ensureSynced();
    const body = await req.json();

    // 1. Handle RECORD_AUDIT_LOG (e.g. ADC login / ADC activity / custom audit event)
    if (body.action === 'RECORD_AUDIT_LOG') {
      const rawEntry = (body.auditEntry || body.entry || body) as Partial<UserAuditLog> & {
        auditAction?: UserAuditAction;
      };
      const resolvedAction: UserAuditAction =
        (rawEntry.auditAction ||
          (rawEntry.action && rawEntry.action !== ('RECORD_AUDIT_LOG' as string)
            ? (rawEntry.action as UserAuditAction)
            : 'AKTIVITAS_ADC')) as UserAuditAction;
      const targetNrp = String(rawEntry.targetNrp || body.nrp || rawEntry.actorNrp || '').trim() || '-';
      const auditLog = serverStore.recordAuditLog({
        ...rawEntry,
        action: resolvedAction,
        actorName: rawEntry.actorName || rawEntry.actorNama || body.actorName || body.actorNama || 'Sistem WS96',
        actorNama: rawEntry.actorNama || rawEntry.actorName || body.actorNama || body.actorName || 'Sistem WS96',
        actorNrp: rawEntry.actorNrp || body.actorNrp,
        actorRole: rawEntry.actorRole || body.actorRole || 'ADC',
        targetNrp,
        targetNama:
          rawEntry.targetNama ||
          rawEntry.targetName ||
          body.targetNama ||
          body.targetName ||
          `Personel ${targetNrp}`,
        targetName:
          rawEntry.targetName ||
          rawEntry.targetNama ||
          body.targetName ||
          body.targetNama ||
          `Personel ${targetNrp}`,
        targetPangkat: rawEntry.targetPangkat || body.targetPangkat,
        targetRole: rawEntry.targetRole || body.targetRole,
        reason: rawEntry.reason || body.reason,
        details: rawEntry.details || body.details,
      });

      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:users:');
      return NextResponse.json({
        success: true,
        auditLog,
        auditLogs: serverStore.getAuditLogs(),
      });
    }

    // 2. Handle RESET_PASSWORD (by Admin / Sekretaris / Ketua)
    if (body.action === 'RESET_PASSWORD') {
      const targetNrp = String(body.nrp || body.targetNrp || '').trim();
      if (!targetNrp) {
        return NextResponse.json({ success: false, message: 'NRP wajib disertakan untuk reset password' }, { status: 400 });
      }
      const newPassword = (body.newPassword && String(body.newPassword).trim()) || `WS96@${targetNrp}`;
      serverStore.setPassword(targetNrp, newPassword);
      const updated = serverStore.updateUser(targetNrp, {
        password: newPassword,
        status: 'AKTIF',
      });

      const auditLog = serverStore.recordAuditLog({
        action: 'RESET_PASSWORD',
        actorNrp: body.actorNrp || '98010710',
        actorName: body.actorName || body.actorNama || 'Superadmin / Pengurus',
        actorNama: body.actorNama || body.actorName || 'Superadmin / Pengurus',
        actorRole: (body.actorRole as UserRole) || 'SUPERADMIN',
        targetNrp: updated?.nrp || targetNrp,
        targetNama: updated?.nama || body.targetNama || body.targetName || `Personel ${targetNrp}`,
        targetName: updated?.nama || body.targetName || body.targetNama || `Personel ${targetNrp}`,
        targetPangkat: updated?.pangkat || body.targetPangkat || 'Kombes Pol',
        targetRole: updated?.isAdcAccount ? 'ADC' : updated?.role || body.targetRole || 'ANGGOTA',
        reason: body.reason || 'Reset password oleh Pengurus',
        details:
          body.details ||
          `Kata sandi akun ${updated?.nama || targetNrp} (NRP ${targetNrp}) direset menjadi ${newPassword} dan status diaktifkan.`,
      });

      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:users:');
      return NextResponse.json({
        success: true,
        message: `Kata sandi ${updated?.nama || targetNrp} berhasil direset menjadi ${newPassword}.`,
        newPassword,
        data: updated,
        auditLog,
        auditLogs: serverStore.getAuditLogs(),
      });
    }

    // 3. Handle REQUEST_PASSWORD_RESET (from Login forgot-password flow)
    if (body.action === 'REQUEST_PASSWORD_RESET') {
      const targetNrp = String(body.nrp || body.targetNrp || body.identifier || '').trim();
      if (!targetNrp) {
        return NextResponse.json({ success: false, message: 'NRP wajib disertakan' }, { status: 400 });
      }
      const matchedUser = serverStore
        .getUsers()
        .find((u) => u.nrp === targetNrp || u.oldNrp === targetNrp || u.email.toLowerCase() === targetNrp.toLowerCase());
      const matchedReg = serverStore
        .getRegistrations()
        .find((r) => r.nrp === (matchedUser?.nrp || targetNrp));
      if (matchedReg) {
        matchedReg.isPasswordResetRequest = true;
      }

      const resolvedNrp = matchedUser?.nrp || targetNrp;
      const resolvedNama =
        matchedUser?.nama || body.targetNama || body.targetName || body.nama || `Personel ${resolvedNrp}`;
      const resolvedPangkat = matchedUser?.pangkat || body.targetPangkat || body.pangkat || 'Kombes Pol';

      const auditLog = serverStore.recordAuditLog({
        action: 'PERMINTAAN_RESET_PASSWORD',
        actorNrp: body.actorNrp || resolvedNrp,
        actorName: body.actorName || body.actorNama || resolvedNama,
        actorNama: body.actorNama || body.actorName || resolvedNama,
        actorRole: (body.actorRole as UserRole) || (matchedUser?.isAdcAccount ? 'ADC' : matchedUser?.role || 'ANGGOTA'),
        targetNrp: resolvedNrp,
        targetNama: resolvedNama,
        targetName: resolvedNama,
        targetPangkat: resolvedPangkat,
        targetRole: matchedUser?.isAdcAccount ? 'ADC' : matchedUser?.role || 'ANGGOTA',
        reason: body.reason || 'Permintaan bantuan reset kata sandi dari halaman Login',
        details:
          body.details ||
          `Personel ${resolvedPangkat} ${resolvedNama} (NRP ${resolvedNrp}) mengajukan permintaan reset kata sandi ke kredensial standar WS96@${resolvedNrp}.`,
      });

      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:users:');
      return NextResponse.json({
        success: true,
        message: 'Permintaan reset kata sandi berhasil dikirim ke Superadmin & Sekretaris.',
        auditLog,
        auditLogs: serverStore.getAuditLogs(),
      });
    }

    const {
      nrp,
      actorRole,
      actorNrp,
      actorName,
      actorNama,
      isBackgroundSync,
      action: _ignoredAction,
      ...updates
    } = body;
    if (!nrp) {
      return NextResponse.json({ success: false, message: 'NRP wajib disertakan' }, { status: 400 });
    }

    if (updates.nama && typeof updates.nama === 'string') {
      updates.nama = stripRankFromName(updates.nama.trim()) || updates.nama.trim();
    }

    const targetNrpForEmail = String(updates.newNrp || nrp).trim();
    if (updates.email !== undefined && typeof updates.email === 'string') {
      updates.email = updates.email.trim() || `${targetNrpForEmail}@polri.go.id`;
    }
    if (updates.secondaryEmail !== undefined && typeof updates.secondaryEmail === 'string') {
      updates.secondaryEmail = updates.secondaryEmail.trim();
    }

    const updated = serverStore.updateUser(nrp, updates);
    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            updates.newNrp && updates.newNrp !== nrp
              ? `Gagal mengubah NRP ke ${updates.newNrp}: NRP baru sudah digunakan atau pengguna tidak ditemukan.`
              : 'Pengguna tidak ditemukan atau telah dihapus',
        },
        { status: 400 }
      );
    }

    if (!isBackgroundSync) {
      const isRoleOnlyUpdate =
        updates.role !== undefined &&
        updates.nama === undefined &&
        updates.newNrp === undefined &&
        updates.jabatanTerakhir === undefined &&
        updates.statusKedinasan === undefined;

      serverStore.recordAuditLog({
        action: isRoleOnlyUpdate ? 'UBAH_ROLE' : 'EDIT_USER',
        actorNrp: actorNrp || '98010710',
        actorName: actorName || actorNama || 'Admin / Sekretaris',
        actorNama: actorNama || actorName || 'Admin / Sekretaris',
        actorRole: (actorRole as UserRole) || 'SUPERADMIN',
        targetNrp: updated.nrp,
        targetNama: updated.nama,
        targetName: updated.nama,
        targetPangkat: updated.pangkat,
        targetRole: updated.isAdcAccount ? 'ADC' : updated.role,
        details: isRoleOnlyUpdate
          ? `Mengubah role akses menjadi ${updated.role}`
          : `Memperbarui data pengguna (${updated.pangkat} • ${updated.jabatanTerakhir || updated.satker || 'Mabes Polri'}${
              updated.statusKedinasan && updated.statusKedinasan !== 'AKTIF' ? ` • Status: ${updated.statusKedinasan}` : ''
            }${updates.newNrp && updates.newNrp !== nrp ? ` • NRP ${nrp} → ${updates.newNrp}` : ''})`,
      });
    }

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:users:');
    await cacheInvalidatePrefix('ws96:members:');
    await cacheInvalidatePrefix('ws96:finance:');
    await cacheInvalidatePrefix('ws96:posts:');

    return NextResponse.json({
      success: true,
      message: `Data pengguna ${updated.nama} (NRP ${updated.nrp}) berhasil diperbarui.`,
      data: updated,
      auditLogs: serverStore.getAuditLogs(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Gagal memperbarui pengguna', error }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await serverStore.ensureSynced();
    const { searchParams } = new URL(req.url);
    let nrp = searchParams.get('nrp');
    let actorNrp = searchParams.get('actorNrp') || undefined;
    let actorName = searchParams.get('actorName') || undefined;
    let actorRole = (searchParams.get('actorRole') as UserRole) || undefined;
    let reason = searchParams.get('reason') || undefined;

    try {
      const body = await req.json();
      if (body) {
        if (!nrp && body.nrp) nrp = body.nrp;
        if (body.actorNrp) actorNrp = body.actorNrp;
        if (body.actorName || body.actorNama) actorName = body.actorName || body.actorNama;
        if (body.actorRole) actorRole = body.actorRole;
        if (body.reason) reason = body.reason;
      }
    } catch {
      // Optional JSON body
    }

    if (!nrp) {
      return NextResponse.json({ success: false, message: 'NRP wajib disertakan' }, { status: 400 });
    }

    const result = serverStore.deleteUser(nrp, {
      actorNrp,
      actorName,
      actorRole,
      reason,
    });
    if (!result.success) {
      return NextResponse.json(result, { status: 403 });
    }

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:users:');
    await cacheInvalidatePrefix('ws96:members:');
    await cacheInvalidatePrefix('ws96:finance:');
    return NextResponse.json({
      ...result,
      auditLogs: serverStore.getAuditLogs(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Gagal menghapus pengguna', error }, { status: 500 });
  }
}
