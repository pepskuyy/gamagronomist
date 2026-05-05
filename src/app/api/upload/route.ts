import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'

// Naikkan batas body request ke 10MB untuk upload foto
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

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

    // Max 8MB
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 8MB.' }, { status: 400 })
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'djfhtirfk'
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'gamagronomist'

    // Upload to Cloudinary (unsigned preset)
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
      return NextResponse.json({ error: 'Gagal upload ke Cloudinary: ' + (err?.error?.message || 'Unknown') }, { status: 500 })
    }

    const result = await cdnRes.json()

    // Apply inline transformation for compression (resize max 1280px, quality 78, auto format)
    const rawUrl = result.secure_url as string
    const finalUrl = rawUrl.replace('/upload/', '/upload/c_limit,w_1280,h_1280,q_78,f_auto/')

    return NextResponse.json({
      success: true,
      url: finalUrl,
    })

  } catch (error: any) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'Gagal mengunggah file: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
