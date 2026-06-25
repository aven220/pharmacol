export const ACTIVE_ROLE_CODES = ['ADMINISTRADOR', 'REGENTE'] as const;
export type ActiveRoleCode = (typeof ACTIVE_ROLE_CODES)[number];

export function assertActiveRoles(roleCodigos: string[]): void {
  const invalid = roleCodigos.filter((c) => !ACTIVE_ROLE_CODES.includes(c as ActiveRoleCode));
  if (invalid.length > 0) {
    throw new Error(`Roles no permitidos: ${invalid.join(', ')}`);
  }
}
