import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import ExcelJS from 'exceljs'


function extractKabupaten(areaStr: string | null | undefined, foAreaName?: string | null): string {
  const area = (areaStr || '').trim()
  const kabStart = area.match(/^(KABUPATEN|KOTA)\s+\w+/i)
  if (kabStart) return kabStart[0].toUpperCase()
  const kabIn = area.match(/\bKab(?:upaten)?\.?\s+([\w]+)/i)
  if (kabIn) return `KABUPATEN ${kabIn[1].toUpperCase()}`
  if (foAreaName) return foAreaName.toUpperCase()
  return area || '-'
}

async function addPhotosToRow(ws: ExcelJS.Worksheet, workbook: ExcelJS.Workbook, row: ExcelJS.Row, rowIndex: number, allPhotoUrls: string[], startCol: number) {
  const IMG_W = 140
  const IMG_H = 100
  const maxPhotos = Math.min(allPhotoUrls.length, 3)

  if (maxPhotos > 0) {
    row.height = IMG_H * 0.75 + 4
    for (let pi = 0; pi < maxPhotos; pi++) {
      const url = allPhotoUrls[pi]
      try {
        const imgRes = await fetch(url)
        if (!imgRes.ok) continue
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const ext = url.match(/\.(jpe?g|png|gif|webp)/i)?.[1]?.toLowerCase() || 'jpeg'
        const imgExt = (ext === 'jpg' ? 'jpeg' : ext) as 'jpeg' | 'png' | 'gif'
        const imageId = workbook.addImage({ buffer: buf, extension: imgExt })
        ws.addImage(imageId, {
          tl: { col: startCol + pi - 1, row: rowIndex - 1 } as any, // exceljs expects 0-indexed for col/row in tl
          ext: { width: IMG_W, height: IMG_H },
          editAs: 'oneCell',
        })
      } catch { /* skip failed downloads */ }
    }
  } else {
    row.height = 22
    row.getCell(startCol).value = 'Tidak ada foto'
  }
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const search = searchParams.get('search') || ''
  const startParam = searchParams.get('start') || ''
  const endParam = searchParams.get('end') || ''

  const startDate = startParam ? new Date(startParam) : undefined
  const endDate = endParam ? new Date(endParam) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {})
    }
  } : {}

  let userFilter: any = {}
  if (['ADMIN', 'SPV'].includes(session.role)) {
    userFilter = {}
  } else if (['AFA', 'PLANTATION'].includes(session.role)) {
    const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
    const userIds = [session.userId, ...fos.map(u => u.id)]
    userFilter = { userId: { in: userIds } }
  } else {
    userFilter = { userId: session.userId }
  }

  try {
    const workbook = new ExcelJS.Workbook()
    let sheetName = 'Laporan'
    
    if (type === 'cb') {
      sheetName = 'Customer Behavior'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal',         key: 'tanggal',      width: 20 },
        { header: 'Pelapor',         key: 'pelapor',      width: 20 },
        { header: 'Nama Petani',     key: 'petani',       width: 22 },
        { header: 'Umur',            key: 'umur',         width: 8  },
        { header: 'Luas Lahan (Ha)', key: 'luas',         width: 14 },
        { header: 'No. HP',          key: 'hp',           width: 15 },
        { header: 'Desa',            key: 'desa',         width: 18 },
        { header: 'Kecamatan',       key: 'kecamatan',    width: 18 },
        { header: 'Area/Kabupaten',  key: 'kabupaten',    width: 22 },
        { header: 'Komoditas',       key: 'komoditas',    width: 14 },
        { header: 'Kendala 1',       key: 'kendala1',     width: 20 },
        { header: 'Kendala 2',       key: 'kendala2',     width: 20 },
        { header: 'OPT 1',           key: 'opt1',         width: 20 },
        { header: 'OPT 2',           key: 'opt2',         width: 20 },
        { header: 'OPT 3',           key: 'opt3',         width: 20 },
        { header: 'Produk Dipakai',  key: 'produk',       width: 22 },
        { header: 'Lokasi Beli',     key: 'lokasi_beli',  width: 20 },
        { header: 'Referensi',       key: 'referensi',    width: 18 },
        { header: 'Foto 1',          key: 'foto1',        width: 22 },
        { header: 'Foto 2',          key: 'foto2',        width: 22 },
        { header: 'Foto 3',          key: 'foto3',        width: 22 },
      ]

      // Helper: safely parse JSON array up to N items, pad with '-'
      const parseArr = (raw: string | null | undefined, n: number): string[] => {
        const result: string[] = []
        if (raw) {
          try {
            const arr = JSON.parse(raw)
            if (Array.isArray(arr)) result.push(...arr.map((v: any) => String(v).trim()).filter(Boolean))
          } catch {
            result.push(...raw.split(',').map(s => s.trim()).filter(Boolean))
          }
        }
        while (result.length < n) result.push('-')
        return result.slice(0, n)
      }

      // Parse Desa / Kecamatan from stored address ("Desa/Kel. X, Kec. Y, ...")
      const parseDesa = (addr: string | null | undefined) => addr?.match(/Desa\/Kel\.\s+([^,]+)/i)?.[1]?.trim() ?? '-'
      const parseKec  = (addr: string | null | undefined) => addr?.match(/Kec\.\s+([^,]+)/i)?.[1]?.trim() ?? '-'

      // Luas lahan → Ha
      const toLuasHa = (val: number | null | undefined, unit: string | null | undefined): string => {
        if (val === null || val === undefined) return '-'
        return unit === 'm2' ? (val / 10000).toFixed(4) : String(val)
      }

      const q = await prisma.customerBehavior.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? {
            OR: [
              { farmerName: { contains: search } },
              { district:   { contains: search } }
            ]
          } : {})
        },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      })

      // Foto kolom mulai di kolom ke-19 (1-indexed), yaitu key foto1 = kolom S
      const FOTO_START_COL = 19

      let rowIndex = 2
      for (const i of q) {
        const kendala = parseArr(i.constraints, 2)
        const opt     = parseArr(i.optDetails, 3)

        const row = ws.addRow({
          tanggal:     new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor:     i.user.name,
          petani:      i.farmerName,
          umur:        i.age || '-',
          luas:        toLuasHa(i.totalLandArea, i.totalLandAreaUnit),
          hp:          i.phone || '-',
          desa:        parseDesa(i.address),
          kecamatan:   parseKec(i.address),
          kabupaten:   i.district || '-',
          komoditas:   i.commodity || '-',
          kendala1:    kendala[0],
          kendala2:    kendala[1],
          opt1:        opt[0],
          opt2:        opt[1],
          opt3:        opt[2],
          produk:      i.usedProducts || '-',
          lokasi_beli: i.buyLocation || '-',
          referensi:   i.references || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }

        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, FOTO_START_COL)
        rowIndex++
      }

    } else if (type === 'demoplot') {
      sheetName = 'Demo Plot'

      // Query per DemoPlot session (bukan per Request) agar sesuai screenshot
      let dpFilter: any = {}
      if (['ADMIN', 'SPV'].includes(session.role)) {
        dpFilter = {}
      } else if (['AFA', 'PLANTATION'].includes(session.role)) {
        const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
        const foIds = [session.userId, ...fos.map(u => u.id)]
        dpFilter = {
          request: { foId: { in: foIds } }
        }
      } else {
        dpFilter = { request: { foId: session.userId } }
      }

      const q = await prisma.demoPlot.findMany({
        where: {
          ...(startDate || endDate ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            }
          } : {}),
          ...dpFilter,
          ...(search ? {
            OR: [
              { farmer: { name: { contains: search } } },
              { area: { contains: search } },
            ]
          } : {}),
        },
        include: {
          farmer: true,
          request: {
            include: {
              fo: { include: { area: true } },
              farmer: true,
            }
          },
          details: {
            include: { product: { select: { name: true, unit: true, unitGramasi: true } } }
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Helper: parse Desa / Kecamatan / Kabupaten dari string area
      // Format umum: "Desa/Kel. X, Kec. Y, Kab. Z" atau "X - Y - Z" atau free-text
      const parseLocDesa = (area: string | null | undefined) => area?.match(/Desa\/Kel\.\s+([^,]+)/i)?.[1]?.trim() ?? (area?.split(',')[0]?.trim() ?? '-')
      const parseLocKec  = (area: string | null | undefined) => area?.match(/Kec(?:amatan)?\.\s+([^,]+)/i)?.[1]?.trim() ?? (area?.split(',')[1]?.trim() ?? '-')
      const parseLocKab  = (area: string | null | undefined) => {
        const m = area?.match(/Kab(?:upaten)?\.\s+([^,]+)/i)?.[1] ?? area?.match(/KABUPATEN\s+(\w+)/i)?.[1]
        return m?.trim() ?? (area?.split(',')[2]?.trim() ?? '-')
      }

      const MAX_PRODUK = 4
      const ws = workbook.addWorksheet(sheetName)

      // Build columns: Produk 1 + Digunakan, Produk 2 + Digunakan, ... up to MAX_PRODUK
      // Last product (Produk 4) has no "Digunakan" column - match screenshot exactly
      const produkCols: Array<{ header: string; key: string; width: number }> = []
      for (let p = 1; p <= MAX_PRODUK; p++) {
        produkCols.push({ header: `Produk ${p}`, key: `produk${p}`, width: 18 })
        if (p < MAX_PRODUK) {
          produkCols.push({ header: 'Digunakan (ml/gram)', key: `digunakan${p}`, width: 16 })
        }
      }

      ws.columns = [
        { header: 'Tanggal',              key: 'tanggal',     width: 20 },
        { header: 'Pelaksana',            key: 'pelaksana',   width: 20 },
        { header: 'Nama Petani',          key: 'petani',      width: 22 },
        { header: 'No. HP',               key: 'hp',          width: 15 },
        { header: 'Desa',                 key: 'desa',        width: 18 },
        { header: 'Kecamatan',            key: 'kecamatan',   width: 18 },
        { header: 'Kabupaten',            key: 'kabupaten',   width: 20 },
        { header: 'Latitude',             key: 'lat',         width: 13 },
        { header: 'Longitude',            key: 'lng',         width: 13 },
        ...produkCols,
        { header: 'Komoditas',            key: 'komoditas',   width: 14 },
        { header: 'Status',               key: 'status',      width: 22 },
        { header: 'Deskripsi Hasil Demplot', key: 'deskripsi', width: 30 },
        { header: 'Foto 1',               key: 'foto1',       width: 22 },
        { header: 'Foto 2',               key: 'foto2',       width: 22 },
        { header: 'Foto 3',               key: 'foto3',       width: 22 },
      ]

      // Foto start column (1-indexed): 9 info cols + produk cols (MAX_PRODUK + (MAX_PRODUK-1) pairs) + 3 meta = ?
      // 9 + 7 (4 produk + 3 digunakan) + 3 = 19, foto start = 20
      const FOTO_START_COL = 9 + (MAX_PRODUK + (MAX_PRODUK - 1)) + 3 + 1

      let rowIndex = 2
      for (const i of q) {
        const farmer  = i.farmer ?? i.request?.farmer
        const fo      = i.request?.fo
        const area    = i.area ?? i.request?.area ?? ''

        // Produk details: max MAX_PRODUK
        const details = i.details.slice(0, MAX_PRODUK)

        const rowData: Record<string, any> = {
          tanggal:   new Date(i.createdAt).toLocaleString('id-ID'),
          pelaksana: fo?.name ?? '-',
          petani:    farmer?.name ?? '-',
          hp:        farmer?.phone ?? '-',
          desa:      parseLocDesa(area),
          kecamatan: parseLocKec(area),
          kabupaten: parseLocKab(area),
          lat:       i.latitude ?? '-',
          lng:       i.longitude ?? '-',
          komoditas: i.commodity ?? i.request?.commodity ?? '-',
          status:    i.request?.status ?? '-',
          deskripsi: i.resultNotes ?? '-',
          foto1: '', foto2: '', foto3: '',
        }

        // Fill produk columns
        for (let p = 1; p <= MAX_PRODUK; p++) {
          const d = details[p - 1]
          rowData[`produk${p}`]    = d ? d.product.name : '-'
          if (p < MAX_PRODUK) {
            rowData[`digunakan${p}`] = d ? d.actualUsage : '-'
          }
        }

        const row = ws.addRow(rowData)
        row.alignment = { vertical: 'middle', wrapText: true }

        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, FOTO_START_COL)
        rowIndex++
      }

    } else if (type === 'kios') {
      sheetName = 'Visit Kios'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal',           key: 'tanggal',     width: 18 },
        { header: 'Pelapor',           key: 'pelapor',     width: 18 },
        { header: 'Nama Kios',         key: 'kios',        width: 25 },
        { header: 'Detail Aktivitas',  key: 'aktivitas',   width: 30 },
        { header: 'Hasil Kunjungan',   key: 'hasil',       width: 30 },
        { header: 'Catatan',           key: 'catatan',     width: 30 },
        { header: 'Foto 1',            key: 'foto1',       width: 20 },
        { header: 'Foto 2',            key: 'foto2',       width: 20 },
        { header: 'Foto 3',            key: 'foto3',       width: 20 },
      ]

      const q = await prisma.visitKios.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { kiosName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })

      let rowIndex = 2
      for (const i of q) {
        const row = ws.addRow({
          tanggal: new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor: i.user.name,
          kios: i.kiosName,
          aktivitas: i.activityDetail || '-',
          hasil: i.visitResult || '-',
          catatan: i.notes || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }
        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, 7)
        rowIndex++
      }

    } else if (type === 'gathering') {
      sheetName = 'Farmer Gathering'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal',           key: 'tanggal',     width: 18 },
        { header: 'Pelapor',           key: 'pelapor',     width: 18 },
        { header: 'Alamat',            key: 'alamat',      width: 25 },
        { header: 'Kecamatan/Kabupaten',key: 'kabupaten',  width: 20 },
        { header: 'Ketua Kelompok Tani',key: 'ketua',      width: 20 },
        { header: 'No HP',             key: 'hp',          width: 14 },
        { header: 'Detail Aktivitas',  key: 'aktivitas',   width: 30 },
        { header: 'Biaya',             key: 'biaya',       width: 15 },
        { header: 'Detail Biaya',      key: 'detail_biaya',width: 25 },
        { header: 'Foto 1',            key: 'foto1',       width: 20 },
        { header: 'Foto 2',            key: 'foto2',       width: 20 },
        { header: 'Foto 3',            key: 'foto3',       width: 20 },
      ]

      const q = await prisma.farmerGathering.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { leaderName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })

      let rowIndex = 2
      for (const i of q) {
        const row = ws.addRow({
          tanggal: new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor: i.user.name,
          alamat: i.address || '-',
          kabupaten: i.district || '-',
          ketua: i.leaderName || '-',
          hp: i.phone || '-',
          aktivitas: i.activityDetail || '-',
          biaya: i.cost || '-',
          detail_biaya: i.costDetail || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }
        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, 10)
        rowIndex++
      }

    } else if (type === 'company') {
      sheetName = 'Visit Company'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal',           key: 'tanggal',     width: 18 },
        { header: 'Pelapor',           key: 'pelapor',     width: 18 },
        { header: 'Nama Perusahaan',   key: 'perusahaan',  width: 25 },
        { header: 'Area',              key: 'area',        width: 20 },
        { header: 'Alamat',            key: 'alamat',      width: 25 },
        { header: 'PIC',               key: 'pic',         width: 20 },
        { header: 'Jabatan PIC',       key: 'jabatan',     width: 18 },
        { header: 'No HP PIC',         key: 'hp',          width: 14 },
        { header: 'Luas Lahan',        key: 'luas',        width: 15 },
        { header: 'Komoditas',         key: 'komoditas',   width: 18 },
        { header: 'Produk',            key: 'produk',      width: 20 },
        { header: 'Tgl Pengadaan',     key: 'tgl_pengadaan',width: 18 },
        { header: 'Term of Payment',   key: 'top',         width: 18 },
        { header: 'Foto 1',            key: 'foto1',       width: 20 },
        { header: 'Foto 2',            key: 'foto2',       width: 20 },
        { header: 'Foto 3',            key: 'foto3',       width: 20 },
      ]

      const companyQ = await prisma.visitCompany.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { companyName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })

      let rowIndex = 2
      for (const i of companyQ) {
        const row = ws.addRow({
          tanggal: new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor: i.user.name,
          perusahaan: i.companyName,
          area: i.district || '-',
          alamat: i.address || '-',
          pic: i.picName || '-',
          jabatan: i.picPosition || '-',
          hp: i.picPhone || '-',
          luas: i.landArea || '-',
          komoditas: i.commodities || '-',
          produk: i.products || '-',
          tgl_pengadaan: i.procurementDate ? new Date(i.procurementDate).toLocaleDateString('id-ID') : '-',
          top: i.paymentTerm || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }
        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, 14)
        rowIndex++
      }

    } else if (type === 'spot-demplot') {
      sheetName = 'Spot Demplot'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal Pelaksanaan',key: 'tanggal',    width: 18 },
        { header: 'Tanggal Submit',     key: 'submit',     width: 18 },
        { header: 'Pelapor',           key: 'pelapor',     width: 18 },
        { header: 'Desa',              key: 'desa',        width: 18 },
        { header: 'Kecamatan',         key: 'kecamatan',   width: 18 },
        { header: 'Kabupaten',         key: 'kabupaten',   width: 20 },
        { header: 'Jenis Gulma',       key: 'gulma',       width: 20 },
        { header: 'Penggunaan Produk', key: 'produk',      width: 30 },
        { header: 'Hasil Pengamatan',  key: 'hasil',       width: 30 },
        { header: 'Foto 1',            key: 'foto1',       width: 20 },
        { header: 'Foto 2',            key: 'foto2',       width: 20 },
        { header: 'Foto 3',            key: 'foto3',       width: 20 },
      ]

      const spotQ = await prisma.spotDemplot.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { districtDesa: { contains: search } } : {})
        },
        include: { user: { select: { name: true } }, details: { include: { product: { select: { name: true, unit: true } } } } },
        orderBy: { createdAt: 'desc' }
      })

      let rowIndex = 2
      for (const i of spotQ) {
        const usageText = i.details.map((d: any) => `${d.product?.name || 'Produk'} (${d.usage} ${d.product?.unit || ''})`).join(', ')
        const row = ws.addRow({
          tanggal: new Date(i.date).toLocaleDateString('id-ID'),
          submit: new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor: i.user.name,
          desa: i.districtDesa || '-',
          kecamatan: i.districtKec || '-',
          kabupaten: i.districtKab || '-',
          gulma: i.weeds ? JSON.parse(i.weeds).join(', ') : '-',
          produk: usageText || '-',
          hasil: i.observationResult || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }
        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, 10)
        rowIndex++
      }

    } else if (type === 'video-konten') {
      sheetName = 'Video Konten'
      const ws = workbook.addWorksheet(sheetName)
      ws.columns = [
        { header: 'Tanggal Upload',    key: 'tanggal',     width: 18 },
        { header: 'Tanggal Submit',    key: 'submit',      width: 18 },
        { header: 'Pelapor',           key: 'pelapor',     width: 18 },
        { header: 'Tema',              key: 'tema',        width: 30 },
        { header: 'Produk Terkait',    key: 'produk',      width: 30 },
        { header: 'Catatan',           key: 'catatan',     width: 30 },
        { header: 'Foto 1',            key: 'foto1',       width: 20 },
        { header: 'Foto 2',            key: 'foto2',       width: 20 },
        { header: 'Foto 3',            key: 'foto3',       width: 20 },
      ]

      const videoQ = await prisma.contentVideo.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { theme: { contains: search, mode: 'insensitive' } } : {})
        },
        include: { user: { select: { name: true } }, products: { include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' }
      })

      let rowIndex = 2
      for (const i of videoQ) {
        const row = ws.addRow({
          tanggal: new Date(i.uploadDate).toLocaleDateString('id-ID'),
          submit: new Date(i.createdAt).toLocaleString('id-ID'),
          pelapor: i.user.name,
          tema: i.theme || '-',
          produk: i.products?.map((p: any) => p.product?.name).join(', ') || '-',
          catatan: i.notes || '-',
          foto1: '', foto2: '', foto3: ''
        })
        row.alignment = { vertical: 'middle', wrapText: true }
        let allPhotoUrls: string[] = []
        if (i.photos) { try { allPhotoUrls = JSON.parse(i.photos) } catch {} }
        await addPhotosToRow(ws, workbook, row, rowIndex, allPhotoUrls, 7)
        rowIndex++
      }
    }

    const ws = workbook.worksheets[0]
    if (ws) {
      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A9B55' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      })
      ws.getRow(1).height = 30
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const dateTag = startParam && endParam ? `_${startParam}_sd_${endParam}` : ''
    return new Response(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan_${type}_foto${dateTag}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('[export-photos]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
