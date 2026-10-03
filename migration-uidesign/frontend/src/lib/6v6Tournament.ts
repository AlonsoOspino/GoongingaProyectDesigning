export type TournamentStage = "rounds" | "brackets" | "finals";

export interface TournamentTeam {
  id: string;
  name: string;
  logo: string;
}

export interface TournamentMatch {
  id: string;
  roundId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
}

export interface TournamentRound {
  id: string;
  name: string;
  stage: TournamentStage;
  sit: string;
}

export interface TournamentState {
  title: string;
  stage: TournamentStage;
  activeRoundId: string;
  spectatedMatchId: string;
  teams: TournamentTeam[];
  rounds: TournamentRound[];
  matches: TournamentMatch[];
}

const names = [
  "Pnut Butter Jelly Time", "Old Heads", "Cyber Fan Club #Thomp", "6 fiddlesticks",
  "Legos", "Creamy", "Bdub", "Jared", "Wildpants",
];

export const initialTournamentState: TournamentState = {
  title: "6V6 TOURNAMENT",
  stage: "rounds",
  activeRoundId: "r1",
  spectatedMatchId: "r1m1",
  teams: names.map((name, index) => ({ id: `t${index + 1}`, name, logo: "" })),
  rounds: [
    { id: "r1", name: "Round 1", stage: "rounds", sit: "Legos" },
    { id: "r2", name: "Round 2", stage: "rounds", sit: "Wildpants" },
    { id: "r3", name: "Round 3", stage: "rounds", sit: "Creamy, Bdub, Jared" },
    { id: "bracket", name: "Brackets", stage: "brackets", sit: "" },
    { id: "final", name: "Finals", stage: "finals", sit: "" },
  ],
  matches: [
    { id: "r1m1", roundId: "r1", teamAId: "t1", teamBId: "t2", scoreA: 0, scoreB: 0 },
    { id: "r1m2", roundId: "r1", teamAId: "t3", teamBId: "t4", scoreA: 0, scoreB: 0 },
    { id: "r2m1", roundId: "r2", teamAId: "t6", teamBId: "t5", scoreA: 0, scoreB: 0 },
    { id: "r2m2", roundId: "r2", teamAId: "t7", teamBId: "t8", scoreA: 0, scoreB: 0 },
    { id: "r3m1", roundId: "r3", teamAId: "t9", teamBId: "t5", scoreA: 0, scoreB: 0 },
    { id: "b1", roundId: "bracket", teamAId: "", teamBId: "", scoreA: 0, scoreB: 0 },
    { id: "b2", roundId: "bracket", teamAId: "", teamBId: "", scoreA: 0, scoreB: 0 },
    { id: "f1", roundId: "final", teamAId: "", teamBId: "", scoreA: 0, scoreB: 0 },
  ],
};

export function tournamentTeam(state: TournamentState, id: string) {
  return state.teams.find((team) => team.id === id);
}

export function activeTournamentMatch(state: TournamentState) {
  return state.matches.find((match) => match.id === state.spectatedMatchId)
    ?? state.matches.find((match) => match.roundId === state.activeRoundId);
}
