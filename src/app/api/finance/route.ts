import { NextRequest, NextResponse } from 'next/server';
import { serverStore, getFinanceConfig, updateFinanceConfig, getFinanceSummary } from '@/lib/serverStore';
import { withRedisCache, cacheInvalidatePrefix } from '@/lib/redisCache';

export async function GET() {
  const { data: bundle, cacheMeta } = await withRedisCache(
    'ws96:finance:bundle',
    45,
    async () => {
      await serverStore.ensureSynced();
      const financeData = serverStore.getFinance();
      const financeConfig = getFinanceConfig();
      const summary = getFinanceSummary();
      return {
        financeData,
        financeConfig,
        summary,
      };
    }
  );

  const { financeData, financeConfig, summary } = bundle;
  return NextResponse.json(
    {
      success: true,
      data: {
        ...financeData,
        summary,
        iuran: financeData.iuranList,
        iuranList: financeData.iuranList,
        financeConfig,
      },
      summary,
      transactions: financeData.transactions,
      iuran: financeData.iuranList,
      iuranList: financeData.iuranList,
      assets: financeData.assets,
      financeConfig,
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
    const session = serverStore.getSession();
    const effectiveRole = body.actorRole || body.role || session?.role;

    // Penginputan data Kas, Iuran, Aset, & Konfigurasi hanya boleh dilakukan oleh BENDAHARA atau SUPERADMIN
    if (effectiveRole !== 'BENDAHARA' && effectiveRole !== 'SUPERADMIN') {
      return NextResponse.json(
        {
          success: false,
          message:
            'Akses Ditolak: Penginputan data Kas, Iuran, Aset, & Pengaturan Kebendaharaan hanya dapat dilakukan oleh Bendahara atau Superadmin.',
        },
        { status: 403 }
      );
    }

    const { action } = body;

    if (action === 'UPDATE_FINANCE_CONFIG') {
      const {
        iuranWajibPerBulan,
        tahunBuku,
        subKategoriMasuk,
        subKategoriKeluar,
        campaigns,
        investmentParticipants,
        linkedTransaction,
        updatedBy,
      } = body;
      const actorName = updatedBy || session?.nama || (effectiveRole === 'SUPERADMIN' ? 'Superadmin' : 'Bendahara');
      const updatedConfig = updateFinanceConfig(
        {
          ...(iuranWajibPerBulan !== undefined ? { iuranWajibPerBulan: Number(iuranWajibPerBulan) } : {}),
          ...(tahunBuku !== undefined ? { tahunBuku: Number(tahunBuku) } : {}),
          ...(Array.isArray(subKategoriMasuk) ? { subKategoriMasuk } : {}),
          ...(Array.isArray(subKategoriKeluar) ? { subKategoriKeluar } : {}),
          ...(Array.isArray(campaigns) ? { campaigns } : {}),
          ...(Array.isArray(investmentParticipants) ? { investmentParticipants } : {}),
        },
        actorName
      );

      if (linkedTransaction && linkedTransaction.jenis && linkedTransaction.nominal && linkedTransaction.keterangan) {
        serverStore.addTransaction({
          nomorReferensi: linkedTransaction.nomorReferensi || 'WS96-MLS-' + Date.now().toString().slice(-4),
          tanggal: linkedTransaction.tanggal || new Date().toISOString().split('T')[0],
          jenis: linkedTransaction.jenis,
          kategori: linkedTransaction.kategori || 'SUMBANGAN_SUKARELA',
          nominal: Number(linkedTransaction.nominal),
          keterangan: linkedTransaction.keterangan,
          pihakTerkait: linkedTransaction.pihakTerkait || '-',
          nrpTerkait: linkedTransaction.nrpTerkait || '',
          dicatatOleh: actorName,
        });
      }

      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:finance:');
      const financeData = serverStore.getFinance();
      const summary = getFinanceSummary();
      return NextResponse.json({
        success: true,
        message:
          'Data Program Sosial / Milestone, Dana Investasi & Pengaturan Kebendaharaan berhasil diperbarui oleh Bendahara / Superadmin',
        data: {
          summary,
          iuran: financeData.iuranList,
          iuranList: financeData.iuranList,
          transactions: financeData.transactions,
          financeConfig: updatedConfig,
        },
        summary,
        iuran: financeData.iuranList,
        iuranList: financeData.iuranList,
        transactions: financeData.transactions,
        financeConfig: updatedConfig,
      });
    }

    if (action === 'PAY_IURAN') {
      const { nrp, nominal, dicatatOleh } = body;
      const updated = serverStore.recordIuranPayment(
        nrp,
        Number(nominal),
        dicatatOleh || session?.nama || (effectiveRole === 'SUPERADMIN' ? 'Superadmin' : 'Bendahara')
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: 'Data iuran perwira tidak ditemukan' }, { status: 404 });
      }
      await serverStore.flushCloud();
      const financeData = serverStore.getFinance();
      const summary = getFinanceSummary();
      await cacheInvalidatePrefix('ws96:finance:');
      return NextResponse.json({
        success: true,
        message: 'Pembayaran iuran berhasil dicatat oleh Bendahara / Superadmin',
        data: updated,
        summary,
        iuran: financeData.iuranList,
        iuranList: financeData.iuranList,
        transactions: financeData.transactions,
        financeConfig: getFinanceConfig(),
      });
    }

    if (action === 'ADD_ASSET') {
      const {
        kodeAset,
        namaAset,
        kategori,
        satuan,
        jumlahUnit,
        nilaiPerolehanIdr,
        estimasiNilaiIdr,
        kustodianLokasi,
        nomorSeriAtauWallet,
        tanggalPerolehan,
        keterangan,
        dicatatOleh,
      } = body;

      if (!namaAset || !kategori || !estimasiNilaiIdr) {
        return NextResponse.json(
          { success: false, message: 'Nama aset, kategori, dan estimasi nilai IDR wajib diisi.' },
          { status: 400 }
        );
      }

      const newAsset = serverStore.addAsset({
        kodeAset: kodeAset || 'WS96-AST-' + Date.now().toString().slice(-4),
        namaAset,
        kategori,
        satuan: satuan || 'Unit',
        jumlahUnit: Number(jumlahUnit) || 1,
        nilaiPerolehanIdr: Number(nilaiPerolehanIdr) || Number(estimasiNilaiIdr),
        estimasiNilaiIdr: Number(estimasiNilaiIdr),
        kustodianLokasi: kustodianLokasi || 'Bendahara Paguyuban',
        nomorSeriAtauWallet: nomorSeriAtauWallet || '-',
        tanggalPerolehan: tanggalPerolehan || new Date().toISOString().split('T')[0],
        keterangan: keterangan || '',
        dicatatOleh: dicatatOleh || session?.nama || (effectiveRole === 'SUPERADMIN' ? 'Superadmin' : 'Bendahara'),
      });

      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:finance:');
      const summary = getFinanceSummary();
      return NextResponse.json({
        success: true,
        message: 'Aset portofolio berhasil dicatat oleh Bendahara / Superadmin',
        data: newAsset,
        summary,
      });
    }

    if (action === 'DELETE_ASSET') {
      const { id } = body;
      const deleted = serverStore.deleteAsset(id);
      if (!deleted) {
        return NextResponse.json({ success: false, message: 'Data aset tidak ditemukan' }, { status: 404 });
      }
      await serverStore.flushCloud();
      await cacheInvalidatePrefix('ws96:finance:');
      return NextResponse.json({
        success: true,
        message: 'Data aset berhasil dihapus oleh Bendahara / Superadmin',
        summary: getFinanceSummary(),
      });
    }

    // Default / ADD_TRANSACTION: Add cash transaction
    const {
      jenis,
      kategori,
      nominal,
      keterangan,
      pihakTerkait,
      nrpTerkait,
      nomorReferensi,
      tanggal,
      dicatatOleh,
      jumlahBulanIuran,
    } = body;
    if (!jenis || !nominal || !keterangan) {
      return NextResponse.json({ success: false, message: 'Jenis, nominal, dan keterangan wajib diisi' }, { status: 400 });
    }

    const actorName = dicatatOleh || session?.nama || (effectiveRole === 'SUPERADMIN' ? 'Superadmin' : 'Bendahara');
    const prevTrxCount = serverStore.getFinance().transactions.length;

    const newTrx = serverStore.addTransaction({
      nomorReferensi: nomorReferensi || 'WS96-KAS-' + Date.now().toString().slice(-4),
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      jenis,
      kategori: kategori || 'OPERASIONAL_PAGUYUBAN',
      nominal: Number(nominal),
      keterangan,
      pihakTerkait: pihakTerkait || '-',
      nrpTerkait: nrpTerkait || '',
      dicatatOleh: actorName,
    });

    const isNewlyInserted = serverStore.getFinance().transactions.length > prevTrxCount;

    // Synchronize member iuran if IURAN_WAJIB_BULANAN with nrpTerkait and jumlahBulanIuran > 0
    let updatedIuran = null;
    if (
      isNewlyInserted &&
      jenis === 'MASUK' &&
      kategori === 'IURAN_WAJIB_BULANAN' &&
      nrpTerkait &&
      Number(jumlahBulanIuran) > 0
    ) {
      updatedIuran = serverStore.recordIuranPayment(nrpTerkait, Number(nominal), actorName, true);
    }

    await serverStore.flushCloud();
    await cacheInvalidatePrefix('ws96:finance:');
    const financeData = serverStore.getFinance();
    const summary = getFinanceSummary();

    return NextResponse.json({
      success: true,
      message: 'Transaksi kas berhasil dicatat oleh Bendahara / Superadmin',
      data: newTrx,
      updatedIuran,
      summary,
      iuran: financeData.iuranList,
      iuranList: financeData.iuranList,
      transactions: financeData.transactions,
      financeConfig: getFinanceConfig(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Gagal memproses data kebendaharaan', error }, { status: 500 });
  }
}

