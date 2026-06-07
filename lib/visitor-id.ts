// Persistent anonymous visitor id, shared by feedback + analytics so a
// "visitor" is consistent across both. Key matches the original inline
// helper in app/feedback/page.tsx.
const KEY = "nba2kapi-visitor-id";

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
