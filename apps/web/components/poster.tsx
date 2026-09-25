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

/** The featured film's backdrop as a tilted photo. Renders nothing without an image. */
export function Still({ movie }: { movie: ShowtimeView }) {
  const [failed, setFailed] = useState(false);
  if (!movie.backdropUrl || failed) return null;
  return <figure className="still">
    <img src={movie.backdropUrl} alt="" decoding="async" onError={() => setFailed(true)} />
    <figcaption>{movie.title}{movie.year ? ` (${movie.year})` : ""}</figcaption>
  </figure>;
}
