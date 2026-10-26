/**
 * Wira Satya 96 — Media Security, Leakage Tracking & Storage Optimization Engine
 *
 * Features:
 * 1. Encrypted / Salted Hash File Naming (`WS-<hash_enkripsi>-<date>.<ext>`) for both
 *    uploads and downloads to enable forensic data-leakage tracking per NRP & timestamp.
 * 2. Smart Auto-Crop (trims unused uniform/empty borders + center aspect-ratio crop)
 *    and WebP/JPEG downscaling to minimize database / MinIO object storage footprint.
 */

export type MediaAssetKind = 'AVATAR' | 'COVER' | 'POST' | 'DOCUMENT' | 'EXPORT';

export interface ProcessedSecureMedia {
  dataUrl: string;
  fileName: string;
  encryptedFileName: string;
  trackingCode: string;
  hashEnkripsi: string;
  dateStamp: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

export interface MediaAuditEntry {
  trackingCode: string;
  fileName: string;
  hashEnkripsi: string;
  actorNrp: string;
  action: 'UPLOAD' | 'DOWNLOAD';
  kind: MediaAssetKind;
  timestamp: string;
  sizeBytes?: number;
}

const WS96_MEDIA_SALT = 'WS96_BARESKRIM_SECURE_LEAK_TRACKER_2026';
const AUDIT_STORAGE_KEY = 'ws96_media_leakage_audit_v1';

/**
 * Formats current date/time as YYYYMMDD-HHmmss for `WS-hash_enkripsi-date` filenames.
 */
export function formatMediaDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

/**
 * Computes a deterministic salted 16-hex-character encrypted tracking hash (`hash_enkripsi`)
 * binding actor NRP, timestamp, and payload fingerprint (FNV-1a 64-bit / Dual-32 mix + XOR cipher).
 */
export function computeEncryptedTrackingHash(
  actorNrp: string = 'ANON',
  dateStamp: string = formatMediaDateStamp(),
  payloadSample: string = ''
): string {
  const cleanNrp = (actorNrp || 'ANON').replace(/\D/g, '') || '00000000';
  const rawInput = `${WS96_MEDIA_SALT}|NRP:${cleanNrp}|TS:${dateStamp}|SAMPLE:${payloadSample.slice(0, 128)}`;

  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < rawInput.length; i++) {
    const ch = rawInput.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x1000193b);
  }

  // Embed obfuscated NRP checksum in last 4 hex chars for instant forensic verification
  let nrpXor = 0x5a96;
  for (let i = 0; i < cleanNrp.length; i++) {
    nrpXor = ((nrpXor << 3) ^ cleanNrp.charCodeAt(i) ^ (i * 17)) & 0xffff;
  }

  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = ((h2 >>> 0) & 0xffff).toString(16).padStart(4, '0');
  const part3 = (nrpXor >>> 0).toString(16).padStart(4, '0');
  return `${part1}${part2}${part3}`.toLowerCase();
}

/**
 * Generates an official leakage-tracked filename with format:
 * `WS-<hash_enkripsi>-<date>.<ext>` (or without extension if ext is omitted).
 */
export function generateLeakageTrackedFileName(
  actorNrpOrOpts:
    | string
    | {
        actorNrp?: string;
        ownerNrp?: string;
        preset?: string;
        extension?: string;
        extraEntropy?: string;
      } = 'ANON',
  ext: string = 'webp',
  kind: MediaAssetKind = 'AVATAR',
  action: 'UPLOAD' | 'DOWNLOAD' = 'UPLOAD',
  payloadSample: string = '',
  sizeBytes?: number
): { fileName: string; trackingCode: string; hashEnkripsi: string; dateStamp: string } & string {
  const actorNrp =
    typeof actorNrpOrOpts === 'string'
      ? actorNrpOrOpts
      : actorNrpOrOpts.actorNrp || actorNrpOrOpts.ownerNrp || 'ANON';
  const effectiveExt =
    typeof actorNrpOrOpts === 'string' ? ext : actorNrpOrOpts.extension || ext;
  const effectiveSample =
    typeof actorNrpOrOpts === 'string'
      ? payloadSample
      : actorNrpOrOpts.extraEntropy || payloadSample;

  const dateStamp = formatMediaDateStamp();
  const hashEnkripsi = computeEncryptedTrackingHash(actorNrp, dateStamp, effectiveSample);
  const trackingCode = `WS-${hashEnkripsi}-${dateStamp}`;
  const cleanExt = effectiveExt.replace(/^\./, '').toLowerCase();
  const fileName = cleanExt ? `${trackingCode}.${cleanExt}` : trackingCode;

  recordMediaAuditEntry({
    trackingCode,
    fileName,
    hashEnkripsi,
    actorNrp: actorNrp || 'ANON',
    action,
    kind,
    timestamp: new Date().toISOString(),
    sizeBytes,
  });

  const result = Object.assign(new String(fileName), {
    fileName,
    trackingCode,
    hashEnkripsi,
    dateStamp,
  });
  return result as unknown as {
    fileName: string;
    trackingCode: string;
    hashEnkripsi: string;
    dateStamp: string;
  } & string;
}

