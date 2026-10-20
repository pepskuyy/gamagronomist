import { NextResponse } from 'next/server'
import { requireApiSession } from '@/lib/session'
import { getAllStores } from '@/lib/data-cache'

export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  // Master toko di-cache (tag 'stores'); di-invalidasi pada CRUD toko & sync Accurate
  const stores = await getAllStores()
  return NextResponse.json(stores)
}
