'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { resolveAreaIdFromCoords } from '@/lib/area-resolver'

const prisma = new PrismaClient()

// Helper to get user session
async function getSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  return await decrypt(sessionToken as string)
}

export async function submitCustomerBehavior(formData: FormData) {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  try {
    const district = formData.get('district') as string
    const kec = formData.get('districtKecamatan') as string
    const desa = formData.get('districtDesa') as string
    const detailAddress = formData.get('address') as string

    // Combine desa, kecamatan, and detail into address. District stays as Kabupaten/Kota.
    const fullAddress = [
      desa ? `Desa/Kel. ${desa}` : '',
      kec ? `Kec. ${kec}` : '',
      detailAddress ? detailAddress : ''
    ].filter(Boolean).join(', ')

    const lat = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null
    const lng = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null

    // Resolve area: GPS-based (Opsi B)
    const geoAreaId = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng))
      ? await resolveAreaIdFromCoords(lat, lng)
      : null

    const data = {
      userId: session.userId,
      snapshotAreaId: geoAreaId ?? session.areaId ?? null,
      farmerName: formData.get('farmerName') as string,
      age: formData.get('age') as string,
      phone: formData.get('phone') as string,
      address: fullAddress,
      district: district,
      commodity: formData.get('commodity') as string,
      reasonChoice: formData.get('reasonChoice') as string,
      constraints: formData.get('constraints') as string,
      optTypes: formData.get('optTypes') as string,
      optDetails: formData.get('optDetails') as string,
      usedProducts: formData.get('usedProducts') as string,
      buyLocation: formData.get('buyLocation') as string,
      buyReason: formData.get('buyReason') as string,
      references: formData.get('references') as string,
      notes: formData.get('notes') as string,
      photos: formData.get('photos') as string,
      totalLandArea: formData.get('totalLandArea') ? parseFloat(formData.get('totalLandArea') as string) : null,
      totalLandAreaUnit: (formData.get('totalLandAreaUnit') as string) || 'ha',
      latitude: lat,
      longitude: lng,
    }

    const report = await prisma.customerBehavior.create({ data })
    return { success: true, id: report.id }
  } catch (err: any) {
    console.error('Submit CB Error:', err)
    return { error: 'Gagal mengirim laporan Customer Behavior.' }
  }
}

export async function submitVisitKios(formData: FormData) {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  try {
    const data = {
      userId: session.userId,
      snapshotAreaId: session.areaId ?? null,
      kiosName: formData.get('kiosName') as string,
      activityDetail: formData.get('activityDetail') as string,
      visitResult: formData.get('visitResult') as string,
      notes: formData.get('notes') as string,
      photos: formData.get('photos') as string,
    }

    const report = await prisma.visitKios.create({ data })
    return { success: true, id: report.id }
  } catch (err: any) {
    console.error('Submit Visit Kios Error:', err)
    return { error: 'Gagal mengirim laporan Visit Kios.' }
  }
}

export async function submitFarmerGathering(formData: FormData) {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  try {
    const costInput = formData.get('cost')
    const data = {
      userId: session.userId,
      snapshotAreaId: session.areaId ?? null,
      address: formData.get('address') as string,
      district: formData.get('district') as string,
      leaderName: formData.get('leaderName') as string,
      phone: formData.get('phone') as string,
      activityDetail: formData.get('activityDetail') as string,
      cost: costInput ? parseFloat(costInput as string) : null,
      costDetail: formData.get('costDetail') as string,
      photos: formData.get('photos') as string,
    }

    const report = await prisma.farmerGathering.create({ data })
    return { success: true, id: report.id }
  } catch (err: any) {
    console.error('Submit Gathering Error:', err)
    return { error: 'Gagal mengirim laporan Farmer Gathering.' }
  }
}

export async function submitVisitCompany(formData: FormData) {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  try {
    const dateInput = formData.get('procurementDate') as string
    const data = {
      userId: session.userId,
      snapshotAreaId: session.areaId ?? null,
      companyName: formData.get('companyName') as string,
      district: formData.get('district') as string,
      address: formData.get('address') as string,
      picName: formData.get('picName') as string,
      picPosition: formData.get('picPosition') as string,
      picPhone: formData.get('picPhone') as string,
      landArea: formData.get('landArea') as string,
      commodities: formData.get('commodities') as string, // JSON array string
      products: formData.get('products') as string,
      procurementDate: dateInput ? new Date(dateInput) : null,
      paymentTerm: formData.get('paymentTerm') as string,
      photos: formData.get('photos') as string,
    }

    const report = await prisma.visitCompany.create({ data })
    return { success: true, id: report.id }
  } catch (err: any) {
    console.error('Submit Visit Company Error:', err)
    return { error: 'Gagal mengirim laporan Visit Company.' }
  }
}
