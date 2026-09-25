import { CinemaApp } from "@/components/cinema-app";
import { getShowtimes, HORIZON_DAYS } from "@/lib/data";

export default async function Home() {
  const { data, demo, generatedAt } = await getShowtimes(HORIZON_DAYS);
  // An empty listing is never worth publishing over the one already live.
  if (!demo && data.length === 0) {
    throw new Error("The database has no upcoming showtimes, so this build would publish an empty schedule. Run the ingest workflow first.");
  }
  // The featured film is a random pick; choosing the seed here keeps the static HTML and the first client render identical.
  const pickSeed = Math.floor(Math.random() * 1_000_000);
  return <CinemaApp initialShowtimes={data} demo={demo} generatedAt={generatedAt} pickSeed={pickSeed} />;
}
