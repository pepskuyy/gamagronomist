import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // validasi token session
    await decrypt(sessionToken)

    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        unitGramasi: true,
        gramasiPerUnit: true,
      },
      orderBy: { name: 'asc' }
    })
    
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
