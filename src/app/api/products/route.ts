import { NextResponse } from 'next/server'
import { getProductOptions } from '@/lib/data-cache'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'


export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // validasi token session
    await decrypt(sessionToken)

    // Master produk di-cache (tag 'products'); di-invalidasi pada setiap mutasi produk
    const products = await getProductOptions()
    
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
