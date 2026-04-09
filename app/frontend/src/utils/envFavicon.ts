/**
 * Generates a dynamic favicon based on the current environment.
 * TST (local/development) = green accent, ACC = orange accent.
 * Production keeps the default blue. A small colored dot badge is
 * added in non-production environments so tabs are easy to tell apart.
 */

type EnvConfig = { accent: string; badge: string | null; titlePrefix: string };

const ENV_MAP: Record<string, EnvConfig> = {
  development: { accent: '#3fb950', badge: '#3fb950', titlePrefix: '[TST]' },
  acceptance:  { accent: '#d29922', badge: '#d29922', titlePrefix: '[ACC]' },
  production:  { accent: '#58a6ff', badge: null,       titlePrefix: '' },
};

function getEnvConfig(): EnvConfig {
  const env = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';
  return ENV_MAP[env] ?? ENV_MAP.development;
}

function buildFaviconSvg(accent: string, badge: string | null): string {
  const badgeMarkup = badge
    ? `<circle cx="104" cy="104" r="22" fill="${badge}" stroke="#0a0e14" stroke-width="4"/>`
    : '';

  return `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M64 16L96 32V64C96 81.6731 81.6731 96 64 96C46.3269 96 32 81.6731 32 64V32L64 16Z" fill="#e6edf3" stroke="#e6edf3" stroke-width="2" stroke-linejoin="miter"/>
  <path d="M64 32L80 40V64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64V40L64 32Z" fill="#0a0e14" stroke="#e6edf3" stroke-width="1.5" stroke-linejoin="miter"/>
  <path d="M64 48L72 52V64C72 68.4183 68.4183 72 64 72C59.5817 72 56 68.4183 56 64V52L64 48Z" fill="${accent}"/>
  ${badgeMarkup}
</svg>`;
}

export function applyEnvFavicon(): void {
  const { accent, badge, titlePrefix } = getEnvConfig();

  // Dynamic favicon
  const svg = buildFaviconSvg(accent, badge);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = url;

  // Prefix the page title
  if (titlePrefix) {
    const base = document.title.replace(/^\[.*?\]\s*/, '');
    document.title = `${titlePrefix} ${base}`;
  }
}
