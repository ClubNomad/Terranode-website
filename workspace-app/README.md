# Terranode Workspace app source

This folder contains the Google Apps Script project used by the private Contacts and Project Media app, published by the Terranode Workspace owner.

- `Code.gs` contains the server-side authorization, data access, form sync, contact operations, and Drive upload/move handlers.
- `Index.html` is the app shell.
- `WorkspaceClient1.html` through `WorkspaceClient10.html` are included client-side templates used by the shell.

The server checks the executing account and an exact team allowlist, held in private Apps Script properties, before exposing private data or performing a contact or Drive operation. Do not move those checks into browser code. The app runs as the Workspace owner to write to the Operations Hub and the existing `02 - Projects` Drive folder.

Contacts are stored in the Operations Hub's **Contacts — Unified** sheet. Original form submissions and imported card files are traceable through **Contact Sources**. Media remains in Google Drive at its selected project folder or the General upload intake. No contact rows, uploaded files, passwords, or access tokens are stored in this source folder.

The live Apps Script deployment uses its own versioned URL. Update the deployment through the Terranode Workspace owner account, verify the current version and access audience, then update the Team Login link in `dist/team.html` and the matching allowed URL in `scripts/check-site.mjs`. The public Terranode website remains static and opens the private app in a separate tab.

OCR uses pinned Tesseract.js assets and runs locally in the importing browser. The resulting fields remain editable and the role must be selected by the user.
