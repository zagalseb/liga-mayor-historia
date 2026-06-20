export interface GameRecord {
  id: string;
  jornada: number | null;
  tipo: string;
  fecha: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  lugar: string;
  neutral: boolean;
  cuenta_standing?: boolean;
}

export interface TeamStanding {
  team_id: string;
  pj: number;
  g: number;
  p: number;
  pct: number;
  pf: number;
  pc: number;
  dif: number;
}

// Returns true if `team_id` won the direct regular-season game against `rival_id`.
// Returns null if they never played.
function resultadoDirecto(
  teamId: string,
  rivalId: string,
  regularGames: GameRecord[]
): boolean | null {
  const game = regularGames.find(
    (g) =>
      (g.home_team_id === teamId && g.away_team_id === rivalId) ||
      (g.home_team_id === rivalId && g.away_team_id === teamId)
  );
  if (!game || game.home_score == null || game.away_score == null) return null;
  return game.home_team_id === teamId
    ? game.home_score > game.away_score
    : game.away_score > game.home_score;
}

/**
 * Ordena un grupo de equipos empatados en PCT siguiendo el reglamento oficial.
 * `allRegularGames` debe contener SOLO los partidos de temporada regular.
 */
export function resolverDesempate(
  tied: TeamStanding[],
  allRegularGames: GameRecord[]
): TeamStanding[] {
  if (tied.length <= 1) return tied;

  // ── EMPATE SIMPLE (2 equipos) ──────────────────────────────────────────────
  if (tied.length === 2) {
    const [a, b] = tied;
    const aGano = resultadoDirecto(a.team_id, b.team_id, allRegularGames);
    if (aGano === true) return [a, b];
    if (aGano === false) return [b, a];
    // No jugaron entre sí: menor PC gana
    return a.pc <= b.pc ? [a, b] : [b, a];
  }

  // ── EMPATE MÚLTIPLE (3 o más equipos) ──────────────────────────────────────
  const groupIds = new Set(tied.map((t) => t.team_id));
  const groupGames = allRegularGames.filter(
    (g) => groupIds.has(g.home_team_id) && groupIds.has(g.away_team_id)
  );

  // Paso 1: ¿algún equipo le ganó a TODOS los demás del grupo?
  for (const candidate of tied) {
    const others = tied.filter((t) => t.team_id !== candidate.team_id);
    const beatsAll = others.every((other) => {
      const gano = resultadoDirecto(candidate.team_id, other.team_id, groupGames);
      return gano === true;
    });
    if (beatsAll) {
      // Ese equipo va primero; resolver el resto recursivamente
      return [candidate, ...resolverDesempate(others, allRegularGames)];
    }
  }

  // Paso 2: Nadie le ganó a todos → ordenar por menor PC (temporada completa)
  // Paso 3: Si PC igual, usar goal average (PF/PC) mayor
  return [...tied].sort((a, b) => {
    if (a.pc !== b.pc) return a.pc - b.pc;
    const gaA = a.pc === 0 ? Infinity : a.pf / a.pc;
    const gaB = b.pc === 0 ? Infinity : b.pf / b.pc;
    return gaB - gaA;
  });
}

export function calcStandingsPorGrupo(
  games: GameRecord[],
  grupos: Record<string, string[]>
): Record<string, TeamStanding[]> {
  const allStandings = calcStandings(games);
  const byTeam = new Map(allStandings.map((s) => [s.team_id, s]));
  const regularGames = games.filter(
    (g) => g.tipo === 'regular' && g.cuenta_standing !== false
  );

  const result: Record<string, TeamStanding[]> = {};
  for (const [nombre, teamIds] of Object.entries(grupos)) {
    const rows = teamIds
      .map((id) => byTeam.get(id))
      .filter((s): s is TeamStanding => s !== undefined);

    rows.sort((a, b) => b.pct - a.pct);

    const resolved: TeamStanding[] = [];
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && rows[j].pct === rows[i].pct) j++;
      const group = rows.slice(i, j);
      resolved.push(...resolverDesempate(group, regularGames));
      i = j;
    }
    result[nombre] = resolved;
  }
  return result;
}

