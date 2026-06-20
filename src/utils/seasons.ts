import type { GameRecord } from './standings';
export type { GameRecord };

export interface DivisionInfo {
  conferencia: string;
  equipos: string[];
}

interface RawSeasonFile {
  season: number;
  liga: string;
  conferencia: string;
  division: number;
  grupo?: string | null;
  grupos?: Record<string, string[]>;
  divisiones?: Record<string, DivisionInfo>;
  clasificados_playoffs?: string[];
  descenso?: string[];
  games: GameRecord[];
}

export interface SeasonData {
  year: number;
  liga: string;
  conferencia: string;
  division: number;
  grupo: string | null;
  grupos?: Record<string, string[]>;
  divisiones?: Record<string, DivisionInfo>;
  clasificados_playoffs?: string[];
  descenso?: string[];
  games: GameRecord[];
}

const modules = import.meta.glob<RawSeasonFile>(
  '../data/seasons/*.json',
  { eager: true, import: 'default' }
);

export const allSeasons: SeasonData[] = Object.values(modules)
  .map((raw) => ({
    year: raw.season,
    liga: raw.liga,
    conferencia: raw.conferencia,
    division: raw.division,
    grupo: raw.grupo ?? null,
    grupos: raw.grupos,
    divisiones: raw.divisiones,
    clasificados_playoffs: raw.clasificados_playoffs,
    descenso: raw.descenso,
    games: raw.games,
  }))
  .sort((a, b) => b.year - a.year);

export function seasonSlug(s: SeasonData): string {
  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  return `${s.year}-${normalize(s.liga)}-${normalize(s.conferencia)}`;
}

export function getSeasonYears(): number[] {
  return allSeasons.map((s) => s.year);
}

export function getSeasonGames(year: number): GameRecord[] {
  return allSeasons.find((s) => s.year === year)?.games ?? [];
}

export function getAllGames(): GameRecord[] {
  return allSeasons.flatMap((s) => s.games);
}
