import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

export async function searchCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query;

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { nama: { contains: q as string } },
              { nis: { contains: q as string } },
              { noHape: { contains: q as string } },
            ],
          }
        : undefined,
      orderBy: { nama: 'asc' },
      take: 20,
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getCustomerByNis(req: Request, res: Response): Promise<void> {
  try {
    const { nis } = req.params;

    const customer = await prisma.customer.findUnique({ where: { nis } });

    if (!customer) {
      res.status(404).json({
        error: `Santri dengan NIS ${nis} belum terdaftar`,
        code: 'CUSTOMER_NOT_FOUND',
      });
      return;
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { nis, nama, kamar, kelas, noHape, tipe, saldo, aktif } = req.body;

    if (!nis || !nis.trim()) {
      res.status(400).json({ error: 'NIS wajib diisi' });
      return;
    }
    if (!nama || !nama.trim()) {
      res.status(400).json({ error: 'Nama santri wajib diisi' });
      return;
    }
    if (!kamar || !kamar.trim()) {
      res.status(400).json({ error: 'Kamar wajib diisi' });
      return;
    }
    if (!kelas || !kelas.trim()) {
      res.status(400).json({ error: 'Kelas wajib diisi' });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { nis: nis.trim() } });
    if (existing) {
      res.status(409).json({
        error: `NIS ${nis} sudah terdaftar atas nama ${existing.nama}`,
        code: 'NIS_ALREADY_EXISTS',
      });
      return;
    }

    const isAktif = aktif === false || aktif === 'false' ? false : true;
    const noHapeTrimmed = noHape && noHape.trim() ? noHape.trim() : null;
    const tipeVal = tipe === 'DEPOSIT' ? 'DEPOSIT' : 'BERLANGGANAN';
    const saldoVal = tipeVal === 'DEPOSIT' ? (parseFloat(saldo) || 0) : 0;
    const customer = await prisma.customer.create({
      data: { nis: nis.trim(), nama: nama.trim(), kamar: kamar.trim(), kelas: kelas.trim(), noHape: noHapeTrimmed, tipe: tipeVal, saldo: saldoVal, aktif: isAktif },
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getCustomerFilters(_req: Request, res: Response): Promise<void> {
  try {
    const [kamarList, kelasList] = await Promise.all([
      prisma.customer.findMany({
        select: { kamar: true },
        distinct: ['kamar'],
        orderBy: { kamar: 'asc' },
      }),
      prisma.customer.findMany({
        select: { kelas: true },
        distinct: ['kelas'],
        orderBy: { kelas: 'asc' },
      }),
    ]);
    res.json({
      kamar: kamarList.map((r) => r.kamar),
      kelas: kelasList.map((r) => r.kelas),
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getCustomerTemplate(_req: Request, res: Response): Promise<void> {
  const header = 'nis,nama,kamar,kelas,noHape,tipe,saldo,aktif\n';
  const example = '2023001,Ahmad Fahri,A-12,X IPA 1,08123456789,BERLANGGANAN,0,true\n2023002,Siti Aminah,B-05,XI IPS 2,,DEPOSIT,50000,true\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template_data_santri.csv"');
  res.send(header + example);
}

export async function getCustomerTemplateXlsx(_req: Request, res: Response): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['nis', 'nama', 'kamar', 'kelas', 'noHape', 'tipe', 'saldo', 'aktif'],
    ['2023001', 'Ahmad Fahri', 'A-12', 'X IPA 1', '08123456789', 'BERLANGGANAN', '0', 'true'],
    ['2023002', 'Siti Aminah', 'B-05', 'XI IPS 2', '', 'DEPOSIT', '50000', 'true'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Data Santri');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', 'attachment; filename="template_data_santri.xls"');
  res.send(buf);
}

// multer: memory storage, max 5 MB
const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      file.mimetype === 'text/csv' ||
      name.endsWith('.csv') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      XLSX_MIMES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE'));
    }
  },
}).single('file');

export async function updateCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nis, nama, kamar, kelas, noHape, tipe, aktif } = req.body;

    if (!nis || !nis.trim()) { res.status(400).json({ error: 'NIS wajib diisi' }); return; }
    if (!nama || !nama.trim()) { res.status(400).json({ error: 'Nama santri wajib diisi' }); return; }
    if (!kamar || !kamar.trim()) { res.status(400).json({ error: 'Kamar wajib diisi' }); return; }
    if (!kelas || !kelas.trim()) { res.status(400).json({ error: 'Kelas wajib diisi' }); return; }

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Santri tidak ditemukan' }); return; }

    // Check NIS conflict (if NIS changed)
    if (nis.trim() !== existing.nis) {
      const conflict = await prisma.customer.findUnique({ where: { nis: nis.trim() } });
      if (conflict) {
        res.status(409).json({ error: `NIS ${nis} sudah terdaftar atas nama ${conflict.nama}`, code: 'NIS_ALREADY_EXISTS' });
        return;
      }
    }

    const isAktif = aktif === false || aktif === 'false' ? false : true;
    const noHapeTrimmed = noHape && noHape.trim() ? noHape.trim() : null;
    const tipeVal = tipe === 'DEPOSIT' ? 'DEPOSIT' : 'BERLANGGANAN';
    // Reset saldo to 0 if switching from DEPOSIT to BERLANGGANAN
    const saldoUpdate = tipeVal === 'BERLANGGANAN' && existing.tipe === 'DEPOSIT' ? { saldo: 0 } : {};
    const customer = await prisma.customer.update({
      where: { id },
      data: { nis: nis.trim(), nama: nama.trim(), kamar: kamar.trim(), kelas: kelas.trim(), noHape: noHapeTrimmed, tipe: tipeVal, aktif: isAktif, ...saldoUpdate },
    });

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function toggleCustomerAktif(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Santri tidak ditemukan' }); return; }

    const customer = await prisma.customer.update({
      where: { id },
      data: { aktif: !existing.aktif },
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function topupSaldo(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { jumlah } = req.body;

    const amount = parseFloat(jumlah);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Jumlah top-up harus lebih dari 0' });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Santri tidak ditemukan' }); return; }
    if (existing.tipe !== 'DEPOSIT') {
      res.status(400).json({ error: 'Hanya santri tipe Deposit yang dapat diisi saldo' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { saldo: existing.saldo + amount },
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Santri tidak ditemukan' }); return; }

    await prisma.customer.delete({ where: { id } });
    res.json({ message: 'Santri berhasil dihapus' });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      res.status(409).json({ error: 'Santri tidak dapat dihapus karena memiliki data order yang terkait' });
      return;
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function bulkUploadCustomers(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'File CSV wajib diunggah', code: 'INVALID_FILE' });
      return;
    }

    let records: Record<string, unknown>[];
    const fileName = req.file.originalname.toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    try {
      if (isXlsx) {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      } else {
        records = parse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, string>[];
      }
    } catch {
      res.status(400).json({ error: 'Format file tidak valid atau header tidak sesuai', code: 'INVALID_FILE' });
      return;
    }

    // Normalize header keys to lowercase
    const normalize = (r: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) out[k.toLowerCase().trim()] = v;
      return out;
    };

    const required = ['nis', 'nama', 'kamar', 'kelas'];
    if (records.length === 0 || !required.every((k) => k in normalize(records[0]))) {
      res.status(400).json({ error: 'Header CSV harus mengandung: nis, nama, kamar, kelas', code: 'INVALID_FILE' });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let skippedInvalid = 0;
    const errors: { row: number; nis: string; reason: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = normalize(records[i]);
      const rowNum = i + 2; // 1-based + header row

      const nis = row['nis'] != null ? String(row['nis']).trim() : '';
      const nama = row['nama'] != null ? String(row['nama']).trim() : '';
      const kamar = row['kamar'] != null ? String(row['kamar']).trim() : '';
      const kelas = row['kelas'] != null ? String(row['kelas']).trim() : '';
      const noHapeRaw = row['nohape'] != null ? String(row['nohape']).trim() : '';
      const noHape = noHapeRaw || null;
      const aktifRaw = row['aktif'] != null ? String(row['aktif']).trim().toLowerCase() : 'true';
      const aktif = aktifRaw !== 'false' && aktifRaw !== '0' && aktifRaw !== 'tidak' && aktifRaw !== 'no';
      const tipeRaw = row['tipe'] != null ? String(row['tipe']).trim().toUpperCase() : 'BERLANGGANAN';
      const tipe = tipeRaw === 'DEPOSIT' ? 'DEPOSIT' : 'BERLANGGANAN';
      const saldo = tipe === 'DEPOSIT' ? (parseFloat(String(row['saldo'] || '0')) || 0) : 0;

      if (!nis || !nama || !kamar || !kelas) {
        skippedInvalid++;
        errors.push({ row: rowNum, nis: nis || '', reason: 'Kolom tidak lengkap' });
        continue;
      }

      const existing = await prisma.customer.findUnique({ where: { nis } });
      if (existing) {
        // Reset saldo to 0 if switching to BERLANGGANAN, use CSV saldo if DEPOSIT
        const saldoUpdate = tipe === 'BERLANGGANAN' ? { saldo: 0 } : { saldo };
        await prisma.customer.update({
          where: { nis },
          data: { nama, kamar, kelas, noHape, tipe, aktif, ...saldoUpdate },
        });
        updated++;
      } else {
        await prisma.customer.create({ data: { nis, nama, kamar, kelas, noHape, tipe, saldo, aktif } });
        inserted++;
      }
    }

    res.json({
      status: 'success',
      data: {
        totalRows: records.length,
        inserted,
        updated,
        skippedInvalid,
        errors,
      },
    });
  } catch (error: any) {
    if (error.message === 'INVALID_FILE') {
      res.status(400).json({ error: 'File bukan CSV yang valid', code: 'INVALID_FILE' });
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Ukuran file melebihi 5MB', code: 'FILE_TOO_LARGE' });
      return;
    }
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
