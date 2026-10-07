# Terranode website

The Terranode Inc. design and construction website. Eight pages, local photography, SVG brand assets, HTML, CSS and JavaScript. No framework, installed dependencies, build step, AI APIs or ChatGPT runtime are required.

## Run locally

Install Node.js 20 or newer and run:

```sh
npm start
```

Open http://127.0.0.1:4317. No dependency installation is needed. The preview server uses Node’s standard library. The deployed website requires only the contents of `dist`.

## Files

| Location | Purpose |
| --- | --- |
| `dist/index.html` | Homepage, Directors, projects and contact |
| `dist/atithi.html` | Atithi project |
| `dist/jay-etobicoke.html` | Jay Bhavani Etobicoke project |
| `dist/jay-windsor.html` | Jay Bhavani Windsor project |
| `dist/jimmy-johns.html` | Jimmy John’s Windsor project |
| `dist/start.html` | Project enquiry |
| `dist/change-request.html` | Existing project change request |
| `dist/trade-partner.html` | Trade partner introduction |
| `dist/styles.css` | Shared design and responsive layout |
| `dist/script.js` | Navigation, conditional phone requirement and photograph viewer |
| `dist/assets/` | Local photography and responsive image sizes |
| `dist/terranode-*.svg` | Terranode logo and symbol |
| `dist/favicon.*` | Small-use symbol on a Chalk tile; Basalt structure and Terracotta core |
| `scripts/` | Local preview and existing website checker |
| `projects.json` | Project descriptions and captions |
| `project-sources.json` | Project photographs and public source URLs |

## Deploy

Publish the **contents of `dist`** to a static web host, or set its publish directory to `dist` with no build command. Navigation and assets use relative URLs. This repository stores the website source; uploading it does not enable web hosting or change terranode.ca DNS.

The three intake pages submit with standard browser forms to the existing published Google Forms. Visitors fill in Terranode-styled fields; Google opens its receipt in a new tab. Each page also links to its original Google Form as a fallback. Do not rename Google questions or replace the forms without checking their `entry.*` field mappings here. Direct email links address **info@terranode.ca**. Automatic enquiry email notifications require separate Google-side activation and are not active merely because this code is uploaded.

## Existing checks

```sh
npm run check
```

The existing checker covers page structure, local links and assets, form destinations, project image records and JavaScript syntax. Do not submit fictitious enquiries to the live Forms.

## Brand and content

Basalt `#26352F`, Chalk `#F5F2E9`, Sandstone `#D8C8B5` and Terracotta `#B66A4E`. The homepage uses actual Jay Bhavani Windsor project photography. Completed project profiles are attributed to LifeBuild Canada. Page content scrolls without reveal animation; controls use restrained hover states. The website respects reduced-motion preferences and supports keyboard navigation.

Public access to this repository does not grant an open-source licence to its brand, photography or company content. The package is marked UNLICENSED.

## Internal files

The original internal source audit, portrait provenance record and enquiry-notification setup files are retained in the complete company source package. Their publication to this public repository is pending approval.
