const sharp = require('sharp')
const path  = require('path')

const src = path.join(__dirname, 'icon-source.png')

// Android mipmap sizes & folder names
const mipmaps = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
]

// Drawable splash sizes (same icon reused)
const drawables = [
  { folder: 'drawable-mdpi',    size: 48  },
  { folder: 'drawable-hdpi',    size: 72  },
  { folder: 'drawable-xhdpi',   size: 96  },
  { folder: 'drawable-xxhdpi',  size: 144 },
  { folder: 'drawable-xxxhdpi', size: 192 },
]

async function replaceIcons() {
  const resDir = path.join(__dirname, 'app', 'src', 'main', 'res')

  for (const { folder, size } of [...mipmaps, ...drawables]) {
    const outDir = path.join(resDir, folder)
    // launcher icon
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'))
      .catch(() => {}) // skip if file/folder doesn't exist

    // round icon (Android 8+)
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'))
      .catch(() => {})

    console.log(`✅ ${folder} (${size}px)`)
  }

  // Also replace store_icon.png (512px, used for Play Store)
  await sharp(src).resize(512, 512).png().toFile(path.join(__dirname, 'store_icon.png'))
  console.log('✅ store_icon.png (512px)')

  console.log('\n🎉 Semua icon Android berhasil diperbarui!')
  console.log('   Sekarang jalankan: bubblewrap build')
}

replaceIcons().catch(console.error)
