// Logo URL for a merchant domain. Single source of truth for the logo provider
// so it can be swapped in one place (client-safe — no server imports).
//
// We key on DOMAIN, not company name — the hard part (name → domain) is done by
// the merchant resolver. Google's favicon service is free, keyless, and reliable
// at avatar size; the CSP allows www.google.com + *.gstatic.com (see next.config).

/** Favicon URL for a domain, or null if there's no domain to look up. */
export function logoUrl(domain: string | null | undefined, size = 64): string | null {
  if (!domain) return null;
  const clean = domain.trim().toLowerCase();
  if (!clean) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=${size}`;
}
