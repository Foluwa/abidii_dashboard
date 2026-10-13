/**
 * Hides most of an email address for on-screen display: the first two
 * characters of the name, dots, then the full domain ("fo••••@abidii.app").
 * The domain stays visible because it's useful at a glance (gmail,
 * privaterelay.appleid.com, abidii.app) without identifying the person.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  if (at <= 0) return '••••••';
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  const shown = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${shown}••••@${domain}`;
}
