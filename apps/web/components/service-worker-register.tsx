"use client";
import { useEffect } from "react";
import { withBase } from "@/lib/base-path";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Cached shells get in the way of local development; only install in production builds.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => void registration.unregister()));
      return;
    }

    const register = () => { void navigator.serviceWorker.register(withBase("/sw.js"), { scope: withBase("/") }).catch(() => undefined); };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
