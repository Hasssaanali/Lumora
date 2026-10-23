# Lumora — Black UI Image Toolkit

Lumora is a Next.js App Router image utility site with a premium near-black theme, Inter typography, Bootstrap 5 layout utilities, Ant Design progress UI, responsive navigation/footer, dedicated tool routes and tool-specific guidance.

## Routes

- `/` — Home, toolkit overview, workflow, FAQs and links to each tool.
- `/convert` — Bulk image format conversion, per-file progress, previews and individual/ZIP downloads.
- `/background-remover` — Browser-based AI background removal using Transformers.js and Xenova MODNet.
- `/resize-compress` — Image dimension and output-quality workflow, with previews and downloads.
- `/documentation` — Installation, tool guides, architecture, API integration, troubleshooting and production checklist.
- `/contact` — Contact form (currently uses a mailto flow; it is not server-side email delivery).

## Requirements

- Node.js 20.9+ and npm
- A modern browser
- Internet access on first use to download AI model assets

## Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Production check:

```bash
npm run build
npm start
```

Run and verify the build before deploying. Dependency installation/build was not successfully completed in the packaging environment, so this archive should be tested locally before production.

## Styling

Global styling and responsive breakpoints are in `src/app/globals.css`. The site uses Inter from Google Fonts, a near-black surface palette and lime accent. Bootstrap 5 provides grid and utility classes; Ant Design provides progress components.

## Extending the toolkit

Create a new route in `src/app/<tool-slug>/page.js`, a dedicated tool component in `src/components/tools/<ToolName>Tool.js`, and keep processing logic in a separate utility or API route for that tool. Add the new tool to `src/components/layout/Navbar.js`, `src/components/layout/Footer.js`, and the homepage tool directory. Avoid modifying existing tool processors to add unrelated features.

The three tool route entry points are separate, but the current interactive processing panel is still shared via `ImageWorkspace.js`. If you need completely independent state and processing logic for each tool, extract the relevant processing paths into dedicated modules before expanding the toolkit further.

## API keys and email

Never expose secret keys in `NEXT_PUBLIC_*` variables or browser code. Store them in server environment variables and call third-party APIs from server routes. The contact page currently opens the visitor's email application; connect a server-side email provider to deliver messages directly from the website.

## CV Builder & PDF Export

Open `/cv-builder` to create a professional A4 CV. The Ant Design form supports personal details, optional photo, summary, repeatable work experience and education, skills, projects, certifications, languages, hobbies, custom sections and references. Use the bullet editor for achievement lists. **Preview PDF** opens an in-page PDF preview; **Generate & Download PDF** saves the file. PDF generation runs in the browser using jsPDF.

Documentation at `/documentation` now contains tool-specific step-by-step guides only.

## PDF Editor
Open `/pdf-editor` to upload a PDF (up to 25 MB), select a page, add text overlays, adjust font size/position/color, and export an edited copy. You can optionally upload a licensed TTF/OTF font file (including a Google Fonts font file) for closer matching. This version adds overlays; it does not automatically replace existing embedded text or infer the original font.

## CV template preview
The CV Builder now shows a live sample layout beside the selected template and includes accent-color swatches. The selected accent is passed to the PDF generator for standard single-column templates. Sidebar layouts retain their built-in palette styling.


## PDF Editor
- Uses a same-origin PDF.js worker copied into `public/pdf.worker.mjs` during `npm install` to avoid fake-worker canvas preview failures.
- Click a detected text fragment in the preview to load its text into the editor; replacement covers the selected region with white and draws the edited text. This is suitable for plain backgrounds, not complex image/pattern backgrounds.
- Scanned/image-only PDFs have no selectable text fragments. The tool supports adding text overlays, dragging them, and exporting a new PDF. It is not a full Word-equivalent PDF editor and cannot guarantee source-font identification or exact reflow.
- Run `npm install`, `npm run dev`, then test with both a standard text PDF and a scanned PDF. Run `npm run build` before deployment.


## Windows install helper
1. Install Node.js 20.9 or newer (LTS recommended) and restart the terminal.
2. Extract this ZIP to a short path such as `C:\projects\lumora` (avoid OneDrive and deeply nested folders).
3. Double-click `INSTALL-WINDOWS.bat`, or run `npm install --legacy-peer-deps --no-audit --no-fund`.
4. Run `npm run dev`.

The `.npmrc` uses legacy peer dependency resolution to reduce npm peer-dependency resolver failures. If npm still fails, the first `npm ERR!` line and Node/npm versions are needed to identify a registry, network, permission, or package error; do not repeatedly delete files or reinstall randomly.


## Security and deployment notes
- Image API routes enforce a 20 MB upload limit, restrict output formats, cap Sharp pixel processing, and return `X-Content-Type-Options: nosniff` on generated image responses.
- App-wide response headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. A Content Security Policy is not enabled because PDF.js/model/font loading needs to be tested before introducing one.
- Do not commit `.env` files, API secrets, uploaded documents, `.next/`, or `node_modules/`. Keep dependency lockfiles committed.
- Before production release, run `npm ci`, `npm run build`, and test uploads with large, malformed, and password-protected files. This styling package has not been production-build-tested in this environment.
- The manifest enables installable standalone presentation on supported browsers. Install prompts and iOS “Add to Home Screen” availability are controlled by the browser and platform.
