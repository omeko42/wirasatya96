// ============================================================================
// SUPABASE MULTI-TABLE CLOUD PERSISTENCE ENGINE - WIRA SATYA 96 (AKPOL 1996)
// Menyimpan data ke 9 tabel khusus terpisah di PostgreSQL Supabase dengan kolom
// terstruktur agar rapi di Table Editor & aman untuk Multiple Input bersamaan.
// ============================================================================

export const SUPABASE_PROJECT_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqudzlzvteofmtxqmvtz.supabase.co';

export const SUPABASE_API_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xdWR6bHp2dGVvZm10eHFtdnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMTAzMjMsImV4cCI6MjEwODU4NjMyM30.PpKBDoCegYqDynYD7cehjIzduAQiJ1zTHYX5e7uSYU0';

export interface SupabaseRecordRow<T = unknown> {
  collection: string;
  record_id: string;
  payload: T;
  updated_at?: string;
}

export interface TableMappingSpec {
  table: string;
  pkColumn: string;
  toDbRow: (recordId: string, payload: Record<string, unknown>, nowIso: string) => Record<string, unknown>;
  fromDbRow: (row: Record<string, unknown>) => SupabaseRecordRow;
}

/**
 * Strips empty strings (`""`), `null`, `undefined`, empty arrays (`[]`), and keys already stored
 * as top-level SQL columns so `payload` JSONB stays ultra-lightweight (a few hundred bytes).
 */
