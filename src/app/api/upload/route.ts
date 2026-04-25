import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

// Cloudinary transformation: resize ke max 1280px, quality 78, format auto (WebP di browser modern)
// Menghemat ~60-70% storage dibanding upload raw tanpa kompresi
const EAGER_TRANSFORMS = 'c_limit,w_1280,h_1280,q_78,f_auto'

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
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah gambar (JPG/PNG/WebP)' }, { status: 400 })
    }

    // Max 8MB input — Cloudinary akan mengompres output jauh lebih kecil
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 8MB.' }, { status: 400 })
    }

    const cloudName    = process.env.CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      return NextResponse.json({ error: 'Konfigurasi upload belum diset. Hubungi admin.' }, { status: 500 })
    }

    // Upload ke Cloudinary dengan eager transformation
    const cdnForm = new FormData()
    cdnForm.append('file', file)
    cdnForm.append('upload_preset', uploadPreset)
    cdnForm.append('folder', 'gamagronomist')
    // Eager: resize max 1280px + compress quality 78 + auto-format WebP
    cdnForm.append('eager', EAGER_TRANSFORMS)
    cdnForm.append('eager_async', 'false') // Tunggu transformasi selesai sebelum return

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

    // Gunakan URL dari eager transformation jika tersedia (sudah dikompres & diubah ke WebP)
    // Jika tidak (preset unsigned tidak mengizinkan eager), inject transformasi inline ke URL
    const eagerUrl = result.eager?.[0]?.secure_url as string | undefined
    const rawUrl   = result.secure_url as string

    const finalUrl = eagerUrl
      ?? rawUrl.replace('/upload/', `/upload/${EAGER_TRANSFORMS}/`)

    return NextResponse.json({
      success: true,
      url: finalUrl,
    })

  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'Gagal mengunggah file.' }, { status: 500 })
  }
}
