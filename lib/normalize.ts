const PUNCTUATION_PATTERN = /[!'’",.:;?()[\]{}]/g;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(PUNCTUATION_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createMovieId(title: string, year?: number): string {
  return `${normalizeTitle(title)}__${year ?? "unknown"}`;
}

export function slugifyTitle(title: string): string {
  return normalizeTitle(title).replace(/\s+/g, "-");
}
