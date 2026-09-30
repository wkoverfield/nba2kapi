/**
 * URL-friendly slug: lowercase, runs of non-alphanumerics collapsed to "-",
 * no leading or trailing dash. Shared by badge links, the pool projection,
 * and the client-side player filter so a badge slug means the same thing
 * everywhere.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
