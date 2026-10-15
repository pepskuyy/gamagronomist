import { SignJWT, jwtVerify } from 'jose'

// Tidak ada fallback: tanpa JWT_SECRET siapa pun bisa memalsukan token.
// Dibaca saat dipakai (bukan saat import) agar `next build` tidak gagal.
function getKey() {
  const secretKey = process.env.JWT_SECRET
  if (!secretKey) throw new Error('JWT_SECRET belum diset di environment')
  return new TextEncoder().encode(secretKey)
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getKey())
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, getKey(), {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    return null
  }
}
