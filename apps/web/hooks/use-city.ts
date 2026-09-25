"use client";
import { useEffect, useState } from "react";
import { HOME_CITY } from "@/lib/site";

const CITY_KEY = "doublebill:city";

/** The chosen city, remembered in this browser, falling back to the home city or the first available. */
export function useCity(cities: string[]): [string, (city: string) => void] {
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    try {
      setChosen(localStorage.getItem(CITY_KEY));
    } catch {
      // Storage unavailable; the default applies.
    }
  }, []);

  const city = chosen && cities.includes(chosen) ? chosen : cities.includes(HOME_CITY) ? HOME_CITY : cities[0] ?? HOME_CITY;
  const select = (next: string) => {
    setChosen(next);
    try {
      localStorage.setItem(CITY_KEY, next);
    } catch {
      // Best effort.
    }
  };
  return [city, select];
}
