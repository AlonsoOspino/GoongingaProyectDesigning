package com.overtimeproductions.goonginga.draft.migration;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/** One-time, audited conversion of Prisma DraftTable/DraftAction history. */
@Service
public class LegacyDraftMigrationService {
    public record Review(int matchId, int legacyDraftId, String status, String phase, int completedMaps,
                         int pickedMaps, List<String> problems, List<String> notes) {}
    public record Report(int total, int ready, int alreadyMigrated, int blocked, List<Review> drafts) {}
    private record Plan(Review review, MatchInfo match, JsonNode legacy, List<JsonNode> picks,
                        Map<Integer,List<JsonNode>> bans, List<JsonNode> results, DraftPhase stage) {}

    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final MatchRepository matches;
    private final DraftStore store;
    private final com.overtimeproductions.goonginga.practice.PracticeDisplayRepository practice;

    public LegacyDraftMigrationService(JdbcTemplate jdbc, JsonSql json, MatchRepository matches, DraftStore store, com.overtimeproductions.goonginga.practice.PracticeDisplayRepository practice) {
        this.jdbc=jdbc; this.json=json; this.matches=matches; this.store=store;
        this.practice=practice;
    }

    private List<Integer> ids() {
        return jdbc.queryForList("""
            SELECT "matchId" FROM public."DraftTable"
            UNION SELECT id FROM public."Match" m WHERE
              ("gameNumber">0 OR "mapWinsTeamA">0 OR "mapWinsTeamB">0 OR status IN ('ACTIVE','FINISHED'))
              AND NOT EXISTS(SELECT 1 FROM spring_draft.draft_sessions s WHERE s.match_id=m.id)
            ORDER BY 1
            """,Integer.class);
    }

    public Report review() {
        List<Review> rows=ids().stream().map(id -> inspect(id,false).review()).toList();
        return new Report(rows.size(),(int)rows.stream().filter(r -> r.status().equals("READY")).count(),
                (int)rows.stream().filter(r -> r.status().equals("MIGRATED")).count(),
                (int)rows.stream().filter(r -> r.status().equals("BLOCKED")).count(),rows);
    }

    /** Refuse the entire batch when any draft cannot be reconstructed. Retry is idempotent. */
    @Transactional
    public Report apply() {
        var plans=new ArrayList<Plan>();
        for (int id:ids()) plans.add(inspect(id,true));
        var blocked=plans.stream().filter(p -> p.review().status().equals("BLOCKED")).toList();
        if (!blocked.isEmpty()) throw new DraftHttpException(HttpStatus.CONFLICT,
                "Legacy draft migration stopped. Review /admin/migrations/legacy-drafts; blocked matches: "
                + blocked.stream().map(p -> String.valueOf(p.review().matchId())).toList());
        for (Plan plan:plans) {
            if (plan.review().status().equals("READY")) importPlan(plan);
            if(plan.review().status().equals("READY")||plan.review().status().equals("MIGRATED"))track(plan.review().matchId(),plan.review().legacyDraftId());
        }
        return review();
    }

