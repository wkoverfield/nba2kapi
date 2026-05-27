/**
 * Query Parameter Validation Helpers
 * Provides helpful error messages when users send invalid query parameters
 */

// Parameter suggestion type
export interface ParamSuggestion {
  correctParam?: string;
  correctEndpoint?: string;
  message: string;
}

/**
 * Map of common parameter mistakes to helpful suggestions
 */
export const PARAM_SUGGESTIONS: Record<string, ParamSuggestion> = {
  // Search-related params that belong on /api/players/search
  name: {
    correctEndpoint: "/api/players/search",
    message:
      "To search by player name, use GET /api/players/search?q=lebron",
  },
  search: {
    correctEndpoint: "/api/players/search",
    message: "To search players, use GET /api/players/search?q=your_query",
  },
  query: {
    correctParam: "q",
    correctEndpoint: "/api/players/search",
    message:
      "Use 'q' parameter on /api/players/search: GET /api/players/search?q=lebron",
  },
  player: {
    correctEndpoint: "/api/players/search",
    message:
      "To find a specific player, use GET /api/players/search?q=player_name or GET /api/players/slug/player-name",
  },

  // Pagination mistakes
  page: {
    correctParam: "cursor",
    message:
      "This API uses cursor-based pagination. Use 'cursor' from the previous response's nextCursor value. For the first page, omit cursor entirely.",
  },
  offset: {
    correctParam: "cursor",
    message:
      "Use 'cursor' for pagination. The cursor value is returned in each paginated response.",
  },
  skip: {
    correctParam: "cursor",
    message: "Use 'cursor' from the pagination meta in responses.",
  },
  per_page: {
    correctParam: "limit",
    message: "Use 'limit' to control results per page (1-100, default 50).",
  },
  pagesize: {
    correctParam: "limit",
    message: "Use 'limit' to control page size (1-100, default 50).",
  },
  page_size: {
    correctParam: "limit",
    message: "Use 'limit' to control page size (1-100, default 50).",
  },
  count: {
    correctParam: "limit",
    message: "Use 'limit' to set number of results (1-100, default 50).",
  },

  // Rating aliases
  rating: {
    correctParam: "minRating",
    message:
      "Use 'minRating' and 'maxRating' to filter by overall rating (0-99).",
  },
  overall: {
    correctParam: "minRating",
    message: "Use 'minRating' or 'maxRating' to filter by overall rating.",
  },
  min_rating: {
    correctParam: "minRating",
    message: "Use 'minRating' (camelCase) for minimum rating filter.",
  },
  max_rating: {
    correctParam: "maxRating",
    message: "Use 'maxRating' (camelCase) for maximum rating filter.",
  },
  minrating: {
    correctParam: "minRating",
    message: "Use 'minRating' (camelCase) for minimum rating filter.",
  },
  maxrating: {
    correctParam: "maxRating",
    message: "Use 'maxRating' (camelCase) for maximum rating filter.",
  },

  // Team type aliases
  type: {
    correctParam: "teamType",
    message:
      "Use 'teamType' with values: 'curr' (current), 'class' (classic), or 'allt' (all-time).",
  },
  roster_type: {
    correctParam: "teamType",
    message: "Use 'teamType' with values: 'curr', 'class', or 'allt'.",
  },
  team_type: {
    correctParam: "teamType",
    message: "Use 'teamType' (camelCase) with values: 'curr', 'class', or 'allt'.",
  },
  roster: {
    correctParam: "teamType",
    message:
      "Use 'teamType' to select roster type: 'curr' (current), 'class' (classic), or 'allt' (all-time).",
  },

  // Position aliases
  pos: {
    correctParam: "position",
    message: "Use 'position' with values: PG, SG, SF, PF, or C.",
  },
  positions: {
    correctParam: "position",
    message: "Use 'position' (singular) with values: PG, SG, SF, PF, or C.",
  },

  // Team aliases
  team_name: {
    correctParam: "team",
    message: "Use 'team' parameter with the full team name (e.g., 'Los Angeles Lakers').",
  },
  teamname: {
    correctParam: "team",
    message: "Use 'team' parameter with the full team name.",
  },
};

/**
 * Valid parameters for each endpoint
 */
export const VALID_PARAMS_BY_ENDPOINT: Record<string, Set<string>> = {
  "/api/players": new Set([
    "teamType",
    "team",
    "minRating",
    "maxRating",
    "position",
    "cursor",
    "limit",
  ]),
  "/api/public/players": new Set([
    "teamType",
    "team",
    "minRating",
    "maxRating",
    "position",
    "cursor",
    "limit",
  ]),
  "/api/players/bulk": new Set([
    "teamType",
    "team",
    "minRating",
    "maxRating",
    "position",
  ]),
  "/api/players/search": new Set(["q", "teamType", "limit"]),
  "/api/players/:id": new Set([]),
  "/api/players/:id/history": new Set(["gameVersion", "limit"]),
  "/api/players/:id/attribute/:attr": new Set(["limit"]),
  "/api/players/:id/versions": new Set([]),
  "/api/players/slug/:slug": new Set(["teamType", "team"]),
  "/api/teams": new Set(["teamType"]),
  "/api/teams/:teamName/roster": new Set(["teamType"]),
  "/api/trending": new Set(["teamType", "days", "limit"]),
  "/api/badges": new Set(["category", "gameVersion"]),
  "/api/badges/categories": new Set([]),
  "/api/badges/:slug": new Set([]),
  "/api/badges/:slug/players": new Set(["tier", "limit"]),
  "/api/dashboard/usage": new Set([]),
};

/**
 * Detected unknown parameter with suggestion
 */
export interface UnknownParamError {
  param: string;
  suggestion?: string;
  correctParam?: string;
  correctEndpoint?: string;
}

/**
 * Detect unknown parameters in a request
 */
export function detectUnknownParams(
  actualParams: Record<string, string>,
  validParams: Set<string>
): UnknownParamError[] {
  const errors: UnknownParamError[] = [];

  for (const param of Object.keys(actualParams)) {
    if (!validParams.has(param)) {
      const suggestion = PARAM_SUGGESTIONS[param.toLowerCase()];
      const error: UnknownParamError = { param };
      if (suggestion?.message) error.suggestion = suggestion.message;
      if (suggestion?.correctParam) error.correctParam = suggestion.correctParam;
      if (suggestion?.correctEndpoint) error.correctEndpoint = suggestion.correctEndpoint;
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Format unknown parameters error for response
 */
export function formatUnknownParamsError(
  errors: UnknownParamError[],
  endpoint: string
): {
  message: string;
  code: string;
  details: {
    unknownParams: UnknownParamError[];
    endpoint: string;
    validParams: string[];
    hint: string;
  };
} {
  const paramList = errors.map((e) => `'${e.param}'`).join(", ");
  const mainSuggestion =
    errors[0]?.suggestion || "Check the API documentation for valid parameters.";

  // Get valid params for this endpoint
  const validParamsForEndpoint = VALID_PARAMS_BY_ENDPOINT[endpoint];
  const validParamsList = validParamsForEndpoint
    ? Array.from(validParamsForEndpoint)
    : [];

  return {
    message: `Unknown query parameter${errors.length > 1 ? "s" : ""}: ${paramList}`,
    code: "UNKNOWN_PARAMETERS",
    details: {
      unknownParams: errors,
      endpoint,
      validParams: validParamsList,
      hint: mainSuggestion,
    },
  };
}
