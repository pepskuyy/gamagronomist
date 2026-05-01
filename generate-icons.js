/**
 * Script untuk generate icon PWA dalam berbagai ukuran
 * Jalankan: node generate-icons.js
 * 
 * Membutuhkan: npm install sharp
 */

const sharp = require('sharp')
const fs    = require('fs')
const path  = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputFile  = path.join(__dirname, 'icon-source.png')   // letakkan icon 512x512 di folder ini
const outputDir  = path.join(__dirname, 'public', 'icons')

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

async function generateIcons() {
  if (!fs.existsSync(inputFile)) {
    console.error('❌ File icon-source.png tidak ditemukan!')
    console.log('   Letakkan file ikon 512x512px dengan nama "icon-source.png" di folder project root.')
    process.exit(1)
  }

  for (const size of sizes) {
    await sharp(inputFile)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`))
    console.log(`✅ Generated icon-${size}x${size}.png`)
  }

  // Juga buat favicon
  await sharp(inputFile).resize(32, 32).png().toFile(path.join(__dirname, 'public', 'favicon-32x32.png'))
  await sharp(inputFile).resize(16, 16).png().toFile(path.join(__dirname, 'public', 'favicon-16x16.png'))
  console.log('\n🎉 Semua icon berhasil digenerate di /public/icons/')
}

generateIcons().catch(console.error)
