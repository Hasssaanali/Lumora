"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AppstoreOutlined, CompressOutlined, SwapOutlined, PictureOutlined,
  FullscreenOutlined, FilePdfOutlined, IdcardOutlined, BookOutlined,
  CustomerServiceOutlined, MenuOutlined, CloseOutlined, ThunderboltOutlined,
  GlobalOutlined, MoonOutlined
} from "@ant-design/icons";

const links = [
  { href: "/", label: "Home", sub: "Your creative workspace", icon: AppstoreOutlined },
  { href: "/resize-compress", label: "Compress", sub: "Reduce image size", icon: CompressOutlined },
  { href: "/convert", label: "Convert", sub: "Convert image formats", icon: SwapOutlined },
  { href: "/background-remover", label: "Background remover", sub: "Clean transparent PNGs", icon: PictureOutlined },
  { href: "/convert", label: "Batch compress", sub: "Process multiple images", icon: CompressOutlined },
  { href: "/convert", label: "WebP / AVIF", sub: "Modern image formats", icon: PictureOutlined },
  { href: "/resize-compress", label: "Resize images", sub: "Change dimensions", icon: FullscreenOutlined },
  { href: "/pdf-editor", label: "PDF Editor", sub: "Edit and annotate PDFs", icon: FilePdfOutlined },
  { href: "/cv-builder", label: "CV Builder", sub: "Create a polished CV", icon: IdcardOutlined },
];
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <>
    <header className="mobile-app-bar">
      <Link href="/" className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark">L</span><span className="brand-copy"><strong>Lumora</strong><small>CREATIVE WORKSPACE</small></span></Link>
      <button className="mobile-menu-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <CloseOutlined /> : <MenuOutlined />}</button>
    </header>
    {open && <button aria-label="Close menu" className="sidebar-backdrop" onClick={() => setOpen(false)} />}
    <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
      <Link href="/" className="brand-lockup sidebar-brand" onClick={() => setOpen(false)}><span className="brand-mark"><PictureOutlined /></span><span className="brand-copy"><strong>Lumora</strong><small>IMAGE & DOCUMENT STUDIO</small></span></Link>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {links.map(({ href, label, sub, icon: Icon }) => {
          const active = label === "Home" ? pathname === "/" : label === "Compress" ? pathname === "/resize-compress" : label === "Convert" ? pathname === "/convert" : label === "Background remover" ? pathname === "/background-remover" : label === "PDF Editor" ? pathname === "/pdf-editor" : label === "CV Builder" ? pathname === "/cv-builder" : label === "Resize images" ? false : false;
          return <Link key={label} href={href} onClick={() => setOpen(false)} className={`sidebar-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="sidebar-nav-icon"><Icon /></span><span className="sidebar-nav-copy"><strong>{label}</strong><small>{sub}</small></span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-section-label sidebar-tools-label">MORE</div>
      <nav className="sidebar-nav sidebar-secondary" aria-label="More links">
        <Link href="/documentation" className={`sidebar-nav-link ${pathname === "/documentation" ? "active" : ""}`} onClick={() => setOpen(false)}><span className="sidebar-nav-icon"><BookOutlined /></span><span className="sidebar-nav-copy"><strong>Documentation</strong><small>How each tool works</small></span></Link>
        <Link href="/contact" className={`sidebar-nav-link ${pathname === "/contact" ? "active" : ""}`} onClick={() => setOpen(false)}><span className="sidebar-nav-icon"><CustomerServiceOutlined /></span><span className="sidebar-nav-copy"><strong>Contact</strong><small>Get support</small></span></Link>
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-privacy-card"><span className="privacy-icon"><ThunderboltOutlined /></span><div><strong>Private by design</strong><p>Tools for a smoother creative workflow.</p></div></div>
      <div className="sidebar-bottom"><span className="sidebar-round-icon"><MoonOutlined /></span><span className="sidebar-round-icon"><GlobalOutlined /></span><span className="sidebar-language">English <span>⌄</span></span></div>
      <div className="sidebar-version">LUMORA WORKSPACE · 1.0</div>
    </aside>
  </>;
}
