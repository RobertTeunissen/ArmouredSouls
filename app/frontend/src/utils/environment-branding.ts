/**
 * Environment branding: browser-tab title prefix and favicon variant (issue #174).
 *
 * ACC and production ship the same build artifact, so the environment is
 * derived at runtime from the hostname rather than a build-time variable.
 *
 *   acc.armouredsouls.com         → acceptance  → "[ACC] …", amber icon (-acc)
 *   localhost / 127.0.0.1 / ::1   → development → "[TST] …", green icon (-dev)
 *   anything else                 → production  → plain title, default icon
 *
 * Unknown hosts fall back to production so the live site never shows a
 * false label. Any code that sets `document.title` must go through
 * `formatDocumentTitle` so the prefix is preserved.
 */

export type AppEnvironment = 'production' | 'acceptance' | 'development';

interface EnvironmentBranding {
  titlePrefix: string;
  iconSuffix: string;
}

export const ACCEPTANCE_HOSTNAME = 'acc.armouredsouls.com';

const DEVELOPMENT_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const BRANDING: Record<AppEnvironment, EnvironmentBranding> = {
  production: { titlePrefix: '', iconSuffix: '' },
  acceptance: { titlePrefix: '[ACC]', iconSuffix: '-acc' },
  development: { titlePrefix: '[TST]', iconSuffix: '-dev' },
};

/**
 * Only the exact prefixes this module adds ("[ACC] " / "[TST] ") are stripped,
 * repeatedly, so formatting is idempotent. Other `[...]` text is left alone.
 */
const KNOWN_PREFIX_PATTERN = /^(?:\[(?:ACC|TST)\] )+/;

/** Base icon paths from index.html, with any environment suffix already applied. */
const ICON_HREF_PATTERN = /^\/(favicon|apple-touch-icon)(?:-acc|-dev)?\.(svg|ico|png)$/;
const KNOWN_ICON_FILES: ReadonlySet<string> = new Set(['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']);

export function resolveAppEnvironment(hostname: string): AppEnvironment {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (host === ACCEPTANCE_HOSTNAME) return 'acceptance';
  if (DEVELOPMENT_HOSTNAMES.has(host)) return 'development';
  return 'production';
}

export function formatDocumentTitle(baseTitle: string, env: AppEnvironment): string {
  const base = baseTitle.replace(KNOWN_PREFIX_PATTERN, '');
  const { titlePrefix } = BRANDING[env];
  return titlePrefix ? `${titlePrefix} ${base}` : base;
}

export function getIconHref(href: string, env: AppEnvironment): string {
  const match = ICON_HREF_PATTERN.exec(href);
  if (!match) return href;
  const [, name, extension] = match;
  if (!KNOWN_ICON_FILES.has(`${name}.${extension}`)) return href;
  return `/${name}${BRANDING[env].iconSuffix}.${extension}`;
}

/**
 * Applies the title prefix and icon variant for the current environment.
 * Call once before the React root renders.
 */
export function applyEnvironmentBranding(
  doc: Document = document,
  hostname: string = window.location.hostname,
): AppEnvironment {
  const env = resolveAppEnvironment(hostname);
  doc.title = formatDocumentTitle(doc.title, env);
  doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === null) return;
    const next = getIconHref(href, env);
    if (next !== href) link.setAttribute('href', next);
  });
  return env;
}
