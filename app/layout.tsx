import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/service-worker-registrar";
import SplashScreen from "@/components/splash-screen";

export const metadata: Metadata = {
  title: "Homu",
  description: "Shared expense tracker for couples & families",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Homu",
    startupImage: "/icons/icon-192.png",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  other: {
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1814" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  // viewport-fit=cover lets the page extend into the iPhone notch / home
  // indicator area. We then opt fixed UI back in via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required on <html> because the theme
    // bootstrap script below writes `data-theme` to this element *before*
    // React hydrates. Without it React would warn on every page load that
    // server-rendered `<html>` (no data-theme) differs from the client.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        {/* Theme + design-system override bootstrap. Both run BEFORE first
            paint so there's no flash. Theme sets data-theme on <html> from
            localStorage. Design overrides (set via /design-system) write
            individual --token CSS variables onto <html>, scoped to the
            active theme's mode (light/dark).
            Uses next/script with strategy="beforeInteractive" — the
            Next.js 16 way to inject inline scripts that need to run before
            hydration without tripping the bare-<script>-in-React warning. */}
        <Script id="homu-theme-bootstrap" strategy="beforeInteractive">{`try{
var t=localStorage.getItem('homu-theme');
if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}
var resolved=(t==='light'||t==='dark')?t:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
var raw=localStorage.getItem('homu-design-overrides');
if(raw){var o=JSON.parse(raw);for(var k in o){var parts=k.split(':');if(parts.length===2&&parts[1]===resolved){document.documentElement.style.setProperty(parts[0],o[k]);}}}
}catch(e){}`}</Script>
        <SplashScreen />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
