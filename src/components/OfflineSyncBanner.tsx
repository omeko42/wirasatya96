'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  CheckCircle2,
  Clock,
  Trash2,
  Zap,
  CloudUpload,
  X,
} from 'lucide-react';
import {
  getOutboxQueue,
  isEffectivelyOnline,
  isSimulatedOfflineActive,
  setSimulatedOfflineActive,
  flushOfflineOutboxQueue,
  clearOfflineOutboxQueue,
  installOfflineSyncInterceptor,
  getLastSyncedAt,
  OfflineOutboxItem,
} from '@/lib/offlineSyncEngine';

interface CacheTelemetryState {
  hits: number;
  misses: number;
  keysCount: number;
  driver: string;
  lastStatus: 'HIT' | 'MISS' | 'OFFLINE_SNAPSHOT';
  lastLayer: string;
}

export const OfflineSyncBanner: React.FC<{
  onSyncCompleted?: () => void;
  isModalOpenExternal?: boolean;
  onCloseModalExternal?: () => void;
}> = ({ onSyncCompleted, isModalOpenExternal = false, onCloseModalExternal }) => {
  const [online, setOnline] = useState<boolean>(true);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [outbox, setOutbox] = useState<OfflineOutboxItem[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isInternalModalOpen, setIsInternalModalOpen] = useState<boolean>(false);
  const [cacheTelemetry, setCacheTelemetry] = useState<CacheTelemetryState>({
    hits: 0,
    misses: 0,
    keysCount: 0,
    driver: 'L1_IN_MEMORY_REDIS_ENGINE',
    lastStatus: 'HIT',
    lastLayer: 'L1_MEMORY',
  });
  const [localDbKb, setLocalDbKb] = useState<number>(0);
  const [isCleaningJunk, setIsCleaningJunk] = useState<boolean>(false);

  const isModalOpen = isModalOpenExternal || isInternalModalOpen;
  const closeModal = () => {
    setIsInternalModalOpen(false);
    onCloseModalExternal?.();
  };

  const refreshState = useCallback(() => {
    setOnline(isEffectivelyOnline());
    setSimulatedOffline(isSimulatedOfflineActive());
    setOutbox(getOutboxQueue());
    setLastSyncedAt(getLastSyncedAt());
  }, []);

  const fetchCacheStats = useCallback(() => {
    if (!isEffectivelyOnline()) return;
    fetch('/api/cache')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.stats) {
          setCacheTelemetry((prev) => ({
            ...prev,
            hits: data.stats.hits ?? prev.hits,
            misses: data.stats.misses ?? prev.misses,
            keysCount: data.stats.keysCount ?? prev.keysCount,
            driver: data.stats.driver || prev.driver,
          }));
        }
        if (data?.storage?.localDbKb !== undefined) {
          setLocalDbKb(data.storage.localDbKb);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    installOfflineSyncInterceptor();
    refreshState();
    fetchCacheStats();

    const handleStateChange = () => refreshState();
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncComplete = (e: Event) => {
      setIsSyncing(false);
      refreshState();
      fetchCacheStats();
      const detail = (e as CustomEvent)?.detail;
      if (detail?.syncedCount > 0) {
        setSyncToast(`${detail.syncedCount} perubahan offline berhasil disinkronkan ke server.`);
        setTimeout(() => setSyncToast(null), 5000);
        onSyncCompleted?.();
      }
    };
    const handleCacheTelemetry = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        setCacheTelemetry((prev) => ({
          ...prev,
          lastStatus: detail.status || prev.lastStatus,
          lastLayer: detail.layer || prev.lastLayer,
          hits: detail.status === 'HIT' ? prev.hits + 1 : prev.hits,
          misses: detail.status === 'MISS' ? prev.misses + 1 : prev.misses,
        }));
      }
    };

    window.addEventListener('ws96_offline_state_changed', handleStateChange);
    window.addEventListener('ws96_offline_sync_started', handleSyncStart);
    window.addEventListener('ws96_offline_sync_completed', handleSyncComplete);
    window.addEventListener('ws96_cache_telemetry', handleCacheTelemetry);

    return () => {
      window.removeEventListener('ws96_offline_state_changed', handleStateChange);
      window.removeEventListener('ws96_offline_sync_started', handleSyncStart);
      window.removeEventListener('ws96_offline_sync_completed', handleSyncComplete);
      window.removeEventListener('ws96_cache_telemetry', handleCacheTelemetry);
    };
  }, [refreshState, fetchCacheStats, onSyncCompleted]);

  useEffect(() => {
    if (isModalOpen) {
      fetchCacheStats();
      refreshState();
    }
  }, [isModalOpen, fetchCacheStats, refreshState]);

  const handleManualSync = async () => {
    if (simulatedOffline) {
      setSimulatedOfflineActive(false);
    }
    setIsSyncing(true);
    await flushOfflineOutboxQueue();
    setIsSyncing(false);
    refreshState();
    fetchCacheStats();
  };

  const handleFlushRedisCache = async () => {
    try {
      const res = await fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'ws96:' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncToast(data.message || 'Cache Redis berhasil di-reset.');
        setTimeout(() => setSyncToast(null), 4000);
        fetchCacheStats();
      }
    } catch {
      // Ignore
    }
  };

  const handleCleanupJunkAndCompact = async () => {
    setIsCleaningJunk(true);
    try {
      if (typeof window !== 'undefined') {
        const keepKeys = new Set([
          'ws96_current_user',
          'ws96_session_meta',
          'ws96_offline_outbox_queue',
        ]);
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('ws96_') && !keepKeys.has(k)) {
            localStorage.removeItem(k);
          }
        }
      }
      const res = await fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEANUP_JUNK' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncToast(data.message || 'Data sampah dibersihkan & JSON dikompresi.');
        setTimeout(() => setSyncToast(null), 5000);
        fetchCacheStats();
      }
    } catch {
      // Ignore
    } finally {
      setIsCleaningJunk(false);
    }
  };

  return (
    <>
      {/* Top Alert Banner when Offline or Outbox Pending or Sync Toast */}
      {(!online || outbox.length > 0 || syncToast) && (
        <div
          className={`w-full px-3 sm:px-6 py-2 text-xs font-medium transition-colors border-b ${
            !online
              ? 'bg-amber-950 text-amber-100 border-amber-800/70'
              : outbox.length > 0
              ? 'bg-blue-950 text-blue-100 border-blue-800/70'
              : 'bg-emerald-950 text-emerald-100 border-emerald-800/70'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!online ? (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              ) : isSyncing ? (
                <RefreshCw className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}

              <span>
                {!online ? (
                  <>
                    <strong className="font-bold text-amber-300">Mode Offline Tersinkronisasi Aktif:</strong>{' '}
                    Anda tetap dapat mengedit data, kas, dan profil.{' '}
                    {outbox.length > 0
                      ? `${outbox.length} perubahan dalam antrean lokal & otomatis disinkronkan saat online.`
                      : 'Seluruh perubahan akan masuk antrean lokal otomatis.'}
                  </>
                ) : outbox.length > 0 ? (
                  <>
                    <strong className="font-bold text-blue-300">Antrean Sinkronisasi Offline:</strong>{' '}
                    {outbox.length} perubahan menunggu sinkronisasi ke server.
                  </>
                ) : (
                  <span>{syncToast}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {outbox.length > 0 && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow-sm"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  {simulatedOffline ? 'Online-kan & Sinkronkan' : 'Sinkronkan Sekarang'} ({outbox.length})
                </button>
              )}
              {simulatedOffline && outbox.length === 0 && (
                <button
                  type="button"
                  onClick={() => setSimulatedOfflineActive(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/50 font-semibold text-[11px] transition"
                >
                  <Wifi className="w-3 h-3" /> Kembali Online
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsInternalModalOpen(true)}
                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition"
              >
                Detail Sinkronisasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Telemetry Redis Cache & Mode Offline Tersinkronisasi */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700/90 p-5 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Redis Cache & Sinkronisasi Offline</p>
                  <p className="text-[11px] text-slate-400">Multi-Tier Caching • Offline-First Outbox Queue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Redis Cache Stats */}
            <div className="bg-slate-800/70 rounded-xl p-3.5 border border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Redis Caching Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-700">
                  {cacheTelemetry.lastStatus} • {cacheTelemetry.lastLayer}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <p className="text-[10px] text-slate-400">Cache Hits</p>
                  <p className="text-base font-extrabold text-emerald-400">{cacheTelemetry.hits}</p>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <p className="text-[10px] text-slate-400">Cache Miss</p>
                  <p className="text-base font-extrabold text-amber-300">{cacheTelemetry.misses}</p>
                </div>
                <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                  <p className="text-[10px] text-slate-400">Active Keys</p>
                  <p className="text-base font-extrabold text-blue-300">{cacheTelemetry.keysCount}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400 truncate">
                  JSON DB: <strong className="text-emerald-300">{localDbKb > 0 ? `${localDbKb} KB` : 'Ringkas'}</strong> • Media: <strong className="text-amber-300">3–14 KB WebP</strong>
                </span>
                <button
                  type="button"
                  onClick={handleFlushRedisCache}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Flush Redis Cache
                </button>
              </div>
              <button
                type="button"
                onClick={handleCleanupJunkAndCompact}
                disabled={isCleaningJunk}
                className="w-full mt-1 py-1.5 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isCleaningJunk ? 'animate-spin' : ''}`} />
                {isCleaningJunk
                  ? 'Mengompresi JSON & Membersihkan Sampah...'
                  : 'Bersihkan Data Sampah & Kompres JSON (KB)'}
              </button>
            </div>

            {/* Offline Mode & Outbox Queue */}
            <div className="bg-slate-800/70 rounded-xl p-3.5 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    {online ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    Mode Offline Tersinkronisasi
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Antrean Outbox Lokal: <strong className="text-white">{outbox.length} perubahan</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSimulatedOfflineActive(!simulatedOffline)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition border ${
                    simulatedOffline
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {simulatedOffline ? 'Matikan Simulasi Offline' : 'Simulasi Mode Offline'}
                </button>
              </div>

              {outbox.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border-t border-slate-700/60 pt-2">
                  {outbox.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-2 rounded-lg text-[11px]"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-amber-200 truncate">{item.label}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString('id-ID')} • {item.method} {item.endpoint}
                        </p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] shrink-0">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/60 rounded-lg p-2.5 text-[11px] text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seluruh data lokal dan server telah tersinkronisasi 100%.</span>
                </div>
              )}

              {lastSyncedAt && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Sinkronisasi terakhir: {new Date(lastSyncedAt).toLocaleTimeString('id-ID')}
                </p>
              )}

              {outbox.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sinkronkan Sekarang ({outbox.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearOfflineOutboxQueue();
                      refreshState();
                    }}
                    className="p-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60"
                    title="Hapus antrean offline"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
