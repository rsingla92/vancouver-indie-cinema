"use client";
import { useEffect, useState } from "react";

/**
 * The current time, starting from the build timestamp so server and client render the
 * same HTML, then switching to the viewer's clock after mount and ticking once a minute.
 * A statically built page can be hours old; this keeps "upcoming" honest.
 */
export function useNow(initialIso: string, refreshMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);
  return now;
}
