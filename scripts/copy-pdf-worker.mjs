import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
try {
  const source = resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  const destination = resolve("public/pdf.worker.mjs");
  await mkdir(resolve("public"), { recursive: true });
  await copyFile(source, destination);
  console.log("Copied PDF.js worker to public/pdf.worker.mjs");
} catch (error) {
  console.warn("PDF.js worker copy skipped. PDF preview may require reinstalling pdfjs-dist.", error?.message || error);
}
