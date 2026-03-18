import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = await decrypt(sessionToken as string)

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah gambar (JPG/PNG)' }, { status: 400 })
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB.' }, { status: 400 })
    }

    const cloudName   = process.env.CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      return NextResponse.json({ error: 'Konfigurasi upload belum diset. Hubungi admin.' }, { status: 500 })
    }

    // Forward to Cloudinary unsigned upload
    const cdnForm = new FormData()
    cdnForm.append('file', file)
    cdnForm.append('upload_preset', uploadPreset)
    cdnForm.append('folder', 'gamagronomist')

    const cdnRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: cdnForm,
    })

    if (!cdnRes.ok) {
      const err = await cdnRes.json().catch(() => ({}))
      console.error('Cloudinary error', err)
      return NextResponse.json({ error: 'Gagal upload ke server gambar.' }, { status: 500 })
    }

    const result = await cdnRes.json()

    return NextResponse.json({
      success: true,
      url: result.secure_url,
    })
  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'Gagal mengunggah file.' }, { status: 500 })
  }
}
