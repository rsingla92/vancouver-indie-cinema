/** Lower-case ASCII letters and digits only, with "&" read as "and", for comparing titles. */
export function canonicalTitle(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}
