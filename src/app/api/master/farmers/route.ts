import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const farmers = await prisma.farmer.findMany({
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(farmers)
}
