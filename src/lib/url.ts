export interface Site {
  /** Settings key, e.g. `http://localhost:3000`. Includes the port. */
  origin: string;
  /** Display name, e.g. `localhost:3000`. */
  host: string;
  /**
   * Host-permission match pattern, e.g. `http://localhost/*`. Match patterns
   * can't carry a port, so this covers every port on that host.
   */
  pattern: string;
}

export type UrlSupport =
  | { ok: true; site: Site }
  | { ok: false; reason: 'internal' | 'file' | 'store' };

// Browsers refuse script injection on their own extension stores.
const STORE_HOSTS = new Set([
  'chromewebstore.google.com',
  'microsoftedge.microsoft.com',
  'addons.mozilla.org',
]);

export function classifyUrl(raw: string | undefined): UrlSupport {
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return { ok: false, reason: 'internal' };
  }
  if (url.protocol === 'file:') return { ok: false, reason: 'file' };
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'internal' };
  }
  if (
    STORE_HOSTS.has(url.hostname) ||
    (url.hostname === 'chrome.google.com' &&
      url.pathname.startsWith('/webstore'))
  ) {
    return { ok: false, reason: 'store' };
  }
  return {
    ok: true,
    site: {
      origin: url.origin,
      host: url.host,
      pattern: `${url.protocol}//${url.hostname}/*`,
    },
  };
}

/**
 * Does a granted match pattern (from permissions.getAll) cover this site?
 * Handles the broad grants a user can choose in the browser's extension
 * settings ("On all sites") as well as per-host ones.
 */
export function patternCovers(pattern: string, site: Site): boolean {
  if (pattern === '<all_urls>') return true;
  const m = /^(\*|https?):\/\/([^/]+)\//.exec(pattern);
  if (!m) return false;
  const [, scheme, host] = m as unknown as [string, string, string];
  const url = new URL(site.origin);
  if (scheme !== '*' && `${scheme}:` !== url.protocol) return false;
  if (host === '*') return true;
  if (host.startsWith('*.')) {
    const base = host.slice(2);
    return url.hostname === base || url.hostname.endsWith(`.${base}`);
  }
  return host === url.hostname;
}

/** A grant for one specific host (not a wildcard). */
export const isHostPattern = (pattern: string): boolean =>
  /^https?:\/\/[^*/]+\/\*$/.test(pattern);

export const UNSUPPORTED_MESSAGE: Record<
  Exclude<UrlSupport, { ok: true }>['reason'] | 'blocked' | 'sandboxed',
  string
> = {
  internal: "Browser pages like this one can't be dimmed.",
  file: 'Local files aren’t supported yet.',
  store: 'Extension stores block all extensions, so this page can’t be dimmed.',
  blocked: 'The browser blocked access to this page.',
  sandboxed: 'This page is sandboxed, so its settings can’t be saved.',
};
