import type { MatchReference } from "../matchReference";
import type { Match } from "../api/types";

interface DraftPermissionInput {
  roles: readonly string[];
  matchReference: MatchReference | null;
  match?: Pick<Match, "type" | "tournamentId" | "teamAId" | "teamBId"> | null;
  currentTurnTeamId?: number | null;
  captainOf: ReadonlyArray<{ tournamentId: number; teamId: number }>;
  readOnly: boolean;
}

/** The developer lab follows the real draft turn without assigning a captain. */
export function deriveDraftPermissions({ roles, matchReference, match, currentTurnTeamId, captainOf, readOnly }: DraftPermissionInput) {
  const captainTeamId = match ? captainOf.find((assignment) => assignment.tournamentId === match.tournamentId
    && (assignment.teamId === match.teamAId || assignment.teamId === match.teamBId))?.teamId : undefined;
  const isCaptain = !readOnly && captainTeamId != null;
  const isDevOperator = !readOnly && matchReference === "dev" && match?.type === "PRACTICE" && roles.includes("DEVELOPER");
  const isManager = !readOnly && (roles.includes("ADMIN") || roles.includes("SOCIAL_MEDIA") || isDevOperator);
  const validTurn = match != null && currentTurnTeamId != null && (currentTurnTeamId === match.teamAId || currentTurnTeamId === match.teamBId);
  const actingTeamId = isDevOperator ? (validTurn ? currentTurnTeamId : undefined) : (isCaptain ? captainTeamId : undefined);
  return {
    isDevOperator,
    isManager,
    isCaptain,
    canActForTeam: isCaptain || isDevOperator,
    actingTeamId,
    canChooseForCurrentTurn: !readOnly && validTurn && actingTeamId === currentTurnTeamId,
  };
}
