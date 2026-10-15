import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'


export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(products)
}
