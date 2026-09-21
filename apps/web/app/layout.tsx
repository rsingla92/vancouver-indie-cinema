import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = { title: "IndieScreen Vancouver", description: "Independent cinema showtimes across Vancouver.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "IndieScreen" } };
export const viewport: Viewport = { themeColor: "#07080a", colorScheme: "dark", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body id="top">{children}<ServiceWorkerRegister/></body></html>;
}
