/**
 * Deterministic favicon generator (issue #174).
 *
 * Writes the favicon set for every environment into `public/`:
 *   favicon{suffix}.svg            primary icon (rounded-square background)
 *   favicon{suffix}.ico            16/32/48 PNG frames (legacy + implicit /favicon.ico probe)
 *   apple-touch-icon{suffix}.png   180x180, opaque, full bleed (iOS rounds the corners)
 *
 * Suffixes: production '', acceptance '-acc', development '-dev'.
 * The runtime picks the variant in `src/utils/environment-branding.ts`.
 *
 * The geometry is the Direction D mark from docs/design_ux/3_brand_usage_system.md.
 * Rasterisation uses the existing Playwright Chromium dev dependency, so no new
 * packages are needed. Outputs are committed; re-running must produce no git diff.
 *
 * Usage: pnpm run icons:generate
 */
import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';

type Variant = 'production' | 'acceptance' | 'development';
type Shape = 'favicon' | 'touch';

interface Palette {
  background: string;
  shield: string;
  inner: string;
  accent: string;
}

interface IcoFrame {
  size: number;
  data: Buffer;
}

const VARIANTS: readonly Variant[] = ['production', 'acceptance', 'development'];

const PALETTES: Record<Variant, Palette> = {
  production: { background: '#0a0e14', shield: '#e6edf3', inner: '#0a0e14', accent: '#58a6ff' },
  acceptance: { background: '#d29922', shield: '#0a0e14', inner: '#d29922', accent: '#0a0e14' },
  development: { background: '#3fb950', shield: '#0a0e14', inner: '#3fb950', accent: '#0a0e14' },
};

const SUFFIXES: Record<Variant, string> = {
  production: '',
  acceptance: '-acc',
  development: '-dev',
};

const TITLES: Record<Variant, string> = {
  production: 'Armoured Souls',
  acceptance: 'Armoured Souls (ACC)',
  development: 'Armoured Souls (TST)',
};

const ICO_SIZES: readonly number[] = [16, 32, 48];
const TOUCH_SIZE = 180;

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Builds the SVG for one variant. Attribute order and line endings are fixed. */
function buildIconSvg(variant: Variant, shape: Shape): string {
  const p = PALETTES[variant];
  const background =
    shape === 'favicon'
      ? `<rect x="16" y="8" width="96" height="96" rx="20" fill="${p.background}"/>`
      : `<rect x="4" y="-4" width="120" height="120" fill="${p.background}"/>`;
  const viewBox = shape === 'favicon' ? '16 8 96 96' : '4 -4 120 120';
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="128" height="128" fill="none">`,
    `  <title>${TITLES[variant]}</title>`,
    `  ${background}`,
    `  <path d="M64 16L96 32V64C96 81.6731 81.6731 96 64 96C46.3269 96 32 81.6731 32 64V32L64 16Z" fill="${p.shield}" stroke="${p.shield}" stroke-width="2" stroke-linejoin="miter"/>`,
    `  <path d="M64 32L80 40V64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64V40L64 32Z" fill="${p.inner}" stroke="${p.shield}" stroke-width="1.5" stroke-linejoin="miter"/>`,
    `  <path d="M64 48L72 52V64C72 68.4183 68.4183 72 64 72C59.5817 72 56 68.4183 56 64V52L64 48Z" fill="${p.accent}" stroke-linejoin="miter"/>`,
    '</svg>',
  ];
  return `${lines.join('\n')}\n`;
}

/** Packs PNG frames into an ICO container (PNG-in-ICO, ascending size order). */
function buildIco(frames: readonly IcoFrame[]): Buffer {
  const sorted = [...frames].sort((a, b) => a.size - b.size);
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize + entrySize * sorted.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sorted.length, 4);
  let offset = header.length;
  sorted.forEach((frame, index) => {
    const base = headerSize + entrySize * index;
    header.writeUInt8(frame.size >= 256 ? 0 : frame.size, base); // width
    header.writeUInt8(frame.size >= 256 ? 0 : frame.size, base + 1); // height
    header.writeUInt8(0, base + 2); // colour count
    header.writeUInt8(0, base + 3); // reserved
    header.writeUInt16LE(1, base + 4); // planes
    header.writeUInt16LE(32, base + 6); // bits per pixel
    header.writeUInt32LE(frame.data.length, base + 8);
    header.writeUInt32LE(offset, base + 12);
    offset += frame.data.length;
  });
  return Buffer.concat([header, ...sorted.map((frame) => frame.data)]);
}

async function rasterise(browser: Browser, svg: string, size: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  try {
    const src = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><img id="icon" src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`,
    );
    await page.locator('#icon').evaluate((img: HTMLImageElement) => img.decode());
    return await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
  } finally {
    await page.close();
  }
}

async function writeOutput(fileName: string, data: string | Buffer): Promise<void> {
  const target = path.join(PUBLIC_DIR, fileName);
  await writeFile(target, data);
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    for (const variant of VARIANTS) {
      const suffix = SUFFIXES[variant];
      const faviconSvg = buildIconSvg(variant, 'favicon');
      await writeOutput(`favicon${suffix}.svg`, faviconSvg);

      const frames: IcoFrame[] = [];
      for (const size of ICO_SIZES) {
        frames.push({ size, data: await rasterise(browser, faviconSvg, size) });
      }
      await writeOutput(`favicon${suffix}.ico`, buildIco(frames));

      const touchPng = await rasterise(browser, buildIconSvg(variant, 'touch'), TOUCH_SIZE);
      await writeOutput(`apple-touch-icon${suffix}.png`, touchPng);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error('Favicon generation failed:', error);
  process.exit(1);
});
