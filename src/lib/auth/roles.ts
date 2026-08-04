import type { Role } from '@/types'

export const STAFF_ROLES: Role[] = ['admin', 'coordinador', 'barbero']

export function isAdmin(role?: string | null): boolean {
  return role === 'admin'
}

export function isCoordinador(role?: string | null): boolean {
  return role === 'coordinador'
}

export function isStaff(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador' || role === 'barbero'
}

export function canViewGeneralAgenda(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador'
}

export function canManageCaja(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador'
}

export function canDoArqueo(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador'
}

export function canManageInventory(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador'
}

export function canRegisterSale(role?: string | null): boolean {
  return role === 'admin' || role === 'coordinador' || role === 'barbero'
}
