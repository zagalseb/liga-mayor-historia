import { allSeasons, seasonSlug } from './seasons';
import type { SeasonData } from './seasons';
import specialGamesData from '../data/special-games.json';

export interface H2HGame {
  id: string;
  fecha: string | null;
  year: number;
  contextLabel: string;
  seasonSlug: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  tipo: string;
  subtipo: string | null;
  lugar: string | null;
  nota: string | null;
  esSpecialGame: boolean;
  cancelled: boolean;
}

export interface H2HRecord {
  winsA: number;
  winsB: number;
  ties: number;
  ptsA: number;
  ptsB: number;
  hasGames: boolean;
}

function contextLabelForSeason(s: SeasonData): string {
  if (s.division === 1 && s.year >= 2008 && s.year <= 2019) {
    return `${s.liga} ${s.year}`;
  }
  return `${s.liga} ${s.conferencia} ${s.year}`;
}

const TIPO_LABEL: Record<string, string> = {
  regular: 'Regular',
  playoffs_wildcard: 'Wild Card',
  playoffs_cuartos: 'Cuartos',
  playoffs_semi: 'Semifinal',
  final: 'Final',
  final_independencia: 'Final',
  final_libertad: 'Final',
  final_revolucion_independencia: 'Final',
  final_centro: 'Final',
  final_norte: 'Final',
  exhibicion: 'Exhibición',
};

export function tipoDisplayLabel(tipo: string, subtipo?: string | null): string {
  if (subtipo) return subtipo;
  return TIPO_LABEL[tipo] ?? tipo;
}

export function getHeadToHead(teamIdA: string, teamIdB: string): H2HGame[] {
  const games: H2HGame[] = [];

  for (const season of allSeasons) {
    const slug = seasonSlug(season);
    const label = contextLabelForSeason(season);
    for (const g of season.games) {
      const isAB =
        (g.home_team_id === teamIdA && g.away_team_id === teamIdB) ||
        (g.home_team_id === teamIdB && g.away_team_id === teamIdA);
      if (!isAB) continue;
      games.push({
        id: g.id,
        fecha: g.fecha ?? null,
        year: season.year,
        contextLabel: label,
        seasonSlug: slug,
        home_team_id: g.home_team_id,
        away_team_id: g.away_team_id,
        home_score: g.home_score ?? null,
        away_score: g.away_score ?? null,
        tipo: g.tipo,
        subtipo: null,
        lugar: g.lugar ?? null,
        nota: null,
        esSpecialGame: false,
        cancelled: g.home_score == null || g.away_score == null,
      });
    }
  }

  for (const g of specialGamesData.games) {
    const isAB =
      (g.home_team_id === teamIdA && g.away_team_id === teamIdB) ||
      (g.home_team_id === teamIdB && g.away_team_id === teamIdA);
    if (!isAB) continue;
    const year = g.fecha ? parseInt(g.fecha.slice(0, 4), 10) : 0;
    games.push({
      id: g.id,
      fecha: g.fecha ?? null,
      year,
      contextLabel: g.subtipo ?? g.tipo,
      seasonSlug: null,
      home_team_id: g.home_team_id,
      away_team_id: g.away_team_id,
      home_score: g.home_score ?? null,
      away_score: g.away_score ?? null,
      tipo: g.tipo,
      subtipo: g.subtipo ?? null,
      lugar: g.lugar ?? null,
      nota: g.nota ?? null,
      esSpecialGame: true,
      cancelled: g.home_score == null || g.away_score == null,
    });
  }

  games.sort((a, b) => {
    if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.fecha && !b.fecha) return a.year !== b.year ? a.year - b.year : -1;
    if (!a.fecha && b.fecha) return a.year !== b.year ? a.year - b.year : 1;
    return a.year - b.year;
  });

  return games;
}

export function calcH2HRecord(games: H2HGame[], teamIdA: string): H2HRecord {
  let winsA = 0, winsB = 0, ties = 0, ptsA = 0, ptsB = 0;
  let hasGames = false;

  for (const g of games) {
    if (g.cancelled) continue;
    const hs = g.home_score as number;
    const as_ = g.away_score as number;
    const aIsHome = g.home_team_id === teamIdA;
    const scoreA = aIsHome ? hs : as_;
    const scoreB = aIsHome ? as_ : hs;

    ptsA += scoreA;
    ptsB += scoreB;
    hasGames = true;

    if (scoreA > scoreB) winsA++;
    else if (scoreB > scoreA) winsB++;
    else ties++;
  }

  return { winsA, winsB, ties, ptsA, ptsB, hasGames };
}
