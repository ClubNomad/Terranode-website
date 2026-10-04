# Terranode website

The Terranode Inc. design and construction website. Five pages, local photography, SVG brand assets, HTML, CSS and JavaScript. No framework, installed dependencies, build step, AI APIs or ChatGPT runtime are required.

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
| `dist/styles.css` | Shared design and responsive layout |
| `dist/script.js` | Navigation, Form dialogs and photograph viewer |
| `dist/assets/` | Local photography and responsive image sizes |
| `dist/terranode-*.svg` | Terranode logo and symbol |
| `scripts/` | Local preview and existing website checker |
| `projects.json` | Project descriptions and captions |
| `project-sources.json` | Project photographs and public source URLs |

## Deploy

Publish the **contents of `dist`** to a static web host, or set its publish directory to `dist` with no build command. Navigation and assets use relative URLs. This repository stores the website source; uploading it does not enable web hosting or change terranode.ca DNS.

The three Google Form routes remain available for enquiries, change requests and vendors. Direct email links address **info@terranode.ca**. Google Forms remains an external service. Automatic enquiry email notifications require separate Google-side activation and are not active merely because this code is uploaded.

## Existing checks

```sh
npm run check
```

The existing checker covers page structure, local links and assets, Form routes, project image records and JavaScript syntax. Do not submit fictitious enquiries to the live Forms.

## Brand and content

Basalt `#26352F`, Chalk `#F5F2E9`, Sandstone `#D8C8B5` and Terracotta `#B66A4E`. The homepage uses actual Jay Bhavani Windsor project photography. Completed project profiles are attributed to LifeBuild Canada. The website respects reduced-motion preferences and supports keyboard navigation.

Public access to this repository does not grant an open-source licence to its brand, photography or company content. The package is marked UNLICENSED.

## Internal files

The original internal source audit, portrait provenance record and enquiry-notification setup files are retained in the complete company source package. Their publication to this public repository is pending approval.
