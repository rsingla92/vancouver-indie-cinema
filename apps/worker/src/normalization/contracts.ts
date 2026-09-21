import { z } from "zod";

export const normalizedTitleSchema = z.object({
  coreTitle: z.string().min(1),
  releaseYear: z.number().int().min(1888).max(2200).nullable(),
  contentKind: z.enum(["film", "non_film", "unknown"]),
  tags: z.array(z.enum(["35mm", "70mm", "16mm", "Q&A", "live", "restoration", "sing-along", "captioned"])),
  confidence: z.number().min(0).max(1),
  note: z.string().max(160),
});

export type NormalizedTitle = z.infer<typeof normalizedTitleSchema>;

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
}

export interface RankedCandidate {
  movie: TmdbMovie;
  score: number;
  reason: string;
}
