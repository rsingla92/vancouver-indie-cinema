import { z } from "zod";


export const normalizedTitleSchema = z.object({
  coreTitle: z.string().min(1),
  releaseYear: z.number().int().min(1888).max(2200).nullable(),
  contentKind: z.enum(["film", "non_film", "unknown"]),
  tags: z.array(z.enum(["35mm", "70mm", "16mm", "4K", "Q&A", "live", "restoration", "re-release", "sing-along", "captioned", "guests", "subtitled", "dubbed", "double bill"])),
  /** Other names the listing gives the same film: a bracketed original title, or the title without a director credit. */
  alternateTitles: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  note: z.string().max(160),
});


export type NormalizedTitle = z.infer<typeof normalizedTitleSchema>;

export interface TitleNormalizer {
  normalize(rawTitle: string): NormalizedTitle;
}


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
  /** The title in other languages the search was run in. */
  localizedTitles?: string[];
}


export interface RankedCandidate {
  movie: TmdbMovie;
  score: number;
  /** Best title similarity behind the score: 1 is the exact title. */
  similarity: number;
  reason: string;
}
