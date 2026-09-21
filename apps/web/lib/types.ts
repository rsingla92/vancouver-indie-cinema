export interface ShowtimeView {
  id: string;
  movieId: string;
  title: string;
  year: number | null;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  theatre: { slug: string; name: string };
  startsAt: string;
  ticketUrl: string;
  status: "scheduled" | "sold_out";
  tags: string[];
}
