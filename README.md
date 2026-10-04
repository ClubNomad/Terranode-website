# Terranode website

A portable website for Terranode Inc. Built with HTML, CSS and JavaScript. There are no installed dependencies, framework, build step, AI APIs or ChatGPT runtime requirements.

## Run locally

Install Node.js 20 or newer, then run:

```sh
npm start
```

Open `http://127.0.0.1:4317`. No `npm install` is needed. Stop with Ctrl+C. To use another port, set the standard `PORT` environment variable before starting.

You can also serve `dist` with any static web server. The Node server is a local preview tool; a deployed site only needs the files inside `dist`.

## Check the website

```sh
npm run check
```

The checker covers pages, assets, cross-page links, photo provenance, the three public Form routes and JavaScript syntax. Before a release, also inspect desktop, tablet and phone layouts; open project photographs; check keyboard controls and Forms. Do not submit fictitious enquiries to the production Forms.

## Where to edit

| File | Purpose |
| --- | --- |
| `dist/index.html` | Homepage, About section, project selection and enquiry entry points |
| `dist/atithi.html` | Atithi project profile |
| `dist/jay-etobicoke.html` | Jay Bhavani Etobicoke project profile |
| `dist/jay-windsor.html` | Jay Bhavani Windsor project profile |
| `dist/jimmy-johns.html` | Jimmy John’s Windsor project profile |
| `dist/styles.css` | Shared colour, type, layout, image treatment and responsive rules |
| `dist/script.js` | Menu, on-demand Forms, progressive reveal and photo viewer |
| `dist/assets/` | All photography, stored locally |
| `dist/terranode-*.svg` | Brand mark and logos |
| `scripts/serve.mjs` | Local preview server using Node's standard library |
| `scripts/check-site.mjs` | Portable release checks |
| `projects.json` | Editorial record of project facts, captions and source pages |
| `project-sources.json` | Each real project's photograph and source URL |
| `photo-sources.json` | Owner-supplied portraits and studio photography |
| `SOURCE-AUDIT.md` | Evidence, attribution and excluded claims |

The HTML files are the published content. The JSON records document the factual basis; they do not generate the pages. Keep them aligned when changing project claims.

## Deploy elsewhere

Upload the **contents of `dist`** to your web host's public document root, or select `dist` as the publish directory on a static host. Use no build command. All site assets and navigation use relative URLs, including when hosted below a repository path.

No OpenAI configuration, account, login integration, secret or API key is needed to serve these files. The managed review host's optional `.openai/hosting.json` is not part of the standalone GitHub package. Removing that file does not change the website or its local checks.

Direct email enquiries use **info@terranode.ca** from each page and the enquiry dialog. These links open the visitor’s email application; they do not submit the Google Form or create a Hub record.

The current Forms are ordinary public Google Forms. Submissions continue to the existing Google Workspace workflow. Google Forms is an external service dependency; it does not require ChatGPT. Replace the three Form URLs consistently across the HTML files if the company moves to another form service.

The current restricted review address is controlled by its hosting account. Uploading these files to a different host does not transfer that host's access restrictions or change `terranode.ca` DNS. Configure the chosen host and audience before switching the domain.

## Design system

- Basalt `#26352F`, Chalk `#F5F2E9`, Sandstone `#D8C8B5` and Terracotta `#B66A4E`.
- Dark clay `#985138` for readable buttons; `#91472F` for light-surface text accents.
- Real Jay Bhavani Windsor photography opens the homepage, with LifeBuild Canada attribution and a direct project link.
- Project previews retain colour with slight CSS desaturation; hover or focus returns full colour. Project pages present the original full-colour photography.
- The Directors section alternates Manjil’s professional portrait and Dipesh’s editorial photograph. A concrete-and-chair detail uses a CSS crop of an original Club Nomad image. No generative photography is used on the pages.
- The image viewer supports Previous, Next, arrow keys and Escape. Direct image and Form URLs remain usable without JavaScript.
- Motion respects the visitor's reduced-motion setting; content is visible by default.

All completed-work profiles are attributed to LifeBuild Canada. Current people are Directors Dipesh and Manjil. Roles come from the owner’s October 2 brief. No corporate-history statistics or credentials should be added without evidence.

## Ownership

This repository does not grant an open-source licence. Terranode brand material, photography and company content remain subject to their owners' rights. See `SOURCE-AUDIT.md` for the owner's authorisation to reuse LifeBuild material in this website.

## Enquiry email notifications

`operations/enquiry-notifications.gs` is prepared for the Operations Hub’s Google Apps Script editor. It emails new project enquiry submissions to info@terranode.ca while the Google Form continues recording responses in the Hub. **It is not installed or activated.** Follow `operations/SETUP.md` under the company Google account. Google authorization and a working group inbox must be confirmed before claiming delivery.
