import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ONE-TIME USE: Create AreaCoverage table
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== 'gamagronomist-dbpush-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AreaCoverage" (
        "id"            TEXT NOT NULL,
        "areaId"        TEXT NOT NULL,
        "kabupatenName" TEXT NOT NULL,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AreaCoverage_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AreaCoverage_areaId_kabupatenName_key" UNIQUE ("areaId", "kabupatenName"),
        CONSTRAINT "AreaCoverage_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    return NextResponse.json({ success: true, message: 'Tabel AreaCoverage berhasil dibuat.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
