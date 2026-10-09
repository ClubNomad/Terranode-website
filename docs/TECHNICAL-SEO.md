# Terranode technical SEO review

Reviewed 2026-10-08 against the merged site and live `https://terranode.ca/`.

## Search signals

- Each of the eight HTML pages has one descriptive title, one search description, one H1 and a self-referencing canonical URL. The homepage canonical is `https://terranode.ca/`; `/index.html` points to it.
- Project search descriptions identify the work as prior experience completed under LifeBuild Canada. Their on-page descriptions already make that attribution. No new credentials or service areas were added.
- The three public intake pages have distinct search descriptions. The existing-project change request is marked `noindex, follow` because it is a utility route for current clients. It remains available via the website's links. The public project enquiry and trade partner pages remain indexable.
- `robots.txt` permits crawling and names the sitemap. `sitemap.xml` lists the seven indexable pages and omits the client change request.
- The homepage includes JSON-LD Organization and WebSite data using the verified name, site, email address and existing logo asset. No LocalBusiness address, rating or review data is claimed.
- Existing Open Graph and Twitter metadata is unchanged.

## Validation completed

- Before these edits, the live homepage returned 200; `www.terranode.ca` redirected to `terranode.ca`; the live `robots.txt` and `sitemap.xml` returned 404. The referenced logo PNG returned 200.
- The existing site checker passes, including canonical, sitemap, indexing and organization assertions. All internal links and assets checked locally. Sitemap XML and JSON-LD parse successfully. Each page has exactly one H1. Social metadata matches the previous version byte-for-byte.
- These edits are saved in source and have not yet been verified on the public domain.

## After publication

- Confirm `/robots.txt` and `/sitemap.xml` return 200 and canonical/robots tags appear in the delivered HTML without JavaScript.
- In Google Search Console, verify domain ownership, submit the sitemap, inspect representative public URLs and the `noindex` change-request URL, and review indexing exclusions and Google-selected canonicals. Search Console access was unavailable for this review.
- Run Google's Rich Results Test or URL Inspection on the published homepage to confirm that the structured data is accessible to its crawler. Valid markup does not guarantee a particular search feature or ranking.
