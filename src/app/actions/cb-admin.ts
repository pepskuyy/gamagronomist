'use server'

import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

async function getAdminSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = await decrypt(sessionToken as string)
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session
}

export async function deleteCustomerBehavior(id: string) {
  try {
    await getAdminSession()
    await prisma.customerBehavior.delete({ where: { id } })
    revalidatePath('/dashboard/reports')
    return { success: true }
  } catch (err: any) {
    console.error('Delete CB Error:', err)
    return { error: 'Gagal menghapus laporan Customer Behavior.' }
  }
}

export async function updateCustomerBehavior(id: string, formData: FormData) {
  try {
    await getAdminSession()

    // Assuming district is the full "Kabupaten" string, and we don't bother splitting desa/kec here unless needed.
    // The edit form will just provide a single 'address' generic string and 'district' string to simplify migrated data edits.
    const data = {
      farmerName: formData.get('farmerName') as string,
      age: formData.get('age') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      district: formData.get('district') as string,
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
    }

    await prisma.customerBehavior.update({
      where: { id },
      data
    })
    
    revalidatePath('/dashboard/reports')
    revalidatePath(`/dashboard/reports/cb/${id}`)
    return { success: true }
  } catch (err: any) {
    console.error('Update CB Error:', err)
    return { error: 'Gagal mengupdate laporan Customer Behavior.' }
  }
}
