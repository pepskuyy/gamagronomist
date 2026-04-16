/**
 * Seed script — recreate essential admin/SPV accounts after db reset
 * Run: node seed.js
 *
 * Requires: npm install bcryptjs (already in package.json)
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding essential accounts...\n')

  // ── List akun yang akan dibuat ──────────────────────────────────────
  // SESUAIKAN username/password/name sesuai kebutuhan !
  const accounts = [
    { username: 'admin',    password: 'admin123',   name: 'Administrator', role: 'ADMIN' },
    { username: 'spv',      password: 'spv123',     name: 'SPV Utama',     role: 'SPV'   },
  ]
  // ────────────────────────────────────────────────────────────────────

  for (const acc of accounts) {
    const hashed = await bcrypt.hash(acc.password, 10)
    const created = await prisma.user.upsert({
      where:  { username: acc.username },
      update: { password: hashed, name: acc.name, role: acc.role, isActive: true },
      create: { username: acc.username, password: hashed, name: acc.name, role: acc.role, isActive: true },
    })
    console.log(`✅ ${created.role}: ${created.username} (ID: ${created.id})`)
  }

  console.log('\n✨ Seeding selesai!')
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
