# Opening photo motion

Added 2026-10-11 to the approved Raju Omelet Albion opening photograph.

When the photo first enters the viewport, it gently settles from 103.5% to its normal size, with a small opacity change from 92% to 100% over 1.4 seconds. It runs once per page visit. The caption and brand stamp stay still, and the fixed image frame prevents layout movement.

The enhancement starts after the image loads. The photograph remains visible by default if JavaScript or IntersectionObserver is unavailable. Reduced-motion preferences prevent the effect; the existing reduced-motion CSS also cancels it if the preference changes during playback. There is no looping, parallax, hover zoom or added library.

Changes are limited to the shared stylesheet, a homepage-only enhancement in script.js and this note. The approved photographs, captions, themes, navigation and inquiry routes are preserved. Implementation was reviewed in the source diff; automated tests were not run for this focused motion request.

Merge the repository proposal into main for the connected Render deployment. Saving the proposal is not confirmation of live publication.
