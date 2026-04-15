import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// ONE-TIME USE: Run npx prisma db push via Vercel serverless
// DELETE THIS FILE after use!
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET && secret !== 'gamagronomist-dbpush-2025') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const out = execSync('npx prisma db push --accept-data-loss', {
      cwd: process.cwd(),
      timeout: 60000,
      encoding: 'utf-8'
    })
    return NextResponse.json({ success: true, output: out })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stderr: err.stderr }, { status: 500 })
  }
}
