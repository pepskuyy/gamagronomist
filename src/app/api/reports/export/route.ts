import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


// Standarisasi area ke format kabupaten
function extractKabupaten(areaStr: string | null | undefined, foAreaName?: string | null): string {
  const area = (areaStr || '').trim()
  // Sudah dalam format KABUPATEN/KOTA
  const kabStart = area.match(/^(KABUPATEN|KOTA)\s+\w+/i)
  if (kabStart) return kabStart[0].toUpperCase()
  // Format "Kab. X" di dalam string
  const kabIn = area.match(/\bKab(?:upaten)?\.?\s+([\w]+)/i)
  if (kabIn) return `KABUPATEN ${kabIn[1].toUpperCase()}`
  // Fallback ke nama area FO (sudah normalized)
  if (foAreaName) return foAreaName.toUpperCase()
  return area || '-'
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)

  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    let data: any[] = []

    if (type === 'cb') {
      const q = await prisma.customerBehavior.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? {
            OR: [
              { farmerName: { contains: search } },
              { district: { contains: search } }
            ]
          } : {})
        },
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      })

      // Helper: safely parse JSON array and return up to N elements
      const parseArr = (raw: string | null | undefined, n: number): string[] => {
        if (!raw) return Array(n).fill('-')
        try {
          const arr = JSON.parse(raw)
          if (!Array.isArray(arr)) return Array(n).fill('-')
          const result = arr.map((v: any) => String(v).trim()).filter(Boolean)
          // Pad with '-' if fewer items than n
          while (result.length < n) result.push('-')
          return result.slice(0, n)
        } catch {
          // Fallback: treat as comma-separated plain text
          const result = raw.split(',').map(s => s.trim()).filter(Boolean)
          while (result.length < n) result.push('-')
          return result.slice(0, n)
        }
      }

      // Helper: parse Desa and Kecamatan from address string (format "Desa/Kel. X, Kec. Y, ...")
      const parseDesa = (address: string | null | undefined): string => {
        if (!address) return '-'
        const m = address.match(/Desa\/Kel\.\s+([^,]+)/i)
        return m ? m[1].trim() : '-'
      }
      const parseKec = (address: string | null | undefined): string => {
        if (!address) return '-'
        const m = address.match(/Kec\.\s+([^,]+)/i)
        return m ? m[1].trim() : '-'
      }

      // Helper: convert luas lahan to Ha
      const toLuasHa = (val: number | null | undefined, unit: string | null | undefined): string => {
        if (val === null || val === undefined) return '-'
        if (unit === 'm2') return (val / 10000).toFixed(4)
        return String(val)
      }

      data = q.map(i => {
        const kendala = parseArr(i.constraints, 2)
        const opt     = parseArr(i.optDetails, 3)
        const photos  = parseArr(i.photos, 3)

        return {
          'Tanggal':          new Date(i.createdAt).toLocaleString('id-ID'),
          'Pelapor':          i.user.name,
          'Nama Petani':      i.farmerName,
          'Umur':             i.age || '-',
          'Luas Lahan (Ha)':  toLuasHa(i.totalLandArea, i.totalLandAreaUnit),
          'No. HP':           i.phone || '-',
          'Desa':             parseDesa(i.address),
          'Kecamatan':        parseKec(i.address),
          'Area/Kabupaten':   i.district || '-',
          'Komoditas':        i.commodity || '-',
          'Kendala 1':        kendala[0],
          'Kendala 2':        kendala[1],
          'OPT 1':            opt[0],
          'OPT 2':            opt[1],
          'OPT 3':            opt[2],
          'Produk Dipakai':   i.usedProducts || '-',
          'Lokasi Beli':      i.buyLocation || '-',
          'Referensi':        i.references || '-',
          'Foto 1':           photos[0],
          'Foto 2':           photos[1],
          'Foto 3':           photos[2],
        }
      })

    } else if (type === 'demoplot') {
      let dpRequestFilter: any = { commodity: { not: '-' }, farmer: { isNot: null } }
      if (['ADMIN', 'SPV'].includes(session.role)) {
        // empty
      } else if (['AFA', 'PLANTATION'].includes(session.role)) {
        const fos = await prisma.user.findMany({ where: { afaId: session.userId }, select: { id: true } })
        const foIds = [session.userId, ...fos.map(u => u.id)]
        dpRequestFilter = { ...dpRequestFilter, OR: [{ foId: { in: foIds } }, { afaId: session.userId }] }
      } else {
        dpRequestFilter = { ...dpRequestFilter, foId: session.userId }
      }

      const q = await prisma.request.findMany({
        where: {
          ...dateFilter,
          ...dpRequestFilter,
          ...(search ? {
            OR: [
              { farmer: { name: { contains: search } } },
              { area: { contains: search } }
            ]
          } : {})
        },
        include: { fo: { include: { area: true } }, farmer: true, demoPlots: true },
        orderBy: { createdAt: 'desc' }
      })

      data = q.map((i: any) => {
        // Kumpulkan semua foto dari semua sesi demo plot
        const allPhotos: string[] = []
        i.demoPlots.forEach((dp: any) => {
          if (dp.photos) {
            try { const urls = JSON.parse(dp.photos); if (Array.isArray(urls)) allPhotos.push(...urls) } catch {}
          }
        })
        return {
          'Tanggal': new Date(i.createdAt).toLocaleString('id-ID'),
          'ID Tiket': i.id,
          'Pelaksana (FO/AFA)': i.fo?.name || '-',
          'Nama Petani': i.farmer?.name || '-',
          'No. HP': i.farmer?.phone || '-',
          'Kabupaten': extractKabupaten(i.area, i.fo?.area?.name),
          'Komoditas': i.commodity || '-',
          'Status': i.status,
          'Jumlah Sesi Dilakukan': i.demoPlots.length,
          'Link Foto Dokumentasi': allPhotos.length > 0 ? allPhotos.join('\n') : '-'
        }
      })

    } else if (type === 'kios') {
      const q = await prisma.visitKios.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { kiosName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
      data = q.map(i => ({
        'Tanggal': new Date(i.createdAt).toLocaleString('id-ID'),
        'Pelapor': i.user.name,
        'Nama Kios': i.kiosName,
        'Detail Aktivitas': i.activityDetail || '-',
        'Hasil Kunjungan': i.visitResult || '-',
        'Catatan': i.notes || '-'
      }))

    } else if (type === 'gathering') {
      const q = await prisma.farmerGathering.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { leaderName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
      data = q.map(i => ({
        'Tanggal': new Date(i.createdAt).toLocaleString('id-ID'),
        'Pelapor': i.user.name,
        'Alamat': i.address || '-',
        'Kecamatan/Kabupaten': i.district || '-',
        'Ketua Kelompok Tani': i.leaderName || '-',
        'No HP': i.phone || '-',
        'Detail Aktivitas': i.activityDetail || '-',
        'Biaya': i.cost || '-',
        'Detail Biaya': i.costDetail || '-'
      }))

      const companyQ = await prisma.visitCompany.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { companyName: { contains: search } } : {})
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
      data = companyQ.map(i => ({
        'Tanggal': new Date(i.createdAt).toLocaleString('id-ID'),
        'Pelapor': i.user.name,
        'Nama Perusahaan': i.companyName,
        'Area': i.district || '-',
        'Alamat': i.address || '-',
        'PIC': i.picName || '-',
        'Jabatan PIC': i.picPosition || '-',
        'No HP PIC': i.picPhone || '-',
        'Luas Lahan': i.landArea || '-',
        'Komoditas': i.commodities || '-',
        'Produk': i.products || '-',
        'Tgl Pengadaan': i.procurementDate ? new Date(i.procurementDate).toLocaleDateString('id-ID') : '-',
        'Term of Payment': i.paymentTerm || '-'
      }))
    } else if (type === 'spot-demplot') {
      const spotQ = await prisma.spotDemplot.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { districtDesa: { contains: search } } : {})
        },
        include: { user: { select: { name: true } }, details: { include: { product: { select: { name: true, unit: true } } } } },
        orderBy: { createdAt: 'desc' }
      })
      data = spotQ.map(i => {
        const usageText = i.details.map((d: any) => `${d.product?.name || 'Produk'} (${d.usage} ${d.product?.unit || ''})`).join(', ')
        return {
          'Tanggal Pelaksanaan': new Date(i.date).toLocaleDateString('id-ID'),
          'Tanggal Submit': new Date(i.createdAt).toLocaleString('id-ID'),
          'Pelapor': i.user.name,
          'Desa': i.districtDesa || '-',
          'Kecamatan': i.districtKec || '-',
          'Kabupaten': i.districtKab || '-',
          'Jenis Gulma': i.weeds ? JSON.parse(i.weeds).join(', ') : '-',
          'Penggunaan Produk': usageText || '-',
          'Hasil Pengamatan': i.observationResult || '-'
        }
      })
    } else if (type === 'video-konten') {
      const videoQ = await prisma.contentVideo.findMany({
        where: {
          ...dateFilter,
          ...userFilter,
          ...(search ? { theme: { contains: search, mode: 'insensitive' } } : {})
        },
        include: { user: { select: { name: true } }, products: { include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' }
      })
      data = videoQ.map(i => {
        let allPhotos: string[] = []
        if (i.photos) { try { const urls = JSON.parse(i.photos); if (Array.isArray(urls)) allPhotos.push(...urls) } catch {} }
        return {
          'Tanggal Upload': new Date(i.uploadDate).toLocaleDateString('id-ID'),
          'Tanggal Submit': new Date(i.createdAt).toLocaleString('id-ID'),
          'Pelapor': i.user.name,
          'Tema': i.theme || '-',
          'Produk Terkait': i.products?.map((p: any) => p.product?.name).join(', ') || '-',
          'Catatan': i.notes || '-',
          'Link Foto Dokumentasi': allPhotos.length > 0 ? allPhotos.join('\n') : '-'
        }
      })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
