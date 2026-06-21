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

    if (!['AFA', 'SPV', 'ADMIN', 'PLANTATION'].includes(session.role)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengunggah SOP.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah file PDF.' }, { status: 400 })
    }

    // Max 20MB for PDF
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 20MB.' }, { status: 400 })
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'djfhtirfk'
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'gamagronomist'

    // Upload to Cloudinary (default resource_type 'image' is required for inline PDF viewing)
    const cdnForm = new FormData()
    cdnForm.append('file', file)
    cdnForm.append('upload_preset', uploadPreset)
    cdnForm.append('folder', 'gamagronomist/sop')

    const cdnRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: cdnForm,
    })

    if (!cdnRes.ok) {
      const err = await cdnRes.json().catch(() => ({}))
      console.error('Cloudinary PDF upload error', err)
      return NextResponse.json({ error: 'Gagal upload PDF ke Cloudinary: ' + (err?.error?.message || 'Unknown') }, { status: 500 })
    }

    const result = await cdnRes.json()

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      fileName: file.name,
    })

  } catch (error: any) {
    console.error('Upload PDF Error:', error)
    return NextResponse.json({ error: 'Gagal mengunggah file: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
