const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const input = path.join(__dirname, 'public', 'logo.png')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function main() {
  // Also generate favicon sizes
  await sharp(input).resize(16, 16).png().toFile(path.join(__dirname, 'public', 'favicon-16x16.png'))
  await sharp(input).resize(32, 32).png().toFile(path.join(__dirname, 'public', 'favicon-32x32.png'))
  console.log('Generated favicons')

  for (const size of sizes) {
    const out = path.join(__dirname, 'public', 'icons', `icon-${size}x${size}.png`)
    await sharp(input)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(out)
    console.log(`Generated ${size}x${size}`)
  }
  console.log('All icons done!')
}

main().catch(console.error)
