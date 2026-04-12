/**
 * WAHA (WhatsApp HTTP API) Client
 * Sends WhatsApp notifications via WAHA v2 /api/sendText endpoint
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
      console.error(`[WAHA] Failed to send to ${phone}: ${res.status} ${errText}`)
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
