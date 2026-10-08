# Terranode navigation handover

The desktop header presents Projects, Services and About as direct routes, followed by a prominent Start a conversation action and the existing appearance selector. On compact screens (up to 1280 CSS pixels), the header uses a full-height menu panel below the sticky brand bar. The panel uses a short opacity/position transition and shows the same four routes without adding another menu level. At 200% text, the compact presentation also prevents the desktop links from overflowing near the breakpoint.

The menu button changes its visible name between Menu and Close and keeps `aria-expanded` in sync. Opening the panel focuses the first route, makes page content inert, and locks background scrolling. Tab stays in the header and panel. Escape and the Close button return focus to the button. Choosing a section on the same page closes the panel and focuses that section; links to another page navigate normally. Resizing between compact and desktop layouts resets the panel cleanly. With JavaScript unavailable, the routes remain visible in the document.

The existing System / Light / Dark selector stays in the menu. The panel uses semantic surface, text, border and action colours from `styles.css`. Reduced-motion visitors see the panel immediately without transitions. The inquiry pages and their form actions are unchanged.

## Checks completed

- All eight pages in local Chrome: open, Escape, focus restoration, inert background, no script errors.
- Mobile: scroll position held while open, keyboard focus loop, selector remains usable, same-page and cross-page navigation.
- Desktop: routes visible and no horizontal overflow at 1281px and 1440px in light and dark themes.
- 200% text at 320px, 390px, 1280px and the first desktop width of 1281px: menu or header fits, inquiry action reachable.
- Reduced motion: no opening transition. JavaScript disabled: visible navigation fallback.
- Existing site check passes. All eight pages were compared with the merged base; their body content, metadata, forms and footer are unchanged outside the header and an early navigation class.

Physical mobile devices, Safari, Firefox and screen-reader speech were not directly tested. This branch is ready for review; the live site updates after merge and the hosting deployment.
