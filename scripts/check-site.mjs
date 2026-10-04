import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const files = readdirSync(dist).filter(f => f.endsWith('.html'));
const pages = Object.fromEntries(files.map(f => [f, readFileSync(resolve(dist, f), 'utf8')]));
const idsFor = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const manifestPath = resolve(root, '.openai/hosting.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const projects = JSON.parse(readFileSync(resolve(root, 'projects.json'), 'utf8'));
const sources = JSON.parse(readFileSync(resolve(root, 'project-sources.json'), 'utf8'));
if (manifest) assert.equal(manifest.static.directory, 'dist');
assert.equal(files.length, 5, 'Homepage and four project profiles');
for (const html of Object.values(pages)) assert.ok(!/chatgpt|openai|siwc/i.test(html), 'Pages have no ChatGPT runtime requirement');
for (const [file, html] of Object.entries(pages)) {
  assert.ok(html.includes('mailto:info@terranode.ca?subject=Terranode%20project%20enquiry'), `${file}: company email route`);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${file}: exactly one page heading`);
  const ids = idsFor(html);
  assert.equal(ids.length, new Set(ids).size, `${file}: unique IDs`);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (url === '#') continue;
    if (url.startsWith('mailto:')) {
      assert.equal(url, 'mailto:info@terranode.ca?subject=Terranode%20project%20enquiry', `${file}: correct enquiry email`);
      continue;
    }
    if (url.startsWith('https://')) {
      assert.ok(url.startsWith('https://docs.google.com/forms/d/e/'), `${file}: unexpected external URL ${url}`);
      continue;
    }
    const [asset, fragment] = url.split('#');
    if (asset) assert.ok(existsSync(resolve(dist, asset)), `${file}: missing asset ${url}`);
    if (fragment) assert.ok(idsFor(pages[asset || file]).includes(fragment), `${file}: missing anchor ${url}`);
  }
  for (const [, set] of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const variant of set.split(',')) assert.ok(existsSync(resolve(dist,variant.trim().split(' ')[0])), `Missing responsive image: ${variant}`);
  }
  for (const [, tag] of html.matchAll(/(<img\s[^>]+>)/g)) {
    assert.ok(/alt="[^"]*"/.test(tag), `${file}: image alt`);
    assert.ok(/width="\d+"/.test(tag) && /height="\d+"/.test(tag), `${file}: image dimensions`);
  }
  const links = [...html.matchAll(/data-form="(enquiry|change|vendor)" href="([^"]+)"/g)];
  assert.equal(new Set(links.map(m=>m[1])).size,3, `${file}: three form routes`);
  assert.equal(new Set(links.map(m=>m[2])).size,3, `${file}: consistent form destinations`);
  assert.ok(!/spreadsheets\/d\/|drive\.google\.com|forms\/d\/(?!e\/)/.test(html), `${file}: no internal editor links`);
  assert.ok(!/Splice|Splyce|Nodera|Hypha|Neuron|Ontario-only|Ushaben|Amar Soni|Hans Sathavara|Sonia Soni|Minna Beliveau|Jack reacher|400\+|12\+/.test(html), `${file}: no obsolete or unverified claims`);
  assert.ok(html.includes('Completed under LifeBuild Canada.'), `${file}: historical attribution`);
}
assert.ok(!pages['index.html'].includes('welcome-'), 'Homepage uses real photography');
assert.ok(pages['index.html'].includes('assets/jay-windsor-2-1600.jpg'), 'Completed-work hero');
assert.ok(pages['index.html'].includes('id="dipesh-name">Dipesh</h3>') && pages['index.html'].includes('id="manjil-name">Manjil</h3>'), 'Both current people introduced');
assert.equal((pages['index.html'].match(/class="director-title"/g)||[]).length,2,'Both people identified as Directors');
for (const p of projects) assert.ok(pages[p.key+'.html'].includes(p.name), `${p.key}: named project page`);
for (const image of sources.images) {
  assert.ok(existsSync(resolve(dist,image.file)), `Source-tracked image missing ${image.file}`);
  assert.ok(image.source_page.startsWith('https://lifebuildcanada.ca/'), 'Documented source page');
  assert.ok(image.source_image.startsWith('https://lifebuildcanada.ca/wp-content/uploads/'), 'Original photograph source');
}
const css = readFileSync(resolve(dist,'styles.css'),'utf8');
assert.ok(css.includes('prefers-reduced-motion') && css.includes(':focus-visible'), 'Motion and focus support');
assert.ok(css.includes('--clay:#b66a4e') && css.includes('background:var(--clay-action)'), 'Rustic orange in the design system');
for (const file of readdirSync(resolve(dist,'assets'))) assert.ok(statSync(resolve(dist,'assets',file)).size<400000, `Image budget ${file}`);
execFileSync(process.execPath,['--check',resolve(dist,'script.js')]);
const sourceBytes=['index.html','styles.css','script.js'].reduce((n,f)=>n+statSync(resolve(dist,f)).size,0);
assert.ok(sourceBytes<50000,'Homepage HTML, shared CSS and JS under 50 KB');
console.log(`PASS: five pages, cross-page links, anchors, assets, three public form routes, two current people, historical attribution, source-tracked photographs, brand and JS syntax. Homepage/shared core: ${sourceBytes} bytes.`);
