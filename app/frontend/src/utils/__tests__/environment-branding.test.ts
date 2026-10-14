import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  applyEnvironmentBranding,
  formatDocumentTitle,
  getIconHref,
  resolveAppEnvironment,
  type AppEnvironment,
} from '../environment-branding';

const ENVIRONMENTS: readonly AppEnvironment[] = ['production', 'acceptance', 'development'];

const HEAD_HTML = `
  <title>Armoured Souls</title>
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
`;

function buildDocument(): Document {
  const doc = document.implementation.createHTMLDocument('');
  doc.head.innerHTML = HEAD_HTML;
  return doc;
}

function iconHrefs(doc: Document): string[] {
  return Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'),
  ).map((link) => link.getAttribute('href') ?? '');
}

describe('resolveAppEnvironment', () => {
  it.each([
    ['acc.armouredsouls.com', 'acceptance'],
    ['ACC.ArmouredSouls.com.', 'acceptance'],
    ['armouredsouls.com', 'production'],
    ['www.armouredsouls.com', 'production'],
    ['localhost', 'development'],
    ['127.0.0.1', 'development'],
    ['[::1]', 'development'],
    ['::1', 'development'],
    ['', 'production'],
    ['example.com', 'production'],
  ] as const)('%s → %s', (hostname, expected) => {
    expect(resolveAppEnvironment(hostname)).toBe(expected);
  });
});

describe('formatDocumentTitle', () => {
  it('formats the base title per environment', () => {
    expect(formatDocumentTitle('Armoured Souls', 'production')).toBe('Armoured Souls');
    expect(formatDocumentTitle('Armoured Souls', 'acceptance')).toBe('[ACC] Armoured Souls');
    expect(formatDocumentTitle('Armoured Souls', 'development')).toBe('[TST] Armoured Souls');
  });

  it('is idempotent', () => {
    const once = formatDocumentTitle('Armoured Souls', 'acceptance');
    expect(formatDocumentTitle(once, 'acceptance')).toBe('[ACC] Armoured Souls');
  });

  it('replaces a stale environment prefix', () => {
    expect(formatDocumentTitle('[TST] Dashboard', 'acceptance')).toBe('[ACC] Dashboard');
    expect(formatDocumentTitle('[ACC] Dashboard', 'production')).toBe('Dashboard');
    expect(formatDocumentTitle('[ACC] [TST] Dashboard', 'production')).toBe('Dashboard');
  });

  it('leaves unknown bracketed prefixes untouched', () => {
    expect(formatDocumentTitle('[Beta] Dashboard', 'production')).toBe('[Beta] Dashboard');
    expect(formatDocumentTitle('[Beta] Dashboard', 'acceptance')).toBe('[ACC] [Beta] Dashboard');
  });

  it('property: formatting twice equals formatting once', () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...ENVIRONMENTS), (title, env) => {
        const once = formatDocumentTitle(title, env);
        expect(formatDocumentTitle(once, env)).toBe(once);
      }),
    );
    // Bias towards prefix-shaped input, which plain random strings rarely hit.
    const prefixed = fc
      .tuple(fc.array(fc.constantFrom('[ACC]', '[TST]', '[Beta]', ' ', '  ')), fc.string())
      .map(([parts, rest]) => parts.join('') + rest);
    fc.assert(
      fc.property(prefixed, fc.constantFrom(...ENVIRONMENTS), (title, env) => {
        const once = formatDocumentTitle(title, env);
        expect(formatDocumentTitle(once, env)).toBe(once);
      }),
    );
  });
});

describe('getIconHref', () => {
  it.each([
    ['/favicon.svg', 'production', '/favicon.svg'],
    ['/favicon.svg', 'acceptance', '/favicon-acc.svg'],
    ['/favicon.svg', 'development', '/favicon-dev.svg'],
    ['/favicon.ico', 'production', '/favicon.ico'],
    ['/favicon.ico', 'acceptance', '/favicon-acc.ico'],
    ['/favicon.ico', 'development', '/favicon-dev.ico'],
    ['/apple-touch-icon.png', 'production', '/apple-touch-icon.png'],
    ['/apple-touch-icon.png', 'acceptance', '/apple-touch-icon-acc.png'],
    ['/apple-touch-icon.png', 'development', '/apple-touch-icon-dev.png'],
    ['/favicon-dev.svg', 'acceptance', '/favicon-acc.svg'],
    ['/apple-touch-icon-acc.png', 'production', '/apple-touch-icon.png'],
  ] as const)('%s under %s → %s', (href, env, expected) => {
    expect(getIconHref(href, env)).toBe(expected);
  });

  it.each(['/logo.svg', '/favicon.png', 'https://cdn.example.com/favicon.svg', ''])(
    'leaves unknown href %j unchanged',
    (href) => {
      for (const env of ENVIRONMENTS) {
        expect(getIconHref(href, env)).toBe(href);
      }
    },
  );
});

describe('applyEnvironmentBranding', () => {
  it('applies ACC title and icons on the acceptance hostname', () => {
    const doc = buildDocument();
    expect(applyEnvironmentBranding(doc, 'acc.armouredsouls.com')).toBe('acceptance');
    expect(doc.title).toBe('[ACC] Armoured Souls');
    expect(iconHrefs(doc)).toEqual(['/favicon-acc.ico', '/favicon-acc.svg', '/apple-touch-icon-acc.png']);
  });

  it('leaves title and icons unchanged on the production hostname', () => {
    const doc = buildDocument();
    expect(applyEnvironmentBranding(doc, 'armouredsouls.com')).toBe('production');
    expect(doc.title).toBe('Armoured Souls');
    expect(iconHrefs(doc)).toEqual(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']);
  });

  it('applies TST title and icons on localhost', () => {
    const doc = buildDocument();
    expect(applyEnvironmentBranding(doc, 'localhost')).toBe('development');
    expect(doc.title).toBe('[TST] Armoured Souls');
    expect(iconHrefs(doc)).toEqual(['/favicon-dev.ico', '/favicon-dev.svg', '/apple-touch-icon-dev.png']);
  });

  it('never creates blob: URLs', () => {
    const doc = buildDocument();
    applyEnvironmentBranding(doc, 'acc.armouredsouls.com');
    expect(iconHrefs(doc).some((href) => href.startsWith('blob:'))).toBe(false);
  });
});
