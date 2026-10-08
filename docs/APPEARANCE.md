# Terranode appearance options

Implemented against main commit `f2c65c388e761c328a64fa058aa4dfe5ae872042` (the approved social-card refresh), 8 October 2026.

## Visitor behaviour

The labelled Appearance selector offers System, Light and Dark in the existing navigation. On mobile it is inside Menu. System is the default and responds immediately to a device preference change. Light and Dark are remembered in localStorage under `terranode.appearance`; choosing System clears that override. Choices also synchronize between open tabs. When storage is blocked, the selector still works on the current page. Without JavaScript, CSS follows the device and hides the unavailable selector.

A small identical inline bootstrap in each HTML head reads the preference before styles and page content render. `appearance.js` then handles the selector and preference changes. `color-scheme` and browser theme-colour metadata follow the resolved appearance. There are no new runtime dependencies or requests to external services.

## Shared design rules

Use the semantic tokens at the top of `dist/styles.css` for new components:

- `--surface`, `--surface-soft`, `--surface-emphasis` for content backgrounds.
- `--text`, `--ink-soft`, `--clay-text` for text and links.
- `--clay-action`, `--on-action`, `--action-hover` for buttons.
- `--control-line`, `--placeholder`, `--focus`, `--error`, `--error-surface` for form controls and feedback.
- `--inverse-*` for intentionally dark sections and the photo viewer.
- `--emphasis-muted` and `--emphasis-link` retain readable text on the Sandstone invitation panel.

The Basalt, Chalk, Terracotta and Sandstone brand pigments stay fixed. The explicit dark-token block and the no-JavaScript media-query fallback use the same values. Keep those maps synchronized when adjusting the palette. The two initial browser surface colours in the inline bootstrap and `appearance.js` correspond to `--surface`.

`terranode-logo-dark.svg` preserves the exact geometry of the horizontal master, using light colours and a transparent background. CSS displays one logo at a time. Photographs retain their original colours and existing treatments.

Native invalid form controls use the shared error colours. Existing submission behaviour, form fields, menu mechanics, page content and social metadata are unchanged.

## Validation completed

- Existing site checks: all eight pages, assets, links, form destinations, syntax and content assertions pass. The homepage, shared CSS and both scripts total 50,726 bytes; the check now includes `appearance.js` and has a 52 KB budget.
- Browser tests: Chrome on macOS, desktop 1440 × 900 and mobile viewport 390 × 900, both themes on all eight pages.
- System/device changes, explicit choice persistence across reloads and navigation, switching back to System, and cross-tab synchronization pass.
- First-paint observations on the homepage, a project page and the inquiry page match saved Light/Dark choices even with the opposite device setting and the shared script delayed.
- Disabled JavaScript, blocked storage and invalid stored values have working fallbacks.
- Keyboard selection, visible focus, native validation on all three forms and photo-viewer appearance pass. No test data was submitted and no third-party requests were made.
- Text contrast is checked from rendered styles: at least 4.5:1 for ordinary text and 3:1 for large text. Control boundaries and focus colours meet 3:1 against their intended surfaces; placeholders, errors and button hover colours are also checked. Text over photos/gradients is inspected visually rather than claimed as exhaustively measured.
- Additional header layouts at 320, 760, 761, 800 and 1024 pixels have no horizontal overflow.
- Source comparison confirms unchanged main content, complete form markup, footer content and sharing metadata on every page. `dist/script.js` is unchanged.
- 29 screenshots captured; lazy photographs are loaded before full-page capture. Machine-readable results are in `appearance-checks.json`.

## Running the checks

Run `npm start` for the local preview, then `npm run check`. The optional `node scripts/check-appearance.mjs` browser suite needs Playwright in the development environment and a Chromium browser. `PLAYWRIGHT_MODULE` and `CHROME_PATH` can point to an existing installation; `APPEARANCE_BASE_URL` and `APPEARANCE_REVIEW_DIR` override the local URL and screenshot destination. Playwright is not a website dependency.

## Remaining limits

Safari, Firefox, physical iOS/Android devices and screen-reader speech have not been directly tested. The mobile checks are browser viewport simulations. Google's external form confirmation pages use Google's own appearance settings. Publication and testing on the deployed domain are pending the normal GitHub review/Render release step.

## Files

Eight `dist/*.html` pages, `dist/styles.css`, new `dist/appearance.js`, new `dist/terranode-logo-dark.svg`, `scripts/check-site.mjs`, new `scripts/check-appearance.mjs`, and this handover with its results JSON.
