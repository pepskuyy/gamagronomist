import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { put } from '@vercel/blob'

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

    // Generate a unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `gamagronomist/${timestamp}-${random}.${ext}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
    })

  } catch (error: any) {
    console.error('Upload Error:', error)

    // Provide helpful error message if BLOB_READ_WRITE_TOKEN is missing
    if (error.message?.includes('BLOB_READ_WRITE_TOKEN') || error.message?.includes('No token')) {
      return NextResponse.json({
        error: 'BLOB_READ_WRITE_TOKEN belum diset. Tambahkan Blob Store di Vercel Dashboard → Storage.'
      }, { status: 500 })
    }

    return NextResponse.json({ error: 'Gagal mengunggah file: ' + (error.message || 'Unknown') }, { status: 500 })
  }
}
