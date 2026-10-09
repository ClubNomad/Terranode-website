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
assert.equal(files.length, 8, 'Homepage, four projects and three contact pages');
for (const html of Object.values(pages)) assert.ok(!/chatgpt|openai|siwc/i.test(html), 'Pages have no ChatGPT runtime requirement');
for (const [file, html] of Object.entries(pages)) {
  if (file === 'index.html' || file === 'start.html' || projects.some(p => file === p.key + '.html')) {
    assert.ok(html.includes('mailto:info@terranode.ca?subject=Terranode%20project%20enquiry'), `${file}: company email route`);
  }
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
  assert.ok(html.includes('href="favicon.svg"'), `${file}: small-screen brand icon`);
  assert.ok(!html.includes('<iframe'), `${file}: no embedded form`);
  assert.ok(!html.includes('data-reveal'), `${file}: no scroll reveal`);
  assert.ok(!/spreadsheets\/d\/|drive\.google\.com|forms\/d\/(?!e\/)/.test(html), `${file}: no internal editor links`);
  assert.ok(!/Splice|Splyce|Nodera|Hypha|Neuron|Ontario-only|Ushaben|Amar Soni|Hans Sathavara|Sonia Soni|Minna Beliveau|Jack reacher|400\+|12\+/.test(html), `${file}: no obsolete or unverified claims`);
  if (file === 'index.html' || projects.some(p => file === p.key + '.html')) {
    assert.ok(html.includes('Completed under LifeBuild Canada.'), `${file}: historical attribution`);
  }
}
for (const file of ['start.html', 'change-request.html', 'trade-partner.html']) {
  const html = pages[file];
  assert.ok(/<form[^>]+action="https:\/\/docs\.google\.com\/forms\/d\/e\/[^"]+\/formResponse"[^>]+method="post"/.test(html), `${file}: published form destination`);
  assert.ok(html.includes('target="_blank"') && html.includes('rel="noopener"'), `${file}: confirmation opens safely`);
  assert.ok(html.includes('type="submit"') && html.includes('required'), `${file}: usable form`);
}
for (const file of ['index.html', ...projects.map(p => p.key+'.html')]) {
  for (const route of ['start.html','change-request.html','trade-partner.html']) {
    assert.ok(pages[file].includes('href="'+route+'"'), `${file}: route to ${route}`);
  }
}
assert.ok(!pages['index.html'].includes('welcome-'), 'Homepage uses real photography');
assert.ok(pages['index.html'].includes('assets/jay-etobicoke-1-1600.jpg'), 'Completed-work hero');
assert.ok(pages['index.html'].includes('Terranode designs, plans and builds.'), 'Immediate design, planning and construction positioning');
assert.ok(pages['index.html'].includes('Selected completed work') && pages['index.html'].includes('Shown here as prior project experience'), 'Portfolio presented as prior completed work');
assert.ok(pages['index.html'].includes('Commercial kitchen built for Jay Bhavani Etobicoke'), 'Homepage includes construction evidence');
assert.ok(!pages['index.html'].includes('Studio detail / Club Nomad'), 'Homepage uses project photography in the closing invitation');
for (const p of projects) assert.ok(pages[p.key+'.html'].includes('Shown here as prior project experience'), `${p.key}: clear historical attribution`);
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
execFileSync(process.execPath,['--check',resolve(dist,'form-accessibility.js')]);
const sourceBytes=['index.html','styles.css','script.js','appearance.js'].reduce((n,f)=>n+statSync(resolve(dist,f)).size,0);
assert.ok(sourceBytes<64000,'Homepage HTML, shared CSS and core JS under 64 KB');
console.log(`PASS: eight pages, cross-page links, assets, three native form routes, historical attribution, source-tracked photographs, brand and JS syntax. Homepage/shared core: ${sourceBytes} bytes.`);