/**
 * Records upload/download tracking metadata in localStorage for leakage auditing.
 */
export function recordMediaAuditEntry(entry: MediaAuditEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const list: MediaAuditEntry[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...list].slice(0, 200);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Detects uniform/blank borders (white, transparent, or solid black bars) around an image
 * and returns the cropped content bounding box so wasted margins are stripped before encoding.
 */
function detectActiveContentBox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { sx: number; sy: number; sw: number; sh: number } {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Sample corner pixel as reference background
    const refR = data[0];
    const refG = data[1];
    const refB = data[2];
    const refA = data[3];

    const isBorderPixel = (idx: number): boolean => {
      const a = data[idx + 3];
      if (a < 16) return true; // transparent
      if (refA < 16) return false;
      const dr = Math.abs(data[idx] - refR);
      const dg = Math.abs(data[idx + 1] - refG);
      const db = Math.abs(data[idx + 2] - refB);
      return dr < 10 && dg < 10 && db < 10;
    };

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    const stepX = Math.max(1, Math.floor(width / 120));
    const stepY = Math.max(1, Math.floor(height / 120));

    // Scan top
    topLoop: for (let y = 0; y < height * 0.25; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        if (!isBorderPixel((y * width + x) * 4)) {
          top = Math.max(0, y - stepY);
          break topLoop;
        }
      }
    }

    // Scan bottom
    bottomLoop: for (let y = height - 1; y > height * 0.75; y -= stepY) {
      for (let x = 0; x < width; x += stepX) {
        if (!isBorderPixel((y * width + x) * 4)) {
          bottom = Math.min(height - 1, y + stepY);
          break bottomLoop;
        }
      }
    }

    // Scan left
    leftLoop: for (let x = 0; x < width * 0.25; x += stepX) {
      for (let y = top; y <= bottom; y += stepY) {
        if (!isBorderPixel((y * width + x) * 4)) {
          left = Math.max(0, x - stepX);
          break leftLoop;
        }
      }
    }

    // Scan right
    rightLoop: for (let x = width - 1; x > width * 0.75; x -= stepX) {
      for (let y = top; y <= bottom; y += stepY) {
        if (!isBorderPixel((y * width + x) * 4)) {
          right = Math.min(width - 1, x + stepX);
          break rightLoop;
        }
      }
    }

    const sw = right - left + 1;
    const sh = bottom - top + 1;
    if (sw >= width * 0.5 && sh >= height * 0.5) {
      return { sx: left, sy: top, sw, sh };
    }
  } catch {
    // Fallback if canvas is tainted
  }
  return { sx: 0, sy: 0, sw: width, sh: height };
}

/**
 * Renders a compact (< 4 KB WebP) visual badge card when a non-image document/file
 * (e.g. PDF, DOCX, XLSX, ZIP) is uploaded so raw multi-MB binaries never bloat JSON storage.
 */
