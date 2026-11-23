// Exports the Tada line illustrations (cut from the designer's mural, see js/art-data.js on the site)
// as standalone SVGs that take their color from CSS (currentColor). Run: node scripts/export-art.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../../../js/art-data.js'), 'utf8');
const art = JSON.parse(src.match(/const TADA_ART = (\{.*?\});/s)[1]);
const keep = ['hand', 'glass', 'glass2', 'leaf', 'cup', 'coffeeCup', 'icedCup', 'croissant', 'cookie', 'cookies', 'biscuit', 'beans',
  'kettle', 'espresso', 'grinder', 'teapot', 'lemon', 'lemonArch', 'citrus', 'pear', 'pitaya', 'scooter', 'map', 'sun', 'hat', 'notes', 'palm', 'wheat', 'arch'];
const SW = 9.85;
for (const key of keep) {
  const a = art[key];
  if (!a) continue;
  const [x, y, w, h] = a.vb;
  const pad = SW;
  const paths = a.p.map(([d, kind, wf]) => kind === 1
    ? `<path d="${d}" fill="currentColor"/>`
    : `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${(SW * (wf || 1)).toFixed(2)}" stroke-linejoin="miter" stroke-miterlimit="4"/>`).join('');
  writeFileSync(resolve(here, `../public/art/${key}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}" aria-hidden="true">${paths}</svg>\n`);
}
console.log('exported', keep.filter((k) => art[k]).length, 'illustrations');
