export interface TheatreRef {
  slug: string;
  name: string;
  city: string;
  /** IANA zone used to print this theatre's times, e.g. America/Vancouver. */
  timezone: string;
}

export interface ShowtimeView {
  id: string;
  movieId: string;
  title: string;
  year: number | null;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  theatre: TheatreRef;
  startsAt: string;
  ticketUrl: string;
  status: "scheduled" | "sold_out";
  tags: string[];
}
