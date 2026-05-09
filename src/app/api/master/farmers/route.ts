import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'


export async function GET() {
  const farmers = await prisma.farmer.findMany({
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(farmers)
}
