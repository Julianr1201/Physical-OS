/** Keeps a post-login return path inside this site. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return '/';
  if (value.includes('\\') || value.includes('://')) return '/';
  return value;
}

export function loginHref(path: string): string {
  const next = safeNext(path);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
