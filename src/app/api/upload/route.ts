import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

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

    // Validate type (basic image validation)
    if (!file.type.startsWith('image/')) {
       return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah gambar (JPG/PNG)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Create random filename to prevent collision
    const ext = path.extname(file.name) || '.jpg'
    const fileName = `${crypto.randomUUID()}${ext}`
    
    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (e) {
      // Ignore if dir already exists
    }

    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    return NextResponse.json({ 
      success: true, 
      url: `/uploads/${fileName}` 
    })
  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'Gagal mengunggah file' }, { status: 500 })
  }
}
