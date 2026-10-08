// Optional browser QA; Playwright is a development tool, never a site dependency.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.APPEARANCE_BASE_URL || 'http://127.0.0.1:4317';
const output = process.env.APPEARANCE_REVIEW_DIR || join(tmpdir(), 'terranode-appearance-review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const key = 'terranode.appearance';
const pages = ['index.html', 'atithi.html', 'jay-etobicoke.html', 'jay-windsor.html', 'jimmy-johns.html', 'start.html', 'change-request.html', 'trade-partner.html'];
const report = { checks: [], contrastFailures: [], layoutFailures: [], scriptErrors: [], externalRequests: [], screenshots: [] };
async function context(options = {}) {
  const c = await browser.newContext({ reducedMotion: 'reduce', ...options });
  // Never send test inquiries or fetch third-party resources.
  await c.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(base).origin) return route.continue();
    report.externalRequests.push(u.origin + u.pathname);
    return route.abort();
  });
  c.on('page', page => page.on('pageerror', e => report.scriptErrors.push(e.message)));
  return c;
}
async function state(page, theme, choice) {
  await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme);
  assert.equal(await page.locator('[data-appearance]').inputValue(), choice);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme);
}
async function choose(page, choice) {
  const select = page.locator('[data-appearance]');
  if (!await select.isVisible()) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await select.selectOption(choice);
}
async function screenshot(page, name, fullPage = false) {
  if (fullPage) {
    await page.evaluate(async () => {
      await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode(); }));
    });
  }
  await page.screenshot({ path: join(output, name + '.png'), fullPage });
  report.screenshots.push(name + '.png');
}
try {
  for (const width of [390, 1440]) {
    const c = await context({ viewport: { width, height: 900 }, colorScheme: 'dark' });
    const page = await c.newPage();
    await page.goto(base);
    await state(page, 'dark', 'system');
    await page.emulateMedia({ colorScheme: 'light' });
    await state(page, 'light', 'system');
    await choose(page, 'dark');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), key), 'dark');
    await page.reload();
    await state(page, 'dark', 'dark');
    await page.goto(base + '/start.html');
    await state(page, 'dark', 'dark');
    await page.emulateMedia({ colorScheme: 'dark' });
    await choose(page, 'light');
    await state(page, 'light', 'light');
    await page.reload();
    await state(page, 'light', 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await state(page, 'light', 'light');
    const other = await c.newPage();
    await other.goto(base + '/atithi.html');
    await state(other, 'light', 'light');
    await choose(page, 'dark');
    await state(other, 'dark', 'dark');
    await choose(page, 'system');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
    await state(page, 'dark', 'system');
    await page.emulateMedia({ colorScheme: 'light' });
    await state(page, 'light', 'system');
    report.checks.push(`${width}px: System changes, explicit choices, reload/navigation persistence, return to System, cross-tab sync`);
    await c.close();
  }

  // Paint-time snapshots with the shared handler deliberately delayed. The
  // inline bootstrap must already have applied a stored preference.
  for (const file of ['index.html', 'atithi.html', 'start.html']) for (const choice of ['light', 'dark']) {
    const c = await context({ colorScheme: choice === 'dark' ? 'light' : 'dark' });
    await c.addInitScript(({ key, choice }) => {
      if (!location.protocol.startsWith('http')) return;
      localStorage.setItem(key, choice);
      window.themePaints = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.themePaints.push({ name: entry.name, theme: document.documentElement.dataset.theme, background: getComputedStyle(document.documentElement).backgroundColor });
      }).observe({ type: 'paint', buffered: true });
    }, { key, choice });
    await c.route('**/appearance.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 700));
      await route.continue();
    });
    const page = await c.newPage();
    await page.goto(base + '/' + file);
    await page.waitForFunction(() => window.themePaints.length > 0);
    const paints = await page.evaluate(() => window.themePaints);
    for (const p of paints) {
      assert.equal(p.theme, choice);
      assert.equal(p.background, choice === 'dark' ? 'rgb(24, 37, 31)' : 'rgb(245, 242, 233)');
    }
    report.checks.push(`${file} ${choice}: correct first paint with opposite device preference and delayed shared script`);
    await c.close();
  }

  for (const mode of ['blocked', 'invalid']) {
    const c = await context({ colorScheme: 'dark' });
    await c.addInitScript(({ key, mode }) => {
      if (!location.protocol.startsWith('http')) return;
      if (mode === 'invalid') localStorage.setItem(key, 'unexpected');
      else for (const method of ['getItem', 'setItem', 'removeItem']) Storage.prototype[method] = () => { throw new DOMException('Disabled', 'SecurityError'); };
    }, { key, mode });
    const page = await c.newPage();
    await page.goto(base);
    await state(page, 'dark', 'system');
    await choose(page, 'light');
    await state(page, 'light', 'light');
    await choose(page, 'system');
    await state(page, 'dark', 'system');
    report.checks.push(`${mode} storage: usable selector and device fallback`);
    await c.close();
  }

  for (const theme of ['light', 'dark']) {
    const c = await context({ javaScriptEnabled: false, colorScheme: theme });
    const page = await c.newPage();
    await page.goto(base);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), theme === 'dark' ? 'rgb(24, 37, 31)' : 'rgb(245, 242, 233)');
    assert.equal(await page.locator('.brand-logo-' + theme).isVisible(), true);
    assert.equal(await page.locator('[data-appearance]').isVisible(), false);
    report.checks.push(`${theme}: device fallback and correct logo without JavaScript`);
    await c.close();
  }

  // Actual computed text/background contrast, excluding text over photographs
  // and gradients, which is covered by visual inspection.
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
    const c = await context({ viewport: { width, height: 900 }, colorScheme: theme });
    const page = await c.newPage();
    for (const file of pages) {
      await page.goto(base + '/' + file);
      await state(page, theme, 'system');
      const qa = await page.evaluate(() => {
        const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = rgb => rgb.slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const failures = [];
        const probe = document.createElement('span');
        document.body.append(probe);
        const token = name => { probe.style.color = `var(${name})`; return parse(getComputedStyle(probe).color); };
        for (const [foreground, background, minimum] of [
          ['--text', '--surface', 4.5], ['--ink-soft', '--surface', 4.5],
          ['--ink-soft', '--surface-soft', 4.5], ['--emphasis-muted', '--surface-emphasis', 4.5],
          ['--emphasis-link', '--surface-emphasis', 4.5], ['--on-action', '--clay-action', 4.5],
          ['--on-action', '--action-hover', 4.5], ['--control-line', '--surface', 3],
          ['--control-line', '--surface-soft', 3], ['--focus', '--surface', 3],
          ['--focus', '--surface-soft', 3], ['--focus', '--surface-emphasis', 3],
          ['--placeholder', '--surface', 4.5], ['--placeholder', '--error-surface', 4.5],
          ['--error', '--error-surface', 3], ['--text', '--error-surface', 4.5],
          ['--inverse-line', '--inverse-surface', 3]
        ]) {
          const r = ratio(token(foreground), token(background));
          if (r < minimum) failures.push({ element: `${foreground} on ${background}`, ratio: +r.toFixed(2), minimum });
        }
        probe.remove();
        for (const el of document.querySelectorAll('body *')) {
          if (!el.checkVisibility() || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || ['SCRIPT', 'OPTION', 'STYLE'].includes(el.tagName)) continue;
          let current = el, background;
          while (current) {
            const cs = getComputedStyle(current);
            if (cs.backgroundImage !== 'none') break;
            const bg = parse(cs.backgroundColor);
            if ((bg[3] ?? 1) === 1) { background = bg; break; }
            current = current.parentElement;
          }
          if (!background) continue;
          const cs = getComputedStyle(el), large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700);
          const r = ratio(parse(cs.color), background), minimum = large ? 3 : 4.5;
          if (r < minimum) failures.push({ element: el.tagName + '.' + el.className, text: el.textContent.trim().slice(0, 65), ratio: +r.toFixed(2), minimum });
        }
        return { failures, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      report.contrastFailures.push(...qa.failures.map(f => ({ file, width, theme, ...f })));
      if (qa.overflow) report.layoutFailures.push({ file, width, theme });
      assert.equal(await page.locator('.brand-logo-' + theme).isVisible(), true);
      if (['index.html', 'start.html', 'atithi.html'].includes(file)) await screenshot(page, `${file.replace('.html', '')}-${theme}-${width}`, file === 'index.html' && width === 1440);
      if (['start.html', 'change-request.html', 'trade-partner.html'].includes(file)) {
        // Native invalid-form handling: nothing is submitted.
        await page.locator('button[type="submit"]').click();
        assert.equal(await page.locator('.field :user-invalid').count() > 0, true);
        const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle, invalid: !document.activeElement.validity.valid }));
        assert.equal(focused.invalid, true);
        assert.notEqual(focused.outline, 'none');
        if (file === 'start.html') await screenshot(page, `form-errors-${theme}-${width}`);
      }
      if (file === 'atithi.html') {
        await page.locator('[data-gallery]').first().click();
        assert.equal(await page.locator('.photo-dialog').isVisible(), true);
        await screenshot(page, `photo-viewer-${theme}-${width}`);
        await page.keyboard.press('Escape');
      }
    }
    // Check selector keyboard operation in the real navigation.
    await page.goto(base);
    if (width === 390) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByLabel('Appearance', { exact: true }).focus();
    assert.equal(await page.locator('[data-appearance]').evaluate(el => el.matches(':focus-visible')), true);
    await page.keyboard.press('l');
    await page.keyboard.press('Tab');
    await state(page, 'light', 'light');
    await page.getByLabel('Appearance', { exact: true }).focus();
    await screenshot(page, `selector-focus-${theme}-${width}`);
    report.checks.push(`${width}px ${theme}: all eight pages, logo, forms/errors, photo viewer, keyboard selector`);
    await c.close();
  }
  // Extra header boundary widths to catch collisions between links and selector.
  for (const width of [320, 760, 761, 800, 1024]) {
    const c = await context({ viewport: { width, height: 900 } });
    const page = await c.newPage();
    await page.goto(base);
    if (width <= 760) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) report.layoutFailures.push({ file: 'index.html', width, theme: 'light' });
    await screenshot(page, `header-${width}`);
    await c.close();
  }
  await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(report.scriptErrors, [], 'No browser script errors');
  assert.deepEqual(report.externalRequests, [], 'No third-party requests or submissions');
  assert.deepEqual(report.layoutFailures, [], 'No horizontal overflow');
  assert.deepEqual(report.contrastFailures, [], 'Rendered text contrast meets AA');
  console.log(JSON.stringify({ status: 'PASS', checks: report.checks, screenshots: report.screenshots.length, output }, null, 2));
} finally { await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
