import { CinemaApp } from "@/components/cinema-app";
import { getShowtimes } from "@/lib/data";

export default async function Home() {
  const { data, demo, generatedAt } = await getShowtimes();
  // An empty listing is never worth publishing over the one already live.
  if (!demo && data.length === 0) {
    throw new Error("The database has no upcoming showtimes, so this build would publish an empty schedule. Run the ingest workflow first.");
  }
  return <CinemaApp initialShowtimes={data} demo={demo} generatedAt={generatedAt} />;
}
