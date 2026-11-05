/** The OAuth return cookie may only resume an invitation or claim on this site. */
export const OAUTH_RETURN_COOKIE = "nicchyo_oauth_return";

export function invitationReturnPath(value: string | undefined): string | null {
  if (!value || /[\\\u0000-\u0020\u007f%?#]/.test(value)) return null;
  return /^\/(?:en\/)?(?:join|claim)\/[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

export function oauthDestination(role: string | null, invitation: string | null): string {
  if (invitation) return invitation;
  if (role === "admin") return "/admin/dashboard";
  if (role === "moderator") return "/moderator";
  if (role === "city_official") return "/city";
  if (role === "vendor") return "/my-shop";
  return "/map";
}
