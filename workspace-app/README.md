# Terranode Workspace app source

This folder contains the Google Apps Script project used by the private Contacts, Project Media, and Operations app, published by the Terranode Workspace owner.

- `Code.gs` contains the server-side authorization, data access, form sync, contact operations, and Drive upload/move handlers.
- `Index.html` is the app shell.
- `WorkspaceClient1.html` through `WorkspaceClient11.html` are included client-side templates used by the shell.

The server checks the executing account and limits every app request to `info@terranode.ca` before exposing private data or performing a contact or Drive operation. Do not move those checks into browser code. The legacy `admins` script property does not grant app access. The app runs as the Workspace owner to write to the Operations Hub and the existing `02 - Projects` Drive folder.

Contacts are stored in the Operations Hub's **Contacts — Unified** sheet. Original form submissions and imported card files are traceable through **Contact Sources**. Media remains in Google Drive at its selected project folder or the General upload intake. No contact rows, uploaded files, passwords, or access tokens are stored in this source folder.

The live Apps Script deployment uses its own versioned URL. Update the deployment through the Terranode Workspace owner account, verify the current version and access audience, then update the Team Login link in `dist/team.html` and the matching allowed URL in `scripts/check-site.mjs`. The public Terranode website remains static and opens the private app in a separate tab.

The Operations view queries the existing Operations Hub registers, unified contacts, project folders, media batches, and Activity log. It supports combined search and filters, linked record details, workflow updates, and email alert status. Workspace alerts go to `info@terranode.ca`; the app records pending or failed delivery in Activity and retries through the `maintainWorkspaceAlerts` timer trigger. Run `installWorkspaceCrmMaintenance` once in Apps Script to set the media scan cutoff and install the retry trigger. The spreadsheet form-submit trigger routes each new linked response from the Enquiries, Change Requests, Trade Partners, Site Logs, Purchases, and Client Contact response tabs into its matching Operations Hub register. It keeps the original response tab intact, uses the response sheet and row as a duplicate-safe source key, and emails a private submission summary and record link to `info@terranode.ca`. Existing contact matching still runs for client and trade partner submissions. The trigger does not backfill historical responses; deploy the updated source before relying on alerts for new submissions.

OCR uses pinned Tesseract.js assets and runs locally in the importing browser. The resulting fields remain editable and the role must be selected by the user.

