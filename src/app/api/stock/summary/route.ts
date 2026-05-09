import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import { getStockBalance } from '@/lib/ledger/stock'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // validasi token session
    const sessionDetail = await decrypt(sessionToken)
    if (!sessionDetail?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stocks = await getStockBalance(sessionDetail.userId)
    
    // Flat map for simple client consumption — quantity is in kemasan units
    const flatStocks = stocks.map(s => ({
      id: s.product.id,
      name: s.product.name,
      unit: s.product.unit,  // kemasan unit (PCS, Btl, etc.)
      systemStock: s.quantity
    }))

    return NextResponse.json(flatStocks)
  } catch (error) {
    console.error('API Summary Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
