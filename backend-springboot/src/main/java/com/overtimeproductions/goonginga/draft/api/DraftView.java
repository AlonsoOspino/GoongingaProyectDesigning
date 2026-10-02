package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** HTTP contract: phase preserves the current Next.js API; stage names the Java phase precisely. */
public record DraftView(long id, int matchId, Long currentTurnTeamId, String phase, DraftPhase stage,
        Instant phaseStartedAt, long remainingSeconds, long version, List<Action> actions,
        List<Long> bannedHeroes, List<Long> pickedMaps, Long currentMapId, MapType selectedMapType,
        List<MapType> allowedMapTypes, List<MapType> availableMapTypes, Map<MapType, Long> availableMapTypeCounts,
        List<MapInfo> availableMaps, List<MapInfo> allMaps, List<HeroInfo> heroes, MatchInfo match) {
    public record Action(long id, long draftId, int teamId, String action, Integer value,
            int gameNumber, int order, Instant createdAt) {}
    public record Share(int matchId, String key) {}
    public record PhaseRow(long id, int matchId, String phase, Integer currentTurnTeamId, MapType selectedMapType) {}
    public record MatchEnvelope(String message, MatchInfo match) {}
}
