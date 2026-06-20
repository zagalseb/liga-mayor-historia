export interface GameRecord {
  id: string;
  jornada: number | null;
  tipo: string;
  fecha: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
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
  if (!game) return null;
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

  const result: Record<string, TeamStanding[]> = {};
  for (const [nombre, teamIds] of Object.entries(grupos)) {
    result[nombre] = teamIds
      .map((id) => byTeam.get(id))
      .filter((s): s is TeamStanding => s !== undefined)
      .sort((a, b) => b.pct - a.pct || b.dif - a.dif);
  }
  return result;
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

    regularGames.push(game);

    const home = get(game.home_team_id);
    const away = get(game.away_team_id);
    const homeWon = game.home_score > game.away_score;

    home.pj++;
    home.pf += game.home_score;
    home.pc += game.away_score;
    homeWon ? home.g++ : home.p++;

    away.pj++;
    away.pf += game.away_score;
    away.pc += game.home_score;
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
