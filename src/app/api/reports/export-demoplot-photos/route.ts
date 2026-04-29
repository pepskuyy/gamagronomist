import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import ExcelJS from 'exceljs'

const prisma = new PrismaClient()

function extractKabupaten(areaStr: string | null | undefined, foAreaName?: string | null): string {
  const area = (areaStr || '').trim()
  const kabStart = area.match(/^(KABUPATEN|KOTA)\s+\w+/i)
  if (kabStart) return kabStart[0].toUpperCase()
  const kabIn = area.match(/\bKab(?:upaten)?\.?\s+([\w]+)/i)
  if (kabIn) return `KABUPATEN ${kabIn[1].toUpperCase()}`
  if (foAreaName) return foAreaName.toUpperCase()
  return area || '-'
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
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

  // Build scope filter
  let dpRequestFilter: any = { commodity: { not: '-' }, farmer: { isNot: null } }
  if (!['ADMIN', 'SPV'].includes(session.role)) {
    if (['AFA', 'PLANTATION'].includes(session.role)) {
      const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
      const foIds = [session.userId, ...fos.map((u: any) => u.id)]
      dpRequestFilter = { ...dpRequestFilter, OR: [{ foId: { in: foIds } }, { afaId: session.userId }] }
    } else {
      dpRequestFilter = { ...dpRequestFilter, foId: session.userId }
    }
  }

  const rows = await prisma.request.findMany({
    where: {
      ...dateFilter,
      ...dpRequestFilter,
      ...(search ? { OR: [{ farmer: { name: { contains: search } } }, { area: { contains: search } }] } : {})
    },
    include: { fo: { include: { area: true } }, farmer: true, demoPlots: true },
    orderBy: { createdAt: 'desc' }
  })

  try {
    // Build Excel with exceljs
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Demo Plot')

    ws.columns = [
      { header: 'Tanggal',           key: 'tanggal',     width: 18 },
      { header: 'ID Tiket',          key: 'id',           width: 14 },
      { header: 'Pelaksana',         key: 'pelaksana',    width: 18 },
      { header: 'Nama Petani',       key: 'petani',       width: 20 },
      { header: 'No. HP',            key: 'hp',           width: 14 },
      { header: 'Kabupaten',         key: 'kabupaten',    width: 22 },
      { header: 'Komoditas',         key: 'komoditas',    width: 14 },
      { header: 'Status',            key: 'status',       width: 20 },
      { header: 'Jumlah Sesi',       key: 'sesi',         width: 12 },
      { header: 'Foto 1',            key: 'foto1',        width: 20 },
      { header: 'Foto 2',            key: 'foto2',        width: 20 },
      { header: 'Foto 3',            key: 'foto3',        width: 20 },
    ]

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A9B55' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    })
    ws.getRow(1).height = 30

    let rowIndex = 2
    for (const i of rows as any[]) {
      const kabupaten = extractKabupaten(i.area, i.fo?.area?.name)

      const allPhotoUrls: string[] = []
      for (const dp of i.demoPlots) {
        if (dp.photos) {
          try {
            const urls = JSON.parse(dp.photos)
            if (Array.isArray(urls)) allPhotoUrls.push(...urls)
          } catch {}
        }
      }

      const IMG_W = 140
      const IMG_H = 100
      const maxPhotos = Math.min(allPhotoUrls.length, 3)

      const row = ws.addRow({
        tanggal: new Date(i.createdAt).toLocaleString('id-ID'),
        id: i.id,
        pelaksana: i.fo?.name || '-',
        petani: i.farmer?.name || '-',
        hp: i.farmer?.phone || '-',
        kabupaten,
        komoditas: i.commodity || '-',
        status: i.status,
        sesi: i.demoPlots.length,
        foto1: '',
        foto2: '',
        foto3: '',
      })
      row.alignment = { vertical: 'middle', wrapText: true }

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
            // col 9 = Foto1, col 10 = Foto2, col 11 = Foto3 (0-indexed)
            ws.addImage(imageId, {
              tl: { col: 9 + pi, row: rowIndex - 1 } as any,
              ext: { width: IMG_W, height: IMG_H },
              editAs: 'oneCell',
            })
          } catch { /* skip failed downloads */ }
        }
      } else {
        row.height = 22
        row.getCell('foto1').value = 'Tidak ada foto'
      }

      rowIndex++
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const dateTag = startParam && endParam ? `_${startParam}_sd_${endParam}` : ''
    return new Response(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan_demoplot_foto${dateTag}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('[export-demoplot-photos]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
