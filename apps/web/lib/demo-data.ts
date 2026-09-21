import type { ShowtimeView } from "./types";

const at = (hour: number, dayOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, hour === 19 ? 30 : 0, 0, 0);
  return date.toISOString();
};

export const demoShowtimes: ShowtimeView[] = [
  { id: "demo-1", movieId: "perfect-days", title: "Perfect Days", year: 2023, synopsis: "A Tokyo toilet cleaner finds beauty in the rhythms of everyday life.", posterUrl: "https://image.tmdb.org/t/p/w500/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg", backdropUrl: "https://image.tmdb.org/t/p/w1280/2f1tvY8q6CcV6Z3DRKXWIIRcc3T.jpg", theatre: { slug: "viff-centre", name: "VIFF Centre" }, startsAt: at(18), ticketUrl: "https://viff.org/", status: "scheduled", tags: [] },
  { id: "demo-2", movieId: "stop-making-sense", title: "Stop Making Sense", year: 1984, synopsis: "Jonathan Demme captures Talking Heads at their exhilarating peak.", posterUrl: "https://image.tmdb.org/t/p/w500/8Z9qq1wV9Z8JpU5JlXw3qLqXH4q.jpg", backdropUrl: "", theatre: { slug: "rio-theatre", name: "Rio Theatre" }, startsAt: at(20), ticketUrl: "https://riotheatretickets.ca/", status: "scheduled", tags: ["4K restoration"] },
  { id: "demo-3", movieId: "in-the-mood-for-love", title: "In the Mood for Love", year: 2000, synopsis: "Two neighbours form an intimate bond after suspecting their spouses.", posterUrl: "https://image.tmdb.org/t/p/w500/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg", backdropUrl: "", theatre: { slug: "the-cinematheque", name: "The Cinematheque" }, startsAt: at(19), ticketUrl: "https://thecinematheque.ca/", status: "scheduled", tags: ["35mm"] },
  { id: "demo-4", movieId: "the-shining", title: "The Shining", year: 1980, synopsis: "A family heads to an isolated hotel where a sinister presence awaits.", posterUrl: "https://image.tmdb.org/t/p/w500/xazWoLealQwEgqZ89MLZklLZD3k.jpg", backdropUrl: "", theatre: { slug: "hollywood-theatre", name: "Hollywood Theatre" }, startsAt: at(21, 1), ticketUrl: "https://www.hollywoodtheatre.ca/", status: "scheduled", tags: ["Late night"] },
];