export function compactPayloadForDb(
  raw: Record<string, unknown>,
  excludedKeys: string[] = [],
  options?: { stripInlineImages?: boolean; stripSnapshotMedia?: boolean }
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const excludeSet = new Set(excludedKeys);
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (excludeSet.has(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;

    if (
      options?.stripInlineImages &&
      (k === 'fotoUrl' || k === 'coverUrl' || k === 'authorAvatar' || k === 'senderAvatar') &&
      typeof v === 'string' &&
      (v.startsWith('data:image/') || v.includes('ui-avatars.com'))
    ) {
      continue;
    }

    if (options?.stripSnapshotMedia && k === 'snapshotUser' && typeof v === 'object' && v !== null) {
      const snap = { ...(v as Record<string, unknown>) };
      delete snap.fotoUrl;
      delete snap.coverUrl;
      delete snap.bio;
      out[k] = snap;
      continue;
    }

    out[k] = v;
  }
  return out;
}

const TABLE_SPECS: Record<string, TableMappingSpec> = {
  members: {
    table: 'ws96_members',
    pkColumn: 'nrp',
    toDbRow: (recordId, p, nowIso) => ({
      nrp: String(p.nrp || recordId),
      nama_lengkap: String(p.namaLengkap || ''),
      pangkat: String(p.pangkat || ''),
      jabatan_terakhir: String(p.jabatanTerakhir || ''),
      satuan_kerja: String(p.satuanKerja || ''),
      polda: String(p.polda || ''),
      status_kedinasan: String(p.statusKedinasan || p.statusDinas || 'AKTIF'),
      no_hp: String(p.noHp || ''),
      email: String(p.email || ''),
      payload: compactPayloadForDb(p, [
        'nrp',
        'namaLengkap',
        'pangkat',
        'jabatanTerakhir',
        'satuanKerja',
        'polda',
        'statusKedinasan',
        'statusDinas',
        'noHp',
        'email',
      ]),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      const statusKedinasan = String(row.status_kedinasan || base.statusKedinasan || base.statusDinas || 'AKTIF');
      return {
        collection: 'members',
        record_id: String(row.nrp || base.nrp || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          riwayatDikbang: [],
          riwayatJabatan: [],
          prestasiPenghargaan: [],
          catatanTambahan: '',
          ...base,
          nrp: String(row.nrp || base.nrp || ''),
          namaLengkap: String(row.nama_lengkap || base.namaLengkap || ''),
          pangkat: String(row.pangkat || base.pangkat || ''),
          jabatanTerakhir: String(row.jabatan_terakhir || base.jabatanTerakhir || ''),
          satuanKerja: String(row.satuan_kerja || base.satuanKerja || ''),
          polda: String(row.polda || base.polda || ''),
          statusKedinasan,
          statusDinas: statusKedinasan,
          noHp: String(row.no_hp ?? base.noHp ?? ''),
          email: String(row.email ?? base.email ?? ''),
        },
      };
    },
  },
  users: {
    table: 'ws96_users',
    pkColumn: 'nrp',
    toDbRow: (recordId, p, nowIso) => ({
      nrp: String(p.nrp || recordId),
      nama: String(p.nama || ''),
      pangkat: String(p.pangkat || ''),
      role: String(p.role || 'ANGGOTA'),
      satker: String(p.satker || ''),
      polda: String(p.polda || ''),
      email: String(p.email || ''),
      password: String(p.password || ''),
      status: String(p.status || 'AKTIF'),
      is_adc: Boolean(p.isAdcAccount),
      payload: compactPayloadForDb(
        p,
        ['nrp', 'nama', 'pangkat', 'role', 'satker', 'polda', 'email', 'password', 'status', 'isAdcAccount'],
        { stripInlineImages: true }
      ),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'users',
        record_id: String(row.nrp || base.nrp || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          ...base,
          nrp: String(row.nrp || base.nrp || ''),
          nama: String(row.nama || base.nama || ''),
          pangkat: String(row.pangkat || base.pangkat || ''),
          role: String(row.role || base.role || 'ANGGOTA'),
          satker: String(row.satker || base.satker || ''),
          polda: String(row.polda || base.polda || ''),
          email: String(row.email || base.email || ''),
          password: String(row.password || base.password || ''),
          status: String(row.status || base.status || 'AKTIF'),
          isAdcAccount: Boolean(row.is_adc ?? base.isAdcAccount),
        },
      };
    },
  },
  iuran: {
    table: 'ws96_iuran',
    pkColumn: 'nrp',
    toDbRow: (recordId, p, nowIso) => ({
      nrp: String(p.nrp || recordId),
      nama_lengkap: String(p.namaLengkap || ''),
      pangkat: String(p.pangkat || ''),
      polda: String(p.polda || ''),
      tahun: Number(p.tahun || 2026),
      total_tagihan: Number(p.totalTagihan || 3000000),
      total_terbayar: Number(p.totalTerbayar || 0),
      status: String(p.status || 'BELUM_BAYAR'),
      payload: compactPayloadForDb(p, [
        'nrp',
        'namaLengkap',
        'pangkat',
        'polda',
        'tahun',
        'totalTagihan',
        'totalTerbayar',
        'status',
      ]),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      const nrpStr = String(row.nrp || base.nrp || '');
      return {
        collection: 'iuran',
        record_id: nrpStr,
        updated_at: String(row.updated_at || ''),
        payload: {
          id: base.id || `iur-${nrpStr}`,
          bulanTerbayar: [],
          ...base,
          nrp: nrpStr,
          namaLengkap: String(row.nama_lengkap || base.namaLengkap || ''),
          pangkat: String(row.pangkat || base.pangkat || ''),
          polda: String(row.polda || base.polda || ''),
          tahun: Number(row.tahun ?? base.tahun ?? 2026),
          totalTagihan: Number(row.total_tagihan ?? base.totalTagihan ?? 3000000),
          totalTerbayar: Number(row.total_terbayar ?? base.totalTerbayar ?? 0),
          status: String(row.status || base.status || 'BELUM_BAYAR'),
        },
      };
    },
  },
  transactions: {
    table: 'ws96_transactions',
    pkColumn: 'id',
    toDbRow: (recordId, p, nowIso) => ({
      id: String(p.id || recordId),
      nomor_referensi: String(p.nomorReferensi || ''),
      tanggal: String(p.tanggal || ''),
      jenis: String(p.jenis || 'MASUK'),
      kategori: String(p.kategori || ''),
      nominal: Number(p.nominal || 0),
      keterangan: String(p.keterangan || ''),
      pihak_terkait: String(p.pihakTerkait || ''),
      dicatat_oleh: String(p.dicatatOleh || ''),
      payload: compactPayloadForDb(p, [
        'id',
        'nomorReferensi',
        'tanggal',
        'jenis',
        'kategori',
        'nominal',
        'keterangan',
        'pihakTerkait',
        'dicatatOleh',
      ]),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'transactions',
        record_id: String(row.id || base.id || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          ...base,
          id: row.id || base.id,
          nomorReferensi: row.nomor_referensi || base.nomorReferensi,
          tanggal: row.tanggal || base.tanggal,
          jenis: row.jenis || base.jenis,
          kategori: row.kategori || base.kategori,
          nominal: Number(row.nominal ?? base.nominal ?? 0),
          keterangan: row.keterangan || base.keterangan,
          pihakTerkait: row.pihak_terkait || base.pihakTerkait,
          dicatatOleh: row.dicatat_oleh || base.dicatatOleh,
        },
      };
    },
  },
  posts: {
    table: 'ws96_posts',
    pkColumn: 'id',
    toDbRow: (recordId, p, nowIso) => ({
      id: String(p.id || recordId),
      author_nrp: String(p.authorNrp || ''),
      author_name: String(p.authorName || ''),
      author_pangkat: String(p.authorPangkat || ''),
      category: String(p.category || 'MOTIVASI'),
      content: String(p.content || ''),
      likes_count: Number(p.likesCount || 0),
      comments_count: Number(p.commentsCount || 0),
      created_at: String(p.createdAt || ''),
      payload: compactPayloadForDb(
        p,
        [
          'id',
          'authorNrp',
          'authorName',
          'authorPangkat',
          'category',
          'content',
          'likesCount',
          'commentsCount',
          'createdAt',
        ],
        { stripInlineImages: true }
      ),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'posts',
        record_id: String(row.id || base.id || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          likedByNrps: [],
          reactionsByNrp: {},
          repostedByNrps: [],
          comments: [],
          tags: [],
          ...base,
          id: row.id || base.id,
          authorNrp: row.author_nrp || base.authorNrp,
          authorName: row.author_name || base.authorName,
          authorPangkat: row.author_pangkat || base.authorPangkat,
          category: row.category || base.category,
          content: row.content ?? base.content,
          likesCount: Number(row.likes_count ?? base.likesCount ?? 0),
          commentsCount: Number(row.comments_count ?? base.commentsCount ?? 0),
          createdAt: row.created_at || base.createdAt,
        },
      };
    },
  },
  messages: {
    table: 'ws96_messages',
    pkColumn: 'id',
    toDbRow: (recordId, p, nowIso) => ({
      id: String(p.id || recordId),
      sender_nrp: String(p.senderNrp || ''),
      sender_name: String(p.senderName || ''),
      receiver_nrp: String(p.receiverNrp || ''),
      receiver_name: String(p.receiverName || ''),
      text: String(p.text || ''),
      timestamp: String(p.timestamp || ''),
      is_read: Boolean(p.isRead),
      payload: compactPayloadForDb(
        p,
        [
          'id',
          'senderNrp',
          'senderName',
          'receiverNrp',
          'receiverName',
          'text',
          'timestamp',
          'isRead',
        ],
        { stripInlineImages: true }
      ),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'messages',
        record_id: String(row.id || base.id || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          ...base,
          id: row.id || base.id,
          senderNrp: row.sender_nrp || base.senderNrp,
          senderName: row.sender_name || base.senderName,
          receiverNrp: row.receiver_nrp || base.receiverNrp,
          receiverName: row.receiver_name || base.receiverName,
          text: row.text ?? base.text,
          timestamp: row.timestamp || base.timestamp,
          isRead: Boolean(row.is_read ?? base.isRead),
        },
      };
    },
  },
  assets: {
    table: 'ws96_assets',
    pkColumn: 'id',
    toDbRow: (recordId, p, nowIso) => ({
      id: String(p.id || recordId),
      kode_aset: String(p.kodeAset || ''),
      nama_aset: String(p.namaAset || ''),
      kategori: String(p.kategori || ''),
      jumlah_unit: Number(p.jumlahUnit || 1),
      estimasi_nilai_idr: Number(p.estimasiNilaiIdr || 0),
      kustodian_lokasi: String(p.kustodianLokasi || ''),
      payload: compactPayloadForDb(p, [
        'id',
        'kodeAset',
        'namaAset',
        'kategori',
        'jumlahUnit',
        'estimasiNilaiIdr',
        'kustodianLokasi',
      ]),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'assets',
        record_id: String(row.id || base.id || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          ...base,
          id: row.id || base.id,
          kodeAset: row.kode_aset || base.kodeAset,
          namaAset: row.nama_aset || base.namaAset,
          kategori: row.kategori || base.kategori,
          jumlahUnit: Number(row.jumlah_unit ?? base.jumlahUnit ?? 1),
          estimasiNilaiIdr: Number(row.estimasi_nilai_idr ?? base.estimasiNilaiIdr ?? 0),
          kustodianLokasi: row.kustodian_lokasi || base.kustodianLokasi,
        },
      };
    },
  },
  audit_logs: {
    table: 'ws96_audit_logs',
    pkColumn: 'id',
    toDbRow: (recordId, p, nowIso) => ({
      id: String(p.id || recordId),
      action: String(p.action || ''),
      actor_nrp: String(p.actorNrp || ''),
      actor_name: String(p.actorName || p.actorNama || ''),
      actor_role: String(p.actorRole || ''),
      target_nrp: String(p.targetNrp || ''),
      target_nama: String(p.targetNama || p.targetName || ''),
      details: String(p.details || ''),
      timestamp: String(p.timestamp || ''),
      payload: compactPayloadForDb(
        p,
        [
          'id',
          'action',
          'actorNrp',
          'actorName',
          'actorNama',
          'actorRole',
          'targetNrp',
          'targetNama',
          'targetName',
          'details',
          'timestamp',
        ],
        { stripSnapshotMedia: true }
      ),
      updated_at: nowIso,
    }),
    fromDbRow: (row) => {
      const base = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
      return {
        collection: 'audit_logs',
        record_id: String(row.id || base.id || ''),
        updated_at: String(row.updated_at || ''),
        payload: {
          ...base,
          id: row.id || base.id,
          action: row.action || base.action,
          actorNrp: row.actor_nrp || base.actorNrp,
          actorName: row.actor_name || base.actorName || base.actorNama,
          actorNama: row.actor_name || base.actorNama || base.actorName,
          actorRole: row.actor_role || base.actorRole,
          targetNrp: row.target_nrp || base.targetNrp,
          targetNama: row.target_nama || base.targetNama || base.targetName,
          targetName: row.target_nama || base.targetName || base.targetNama,
          details: row.details || base.details,
          timestamp: row.timestamp || base.timestamp,
        },
      };
    },
  },
  meta: {
    table: 'ws96_config',
    pkColumn: 'config_key',
    toDbRow: (recordId, p, nowIso) => ({
      config_key: recordId,
      description:
        recordId === 'financeSummary'
          ? 'Ringkasan Saldo Kas & Pemasukan/Pengeluaran'
          : recordId === 'financeConfig'
            ? 'Pengaturan Tarif Iuran Wajib & Kategori Cashflow'
            : recordId === 'deletedNrps'
              ? 'Daftar NRP yang Dihapus / Non-1996'
              : recordId === 'registrations'
                ? 'Data Antrean Verifikasi & Registrasi Akun'
                : 'Konfigurasi Sistem WS96',
      payload: p,
      updated_at: nowIso,
    }),
    fromDbRow: (row) => ({
      collection: 'meta',
      record_id: String(row.config_key || ''),
      updated_at: String(row.updated_at || ''),
      payload: row.payload,
    }),
  },
};

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SUPABASE_API_KEY,
    Authorization: `Bearer ${SUPABASE_API_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchAllRowsFromTable(
  tableName: string,
  sinceIso?: string
): Promise<Record<string, unknown>[] | null> {
  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let offset = 0;
  const deltaFilter = sinceIso ? `&updated_at=gt.${encodeURIComponent(sinceIso)}` : '';

  while (true) {
    const url = `${SUPABASE_PROJECT_URL}/rest/v1/${tableName}?select=*${deltaFilter}&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const batch = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(batch)) break;
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

/**
 * Mengecek status tabel-tabel terpisah di Supabase (`ws96_members`, `ws96_users`, dll.)
 */
export async function checkSupabaseTableStatus(): Promise<{
  connected: boolean;
  tableReady: boolean;
  mode?: 'multi-table' | 'single-table';
  rowCount?: number;
  tables?: Record<string, number>;
  error?: string;
}> {
  try {
    const tableCounts: Record<string, number> = {};
    let totalMultiRows = 0;
    let multiReady = true;

    for (const spec of Object.values(TABLE_SPECS)) {
      const url = `${SUPABASE_PROJECT_URL}/rest/v1/${spec.table}?select=${spec.pkColumn}&limit=1`;
      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders({ Prefer: 'count=exact' }),
        cache: 'no-store',
      });
      if (!res.ok) {
        multiReady = false;
        break;
      }
      const range = res.headers.get('content-range') || '';
      const totalPart = range.split('/')[1];
      const count = totalPart && totalPart !== '*' ? Number(totalPart) : 0;
      tableCounts[spec.table] = count;
      totalMultiRows += count;
    }

    if (multiReady) {
      return {
        connected: true,
        tableReady: true,
        mode: 'multi-table',
        rowCount: totalMultiRows,
        tables: tableCounts,
      };
    }

    // Fallback check for legacy single table ws96_records
    const legacyUrl = `${SUPABASE_PROJECT_URL}/rest/v1/ws96_records?select=record_id&limit=1`;
    const legacyRes = await fetch(legacyUrl, {
      method: 'GET',
      headers: getHeaders({ Prefer: 'count=exact' }),
      cache: 'no-store',
    });
    if (legacyRes.ok) {
      const range = legacyRes.headers.get('content-range') || '';
      const totalPart = range.split('/')[1];
      const rowCount = totalPart && totalPart !== '*' ? Number(totalPart) : 0;
      return {
        connected: true,
        tableReady: true,
        mode: 'single-table',
        rowCount,
      };
    }

    const body = await legacyRes.text();
    return {
      connected: true,
      tableReady: false,
      error: body,
    };
  } catch (err) {
    return {
      connected: false,
      tableReady: false,
      error: String(err),
    };
  }
}

