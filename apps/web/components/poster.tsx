"use client";
import { useState } from "react";
import type { ShowtimeView } from "@/lib/types";

/** A film poster in a paper frame, or a hatched placeholder when there is none or it fails to load. */
export function Poster({ movie }: { movie: ShowtimeView }) {
  const [failed, setFailed] = useState(false);
  if (!movie.posterUrl || failed) {
    return <div className="poster-fallback" aria-hidden="true"><span>no poster</span><b>{movie.title}</b></div>;
  }
  return <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
