import { CinemaApp } from "@/components/cinema-app";
import { getShowtimes } from "@/lib/data";

export const revalidate = 300;

export default async function Home() {
  const { data, demo, generatedAt } = await getShowtimes();
  return <CinemaApp initialShowtimes={data} demo={demo} generatedAt={generatedAt} />;
}