/**
 * Mengambil seluruh baris (atau delta baris yang berubah sejak `sinceIso`) dari 9 tabel terpisah di Supabase.
 */
export async function fetchAllSupabaseRecords(
  sinceIso?: string
): Promise<SupabaseRecordRow[] | null> {
  try {
    const entries = Object.entries(TABLE_SPECS);
    const results = await Promise.all(
      entries.map(async ([, spec]) => {
        const rows = await fetchAllRowsFromTable(spec.table, sinceIso);
        return { spec, rows };
      })
    );

    const allMultiTablesExist = results.every((r) => r.rows !== null);
    if (allMultiTablesExist) {
      const combined: SupabaseRecordRow[] = [];
      for (const { spec, rows } of results) {
        for (const r of rows || []) {
          combined.push(spec.fromDbRow(r));
        }
      }
      return combined;
    }

    // Fallback ke ws96_records jika 9 tabel belum dibuat
    const legacyRows = await fetchAllRowsFromTable('ws96_records', sinceIso);
    if (legacyRows !== null) {
      return legacyRows as unknown as SupabaseRecordRow[];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Upsert banyak baris sekaligus ke masing-masing tabel terpisah di Supabase.
 */
export async function upsertSupabaseBatch(rows: SupabaseRecordRow[]): Promise<boolean> {
  if (!rows.length) return true;
  try {
    const nowIso = new Date().toISOString();
    const byCollection = new Map<string, SupabaseRecordRow[]>();
    for (const r of rows) {
      const list = byCollection.get(r.collection) || [];
      list.push(r);
      byCollection.set(r.collection, list);
    }

    for (const [collection, collRows] of Array.from(byCollection.entries())) {
      const spec = TABLE_SPECS[collection];
      if (!spec) continue;

      const formattedRows = collRows.map((r) =>
        spec.toDbRow(r.record_id, (r.payload ?? {}) as Record<string, unknown>, r.updated_at || nowIso)
      );

      const chunkSize = 200;
      for (let i = 0; i < formattedRows.length; i += chunkSize) {
        const chunk = formattedRows.slice(i, i + chunkSize);
        const url = `${SUPABASE_PROJECT_URL}/rest/v1/${spec.table}?on_conflict=${encodeURIComponent(spec.pkColumn)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: getHeaders({
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(chunk),
          cache: 'no-store',
        });

        if (!res.ok) {
          // Fallback ke ws96_records jika tabel terpisah belum di-run
          const legacyUrl = `${SUPABASE_PROJECT_URL}/rest/v1/ws96_records?on_conflict=collection,record_id`;
          const legacyChunk = collRows.slice(i, i + chunkSize).map((r) => ({
            collection: r.collection,
            record_id: r.record_id,
            payload: r.payload,
            updated_at: r.updated_at || nowIso,
          }));
          const legacyRes = await fetch(legacyUrl, {
            method: 'POST',
            headers: getHeaders({
              Prefer: 'resolution=merge-duplicates,return=minimal',
            }),
            body: JSON.stringify(legacyChunk),
            cache: 'no-store',
          });
          if (!legacyRes.ok) return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Upsert 1 baris spesifik ke tabel terkait di Supabase.
 */
export async function upsertSupabaseRecord<T>(
  collection: string,
  recordId: string,
  payload: T
): Promise<boolean> {
  return upsertSupabaseBatch([
    {
      collection,
      record_id: String(recordId),
      payload,
    },
  ]);
}

/**
 * Menghapus 1 baris spesifik dari tabel terkait di Supabase.
 */
export async function deleteSupabaseRecord(
  collection: string,
  recordId: string
): Promise<boolean> {
  try {
    const spec = TABLE_SPECS[collection];
    if (spec) {
      const url = `${SUPABASE_PROJECT_URL}/rest/v1/${spec.table}?${spec.pkColumn}=eq.${encodeURIComponent(recordId)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders({ Prefer: 'return=minimal' }),
        cache: 'no-store',
      });
      if (res.ok) return true;
    }

    const legacyUrl = `${SUPABASE_PROJECT_URL}/rest/v1/ws96_records?collection=eq.${encodeURIComponent(
      collection
    )}&record_id=eq.${encodeURIComponent(recordId)}`;
    const legacyRes = await fetch(legacyUrl, {
      method: 'DELETE',
      headers: getHeaders({ Prefer: 'return=minimal' }),
      cache: 'no-store',
    });
    return legacyRes.ok;
  } catch {
    return false;
  }
}