    private Plan inspect(int matchId, boolean lock) {
        MatchInfo match=lock?matches.lock(matchId):matches.get(matchId);
        JsonNode legacy=json.first("SELECT to_jsonb(d)::text FROM public.\"DraftTable\" d WHERE \"matchId\"=?",matchId).orElse(null);
        if(legacy==null)return new Plan(new Review(matchId,0,"BLOCKED",null,match.gameNumber(),0,
                List.of("Progressed match has no DraftTable. Restore its history or audit this record before migration."),List.of()),match,null,List.of(),Map.of(),List.of(),null);
        int legacyId=legacy.get("id").asInt();
        List<String> problems=new ArrayList<>();
        List<String> notes=new ArrayList<>();
        if(store.exists(matchId)) {
            List<String> imported=jdbc.queryForList("SELECT source_fingerprint FROM spring_draft.legacy_imports WHERE match_id=?",String.class,matchId);
            if(!imported.isEmpty()) {
                if(!imported.getFirst().equals(fingerprint(matchId)))problems.add("Legacy source changed after import. Stop Node writes and audit both histories.");
                int completed=0,picked=0;
                try {var loaded=store.byMatch(matchId);completed=loaded.state().results().size();picked=loaded.maps().size();}
                catch(RuntimeException invalid){problems.add("Existing Spring draft is inconsistent with Match.");}
                return new Plan(new Review(matchId,legacyId,problems.isEmpty()?"MIGRATED":"BLOCKED",legacy.path("phase").asText(),completed,picked,List.copyOf(problems),List.of()),
                        match,legacy,List.of(),Map.of(),List.of(),null);
            }
        }
        List<JsonNode> actions=json.list("SELECT to_jsonb(a)::text FROM public.\"DraftAction\" a WHERE \"draftId\"=? ORDER BY \"order\",id",legacyId);
        boolean rehearsal=isRehearsal(match) && actions.stream().noneMatch(a->a.path("action").asText().equals("PICK"))
                && (match.mapResults()==null||match.mapResults().isNull()||(match.mapResults().isArray()&&match.mapResults().isEmpty()));
        if(rehearsal&&!store.exists(matchId)) {
            if(!legacy.path("phase").asText().equals("STARTING"))problems.add("Practice without PICK history must be STARTING.");
            if(actions.stream().anyMatch(a->!a.path("action").asText().equals("BAN")||!match.hasTeam(a.path("teamId").asInt())))problems.add("Invalid practice display action.");
            if(match.gameNumber()!=0)problems.add("Practice gameNumber has no results.");
            return new Plan(new Review(matchId,legacyId,problems.isEmpty()?"READY":"BLOCKED","STARTING",0,0,List.copyOf(problems),List.of()),match,legacy,List.of(),Map.of(),List.of(),DraftPhase.PREPARATION);
        }
        Map<Integer,JsonNode> picksByGame=new HashMap<>();
        Map<Integer,List<JsonNode>> bans=new HashMap<>();
        for (JsonNode action:actions) {
            int number=action.get("gameNumber").asInt();
            String kind=action.get("action").asText();
            if (number<1) problems.add("Invalid action gameNumber.");
            if (!match.hasTeam(action.get("teamId").asInt())) problems.add("Action team is not in this match.");
            if (kind.equals("PICK")) {
                if (action.get("value").isNull() || picksByGame.putIfAbsent(number,action)!=null)
                    problems.add("Each map needs exactly one valid PICK action.");
            } else if (kind.equals("BAN")) bans.computeIfAbsent(number,k -> new ArrayList<>()).add(action);
            else problems.add("Unsupported legacy action: "+kind);
        }
        List<JsonNode> results=new ArrayList<>();
        if (match.mapResults()!=null && match.mapResults().isArray()) match.mapResults().forEach(results::add);
        else if (match.mapResults()!=null && !match.mapResults().isNull()) problems.add("mapResults is not an array.");
        if (results.size()!=match.gameNumber()) problems.add("Match gameNumber differs from mapResults length.");
        List<JsonNode> picks=new ArrayList<>();
        for (int number=1;number<=picksByGame.size();number++) {
            JsonNode pick=picksByGame.get(number);
            if (pick==null) { problems.add("PICK game numbers are not sequential."); break; }
            picks.add(pick);
        }
        if (picks.size()!=picksByGame.size() || picks.size()<results.size() || picks.size()>results.size()+1)
            problems.add("PICK history does not match completed maps.");
        int aWins=0,bWins=0;
        for (int i=0;i<results.size();i++) {
            JsonNode result=results.get(i);
            if (result.path("gameNumber").asInt()!=i+1 || i>=picks.size()
                    || result.path("mapId").asInt()!=picks.get(i).path("value").asInt())
                problems.add("Map result does not match its PICK action at game "+(i+1)+".");
            int winner=result.path("winnerTeamId").asInt(0);
            if (winner==match.teamAId()) aWins++;
            else if (winner==match.teamBId()) bWins++;
            else if (winner!=0 || !result.path("isDraw").asBoolean(false)) problems.add("Invalid winner/draw at game "+(i+1)+".");
        }
        if (aWins!=match.mapWinsTeamA() || bWins!=match.mapWinsTeamB()) problems.add("Map win totals differ from results.");
        var seenMaps=new HashSet<Integer>();
        for (JsonNode pick:picks) {
            int id=pick.path("value").asInt();
            if (!seenMaps.add(id)) problems.add("A map was picked twice.");
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Map\" WHERE id=?)",Boolean.class,id))) {
                if(pick.path("gameNumber").asInt()>results.size())problems.add("Pending map "+id+" no longer exists.");
                else notes.add("Retired map "+id+" is preserved as historical id; unavailable catalog metadata is left null.");
            }
        }
        JsonNode pickedMaps=legacy.path("pickedMaps");
        if (!pickedMaps.isArray() || pickedMaps.size()!=picks.size()) problems.add("pickedMaps differs from PICK history.");
        else for (int i=0;i<picks.size();i++) if (pickedMaps.get(i).asInt()!=picks.get(i).path("value").asInt())
            problems.add("pickedMaps order differs from PICK history.");
        for (var entry:bans.entrySet()) {
            if (!picksByGame.containsKey(entry.getKey()) || entry.getValue().size()>4) problems.add("BAN history has no map or more than four turns.");
            Set<Integer> heroes=new HashSet<>();
            for (JsonNode ban:entry.getValue()) if (!ban.get("value").isNull()) {
                int hero=ban.get("value").asInt();
                if (!heroes.add(hero)) problems.add("Hero banned twice on one map.");
                if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Hero\" WHERE id=?)",Boolean.class,hero)))
                    problems.add("Banned hero "+hero+" no longer exists.");
            }
        }
        DraftPhase stage=null;
        String phase=legacy.path("phase").asText();
        try {
            stage=switch(phase) {
                case "STARTING" -> DraftPhase.PREPARATION;
                case "MAPTYPEPICKING" -> DraftPhase.MAP_TYPE_SELECTION;
                case "MAPPICKING" -> picks.size()>results.size()?DraftPhase.MAP_LOCKED:DraftPhase.MAP_SELECTION;
                case "BAN" -> DraftPhase.HERO_BANS;
                case "PLAYING" -> DraftPhase.PLAYING;
                case "ENDMAP" -> DraftPhase.RESULT_PENDING;
                case "FINISHED" -> DraftPhase.FINISHED;
                default -> throw new IllegalArgumentException();
            };
        } catch (IllegalArgumentException invalid) { problems.add("Unknown legacy phase: "+phase); }
        boolean activePick=picks.size()>results.size();
        if (activePick && legacy.path("currentMapId").asInt()!=picks.getLast().path("value").asInt())
            problems.add("currentMapId differs from the latest PICK.");
        if (!activePick && !legacy.path("currentMapId").isNull()) problems.add("currentMapId exists without a pending PICK.");
        if (Set.of("BAN","PLAYING","ENDMAP").contains(phase) && !activePick) problems.add("Active phase has no pending map.");
        if (phase.equals("FINISHED") && !match.status().equals("FINISHED")) problems.add("Finished draft has unfinished match.");
        if (match.status().equals("FINISHED") && !phase.equals("FINISHED")) problems.add("Finished match has unfinished draft.");
        if (activePick && (phase.equals("STARTING") || phase.equals("MAPTYPEPICKING") || phase.equals("FINISHED")))
            problems.add("Pending map conflicts with draft phase.");
        Integer turn=nullableInt(legacy,"currentTurnTeamId");
        if (turn!=null && !match.hasTeam(turn)) problems.add("Turn team is not in this match.");
        if (stage==DraftPhase.HERO_BANS && activePick && bans.getOrDefault(results.size()+1,List.of()).size()==4)
            problems.add("Four bans should have advanced to PLAYING.");
        if (stage==DraftPhase.PLAYING && activePick && bans.getOrDefault(results.size()+1,List.of()).size()!=4)
            problems.add("PLAYING requires four ban turns.");
        if(stage==DraftPhase.MAP_SELECTION && legacy.path("selectedMapType").isNull())problems.add("Map selection has no selected map type.");
        if(Set.of("MAPTYPEPICKING","MAPPICKING","BAN").contains(phase)&&turn==null)problems.add("Timed phase has no turn team.");
        if(activePick&&!legacy.path("selectedMapType").isNull()) {
            String actual=jdbc.queryForList("SELECT type::text FROM public.\"Map\" WHERE id=?",String.class,picks.getLast().path("value").asInt()).stream().findFirst().orElse(null);
            if(!legacy.path("selectedMapType").asText().equals(actual))problems.add("Selected map type differs from picked map.");
        }
        boolean migrated=store.exists(matchId);
        if(migrated) {
            try {store.byMatch(matchId);}catch(RuntimeException invalid){problems.add("Existing Spring draft is inconsistent with Match.");}
            List<String> fingerprints=jdbc.queryForList("SELECT source_fingerprint FROM spring_draft.legacy_imports WHERE match_id=?",String.class,matchId);
            if(!fingerprints.isEmpty()&&!fingerprints.getFirst().equals(fingerprint(matchId)))problems.add("Legacy source changed after import. Stop Node writes and audit both histories.");
            // Match scores advance under Java while the legacy archive stays unchanged.
            if(!fingerprints.isEmpty())problems.removeIf(p->p.equals("Match gameNumber differs from mapResults length.")||p.equals("Map win totals differ from results.")||p.startsWith("Map result does not match")||p.equals("PICK history does not match completed maps.")||p.equals("Finished match has unfinished draft."));
            else try {if(store.byMatch(matchId).state().phase()!=stage||store.byMatch(matchId).maps().size()!=picks.size())problems.add("Existing Spring draft has no import audit and differs from legacy state.");}catch(RuntimeException invalid){problems.add("Existing Spring draft could not be loaded.");}
        }
        String status=problems.isEmpty()?(migrated?"MIGRATED":"READY"):"BLOCKED";
        var review=new Review(matchId,legacyId,status,phase,results.size(),picks.size(),List.copyOf(problems),List.copyOf(notes));
        return new Plan(review,match,legacy,List.copyOf(picks),bans,List.copyOf(results),stage);
    }

    private void importPlan(Plan plan) {
        MatchInfo match=plan.match(); JsonNode legacy=plan.legacy();
        if(isRehearsal(match)&&plan.picks().isEmpty()&&plan.results().isEmpty()) {
            practice.scores(match.id(),match.mapWinsTeamA(),match.mapWinsTeamB());
            List<JsonNode> manual=json.list("SELECT to_jsonb(a)::text FROM public.\"DraftAction\" a WHERE \"draftId\"=? AND action='BAN' ORDER BY \"order\",id",plan.review().legacyDraftId());
            practice.bans(match.id(),manual.stream().filter(a->a.path("teamId").asInt()==match.teamAId()&&!a.path("value").isNull()).map(a->a.path("value").asInt()).toList(),
                    manual.stream().filter(a->a.path("teamId").asInt()==match.teamBId()&&!a.path("value").isNull()).map(a->a.path("value").asInt()).toList());
            jdbc.update("UPDATE public.\"Match\" SET \"mapWinsTeamA\"=0,\"mapWinsTeamB\"=0,\"gameNumber\"=0,\"mapResults\"='[]'::jsonb WHERE id=?",match.id());
            store.create(matches.get(match.id()),com.overtimeproductions.goonginga.draft.domain.DraftState.newDraft(match.id(),match.teamAId(),match.teamBId(),match.effectiveBestOf(),match.teamAId()),Instant.parse(legacy.path("phaseStartedAt").asText()));
            return;
        }
        int completed=plan.results().size(),number=plan.stage()==DraftPhase.FINISHED?Math.max(1,completed):completed+1;
        Integer turn=nullableInt(legacy,"currentTurnTeamId");
        String selected=legacy.path("selectedMapType").isNull()?null:legacy.path("selectedMapType").asText();
        Instant started=Instant.parse(legacy.get("phaseStartedAt").asText());
        Instant deadline=Set.of(DraftPhase.MAP_TYPE_SELECTION,DraftPhase.MAP_SELECTION,DraftPhase.HERO_BANS).contains(plan.stage())
                ? started.plusSeconds(95):null;
        Instant paused=match.mapTimerPaused()?match.mapTimerPausedAt():null;
        long sessionId=jdbc.queryForObject("""
                INSERT INTO spring_draft.draft_sessions
                  (match_id,phase,map_number,turn_team_id,selected_map_type,phase_started_at,turn_deadline_at,paused_at)
                VALUES (?,?,?,?,?,?,?,?) RETURNING id
                """,Long.class,match.id(),plan.stage().name(),number,turn,selected,
                java.sql.Timestamp.from(started),deadline==null?null:java.sql.Timestamp.from(deadline),
                paused==null?null:java.sql.Timestamp.from(paused));
        for (int i=0;i<plan.picks().size();i++) {
            JsonNode pick=plan.picks().get(i);
            int mapId=pick.get("value").asInt(),game=i+1;
            String mapType=jdbc.queryForList("SELECT type::text FROM public.\"Map\" WHERE id=?",String.class,mapId).stream().findFirst().orElse(null);
            boolean done=i<completed;
            Integer winner=done?nullableInt(plan.results().get(i),"winnerTeamId"):null;
            Instant pickedAt=Instant.parse(pick.get("createdAt").asText());
            long mapRow=jdbc.queryForObject("""
                    INSERT INTO spring_draft.draft_maps
                    (draft_session_id,map_number,map_id,map_type,picker_team_id,selected_at,play_started_at,result_recorded_at,winner_team_id,is_draw)
                    VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id
                    """,Long.class,sessionId,game,mapId,mapType,pick.get("teamId").asInt(),
                    java.sql.Timestamp.from(pickedAt),done?java.sql.Timestamp.from(pickedAt):match.mapStartedAt()==null?null:java.sql.Timestamp.from(match.mapStartedAt()),
                    done?java.sql.Timestamp.from(started):null,winner,done && winner==null);
            int turnNumber=1;
            for (JsonNode ban:plan.bans().getOrDefault(game,List.of())) {
                Integer hero=nullableInt(ban,"value");
                jdbc.update("""
                        INSERT INTO spring_draft.draft_bans (draft_map_id,turn_number,team_id,hero_id,created_at)
                        VALUES (?,?,?,?,?)
                        """,mapRow,turnNumber++,ban.get("teamId").asInt(),hero,
                        java.sql.Timestamp.from(Instant.parse(ban.get("createdAt").asText())));
            }
        }
        // DraftStore independently verifies every imported result against Match before commit.
        store.byMatch(match.id());
    }

    private boolean isRehearsal(MatchInfo match) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Tournament\" WHERE id=? AND name='GGL Developer Draft App')",Boolean.class,match.tournamentId()));
    }
    private String fingerprint(int matchId) {
        return jdbc.queryForObject("""
            SELECT md5(jsonb_build_object('draft',to_jsonb(d),'actions',COALESCE(
              (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public."DraftAction" a WHERE a."draftId"=d.id),'[]'::jsonb))::text)
            FROM public."DraftTable" d WHERE d."matchId"=?
            """,String.class,matchId);
    }
    private void track(int matchId,int legacyId) {
        jdbc.update("INSERT INTO spring_draft.legacy_imports(match_id,legacy_draft_id,source_fingerprint) VALUES (?,?,?) ON CONFLICT DO NOTHING",matchId,legacyId,fingerprint(matchId));
    }

    private static Integer nullableInt(JsonNode row,String field) {
        JsonNode value=row.path(field); return value.isMissingNode() || value.isNull()?null:value.asInt();
    }
}
