import "bootstrap/dist/css/bootstrap.min.css";
import "antd/dist/reset.css";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
export const metadata = { title: { default: "Lumora — Image tools, beautifully simple", template: "%s | Lumora" }, description: "A focused image workspace to convert, remove backgrounds, resize and compress images.", applicationName: "Lumora", manifest: "/manifest.json", icons: { icon: "/lumora-icon.svg", shortcut: "/lumora-icon.svg", apple: "/lumora-icon.svg" }, appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lumora" } };
export const viewport = { themeColor: "#0CB8C0", width: "device-width", initialScale: 1, maximumScale: 5 };
export default function RootLayout({ children }) { return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body><Navbar/><div className="site-content">{children}</div><Footer/></body></html> }
