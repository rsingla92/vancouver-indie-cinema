import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "IndieScreen Vancouver",
  description: "Independent cinema showtimes across Vancouver.",
  manifest: withBase("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: withBase("/icon.svg"), type: "image/svg+xml" },
      { url: withBase("/icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: withBase("/apple-touch-icon.png"),
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "IndieScreen" },
};

export const viewport: Viewport = { themeColor: "#f5f0e4", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body id="top">{children}<ServiceWorkerRegister /></body></html>;
}
