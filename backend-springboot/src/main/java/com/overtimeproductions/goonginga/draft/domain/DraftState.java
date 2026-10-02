package com.overtimeproductions.goonginga.draft.domain;

import java.util.List;
import java.util.Set;

/** Immutable state for one match. Each phase returns a new state after validating a command. */
public record DraftState(
        long matchId,
        long teamAId,
        long teamBId,
        int mapNumber,
        int bestOf,
        int winsA,
        int winsB,
        DraftPhase phase,
        Long turnTeamId,
        MapType selectedMapType,
        Long currentMapId,
        Long lastPickerTeamId,
        Set<Long> usedMapIds,
        List<BanSelection> bans,
        List<MapResult> results
) {
    public DraftState {
        if (matchId <= 0 || teamAId <= 0 || teamBId <= 0 || teamAId == teamBId) {
            throw new IllegalArgumentException("Match and team ids must identify two distinct teams.");
        }
        if (mapNumber < 1 || bestOf < 1 || winsA < 0 || winsB < 0 || phase == null) {
            throw new IllegalArgumentException("Invalid map number, series score, or phase.");
        }
        if (turnTeamId != null && turnTeamId != teamAId && turnTeamId != teamBId) {
            throw new IllegalArgumentException("Turn team must belong to the match.");
        }
        if (lastPickerTeamId != null && lastPickerTeamId != teamAId && lastPickerTeamId != teamBId) {
            throw new IllegalArgumentException("Last picker must belong to the match.");
        }
        usedMapIds = Set.copyOf(usedMapIds);
        bans = List.copyOf(bans);
        results = List.copyOf(results);
    }

    public static DraftState newDraft(long matchId, long teamAId, long teamBId, int bestOf, long firstPickerTeamId) {
        return new DraftState(matchId, teamAId, teamBId, 1, bestOf, 0, 0,
                DraftPhase.PREPARATION, firstPickerTeamId, null, null, null,
                Set.of(), List.of(), List.of());
    }

    public boolean hasTeam(long teamId) {
        return teamId == teamAId || teamId == teamBId;
    }

    public long otherTeam(long teamId) {
        if (!hasTeam(teamId)) {
            throw new DraftRuleViolation("Team does not belong to this match.");
        }
        return teamId == teamAId ? teamBId : teamAId;
    }

    public void requirePhase(DraftPhase expected) {
        if (phase != expected) {
            throw new DraftRuleViolation("Expected " + expected + " but draft is in " + phase + ".");
        }
    }

    public void requireTurn(long teamId) {
        if (turnTeamId == null || turnTeamId != teamId) {
            throw new DraftRuleViolation("It is not this team's turn.");
        }
    }

    public int requiredWins() {
        return (bestOf + 1) / 2;
    }

    public Builder toBuilder() {
        return new Builder(this);
    }

    public static final class Builder {
        private final long matchId;
        private final long teamAId;
        private final long teamBId;
        private int mapNumber;
        private final int bestOf;
        private int winsA;
        private int winsB;
        private DraftPhase phase;
        private Long turnTeamId;
        private MapType selectedMapType;
        private Long currentMapId;
        private Long lastPickerTeamId;
        private Set<Long> usedMapIds;
        private List<BanSelection> bans;
        private List<MapResult> results;

        private Builder(DraftState state) {
            matchId = state.matchId;
            teamAId = state.teamAId;
            teamBId = state.teamBId;
            mapNumber = state.mapNumber;
            bestOf = state.bestOf;
            winsA = state.winsA;
            winsB = state.winsB;
            phase = state.phase;
            turnTeamId = state.turnTeamId;
            selectedMapType = state.selectedMapType;
            currentMapId = state.currentMapId;
            lastPickerTeamId = state.lastPickerTeamId;
            usedMapIds = state.usedMapIds;
            bans = state.bans;
            results = state.results;
        }

        public Builder mapNumber(int value) { mapNumber = value; return this; }
        public Builder wins(int a, int b) { winsA = a; winsB = b; return this; }
        public Builder phase(DraftPhase value) { phase = value; return this; }
        public Builder turnTeamId(Long value) { turnTeamId = value; return this; }
        public Builder selectedMapType(MapType value) { selectedMapType = value; return this; }
        public Builder currentMapId(Long value) { currentMapId = value; return this; }
        public Builder lastPickerTeamId(Long value) { lastPickerTeamId = value; return this; }
        public Builder usedMapIds(Set<Long> value) { usedMapIds = value; return this; }
        public Builder bans(List<BanSelection> value) { bans = value; return this; }
        public Builder results(List<MapResult> value) { results = value; return this; }

        public DraftState build() {
            return new DraftState(matchId, teamAId, teamBId, mapNumber, bestOf, winsA, winsB,
                    phase, turnTeamId, selectedMapType, currentMapId, lastPickerTeamId,
                    usedMapIds, bans, results);
        }
    }
}
