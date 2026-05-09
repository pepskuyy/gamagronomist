import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Default message templates (used as placeholder text in UI and fallback in afa-stock.ts)
export const DEFAULT_TEMPLATES: Record<string, string> = {
  msg_afa_submit:
    '🔔 *Pengajuan Stok Baru*\n\nAFA *{nama_afa}* telah mengajukan permintaan restock gudang.\n\nSilakan buka aplikasi untuk menyetujui: /dashboard/stock',
  msg_spv_approve:
    '✅ *Pengajuan Stok — Disetujui SPV*\n\nPengajuan restock AFA (*{nama_afa}*) telah disetujui SPV.\nSaat ini menunggu persetujuan Anda sebagai FA Manager.\n\nBuka: /dashboard/stock',
  msg_fam_approve:
    '✅ *Pengajuan Stok — Disetujui FA Manager*\n\nPengajuan restock AFA (*{nama_afa}*) telah disetujui FA Manager.\nSaat ini menunggu persetujuan Anda sebagai WH Manager.\n\nBuka: /dashboard/stock',
  msg_whm_approve:
    '📦 *Stok Siap Diterima*\n\nPengajuan restock AFA (*{nama_afa}*) telah disetujui WH Manager.\nSilakan konfirmasi penerimaan stok di aplikasi: /dashboard/stock',
  msg_spv_receive:
    '✅ *Pengajuan Stok Selesai*\n\nHai *{nama_afa}*, pengajuan stok Anda (ID: {id_pengajuan}) telah diterima dan stok telah masuk.{invoice}\n\nCek di: /dashboard/stock',
  msg_rejection:
    '❌ *Pengajuan Stok Ditolak*\n\nHai *{nama_afa}*, pengajuan stok Anda (ID: {id_pengajuan}) telah *ditolak* oleh {peran_penolak}.\n\nSilakan hubungi {peran_penolak} untuk informasi lebih lanjut.',
}

export const ALLOWED_KEYS = [
  // ── WAHA Server ──────────────────────────────────────────────────
  { key: 'waha_base_url', label: 'WAHA Base URL', group: 'server' },
  { key: 'waha_api_key',  label: 'WAHA API Key',  group: 'server' },
  { key: 'waha_session',  label: 'WAHA Session Name', group: 'server' },

  // ── Nomor WA per Role ─────────────────────────────────────────────
  { key: 'wa_spv', label: 'No. WA SPV (pisahkan koma jika lebih dari 1)', group: 'phones' },
  { key: 'wa_fam', label: 'No. WA FA Manager (pisahkan koma jika lebih dari 1)', group: 'phones' },
  { key: 'wa_whm', label: 'No. WA WH Manager (pisahkan koma jika lebih dari 1)', group: 'phones' },

  // ── Template Pesan ────────────────────────────────────────────────
  { key: 'msg_afa_submit',  label: 'Pesan ke SPV saat AFA mengajukan stok',               group: 'templates' },
  { key: 'msg_spv_approve', label: 'Pesan ke FA Manager saat SPV menyetujui',              group: 'templates' },
  { key: 'msg_fam_approve', label: 'Pesan ke WH Manager saat FA Manager menyetujui',       group: 'templates' },
  { key: 'msg_whm_approve', label: 'Pesan ke SPV saat WH Manager menyetujui (siap terima)', group: 'templates' },
  { key: 'msg_spv_receive', label: 'Pesan ke AFA saat SPV konfirmasi penerimaan (selesai)', group: 'templates' },
  { key: 'msg_rejection',   label: 'Pesan ke AFA saat pengajuan ditolak',                  group: 'templates' },
]

async function getSession(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  return decrypt(token as string)
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ALLOWED_KEYS.map(k => k.key) } }
    })

    // Merge with defaults
    const result = ALLOWED_KEYS.map(({ key, label, group }) => {
      const found = configs.find(c => c.key === key)
      return {
        key,
        label,
        group,
        value: found?.value ?? '',                        // empty = use default
        defaultValue: DEFAULT_TEMPLATES[key] ?? '',       // shown as placeholder
        updatedAt: found?.updatedAt ?? null,
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  try {
    const body = await req.json() as { key: string; value: string }[]

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Body harus berupa array [{ key, value }]' }, { status: 400 })
    }

    const allowedKeySet = new Set(ALLOWED_KEYS.map(k => k.key))
    const results = []

    for (const { key, value } of body) {
      if (!allowedKeySet.has(key)) continue
      const meta = ALLOWED_KEYS.find(k => k.key === key)
      const record = await prisma.systemConfig.upsert({
        where: { key },
        update: { value, label: meta?.label },
        create: { key, value, label: meta?.label },
      })
      results.push(record)
    }

    return NextResponse.json({ success: true, updated: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
