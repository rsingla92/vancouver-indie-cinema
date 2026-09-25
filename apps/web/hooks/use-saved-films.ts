"use client";
import { useEffect, useState } from "react";
import { readSaved, toggleSaved, writeSaved, type SavedFilm } from "@/lib/saved";
import type { ShowtimeView } from "@/lib/types";

/** The viewer's saved films, loaded after mount so the static HTML matches on first render. */
export function useSavedFilms(showtimes: ShowtimeView[]) {
  const [saved, setSaved] = useState<SavedFilm[]>([]);
  useEffect(() => { setSaved(readSaved(showtimes)); }, [showtimes]);

  const isSaved = (movieId: string) => saved.some((film) => film.movieId === movieId);
  const toggle = (film: SavedFilm) => setSaved((current) => {
    const next = toggleSaved(current, film);
    writeSaved(next);
    return next;
  });
  return { saved, isSaved, toggle };
}
