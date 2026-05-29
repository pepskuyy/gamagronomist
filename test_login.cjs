// Jalankan: node test_login.cjs
// Ganti USERNAME dan PASSWORD dengan kredensial yang Anda pakai saat login

const https = require('https')

const USERNAME = 'spv1'
const PASSWORD = 'password123'

const VERCEL_URL = 'gamagronomist-qi0vw20p3-febrisatrio3-4271s-projects.vercel.app'

const body = JSON.stringify({ username: USERNAME, password: PASSWORD })

const options = {
  hostname: VERCEL_URL,
  path: '/api/debug-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}

console.log(`Testing login for user: ${USERNAME}`)
console.log(`URL: https://${VERCEL_URL}/api/debug-login\n`)

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    try {
      const result = JSON.parse(data)
      console.log('Result:', JSON.stringify(result, null, 2))
    } catch {
      console.log('Raw response:', data)
    }
  })
})

req.on('error', e => console.error('Request error:', e.message))
req.setTimeout(15000, () => {
  console.log('❌ Request timed out after 15 seconds - server is hanging!')
  req.destroy()
})

req.write(body)
req.end()
