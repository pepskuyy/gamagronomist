/**
 * Tujuan     : Client WhatsApp HTTP API (WAHA) untuk notifikasi di setiap step approval stok
 * Caller     : actions/afa-stock.ts (semua step approval)
 * Dependensi : lib/prisma (baca SystemConfig: waha_base_url, waha_api_key, waha_session, wa_spv/fam/whm)
 * Main Functions: sendWhatsApp, sendWhatsAppBulk, getRolePhones, getMsgTemplate
 * Side Effects  : HTTP POST ke WAHA server eksternal (self-hosted). Gagal = silent, TIDAK throw — hanya log warning.
 */

import prisma from '@/lib/prisma'

// Default message templates — used when admin hasn't customized them yet
const DEFAULT_TEMPLATES: Record<string, string> = {
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

interface WahaConfig {
  baseUrl: string
  apiKey: string
  session: string
}

async function getWahaConfig(): Promise<WahaConfig | null> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['waha_base_url', 'waha_api_key', 'waha_session'] } }
    })

    const map: Record<string, string> = {}
    for (const c of configs) map[c.key] = c.value

    if (!map['waha_base_url']) return null

    return {
      baseUrl: map['waha_base_url'].replace(/\/$/, ''),
      apiKey: map['waha_api_key'] ?? '',
      session: map['waha_session'] || 'default',
    }
  } catch (err) {
    console.error('[WAHA] Failed to load config:', err)
    return null
  }
}

/**
 * Format a local phone number to WhatsApp chat ID
 * e.g. "081234567890" → "6281234567890@c.us"
 */
function toWaId(phone: string): string {
  let cleaned = phone.replace(/\D/g, '') // Remove non-digits
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1)
  if (!cleaned.startsWith('62')) cleaned = '62' + cleaned
  return `${cleaned}@c.us`
}

/**
 * Send a WhatsApp message to a single phone number
 * Silently logs errors — does NOT throw
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!phone) return false

  const config = await getWahaConfig()
  if (!config) {
    console.warn('[WAHA] No WAHA config found — skipping WA notification')
    return false
  }

  const chatId = toWaId(phone)
  const url = `${config.baseUrl}/api/sendText`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        text: message,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('[WAHA] Send failed', {
        event: 'waha_send_failed',
        phone,
        chatId,
        status: res.status,
        error: errText,
        timestamp: new Date().toISOString(),
      })
      return false
    }

    console.log(`[WAHA] Sent WA to ${phone}`)
    return true
  } catch (err) {
    console.error(`[WAHA] Network error sending to ${phone}:`, err)
    return false
  }
}

/**
 * Send a WhatsApp message to multiple phone numbers (comma-separated or array)
 * Returns number of successfully sent messages
 */
export async function sendWhatsAppBulk(phones: string | string[], message: string): Promise<number> {
  const phoneList = Array.isArray(phones)
    ? phones
    : phones.split(',').map(p => p.trim()).filter(Boolean)

  let sent = 0
  for (const phone of phoneList) {
    const ok = await sendWhatsApp(phone, message)
    if (ok) sent++
  }
  return sent
}

/**
 * Get configured phone numbers for a role from SystemConfig
 * key: "wa_spv", "wa_fam", "wa_whm"
 */
export async function getRolePhones(key: 'wa_spv' | 'wa_fam' | 'wa_whm'): Promise<string[]> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    if (!config?.value) return []
    return config.value.split(',').map(p => p.trim()).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Get a message template from SystemConfig (with fallback to defaults)
 * and replace placeholders with provided variables.
 *
 * Supported placeholders:
 *   {nama_afa}      — name of the AFA user
 *   {id_pengajuan}  — first 8 chars of requestId uppercased
 *   {peran_penolak} — role label that rejected (e.g. "SPV", "FA Manager")
 *   {invoice}       — invoice info string (pre-formatted, e.g. "\nNo. Invoice: INV-001")
 */
export async function getMsgTemplate(
  key: keyof typeof DEFAULT_TEMPLATES,
  vars: Partial<{
    nama_afa: string
    id_pengajuan: string
    peran_penolak: string
    invoice: string
  }> = {}
): Promise<string> {
  let template = DEFAULT_TEMPLATES[key] ?? ''

  try {
    const config = await prisma.systemConfig.findUnique({ where: { key } })
    if (config?.value?.trim()) {
      template = config.value
    }
  } catch (err) {
    console.warn(`[WAHA] Could not load msg template "${key}", using default:`, err)
  }

  // Replace all placeholders
  return template
    .replace(/\{nama_afa\}/g, vars.nama_afa ?? '')
    .replace(/\{id_pengajuan\}/g, vars.id_pengajuan ?? '')
    .replace(/\{peran_penolak\}/g, vars.peran_penolak ?? '')
    .replace(/\{invoice\}/g, vars.invoice ?? '')
}
