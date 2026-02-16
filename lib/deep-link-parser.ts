/**
 * Parses API request endpoints and generates deep links to the appropriate
 * interactive pages (playground, player detail, team detail)
 */

export interface DeepLink {
  href: string;
  label: string;
  available: boolean;
}

/**
 * Parse an API endpoint and generate a deep link to the interactive UI
 * @param endpoint - The API endpoint (e.g., "/api/players?team=Lakers")
 * @returns Deep link object with href, label, and availability
 */
export function parseEndpointToDeepLink(endpoint: string): DeepLink {
  try {
    const url = new URL(endpoint, "http://localhost");
    const pathname = url.pathname;
    const params = url.searchParams;

    // Player detail page: /api/players/slug/:slug
    const playerSlugMatch = pathname.match(/\/api\/players\/slug\/([^/]+)/);
    if (playerSlugMatch) {
      const slug = playerSlugMatch[1];
      const type = params.get("teamType") || "curr";
      const team = params.get("team");
      let href = `/players/${slug}?type=${type}`;
      if (team) {
        href += `&team=${encodeURIComponent(team)}`;
      }
      return {
        href,
        label: "View Player",
        available: true,
      };
    }

    // Players list with filters: /api/players?...
    if (pathname === "/api/players") {
      const queryParams = new URLSearchParams();

      // Map API params to playground params
      const team = params.get("team");
      if (team) queryParams.set("teams", team);

      const position = params.get("position");
      if (position) queryParams.set("positions", position);

      const minRating = params.get("minRating");
      if (minRating) queryParams.set("minOverall", minRating);

      const maxRating = params.get("maxRating");
      if (maxRating) queryParams.set("maxOverall", maxRating);

      const teamType = params.get("teamType");
      if (teamType) queryParams.set("teamType", teamType);

      const name = params.get("name");
      if (name) queryParams.set("search", name);

      const queryString = queryParams.toString();
      return {
        href: `/playground${queryString ? `?${queryString}` : ""}`,
        label: "View in Playground",
        available: true,
      };
    }

    // Search endpoint: /api/players/search?q=...
    if (pathname === "/api/players/search") {
      const query = params.get("q");
      if (query) {
        return {
          href: `/playground?search=${encodeURIComponent(query)}`,
          label: "View in Playground",
          available: true,
        };
      }
    }

    // Teams list: /api/teams
    if (pathname === "/api/teams") {
      const teamType = params.get("teamType") || "curr";
      return {
        href: `/teams?type=${teamType}`,
        label: "Browse Teams",
        available: true,
      };
    }

    // Team detail: /api/teams/:team
    const teamMatch = pathname.match(/\/api\/teams\/([^/]+)/);
    if (teamMatch) {
      const teamSlug = teamMatch[1];
      const teamType = params.get("teamType") || "curr";
      return {
        href: `/teams/${teamSlug}?type=${teamType}`,
        label: "View Team",
        available: true,
      };
    }

    // No matching deep link
    return {
      href: "#",
      label: "View",
      available: false,
    };
  } catch (error) {
    // Invalid URL or other parsing error
    return {
      href: "#",
      label: "View",
      available: false,
    };
  }
}
