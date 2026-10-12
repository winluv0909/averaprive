export const platformRoles = ["super_admin", "moderator", "verification_reviewer", "support", "finance"] as const;
export type PlatformRole = typeof platformRoles[number];
export function isPlatformRole(value: string): value is PlatformRole {
  return platformRoles.some(role => role === value);
}
export function platformHome(roles: string[]): string {
  if (roles.includes("super_admin")) return "/owners/dashboard";
  if (roles.includes("moderator")) return "/owners/dashboard/moderation";
  if (roles.includes("verification_reviewer")) return "/owners/dashboard/verifications";
  if (roles.includes("support")) return "/owners/dashboard/support";
  if (roles.includes("finance")) return "/owners/dashboard/payments";
  return "/forbidden?portal=owner";
}
export function needsPasswordChange(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.platform_password_change_required === true;
}
export function passwordError(password: string, confirmation: string): string | null {
  if (password.length < 12 || password.length > 128) return "Use a password between 12 and 128 characters.";
  if (password !== confirmation) return "The new passwords do not match.";
  return null;
}
