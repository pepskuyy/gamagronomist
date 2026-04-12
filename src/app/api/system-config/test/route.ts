import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { sendWhatsApp } from '@/lib/waha'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = await decrypt(token as string)

  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Nomor WA tidak boleh kosong' }, { status: 400 })

    const ok = await sendWhatsApp(phone, '🤖 *Test Notifikasi WAHA*\n\nHalo! Ini adalah pesan test dari sistem Gamagronomist.\nJika Anda menerima pesan ini, koneksi WAHA berfungsi dengan baik. ✅')
    if (!ok) return NextResponse.json({ error: 'Gagal mengirim WA. Periksa konfigurasi WAHA.' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
