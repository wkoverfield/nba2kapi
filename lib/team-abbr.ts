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
