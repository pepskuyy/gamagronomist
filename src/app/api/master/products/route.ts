import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(products)
}