function renderCompactDocumentBadge(
  fileNameRaw: string,
  fileSizeBytes: number,
  actorNrp: string,
  kind: MediaAssetKind
): ProcessedSecureMedia {
  const outW = 360;
  const outH = 120;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, outW, outH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, outW - 8, outH - 8);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('DOKUMEN TERKOMPRESI WS96', 18, 34);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    const safeName = (fileNameRaw || 'lampiran.dat').slice(0, 34);
    ctx.fillText(safeName, 18, 62);

    const kbOrig = Math.max(1, Math.round(fileSizeBytes / 1024));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`Ukuran Asli: ${kbOrig} KB -> Kompresi JSON < 4 KB`, 18, 88);
  }

  let encodedDataUrl = canvas.toDataURL('image/webp', 0.58);
  let ext = 'webp';
  if (!encodedDataUrl.startsWith('data:image/webp')) {
    encodedDataUrl = canvas.toDataURL('image/jpeg', 0.58);
    ext = 'jpg';
  }
  const compressedBytes = Math.round((encodedDataUrl.length * 3) / 4);
  const { fileName, trackingCode, hashEnkripsi, dateStamp } =
    generateLeakageTrackedFileName(
      actorNrp,
      ext,
      kind,
      'UPLOAD',
      encodedDataUrl.slice(-96),
      compressedBytes
    );
  const trackedDataUrl = encodedDataUrl.replace(
    /^data:(image\/[a-z]+);base64,/,
    `data:$1;name=${fileName};base64,`
  );

  return {
    dataUrl: trackedDataUrl,
    fileName,
    encryptedFileName: fileName,
    trackingCode,
    hashEnkripsi,
    dateStamp,
    originalBytes: fileSizeBytes,
    compressedBytes,
    width: outW,
    height: outH,
  };
}

/**
 * Compresses, auto-crops unused borders/margins, and tags an uploaded image/file
 * with the `WS-<hash_enkripsi>-<date>` leakage-tracking identifier.
 *
 * Ultra-light KB storage budgets (anti-bloat for JSON & Supabase Egress):
 * - AVATAR: 128x128 square crop, iterative WebP compression <= 6 KB (~3–6 KB)
 * - COVER:  480x160 banner crop (3:1), iterative WebP compression <= 12 KB (~6–12 KB)
 * - POST / DOCUMENT: max 480x360 auto-fit crop, iterative WebP compression <= 14 KB (~6–14 KB)
 */
