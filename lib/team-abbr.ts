/**
 * NBA team full name → broadcast abbreviation.
 * Used by the new landing/board designs for compact team labels.
 */
export const TEAM_ABBREVIATIONS: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

/** Franchise → conference. Same includes-matching as abbreviations. */
export const TEAM_CONFERENCES: Record<string, "EAST" | "WEST"> = {
  "Atlanta Hawks": "EAST",
  "Boston Celtics": "EAST",
  "Brooklyn Nets": "EAST",
  "Charlotte Hornets": "EAST",
  "Chicago Bulls": "EAST",
  "Cleveland Cavaliers": "EAST",
  "Dallas Mavericks": "WEST",
  "Denver Nuggets": "WEST",
  "Detroit Pistons": "EAST",
  "Golden State Warriors": "WEST",
  "Houston Rockets": "WEST",
  "Indiana Pacers": "EAST",
  "LA Clippers": "WEST",
  "Los Angeles Clippers": "WEST",
  "Los Angeles Lakers": "WEST",
  "Memphis Grizzlies": "WEST",
  "Miami Heat": "EAST",
  "Milwaukee Bucks": "EAST",
  "Minnesota Timberwolves": "WEST",
  "New Orleans Pelicans": "WEST",
  "New York Knicks": "EAST",
  "Oklahoma City Thunder": "WEST",
  "Orlando Magic": "EAST",
  "Philadelphia 76ers": "EAST",
  "Phoenix Suns": "WEST",
  "Portland Trail Blazers": "WEST",
  "Sacramento Kings": "WEST",
  "San Antonio Spurs": "WEST",
  "Toronto Raptors": "EAST",
  "Utah Jazz": "WEST",
  "Washington Wizards": "EAST",
};

/**
 * Conference for any team name variant (classic/all-time included).
 * Historical relocations aside, this maps by the modern franchise name;
 * unknown names return null.
 */
export function getTeamConference(team: string): "EAST" | "WEST" | null {
  if (TEAM_CONFERENCES[team]) return TEAM_CONFERENCES[team];
  for (const [name, conf] of Object.entries(TEAM_CONFERENCES)) {
    if (team.includes(name)) return conf;
  }
  return null;
}

/**
 * Abbreviate any team name, including classic ("'96 Chicago Bulls") and
 * all-time ("All-Time Chicago Bulls") variants, by matching the modern
 * franchise name inside the string. Falls back to first 3 letters.
 */
export function getTeamAbbreviation(team: string): string {
  if (TEAM_ABBREVIATIONS[team]) return TEAM_ABBREVIATIONS[team];
  for (const [name, abbr] of Object.entries(TEAM_ABBREVIATIONS)) {
    if (team.includes(name)) return abbr;
  }
  return team.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
