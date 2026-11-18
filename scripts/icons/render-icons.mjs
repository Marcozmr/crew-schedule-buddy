#!/usr/bin/env node
/**
 * Gera todos os ícones do EscalaX a partir do desenho "Órbita"
 * (docs/superpowers/specs/2026-11-18-visual-verde-amarelo-design.md, seção 5).
 *
 * Uso: node scripts/icons/render-icons.mjs
 * Renderiza com o Microsoft Edge instalado (Playwright, channel "msedge").
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PLANE =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';

/** Avião + órbita + ponto, centrado em (256,256), com escala em torno do centro. */
function mark(scale = 1) {
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
  <circle cx="256" cy="256" r="150" fill="#FFFFFF" fill-opacity="0.08"/>
  <path d="M56 256 A200 84 0 0 1 456 256" fill="none" stroke="#FACC15" stroke-width="16" stroke-linecap="round" transform="rotate(-28 256 256)"/>
  <g transform="translate(143 140) scale(9.2)"><path d="${PLANE}" fill="#FFFFFF" stroke="#17803F" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke"/></g>
  <path d="M56 256 A200 84 0 0 0 456 256" fill="none" stroke="#FACC15" stroke-width="16" stroke-linecap="round" transform="rotate(-28 256 256)"/>
  <circle cx="432" cy="162" r="24" fill="#FACC15"/>
</g>`;
}

const GRADIENT = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22A35A"/><stop offset="1" stop-color="#0F5B2E"/></linearGradient></defs>`;

/** background: 'rounded' (cantos 116), 'full' (quadrado cheio), 'circle' ou 'none' (transparente). */
function svg({ background, scale = 1 }) {
  const bg =
    background === 'rounded'
      ? '<rect width="512" height="512" rx="116" fill="url(#g)"/>'
      : background === 'full'
        ? '<rect width="512" height="512" fill="url(#g)"/>'
        : background === 'circle'
          ? '<circle cx="256" cy="256" r="256" fill="url(#g)"/>'
          : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${GRADIENT}${bg}${mark(scale)}</svg>`;
}

const RES = 'android/app/src/main/res';
const DENSITIES = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

const JOBS = [
  ['public/escalax-icon.png', 512, { background: 'rounded' }],
  ['public/escalax-maskable.png', 512, { background: 'full', scale: 0.85 }],
  ['public/apple-touch-icon.png', 180, { background: 'full' }],
  ['public/favicon.png', 64, { background: 'rounded' }],
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, { background: 'full' }],
  ...DENSITIES.flatMap(([d, legacy, fg]) => [
    [`${RES}/mipmap-${d}/ic_launcher.png`, legacy, { background: 'rounded' }],
    [`${RES}/mipmap-${d}/ic_launcher_round.png`, legacy, { background: 'circle' }],
    // Frente do ícone adaptativo: área segura de 66 dp em 108 dp.
    [`${RES}/mipmap-${d}/ic_launcher_foreground.png`, fg, { background: 'none', scale: 0.7 }],
  ]),
];

writeFileSync(resolve(ROOT, 'public/escalax-logo.svg'), svg({ background: 'rounded' }) + '\n');

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
for (const [out, size, opts] of JOBS) {
  await page.setViewportSize({ width: size, height: size });
  const body = svg(opts).replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${body}</body></html>`);
  const file = resolve(ROOT, out);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`${out} (${size}px)`);
}
await browser.close();
