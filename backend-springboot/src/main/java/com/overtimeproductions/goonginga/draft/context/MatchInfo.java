package com.overtimeproductions.goonginga.draft.context;

import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.time.Instant;
import java.util.Set;
import tools.jackson.databind.JsonNode;

/** Read model of the existing Match table. Spring owns only its draft-related updates. */
public record MatchInfo(int id, String type, String status, int bestOf, Instant startDate,
        int tournamentId, int teamAId, int teamBId, int teamAready, int teamBready,
        int mapWinsTeamA, int mapWinsTeamB, int gameNumber, Integer semanas, String title,
        Integer playoffRound, Integer playoffSlot, JsonNode mapsAllowedByRound, JsonNode mapResults,
        Instant mapStartedAt, boolean mapTimerPaused, Instant mapTimerPausedAt,
        Integer pauseRequestedBy, Instant pauseRequestedAt, MapType overlayFocusType, Integer overlayFocusMapId) {
    public boolean hasTeam(long teamId) { return teamAId == teamId || teamBId == teamId; }
    public boolean isBracket() { return playoffRound != null || Set.of("PLAYOFFS", "SEMIFINALS", "FINALS").contains(type); }
    public MatchInfo displayScores(Integer a,Integer b) {
        return new MatchInfo(id,type,status,bestOf,startDate,tournamentId,teamAId,teamBId,teamAready,teamBready,
                a==null?mapWinsTeamA:a,b==null?mapWinsTeamB:b,gameNumber,semanas,title,playoffRound,playoffSlot,
                mapsAllowedByRound,mapResults,mapStartedAt,mapTimerPaused,mapTimerPausedAt,pauseRequestedBy,pauseRequestedAt,overlayFocusType,overlayFocusMapId);
    }
    public int effectiveBestOf() {
        if (Integer.valueOf(3).equals(playoffRound) || "FINALS".equals(type)
                || (title != null && java.util.regex.Pattern.compile("grand\\s*final", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(title).find())) return 7;
        return bestOf > 0 ? bestOf : 5;
    }
}