export function processSecureImageUpload(
  file: File,
  kindOrOpts:
    | MediaAssetKind
    | {
        preset?: string;
        actorNrp?: string;
        ownerNrp?: string;
      } = 'AVATAR',
  actorNrpParam: string = 'ANON'
): Promise<ProcessedSecureMedia> {
  const kind: MediaAssetKind =
    typeof kindOrOpts === 'string'
      ? kindOrOpts
      : (kindOrOpts.preset as MediaAssetKind) || 'AVATAR';
  const actorNrp: string =
    typeof kindOrOpts === 'string'
      ? actorNrpParam
      : kindOrOpts.actorNrp || kindOrOpts.ownerNrp || actorNrpParam || 'ANON';

  return new Promise((resolve, reject) => {
    if (file.type && !file.type.startsWith('image/')) {
      resolve(renderCompactDocumentBadge(file.name, file.size || 1024, actorNrp, kind));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('File gambar kosong'));
        return;
      }

      const img = new window.Image();
      img.onerror = () => {
        resolve(renderCompactDocumentBadge(file.name, file.size || rawDataUrl.length, actorNrp, kind));
      };
      img.onload = () => {
        // 1. Draw to staging canvas to trim unused uniform borders
        const stageW = Math.min(img.width, 960);
        const stageScale = stageW / img.width;
        const stageH = Math.max(1, Math.round(img.height * stageScale));

        const stageCanvas = document.createElement('canvas');
        stageCanvas.width = stageW;
        stageCanvas.height = stageH;
        const stageCtx = stageCanvas.getContext('2d');
        if (!stageCtx) {
          reject(new Error('Canvas context tidak tersedia'));
          return;
        }
        stageCtx.drawImage(img, 0, 0, stageW, stageH);

        const activeBox = detectActiveContentBox(stageCtx, stageW, stageH);

        // 2. Determine target dimensions, strict KB budget & smart center-crop based on asset kind
        let sx = activeBox.sx;
        let sy = activeBox.sy;
        let sw = activeBox.sw;
        let sh = activeBox.sh;
        let outW = sw;
        let outH = sh;
        let quality = 0.62;
        let maxBudgetBytes = 14 * 1024; // 14 KB default max

        if (kind === 'AVATAR') {
          // Strict 1:1 square center crop, 128x128 px (<= 6 KB target)
          const minSide = Math.min(sw, sh);
          sx = sx + (sw - minSide) / 2;
          sy = sy + (sh - minSide) / 2;
          sw = minSide;
          sh = minSide;
          outW = 128;
          outH = 128;
          quality = 0.62;
          maxBudgetBytes = 6 * 1024;
        } else if (kind === 'COVER') {
          // Sleek 3:1 cover banner aspect ratio, max 480x160 px (<= 12 KB target)
          const targetRatio = 3.0;
          const currentRatio = sw / sh;
          if (currentRatio > targetRatio) {
            const newSw = sh * targetRatio;
            sx = sx + (sw - newSw) / 2;
            sw = newSw;
          } else {
            const newSh = sw / targetRatio;
            sy = sy + (sh - newSh) / 2;
            sh = newSh;
          }
          outW = Math.min(480, Math.round(sw));
          outH = Math.max(1, Math.round(outW / targetRatio));
          quality = 0.58;
          maxBudgetBytes = 12 * 1024;
        } else {
          // POST / DOCUMENT: max 480x360 preserving cropped content aspect ratio (<= 14 KB target)
          const maxW = 480;
          const maxH = 360;
          const scale = Math.min(1, maxW / sw, maxH / sh);
          outW = Math.max(1, Math.round(sw * scale));
          outH = Math.max(1, Math.round(sh * scale));
          quality = 0.60;
          maxBudgetBytes = 14 * 1024;
        }

        const encodeAttempt = (w: number, h: number, q: number) => {
          const outCanvas = document.createElement('canvas');
          outCanvas.width = w;
          outCanvas.height = h;
          const outCtx = outCanvas.getContext('2d');
          if (!outCtx) return null;
          outCtx.imageSmoothingEnabled = true;
          outCtx.imageSmoothingQuality = 'high';
          outCtx.drawImage(stageCanvas, sx, sy, sw, sh, 0, 0, w, h);

          let dataUrl = outCanvas.toDataURL('image/webp', q);
          let ext = 'webp';
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = outCanvas.toDataURL('image/jpeg', q);
            ext = 'jpg';
          }
          const bytes = Math.round((dataUrl.length * 3) / 4);
          return { dataUrl, ext, bytes, w, h };
        };

        let attempt = encodeAttempt(outW, outH, quality);
        if (!attempt) {
          reject(new Error('Output canvas gagal diinisialisasi'));
          return;
        }

        // 3. Iterative compression step-down loop until strictly within few-KB budget
        const stepSchedules = [
          { scale: 1.0, q: quality - 0.12 },
          { scale: 0.85, q: Math.max(0.32, quality - 0.18) },
          { scale: 0.72, q: 0.34 },
          { scale: 0.60, q: 0.28 },
        ];
        for (const step of stepSchedules) {
          if (attempt.bytes <= maxBudgetBytes) break;
          const nextW = Math.max(64, Math.round(outW * step.scale));
          const nextH = Math.max(48, Math.round(outH * step.scale));
          const nextTry = encodeAttempt(nextW, nextH, step.q);
          if (nextTry && nextTry.bytes < attempt.bytes) {
            attempt = nextTry;
          }
        }

        const encodedDataUrl = attempt.dataUrl;
        const ext = attempt.ext;
        const compressedBytes = attempt.bytes;
        const { fileName, trackingCode, hashEnkripsi, dateStamp } =
          generateLeakageTrackedFileName(
            actorNrp,
            ext,
            kind,
            'UPLOAD',
            encodedDataUrl.slice(-96),
            compressedBytes
          );

        // Inject tracking filename parameter into the data URL header so any inspection reveals `WS-<hash>-<date>`
        const trackedDataUrl = encodedDataUrl.replace(
          /^data:(image\/[a-z]+);base64,/,
          `data:$1;name=${fileName};base64,`
        );

        resolve({
          dataUrl: trackedDataUrl,
          fileName,
          encryptedFileName: fileName,
          trackingCode,
          hashEnkripsi,
          dateStamp,
          originalBytes: file.size || Math.round((rawDataUrl.length * 3) / 4),
          compressedBytes,
          width: attempt.w,
          height: attempt.h,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Re-compresses an existing base64 `data:image/...` string down to a few KB (3–12 KB WebP).
 * Useful for automatically shrinking legacy oversized avatars/covers/post images in localStorage or DB.
 */
export function compressDataUrlToFewKb(
  rawDataUrl: string,
  kind: MediaAssetKind = 'AVATAR',
  actorNrp: string = 'SYSTEM'
): Promise<string> {
  if (typeof window === 'undefined' || !rawDataUrl || !rawDataUrl.startsWith('data:image/')) {
    return Promise.resolve(rawDataUrl);
  }
  const thresholdChars = kind === 'AVATAR' ? 9500 : 17000;
  if (rawDataUrl.length <= thresholdChars) {
    return Promise.resolve(rawDataUrl);
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onerror = () => resolve(rawDataUrl);
    img.onload = () => {
      const targetW = kind === 'AVATAR' ? 112 : kind === 'COVER' ? 420 : 420;
      const targetH =
        kind === 'AVATAR'
          ? 112
          : kind === 'COVER'
            ? 140
            : Math.max(60, Math.round((img.height / Math.max(1, img.width)) * 420));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (kind === 'AVATAR') {
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }
      let out = canvas.toDataURL('image/webp', 0.52);
      let ext = 'webp';
      if (!out.startsWith('data:image/webp')) {
        out = canvas.toDataURL('image/jpeg', 0.52);
        ext = 'jpg';
      }
      if (out.length >= rawDataUrl.length) {
        resolve(rawDataUrl);
        return;
      }
      const compressedBytes = Math.round((out.length * 3) / 4);
      const { fileName } = generateLeakageTrackedFileName(
        actorNrp,
        ext,
        kind,
        'UPLOAD',
        out.slice(-96),
        compressedBytes
      );
      resolve(out.replace(/^data:(image\/[a-z]+);base64,/, `data:$1;name=${fileName};base64,`));
    };
    img.src = rawDataUrl;
  });
}

/**
 * Triggers a browser file download with automatic `WS-<hash_enkripsi>-<date>.<ext>` naming
 * so exported CSVs, reports, or downloaded media can be traced if leaked.
 */
export function triggerTrackedDownload(
  paramsOrContent:
    | {
        content: Blob | string;
        ext: string;
        actorNrp?: string;
        kind?: MediaAssetKind;
        mimeType?: string;
      }
    | Blob
    | string,
  extraOpts?: {
    actorNrp?: string;
    ownerNrp?: string;
    preset?: string;
    extension?: string;
    mimeType?: string;
  }
): { fileName: string; trackingCode: string } & string {
  const isParamsObj =
    typeof paramsOrContent === 'object' &&
    paramsOrContent !== null &&
    !(paramsOrContent instanceof Blob) &&
    'content' in paramsOrContent;

  const content: Blob | string = isParamsObj ? paramsOrContent.content : paramsOrContent;
  const ext: string = isParamsObj
    ? paramsOrContent.ext
    : extraOpts?.extension || 'jpg';
  const actorNrp: string = isParamsObj
    ? paramsOrContent.actorNrp || 'ANON'
    : extraOpts?.actorNrp || extraOpts?.ownerNrp || 'ANON';
  const kind: MediaAssetKind = isParamsObj
    ? paramsOrContent.kind || 'EXPORT'
    : (extraOpts?.preset as MediaAssetKind) || 'EXPORT';
  const mimeType: string = isParamsObj
    ? paramsOrContent.mimeType || 'text/csv;charset=utf-8;'
    : extraOpts?.mimeType || 'text/csv;charset=utf-8;';

  const sample = typeof content === 'string' ? content.slice(0, 128) : `blob-${content.size}`;
  const sizeBytes = typeof content === 'string' ? content.length : content.size;

  const { fileName, trackingCode } = generateLeakageTrackedFileName(
    actorNrp,
    ext,
    kind,
    'DOWNLOAD',
    sample,
    sizeBytes
  );

  if (typeof window !== 'undefined') {
    let url = '';
    let shouldRevoke = false;
    if (
      typeof content === 'string' &&
      (content.startsWith('data:') || content.startsWith('/') || content.startsWith('http'))
    ) {
      url = content;
    } else if (typeof content === 'string') {
      const blob = new Blob([content], { type: mimeType });
      url = URL.createObjectURL(blob);
      shouldRevoke = true;
    } else {
      url = URL.createObjectURL(content);
      shouldRevoke = true;
    }

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }

  return Object.assign(new String(fileName), {
    fileName,
    trackingCode,
  }) as unknown as { fileName: string; trackingCode: string } & string;
}

