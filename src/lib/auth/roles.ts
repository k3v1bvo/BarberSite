import type { Role } from '@/types'

export const STAFF_ROLES: Role[] = ['admin', 'recepcionista', 'barbero']

export function isAdmin(role?: string | null): boolean {
  return role === 'admin'
}

export function isStaff(role?: string | null): boolean {
  return role === 'admin' || role === 'recepcionista' || role === 'barbero'
}

export function canViewGeneralAgenda(role?: string | null): boolean {
  return role === 'admin' || role === 'recepcionista'
}
