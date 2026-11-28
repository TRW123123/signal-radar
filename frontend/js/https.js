/** Absolute https URL without userinfo, or '' when the value must not become a link. */
export function httpsHref(url) {
  try {
    const u = new URL(String(url ?? ''));
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    return u.href;
  } catch {
    return '';
  }
}
