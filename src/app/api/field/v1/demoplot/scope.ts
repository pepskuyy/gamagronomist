import prisma from '@/lib/prisma'

/** Cakupan pengajuan demo plot, sama dengan dpWhere di tab Demo Plot laporan web. */
export async function demoplotScope(user: { id: string; role: string }) {
  if (!['AFA', 'PLANTATION'].includes(user.role)) return { foId: user.id }
  const fos = await prisma.user.findMany({ where: { afaId: user.id }, select: { id: true } })
  return { OR: [{ foId: { in: [user.id, ...fos.map(f => f.id)] } }, { afaId: user.id }] }
}

export const canContinue = (r: { status: string; foId: string; afaId: string | null }, userId: string) =>
  r.status === 'APPROVED' && (r.foId === userId || r.afaId === userId)
