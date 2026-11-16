/**
 * Pintu tulis App Lapangan: memanggil server action yang sama dengan web,
 * supaya aturan stok/ledger tidak digandakan. Hanya aksi di daftar ini yang bisa dipanggil.
 *
 *   form : body multipart/form-data → action(formData)
 *   json : body { "args": [...] }   → action(...args)
 */
import { NextResponse } from 'next/server'
import { requireFieldSession } from '@/lib/field-api'
import { submitCustomerBehavior, submitVisitKios, submitFarmerGathering, submitVisitCompany, submitVideoKonten } from '@/app/actions/report'
import { submitSpotDemplot } from '@/app/actions/spot-demplot'
import { submitStandaloneDemoPlot, submitContinueDemoPlot } from '@/app/actions/standalone-demoplot'
import { submitDemoPlotSession } from '@/app/actions/execute'
import { submitRequestDemoPlot } from '@/app/actions/request'
import { submitAfaSelfPlan } from '@/app/actions/afa-plan'
import { submitAfaStockRequest } from '@/app/actions/afa-stock'
import { approveRequest, rejectRequest } from '@/app/actions/approve'
import { submitStockTransfer, cancelStockTransfer, receiveStockTransfer } from '@/app/actions/stock-transfer'
import { submitStockOpname } from '@/app/actions/opname'
import { changePassword, updateEmail, updatePhone, updateProfilePhoto } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Fn = (...args: any[]) => Promise<unknown>

const FORM: Record<string, Fn> = {
  'customer-behavior': submitCustomerBehavior,
  'visit-kios': submitVisitKios,
  'farmer-gathering': submitFarmerGathering,
  'visit-company': submitVisitCompany,
  'video-konten': submitVideoKonten,
  'spot-demplot': submitSpotDemplot,
  'demoplot-new': submitStandaloneDemoPlot,
  // requestId dikirim sebagai field form
  'demoplot-continue': (fd: FormData) => submitContinueDemoPlot(String(fd.get('requestId') ?? ''), fd),
  'demoplot-session': submitDemoPlotSession,
  'stock-request-fo': submitRequestDemoPlot,
  'afa-plan': submitAfaSelfPlan,
  'stock-request-afa': submitAfaStockRequest,
  'fo-request-approve': approveRequest,
  'fo-request-reject': rejectRequest,
  'stock-opname': submitStockOpname,
  'change-password': changePassword,
  'update-email': updateEmail,
  'update-phone': updatePhone,
}

const JSON_ARGS: Record<string, Fn> = {
  'transfer-submit': submitStockTransfer,
  'transfer-cancel': cancelStockTransfer,
  'transfer-receive': receiveStockTransfer,
  'update-photo': updateProfilePhoto,
}

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireFieldSession()
  if (auth instanceof NextResponse) return auth
  const { name } = await params

  try {
    let result: unknown
    if (Object.hasOwn(FORM, name)) {
      result = await FORM[name](await req.formData())
    } else if (Object.hasOwn(JSON_ARGS, name)) {
      const body = await req.json().catch(() => null)
      if (!Array.isArray(body?.args)) return NextResponse.json({ error: 'Body harus { "args": [...] }' }, { status: 400 })
      result = await JSON_ARGS[name](...body.args)
    } else {
      return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 404 })
    }
    const r = (result ?? { success: true }) as Record<string, unknown>
    // Action lama melaporkan gagal lewat { error }, bukan exception
    return NextResponse.json(r, { status: r.error ? 422 : 200 })
  } catch (err) {
    console.error(`[field-api] ${name}:`, err)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
