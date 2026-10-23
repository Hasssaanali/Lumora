"use client";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { ConfigProvider, Progress } from "antd";

const formats = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG / JPEG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
];

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function postImage(endpoint, file, extra = {}) {
  const form = new FormData();
  form.append("image", file);
  Object.entries(extra).forEach(([key, value]) => form.append(key, String(value)));
  const response = await fetch(endpoint, { method: "POST", body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Processing failed.");
  }
  return response.blob();
}

let segmenterPromise;
async function getSegmenter(onProgress) {
  if (!segmenterPromise) {
    segmenterPromise = import("@huggingface/transformers")
      .then(async ({ pipeline, env }) => {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        try {
          return await pipeline("background-removal", "Xenova/modnet", {
            device: "webgpu",
            progress_callback: (progress) => onProgress?.(progress),
          });
        } catch (webgpuError) {
          console.warn("WebGPU unavailable; retrying with WASM.", webgpuError);
          return pipeline("background-removal", "Xenova/modnet", {
            device: "wasm",
            progress_callback: (progress) => onProgress?.(progress),
          });
        }
      })
      .catch((error) => {
        segmenterPromise = null;
        throw error;
      });
  }
  return segmenterPromise;
}

async function removeImageBackground(file, onProgress) {
  const segmenter = await getSegmenter(onProgress);
  const sourceUrl = URL.createObjectURL(file);
  try {
    const output = await segmenter(sourceUrl);
    const result = Array.isArray(output) ? output[0] : output;
    if (!result) throw new Error("The AI model returned no output.");

    let sourceBlob;
    if (typeof result.toBlob === "function") sourceBlob = await result.toBlob();
    if (!sourceBlob && typeof result.toCanvas === "function") {
      const canvas = result.toCanvas();
      sourceBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export image."))), "image/png");
      });
    }
    if (!sourceBlob) throw new Error("Unexpected AI output. Please refresh and try again.");

    // Re-encode through canvas as PNG so each result has a browser-friendly image URL.
    const bitmap = await createImageBitmap(sourceBlob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Your browser could not prepare the transparent image.");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create transparent PNG."))), "image/png");
      });
    } finally {
      bitmap.close?.();
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function ImageWorkspace({ initialTool = "convert" } = {}) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState("");
  const [activeFile, setActiveFile] = useState(null);
  const [activePreview, setActivePreview] = useState("");
  const [results, setResults] = useState([]);
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState(initialTool);

  useEffect(() => {
    if (!files.length) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(files[0]);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);

  useEffect(() => {
    if (!activeFile) {
      setActivePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(activeFile);
    setActivePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [activeFile]);

  function clearResults() {
    setResults((current) => {
      current.forEach((result) => URL.revokeObjectURL(result.url));
      return [];
    });
  }

  function addResults(items) {
    const prepared = items.map((item) => ({ ...item, url: URL.createObjectURL(item.blob) }));
    setResults((current) => [...current, ...prepared]);
  }

  function addFiles(list) {
    setError("");
    setMessage("");
    const incoming = Array.from(list || []);
    const valid = incoming.filter((file) => file.type.startsWith("image/") && file.size <= 20 * 1024 * 1024);
    if (valid.length !== incoming.length) setError(`${incoming.length - valid.length} file(s) skipped. Use images up to 20 MB each.`);
    setFiles((old) => {
      const seen = new Set(old.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...old];
      valid.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push(file);
        }
      });
      return next.slice(0, 100);
    });
  }

  function beginJob() {
    clearResults();
    setError("");
    setMessage("");
    setProgressPercent(0);
  }

  async function processBulk(kind) {
    if (!files.length) {
      setError("Choose one or more images first.");
      return;
    }
    if (kind === "resize" && !Number(width) && !Number(height)) {
      setError("Enter a width or height.");
      return;
    }
    beginJob();
    setBusy(true);
    const zip = new JSZip();
    const ext = format === "jpeg" ? "jpg" : format;
    const zipName = kind === "convert" ? "lumora-converted.zip" : "lumora-resized.zip";
    const folderName = kind === "convert" ? "lumora-converted" : "lumora-resized";
    const folder = zip.folder(folderName);
    const usedNames = new Set();
    let ok = 0;
    const failures = [];
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setActiveFile(file);
        setProgress(`${kind === "convert" ? "Converting" : "Resizing and compressing"} ${i + 1}/${files.length}: ${file.name}`);
        setProgressPercent(Math.round((i / files.length) * 100));
        try {
          const endpoint = kind === "convert" ? "/api/convert" : "/api/resize-compress";
          const extra = kind === "convert"
            ? { format, quality }
            : { format, quality, width: width || 0, height: height || 0 };
          const blob = await postImage(endpoint, file, extra);
          const base = file.name.replace(/\.[^.]+$/, "") || `image-${i + 1}`;
          let name = `${base}.${ext}`;
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}.${ext}`;
          usedNames.add(name.toLowerCase());
          folder.file(name, blob);
          addResults([{ name, blob, size: blob.size, type: blob.type, sourceName: file.name }]);
          ok += 1;
        } catch (jobError) {
          failures.push(`${file.name}: ${jobError.message}`);
        }
        setProgressPercent(Math.round(((i + 1) / files.length) * 100));
      }
      if (!ok) throw new Error(`No images processed successfully. ${failures.join("; ")}`);
      setMessage(`${ok} image(s) processed. Preview results below, then download individually or as a ZIP.${failures.length ? ` Failed: ${failures.join("; ")}` : ""}`);
      setProgress("Preparing ZIP download…");
      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => setProgressPercent(90 + Math.round(meta.percent / 10)));
      addResults([{ name: zipName, blob: zipBlob, size: zipBlob.size, type: zipBlob.type, isArchive: true }]);
    } catch (jobError) {
      setError(jobError.message || "Image processing failed.");
    } finally {
      setBusy(false);
      setProgress("");
      setActiveFile(null);
      setProgressPercent(0);
    }
  }

  async function bulkRemoveBackground() {
    if (!files.length) {
      setError("Choose one or more images first.");
      return;
    }
    beginJob();
    setBusy(true);
    const zip = new JSZip();
    const folder = zip.folder("lumora-background-removed");
    let ok = 0;
    const failures = [];
    const usedNames = new Set();
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setActiveFile(file);
        setProgress(`Preparing browser AI for image ${i + 1}/${files.length}: ${file.name}`);
        setProgressPercent(Math.round((i / files.length) * 100));
        try {
          const blob = await removeImageBackground(file, (item) => {
            if (item?.status === "progress" && item.total) {
              const pct = Math.round(((item.loaded || 0) / item.total) * 100);
              setProgress(`Downloading AI model: ${pct}%`);
            } else if (item?.status === "progress" && item.file) {
              setProgress(`Loading AI model: ${item.file}`);
            }
          });
          const base = file.name.replace(/\.[^.]+$/, "") || `image-${i + 1}`;
          let name = `${base}-no-background.png`;
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) name = `${base}-${suffix++}-no-background.png`;
          usedNames.add(name.toLowerCase());
          folder.file(name, blob);
          addResults([{ name, blob, size: blob.size, type: "image/png", sourceName: file.name }]);
          ok += 1;
        } catch (jobError) {
          failures.push(`${file.name}: ${jobError.message}`);
        }
        setProgressPercent(Math.round(((i + 1) / files.length) * 100));
        setProgress(`Processed ${i + 1}/${files.length} images`);
      }
      if (!ok) throw new Error(`No backgrounds were removed. ${failures.join("; ")}`);
      setMessage(`${ok} background(s) removed. Preview each transparent PNG below and download individually or as a ZIP.${failures.length ? ` Failed: ${failures.join("; ")}` : ""}`);
      setProgress("Preparing ZIP download…");
      const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => setProgressPercent(90 + Math.round(meta.percent / 10)));
      addResults([{ name: "lumora-background-removed.zip", blob: zipBlob, size: zipBlob.size, type: zipBlob.type, isArchive: true }]);
    } catch (jobError) {
      setError(jobError.message || "Background removal failed.");
    } finally {
      setBusy(false);
      setProgress("");
      setActiveFile(null);
      setProgressPercent(0);
    }
  }

  function clear() {
    clearResults();
    setFiles([]);
    setActiveFile(null);
    setError("");
    setMessage("");
    setProgress("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const title = { convert: "Bulk image converter", background: "AI background remover", resize: "Resize & compress" }[tool];
  const imageResults = results.filter((result) => !result.isArchive);
  const archiveResult = results.find((result) => result.isArchive);

  return (
    <main className="container main-content tool-page py-5">
        <div className="tool-page-heading row align-items-end g-4 mb-4"><div className="col-lg-8">
          <div className="eyebrow mb-3">LUMORA TOOLKIT / {tool === "convert" ? "01" : tool === "background" ? "02" : "03"}</div>
          <h1 className="hero-title display-4 fw-bold mb-3">{title}<span className="title-period">.</span></h1>
          <p className="text-muted-custom fs-5 mb-0">{tool === "convert" ? "Convert batches into production-ready image formats with clean previews and one-click downloads." : tool === "background" ? "Create transparent cutouts with browser-based AI. No paid API key required for the included local model." : "Control dimensions, output format and quality with a streamlined batch workflow."}</p>
        </div><div className="col-lg-4 text-lg-end"><span className="limit-pill">UP TO 100 FILES <i/> 20 MB EACH</span></div></div>

        <div className="panel p-3 p-md-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4"><div><h3 className="h4 fw-bold mb-1">{title}</h3><p className="text-muted-custom small mb-0">Live progress is shown while each image is processed. Completed images appear below as they finish.</p></div>
            {(files.length > 0 || results.length > 0) && <button className="btn btn-sm btn-outline-light" onClick={clear} disabled={busy}>Clear all ({files.length})</button>}
          </div>

          <input ref={inputRef} type="file" accept="image/*" multiple className="d-none" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <button type="button" className="dropzone w-100 text-white mb-3" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
            <span><span className="display-6 d-block mb-2">↑</span><strong className="d-block fs-5">Drop images here</strong><span className="text-muted-custom d-block my-2">or browse multiple files from your device</span><span className="btn btn-lime mt-2">Choose images</span><span className="d-block text-muted-custom small mt-3">Maximum 100 files · 20 MB each</span></span>
          </button>

          {files.length > 0 && <div className="panel p-3 mb-4"><div className="d-flex justify-content-between align-items-center mb-3"><strong>Selected images</strong><span className="text-muted-custom small">{files.length} file(s) · {bytes(files.reduce((sum, file) => sum + file.size, 0))} total</span></div>
            <div className="row g-3"><div className="col-md-4"><div className="preview-board">{activePreview ? <img src={activePreview} alt="Image currently being processed" className="preview-img" /> : preview ? <img src={preview} alt="First selected image preview" className="preview-img" /> : null}</div>{activeFile && <div className="small text-center mt-2" style={{ color: "var(--pf-lime)" }}>Now processing: {activeFile.name}</div>}</div>
              <div className="col-md-8"><div className="list-group list-group-flush" style={{ maxHeight: 220, overflowY: "auto" }}>{files.map((file, index) => <div className="list-group-item d-flex justify-content-between gap-3 px-2 py-2" style={{ background: "transparent", borderColor: "var(--pf-border)" }} key={`${file.name}-${file.lastModified}-${index}`}><span className="text-truncate">{file.name}</span><span className="small text-muted-custom flex-shrink-0">{bytes(file.size)}</span></div>)}</div></div></div>
          </div>}

          {tool !== "background" && <div className="row g-3 align-items-end"><div className="col-md-4"><label className="form-label fw-semibold" htmlFor="format">Output format</label><select id="format" className="form-select" value={format} onChange={(event) => setFormat(event.target.value)}>{formats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            {tool === "resize" && <><div className="col-md-2"><label className="form-label" htmlFor="width">Width (px)</label><input id="width" className="form-control" type="number" min="0" max="8000" value={width} onChange={(event) => setWidth(event.target.value)} placeholder="1200" /></div><div className="col-md-2"><label className="form-label" htmlFor="height">Height (px)</label><input id="height" className="form-control" type="number" min="0" max="8000" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="Auto" /></div></>}
            <div className="col-md-3"><div className="d-flex justify-content-between align-items-center mb-2"><label className="form-label fw-semibold mb-0" htmlFor="quality">Quality</label><span style={{ color: "var(--pf-lime)" }}>{quality}%</span></div><input id="quality" className="form-range" type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></div>
            <div className="col-md-3"><button className="btn btn-lime w-100" disabled={busy || !files.length} onClick={() => processBulk(tool === "convert" ? "convert" : "resize")}>{busy ? "Processing…" : tool === "convert" ? "Convert all images" : "Resize & compress all"}</button></div>
          </div>}

          {tool === "background" && <div className="p-3 rounded-3" style={{ background: "#0e1628", border: "1px solid var(--pf-border)" }}><h5 className="fw-bold">Browser-based AI background removal</h5><p className="text-muted-custom small">No paid API or Python service. The AI model downloads on first use and runs on the device (WebGPU when available, WASM fallback otherwise). Each completed image appears below with a transparent-background preview and its own download button.</p><button className="btn btn-lime" disabled={busy || !files.length} onClick={bulkRemoveBackground}>{busy ? "Removing backgrounds…" : "Remove backgrounds"}</button></div>}

          {busy && <div className="processing-panel mt-4"><div className="d-flex justify-content-between gap-3 small mb-2"><span className="text-muted-custom">{progress}</span><strong className="accent">{progressPercent}%</strong></div><ConfigProvider theme={{ token: { colorPrimary: "#c5ff5a", colorText: "#f5f7fb", colorBgContainer: "#111111" } }}><Progress percent={progressPercent} showInfo={false} strokeColor="#c5ff5a" trailColor="#272727" strokeLinecap="round" /></ConfigProvider></div>}
          {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
          {message && <div className="alert alert-info mt-3 mb-0" role="status">{message}</div>}
        </div>

        {results.length > 0 && <section className="mt-4" aria-live="polite"><div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3"><div><h3 className="h4 fw-bold mb-1">{tool === "background" ? "Background removed — results" : "Processed images — results"}</h3><p className="text-muted-custom small mb-0">Each image is ready to preview and download. Transparent backgrounds use a checkerboard preview.</p></div>{archiveResult && <button className="btn btn-lime" onClick={() => saveBlob(archiveResult.blob, archiveResult.name)}><span className="me-2">↓</span>Download all as ZIP ({bytes(archiveResult.size)})</button>}</div>
          <div className="row g-3">{imageResults.map((result, index) => <div className="col-sm-6 col-lg-4" key={`${result.name}-${index}`}><article className="tool-card p-3 h-100"><div className="preview-board result-preview mb-3"><img src={result.url} alt={`Processed result: ${result.name}`} className="preview-img" /></div><div className="d-flex justify-content-between align-items-start gap-2"><div className="min-w-0"><div className="fw-semibold text-break">{result.name}</div><div className="text-muted-custom small mt-1">{bytes(result.size)}{result.sourceName ? ` · From ${result.sourceName}` : ""}</div></div><span className="badge rounded-pill text-bg-success">Ready</span></div><button className="btn btn-outline-light w-100 mt-3" onClick={() => saveBlob(result.blob, result.name)}><span className="me-2">↓</span>Download image</button></article></div>)}</div>
        </section>}

      </main>
  );
}
