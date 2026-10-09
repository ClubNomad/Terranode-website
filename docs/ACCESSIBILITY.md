# Accessibility and responsive usability audit

This change targets WCAG 2.2 AA. It is not a conformance certification. The audit combined axe-core 4.14.0 with keyboard interaction, rendered layout inspection, form-validation checks, computed geometry and manual contrast assessment against the [W3C WCAG 2.2 criteria](https://www.w3.org/TR/WCAG22/).

## Issues found and repaired

- The compact menu inherited wrapping from an older layout. On a 320px-wide, 568px-high screen with 200% text, its contents wrapped into sideways columns. The panel now stays in one vertically scrolling column. The inquiry button wraps its wording, decorative route numbers/arrows are omitted at the narrowest width, and the logo can shrink so Close remains visible.
- Reopening a previously scrolled menu could focus an offscreen first route. Opening now resets the panel's scroll position. Native keyboard scrolling was checked: the header and Close remain visible, and Escape restores focus.
- A change-request label made its grid exceed 320px at 200% text. Shared grid children now allow shrinking, required/optional labels wrap, field rows collapse according to available width, and tablet intake pages use one column.
- The decorative footer word overflowed when text spacing increased. It now fits the available width. The functional brand logo and its accessible name are preserved.
- Sticky-header clearance was fixed at a value that did not account for enlarged text. Its measured height now sets anchor/focus clearance. The skip link lands on a programmatically focusable main region.
- Native browser error bubbles were temporary and the field styling depended on colour. All three forms now add persistent textual errors, associated descriptions and a focused summary linking to each invalid control. Invalid email and website formats have corrective guidance. Links also open collapsed optional sections when an invalid field is inside them. Native validation and the original form posting remain in place.
- The consent checkbox and optional-details toggle now have more comfortable targets. Photo captions use a dark backing and stack on narrow phones for readable text over photography.

The form status says to check Google's new confirmation tab. It does not claim that a response was accepted: the website cannot observe the external Google confirmation. No new success page or submission transport was introduced.

## Verification

All eight pages were scanned in both themes, using WCAG A/AA tags through 2.2 plus best-practice rules. The closed-page scans flagged no A/AA violations. Each public form's error state and the photo viewer were also scanned in both themes with no flagged A/AA violations. The open menu produced document-level best-practice reports for a missing main landmark and H1 because the background is intentionally inert; these are recorded as contextual reports, not removed by adding duplicate landmarks inside navigation.

Axe could not evaluate the homepage caption against the photograph. Manual compositing against the brightest possible underlying pixel gave a worst-case contrast of 12.43:1 for white text and 10.40:1 for its slightly transparent supporting text. Both exceed 4.5:1. Image alternatives, headings, labels, control names, source order and link purposes were inspected; existing descriptions were retained.

The homepage, a project profile and all three forms were checked at 320, 390, 768, 1024 and 1440 CSS pixels, at normal and 200% text size (50 layouts). Increased line height, paragraph, letter and word spacing was checked at 320, 768 and 1440px. The 320px layouts also cover the reflow width equivalent to 400% zoom on a 1280px desktop viewport. Short-screen menu and viewer checks used 320×568px. This is viewport/text-size simulation, not physical-device testing.

Manual/browser checks covered skip navigation, keyboard order and visible focus, menu focus containment and reopening, Escape/restoration, gallery arrows, collapsed details, validation repair, reduced-motion rules and focus clearance beneath the sticky header. Valid-submit tests were intercepted before sending: all original Google actions, POST methods, new-tab targets and field names were preserved, and the enhancement did not prevent a valid native submit. No inquiries, customer emails or notifications were generated. Existing site checks and JavaScript syntax checks pass.

## Limits and next checks

Physical iOS/Android devices, Safari, Firefox and screen-reader speech were not directly tested. Google’s external confirmation/acceptance page and backend receipt were not tested with a real submission; that end-to-end inquiry workflow remains a separate check. Automated results do not establish WCAG compliance. No larger redesign was needed for the defects found.

## Saved files

Eight page files add a skip destination; the three intake pages also load `form-accessibility.js`. Shared repairs are in `styles.css` and `script.js`. The site check includes syntax validation of the form enhancement and an updated core-file size allowance. `accessibility-checks.json` preserves audit results. Branding assets, page copy, social metadata, form field names and submission destinations are unchanged.