export function calcStandingsPorDivision(
  games: GameRecord[],
  divisiones: Record<string, { conferencia: string; equipos: string[] }>
): Record<string, TeamStanding[]> {
  const allStandings = calcStandings(games);
  const byTeam = new Map(allStandings.map((s) => [s.team_id, s]));
  const regularGames = games.filter(
    (g) => g.tipo === 'regular' && g.cuenta_standing !== false
  );

  const result: Record<string, TeamStanding[]> = {};
  for (const [divKey, { equipos }] of Object.entries(divisiones)) {
    const rows = equipos
      .map((id) => byTeam.get(id))
      .filter((s): s is TeamStanding => s !== undefined);

    rows.sort((a, b) => b.pct - a.pct);

    const resolved: TeamStanding[] = [];
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && rows[j].pct === rows[i].pct) j++;
      const group = rows.slice(i, j);
      resolved.push(...resolverDesempate(group, regularGames));
      i = j;
    }
    result[divKey] = resolved;
  }
  return result;
}

export function calcAllTimeStandings(
  seasons: { division: number; games: GameRecord[]; divisiones?: Record<string, { equipos: string[] }> }[],
  division: number
): TeamStanding[] {
  const map = new Map<string, TeamStanding>();

  const get = (id: string): TeamStanding => {
    if (!map.has(id)) {
      map.set(id, { team_id: id, pj: 0, g: 0, p: 0, pct: 0, pf: 0, pc: 0, dif: 0 });
    }
    return map.get(id)!;
  };

  const addForTeam = (teamId: string, myScore: number, theirScore: number) => {
    const entry = get(teamId);
    const won = myScore > theirScore;
    entry.pj++;
    entry.pf += myScore;
    entry.pc += theirScore;
    won ? entry.g++ : entry.p++;
  };

  for (const season of seasons) {
    if (season.divisiones) {
      const divInfo = season.divisiones[String(division)];
      if (!divInfo) continue;
      const divTeams = new Set(divInfo.equipos);
      for (const game of season.games) {
        if (game.cuenta_standing === false || game.home_score == null || game.away_score == null) continue;
        if (divTeams.has(game.home_team_id))
          addForTeam(game.home_team_id, game.home_score, game.away_score);
        if (divTeams.has(game.away_team_id))
          addForTeam(game.away_team_id, game.away_score, game.home_score);
      }
    } else {
      if (season.division !== division) continue;
      for (const game of season.games) {
        if (game.cuenta_standing === false || game.home_score == null || game.away_score == null) continue;
        addForTeam(game.home_team_id, game.home_score, game.away_score);
        addForTeam(game.away_team_id, game.away_score, game.home_score);
      }
    }
  }

  for (const entry of map.values()) {
    entry.dif = entry.pf - entry.pc;
    entry.pct = entry.pj > 0 ? entry.g / entry.pj : 0;
  }

  return [...map.values()].sort((a, b) =>
    b.pct !== a.pct ? b.pct - a.pct : b.dif - a.dif
  );
}

export function calcStandings(games: GameRecord[]): TeamStanding[] {
  const map = new Map<string, TeamStanding>();

  const get = (id: string): TeamStanding => {
    if (!map.has(id)) {
      map.set(id, { team_id: id, pj: 0, g: 0, p: 0, pct: 0, pf: 0, pc: 0, dif: 0 });
    }
    return map.get(id)!;
  };

  const regularGames: GameRecord[] = [];

  for (const game of games) {
    if (game.tipo !== 'regular') continue;
    if (game.cuenta_standing === false) continue;
    if (game.home_score == null || game.away_score == null) continue;

    regularGames.push(game);

    const home = get(game.home_team_id);
    const away = get(game.away_team_id);
    const hs = game.home_score as number;
    const as_ = game.away_score as number;
    const homeWon = hs > as_;

    home.pj++;
    home.pf += hs;
    home.pc += as_;
    homeWon ? home.g++ : home.p++;

    away.pj++;
    away.pf += as_;
    away.pc += hs;
    homeWon ? away.p++ : away.g++;
  }

  for (const entry of map.values()) {
    entry.dif = entry.pf - entry.pc;
    entry.pct = entry.pj > 0 ? entry.g / entry.pj : 0;
  }

  // Agrupar por PCT y resolver desempates dentro de cada grupo
  const all = [...map.values()];
  all.sort((a, b) => b.pct - a.pct);

  const result: TeamStanding[] = [];
  let i = 0;
  while (i < all.length) {
    let j = i + 1;
    while (j < all.length && all[j].pct === all[i].pct) j++;
    const group = all.slice(i, j);
    const resolved = resolverDesempate(group, regularGames);
    result.push(...resolved);
    i = j;
  }

  return result;
}
