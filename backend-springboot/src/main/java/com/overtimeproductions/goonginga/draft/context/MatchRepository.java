package com.overtimeproductions.goonginga.draft.context;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class MatchRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public MatchRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public MatchInfo get(int id) { return load(id, false); }
    public MatchInfo lock(int id) { return load(id, true); }

    public List<Integer> unprovisionedScheduledIds() {
        return jdbc.queryForList("""
                SELECT m.id FROM public."Match" m
                WHERE m.status='SCHEDULED' AND m."gameNumber"=0 AND m."mapWinsTeamA"=0 AND m."mapWinsTeamB"=0
                  AND m."mapStartedAt" IS NULL
                  AND NOT EXISTS(SELECT 1 FROM spring_draft.draft_sessions s WHERE s.match_id=m.id)
                ORDER BY m.id
                """, Integer.class);
    }

    public void lockBracketTournament(int id) {
        MatchInfo match=get(id);
        if(match.isBracket())jdbc.queryForList("SELECT id FROM public.\"Tournament\" WHERE id=? FOR UPDATE",Integer.class,match.tournamentId());
    }

    private MatchInfo load(int id, boolean lock) {
        return jdbc.query("SELECT * FROM public.\"Match\" WHERE id = ?" + (lock ? " FOR UPDATE" : ""), this::map, id)
                .stream().findFirst().orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "Match not found."));
    }

    public int resolve(String reference) {
        if (!"dev".equalsIgnoreCase(reference)) {
            int id = Integer.parseInt(reference);
            if (id < 1) throw new IllegalArgumentException("Invalid match id.");
            return id;
        }
        return jdbc.queryForList("""
                SELECT m.id FROM public."Match" m JOIN public."Tournament" t ON t.id=m."tournamentId"
                WHERE t.name='GGL Developer Draft App' AND m.title='Developer Match' ORDER BY m.id DESC LIMIT 1
                """, Integer.class).stream().findFirst()
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "Developer match not found."));
    }

    public void start(int id) {
        jdbc.update("UPDATE public.\"Match\" SET status='ACTIVE' WHERE id=?", id);
    }

    public void startPlaying(int id, Instant now) {
        jdbc.update("UPDATE public.\"Match\" SET \"mapStartedAt\"=? WHERE id=?", utc(now), id);
    }

    public void syncScore(DraftState state) {
        var results = state.results().stream().map(r -> new ResultRow(r.mapNumber(), r.mapId(), r.winnerTeamId(), r.winnerTeamId() == null)).toList();
        jdbc.update("""
                UPDATE public."Match" SET "mapWinsTeamA"=?, "mapWinsTeamB"=?, "gameNumber"=?,
                    "mapResults"=?::jsonb, "teamAready"=0, "teamBready"=0, "mapStartedAt"=NULL,
                    "mapTimerPaused"=false, "mapTimerPausedAt"=NULL, "pauseRequestedBy"=NULL,
                    "pauseRequestedAt"=NULL, status=?::"MatchStatus", "bestOf"=? WHERE id=?
                """, state.winsA(), state.winsB(), results.size(), json.writeValueAsString(results),
                state.phase() == com.overtimeproductions.goonginga.draft.domain.DraftPhase.FINISHED ? "FINISHED" : "ACTIVE", state.bestOf(), state.matchId());
    }

    public void reset(int id) {
        jdbc.update("""
                UPDATE public."Match" SET status='SCHEDULED', "mapWinsTeamA"=0,"mapWinsTeamB"=0,
                    "startDate"=NULL,"pointsTeamA"=0,"pointsTeamB"=0,
                    "gameNumber"=0,"mapResults"='[]'::jsonb,"teamAready"=0,"teamBready"=0,
                    "mapStartedAt"=NULL,"mapTimerPaused"=false,"mapTimerPausedAt"=NULL,
                    "pauseRequestedBy"=NULL,"pauseRequestedAt"=NULL,"overlayFocusType"=NULL,"overlayFocusMapId"=NULL WHERE id=?
                """, id);
    }

    public void adjustMapStanding(int winner, int loser, int delta) {
        jdbc.update("UPDATE public.\"Team\" SET \"mapWins\"=\"mapWins\"+? WHERE id=?", delta, winner);
        jdbc.update("UPDATE public.\"Team\" SET \"mapLoses\"=\"mapLoses\"+? WHERE id=?", delta, loser);
    }

    public void lockTeams(MatchInfo match) {
        jdbc.queryForList("SELECT id FROM public.\"Team\" WHERE id IN (?,?) ORDER BY id FOR UPDATE", Integer.class, match.teamAId(), match.teamBId());
    }

    public boolean hasUploadedStats(int id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"PlayerStat\" WHERE \"matchId\"=?)", Boolean.class, id));
    }

    public void adjustSeriesStanding(int winner, int loser, int delta) {
        jdbc.update("UPDATE public.\"Team\" SET victories=victories+? WHERE id=?", delta, winner);
        jdbc.update("UPDATE public.\"Team\" SET defeats=defeats+? WHERE id=?", delta, loser);
    }

    public void pause(int id, boolean paused, Instant at) {
        jdbc.update("UPDATE public.\"Match\" SET \"mapTimerPaused\"=?,\"mapTimerPausedAt\"=? WHERE id=?", paused, paused ? utc(at) : null, id);
        if (!paused) clearPauseRequest(id);
    }

    public void requestPause(int id, int team, Instant at) {
        jdbc.update("UPDATE public.\"Match\" SET \"pauseRequestedBy\"=?,\"pauseRequestedAt\"=? WHERE id=?", team, utc(at), id);
    }

    public void clearPauseRequest(int id) {
        jdbc.update("UPDATE public.\"Match\" SET \"pauseRequestedBy\"=NULL,\"pauseRequestedAt\"=NULL WHERE id=?", id);
    }

    public void readiness(int id, boolean teamA, int ready) {
        String column = teamA ? "teamAready" : "teamBready";
        jdbc.update("UPDATE public.\"Match\" SET \"" + column + "\"=? WHERE id=?", ready, id);
    }

    public void schedule(int id, Instant startDate) {
        jdbc.update("UPDATE public.\"Match\" SET \"startDate\"=? WHERE id=?", utc(startDate), id);
    }

    public void overlay(int id, MapType type, Integer mapId) {
        jdbc.update("UPDATE public.\"Match\" SET \"overlayFocusType\"=?::\"MapType\",\"overlayFocusMapId\"=? WHERE id=?", type == null ? null : type.name(), mapId, id);
    }

    public boolean hasLegacyProgress(int id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM public."DraftTable" WHERE "matchId"=? AND
                  (phase <> 'STARTING' OR "currentMapId" IS NOT NULL OR jsonb_array_length("pickedMaps"::jsonb)>0))
                """, Boolean.class, id));
    }

    private MatchInfo map(ResultSet r, int row) throws SQLException {
        String focus = r.getString("overlayFocusType");
        return new MatchInfo(r.getInt("id"), r.getString("type"), r.getString("status"), r.getInt("bestOf"), instant(r,"startDate"),
                r.getInt("tournamentId"), r.getInt("teamAId"), r.getInt("teamBId"), r.getInt("teamAready"), r.getInt("teamBready"),
                r.getInt("mapWinsTeamA"), r.getInt("mapWinsTeamB"), r.getInt("gameNumber"), integer(r,"semanas"), r.getString("title"),
                integer(r,"playoffRound"), integer(r,"playoffSlot"), node(r.getString("mapsAllowedByRound")), node(r.getString("mapResults")),
                instant(r,"mapStartedAt"), r.getBoolean("mapTimerPaused"), instant(r,"mapTimerPausedAt"), integer(r,"pauseRequestedBy"),
                instant(r,"pauseRequestedAt"), focus == null ? null : MapType.valueOf(focus), integer(r,"overlayFocusMapId"));
    }

    private JsonNode node(String value) { return value == null ? null : json.readTree(value); }
    // Prisma stores these TIMESTAMP WITHOUT TIME ZONE columns as UTC, regardless of the JVM's local zone.
    private static LocalDateTime utc(Instant value) { return LocalDateTime.ofInstant(value, ZoneOffset.UTC); }
    public static Instant instant(ResultSet r, String field) throws SQLException {
        LocalDateTime value = r.getObject(field, LocalDateTime.class);
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
    public static Integer integer(ResultSet r, String field) throws SQLException { return r.getObject(field, Integer.class); }
    private record ResultRow(int gameNumber, long mapId, Long winnerTeamId, boolean isDraw) {}
}
