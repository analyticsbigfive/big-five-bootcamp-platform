export const MAINTENANCE_MODE_KEY = 'maintenance_mode'

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled'])
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled'])

export function parseMaintenanceMode(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (TRUTHY_VALUES.has(normalized)) return true
  if (FALSY_VALUES.has(normalized)) return false

  return fallback
}

export function serializeMaintenanceMode(enabled: boolean): string {
  return enabled ? 'true' : 'false'
}
