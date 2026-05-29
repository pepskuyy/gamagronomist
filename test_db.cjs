const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  connectionString: 'postgresql://postgres.wfgarxbunoltnatyktmb:Gas3208161180@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
})

async function check() {
  // Ambil user spv1
  const res = await pool.query('SELECT id, username, password, role, "isActive" FROM "User" WHERE username = $1', ['spv1'])
  if (res.rows.length === 0) {
    console.log('❌ User spv1 tidak ditemukan!')
  } else {
    const user = res.rows[0]
    console.log('✅ User found:', user.username, '| Role:', user.role, '| Active:', user.isActive)
    console.log('   Password hash:', user.password?.substring(0, 20) + '...')
    
    // Test beberapa password umum
    const testPasswords = ['admin123', 'password', '123456', 'spv123', 'Admin123']
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, user.password)
      if (match) console.log(`   ✅ Password match: "${pwd}"`)
    }
  }
  
  // List semua user
  const allUsers = await pool.query('SELECT username, role, "isActive" FROM "User" ORDER BY role, username LIMIT 10')
  console.log('\n👥 Daftar User (10 pertama):')
  allUsers.rows.forEach(u => console.log(`   ${u.username} | ${u.role} | Active: ${u.isActive}`))
  
  await pool.end()
}

check().catch(e => { console.error('Error:', e.message); pool.end() })
