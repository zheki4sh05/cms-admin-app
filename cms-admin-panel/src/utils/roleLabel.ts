export function roleLabel(role: string | null | undefined): string {
  const normalized = (role ?? '').trim().toLowerCase()
  if (normalized === 'executive' || normalized === 'top_management') return 'топ менеджер'
  if (normalized === 'supervisor' || normalized === 'head') return 'руководитель'
  if (normalized === 'manager') return 'менеджер'
  if (normalized === 'admin') return 'администратор'
  return role?.trim() || '—'
}

