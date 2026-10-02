package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class MatchAdminService {
    private static final Set<String> TYPES=Set.of("ROUNDROBIN","PLAYINS","PLAYOFFS","SEMIFINALS","FINALS","PRACTICE");
    private static final Set<String> STATUSES=Set.of("SCHEDULED","ACTIVE","FINISHED");
    private static final Map<String,String> COLUMNS=Map.ofEntries(
            Map.entry("type","type"),Map.entry("bestOf","\"bestOf\""),Map.entry("status","status"),
            Map.entry("startDate","\"startDate\""),Map.entry("tournamentId","\"tournamentId\""),
            Map.entry("teamAId","\"teamAId\""),Map.entry("teamBId","\"teamBId\""),
            Map.entry("teamAready","\"teamAready\""),Map.entry("teamBready","\"teamBready\""),
            Map.entry("pointsTeamA","\"pointsTeamA\""),Map.entry("pointsTeamB","\"pointsTeamB\""),
            Map.entry("mapWinsTeamA","\"mapWinsTeamA\""),Map.entry("mapWinsTeamB","\"mapWinsTeamB\""),
            Map.entry("gameNumber","\"gameNumber\""),Map.entry("semanas","semanas"),
            Map.entry("title","title"),Map.entry("playoffRound","\"playoffRound\""),Map.entry("playoffSlot","\"playoffSlot\""),
            Map.entry("mapsAllowedByRound","\"mapsAllowedByRound\""),Map.entry("mapResults","\"mapResults\""),
            Map.entry("mapStartedAt","\"mapStartedAt\""),Map.entry("mapTimerPaused","\"mapTimerPaused\""),
            Map.entry("mapTimerPausedAt","\"mapTimerPausedAt\""),Map.entry("pauseRequestedAt","\"pauseRequestedAt\""),
            Map.entry("pauseRequestedBy","\"pauseRequestedBy\""),Map.entry("discordMessageId","\"discordMessageId\""),
            Map.entry("overlayFocusType","\"overlayFocusType\""),Map.entry("overlayFocusMapId","\"overlayFocusMapId\""));
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final MatchQueryService reads;
    private final TournamentRepository tournaments;
    private final ScheduleNotifications notifications;
    public MatchAdminService(JdbcTemplate jdbc,JsonSql json,MatchQueryService reads,TournamentRepository tournaments,ScheduleNotifications notifications) {
        this.jdbc=jdbc;this.json=json;this.reads=reads;this.tournaments=tournaments;
        this.notifications=notifications;
    }
    private JsonNode raw(int id) { return json.first("SELECT to_jsonb(m)::text FROM public.\"Match\" m WHERE id=?",id)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Match not found.")); }
    private static int positive(Object raw,String field) {
        if (!(raw instanceof Number n) || n.doubleValue()!=Math.rint(n.doubleValue()) || n.intValue()<1)
            throw new IllegalArgumentException(field+" must be a positive integer.");
        return n.intValue();
    }
    private static String type(Object raw) {
        String value=String.valueOf(raw).trim().toUpperCase();
        if (!TYPES.contains(value)) throw new IllegalArgumentException("Invalid match type.");
        return value;
    }
    private static String date(Object raw) {
        if (raw==null) return null;
        return LocalDateTime.ofInstant(TournamentService.parseDate(String.valueOf(raw)),ZoneOffset.UTC).toString();
    }
    private String validate(int tournamentId,String matchType,Integer week,int teamA,int teamB,Integer excludeId) {
        if (teamA==teamB) throw new IllegalArgumentException("teamAId and teamBId must be different.");
        String state=tournaments.get(tournamentId).get("state").asText();
        Set<String> allowed=switch (state) {
            case "ROUNDROBIN" -> Set.of("ROUNDROBIN");
            case "PLAYOFFS" -> Set.of("PLAYINS","PLAYOFFS");
            case "SEMIFINALS" -> Set.of("SEMIFINALS");
            case "FINALS" -> Set.of("FINALS");
            default -> TYPES;
        };
        if (!allowed.contains(matchType)) throw new IllegalArgumentException("Match type is not allowed in tournament state "+state+".");
        int known=jdbc.queryForObject("SELECT count(*) FROM public.\"Team\" WHERE \"tournamentId\"=? AND id IN (?,?)",Integer.class,tournamentId,teamA,teamB);
        if (known!=2) throw new IllegalArgumentException("Both teams must belong to this tournament.");
        if (matchType.equals("ROUNDROBIN")) {
            if (week==null || week<1) throw new IllegalArgumentException("semanas must be a positive integer.");
            int conflicts=jdbc.queryForObject("""
                    SELECT count(*) FROM public."Match" WHERE "tournamentId"=? AND type='ROUNDROBIN' AND semanas=?
                    AND ("teamAId" IN (?,?) OR "teamBId" IN (?,?)) AND (?::integer IS NULL OR id<>?)
                    """,Integer.class,tournamentId,week,teamA,teamB,teamA,teamB,excludeId,excludeId);
            if (conflicts>0) throw new IllegalArgumentException("Round robin week conflict: one of these teams is already scheduled in week "+week+".");
        }
        return state;
    }
    private int insert(int tournamentId,int teamA,int teamB,String matchType,int bestOf,Integer week,String title,String status,String startDate) {
        return jdbc.queryForObject("""
                INSERT INTO public."Match" ("tournamentId","teamAId","teamBId",type,"bestOf",semanas,title,status,"startDate")
                VALUES (?,?,?,?::"MatchType",?,?,?,?::"MatchStatus",?::timestamp) RETURNING id
                """,Integer.class,tournamentId,teamA,teamB,matchType,bestOf,week,title,status,startDate);
    }
    private void connectMaps(int matchId,List<Integer> mapIds) {
        for (Integer mapId:mapIds) jdbc.update("INSERT INTO public.\"_AllowedMaps\" (\"A\",\"B\") VALUES (?,?) ON CONFLICT DO NOTHING",mapId,matchId);
    }
    private List<Integer> allMapIds() { return jdbc.queryForList("SELECT id FROM public.\"Map\" ORDER BY id",Integer.class); }
    @Transactional
    public JsonNode create(Map<String,Object> input) {
        int tournamentId=positive(input.get("tournamentId"),"tournamentId"),a=positive(input.get("teamAId"),"teamAId"),b=positive(input.get("teamBId"),"teamBId");
        String matchType=type(input.get("type"));
        Integer week=input.get("semanas")==null?null:positive(input.get("semanas"),"semanas");
        validate(tournamentId,matchType,week,a,b,null);
        int bestOf=input.get("bestOf")==null?5:positive(input.get("bestOf"),"bestOf");
        String status=input.get("status")==null?"SCHEDULED":String.valueOf(input.get("status")).toUpperCase();
        if (!STATUSES.contains(status)) throw new IllegalArgumentException("Invalid match status.");
        int id=insert(tournamentId,a,b,matchType,bestOf,matchType.equals("ROUNDROBIN")?week:null,
                input.get("title")==null?null:String.valueOf(input.get("title")),status,date(input.get("startDate")));
        if (input.get("allowedMaps") instanceof Map<?,?> maps && maps.get("connect") instanceof List<?> connected) {
            var ids=new ArrayList<Integer>();
            for (Object raw:connected) if (raw instanceof Map<?,?> map) ids.add(positive(map.get("id"),"map id"));
            connectMaps(id,ids);
        }
        return raw(id);
    }
    @Transactional
    public List<JsonNode> generateRoundRobin(int tournamentId,String confirmation) {
        if (!"CONFIRM ROUND ROBIN".equals(confirmation)) throw new IllegalArgumentException("confirmationText must be exactly: CONFIRM ROUND ROBIN");
        tournaments.lock(tournamentId);
        if (!"ROUNDROBIN".equals(tournaments.get(tournamentId).get("state").asText()))
            throw new IllegalArgumentException("Round robin matches can only be generated when tournament state is ROUNDROBIN.");
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Match\" WHERE \"tournamentId\"=? AND type='ROUNDROBIN')",Boolean.class,tournamentId)))
            throw new IllegalArgumentException("This tournament already has round robin matches.");
        var participants=new ArrayList<Integer>(jdbc.queryForList("SELECT id FROM public.\"Team\" WHERE \"tournamentId\"=? ORDER BY id",Integer.class,tournamentId));
        if (participants.size()<2) throw new IllegalArgumentException("At least 2 teams are required for round robin generation.");
        int teamCount=participants.size();
        if (teamCount%2!=0) participants.add(null);
        var rotation=new ArrayList<Integer>(participants);
        var created=new ArrayList<JsonNode>();
        var pairs=new HashSet<String>();
        var maps=allMapIds();
        for (int round=0;round<rotation.size()-1;round++) {
            for (int i=0;i<rotation.size()/2;i++) {
                Integer a=rotation.get(i),b=rotation.get(rotation.size()-1-i);
                if (a==null || b==null) continue;
                if (i==0 && round%2==1) { int swap=a; a=b; b=swap; }
                String pair=Math.min(a,b)+"-"+Math.max(a,b);
                if (!pairs.add(pair)) throw new IllegalStateException("Duplicate round robin pairing.");
                int id=insert(tournamentId,a,b,"ROUNDROBIN",5,round+1,"Week "+(round+1),"SCHEDULED",null);
                connectMaps(id,maps);
                created.add(raw(id));
            }
            Integer last=rotation.remove(rotation.size()-1);
            rotation.add(1,last);
        }
        if (pairs.size()!=teamCount*(teamCount-1)/2) throw new IllegalStateException("Incomplete round robin schedule.");
        return created;
    }
    @Transactional
    public JsonNode update(int id,Map<String,Object> input,boolean manager) {
        jdbc.queryForList("SELECT id FROM public.\"Match\" WHERE id=? FOR UPDATE",Integer.class,id);
        JsonNode original=raw(id);
        if (input.isEmpty()) throw new IllegalArgumentException("No allowed fields to update.");
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM spring_draft.draft_sessions WHERE match_id=?)",Boolean.class,id))) {
            for(String field:List.of("type","bestOf","tournamentId","teamAId","teamBId","status","gameNumber","mapResults","mapWinsTeamA","mapWinsTeamB"))
                if(input.containsKey(field))throw new DraftHttpException(HttpStatus.CONFLICT,"Use draft phase commands or reset before changing "+field+" on a match with a draft.");
        }
        int tournamentId=input.get("tournamentId")==null?original.get("tournamentId").asInt():positive(input.get("tournamentId"),"tournamentId");
        int a=input.get("teamAId")==null?original.get("teamAId").asInt():positive(input.get("teamAId"),"teamAId");
        int b=input.get("teamBId")==null?original.get("teamBId").asInt():positive(input.get("teamBId"),"teamBId");
        String matchType=input.get("type")==null?original.get("type").asText():type(input.get("type"));
        Integer week=input.containsKey("semanas")?(input.get("semanas")==null?null:positive(input.get("semanas"),"semanas")):
                (original.get("semanas").isNull()?null:original.get("semanas").asInt());
        if(input.keySet().stream().anyMatch(Set.of("type","tournamentId","teamAId","teamBId","semanas")::contains))
            validate(tournamentId,matchType,week,a,b,id);
        var fields=new java.util.LinkedHashMap<>(input);
        fields.put("type",matchType);
        fields.put("semanas",matchType.equals("ROUNDROBIN")?week:null);
        if (manager) for (String forbidden:List.of("id","bestOf","tournamentId","teamAId","teamBId","allowedMaps")) fields.remove(forbidden);
        fields.remove("allowedMaps");
        var clauses=new ArrayList<String>();var args=new ArrayList<Object>();
        for (var entry:fields.entrySet()) {
            String column=COLUMNS.get(entry.getKey());
            if (column==null) throw new IllegalArgumentException("Unknown match field: "+entry.getKey());
            String cast=switch (entry.getKey()) {
                case "type" -> "::\"MatchType\""; case "status" -> "::\"MatchStatus\"";
                case "overlayFocusType" -> "::\"MapType\"";
                case "startDate","mapStartedAt","mapTimerPausedAt","pauseRequestedAt" -> "::timestamp";
                case "mapsAllowedByRound","mapResults" -> "::jsonb"; default -> "";
            };
            Object value=entry.getValue();
            if (entry.getKey().endsWith("At") || entry.getKey().equals("startDate")) value=date(value);
            if (entry.getKey().equals("mapsAllowedByRound") || entry.getKey().equals("mapResults")) value=value==null?null:json.stringify(value);
            if (entry.getKey().equals("status") && value!=null && !STATUSES.contains(String.valueOf(value))) throw new IllegalArgumentException("Invalid match status.");
            clauses.add(column+"=?"+cast);args.add(value);
        }
        args.add(id);
        jdbc.update("UPDATE public.\"Match\" SET "+String.join(",",clauses)+" WHERE id=?",args.toArray());
        if(input.containsKey("startDate"))notifications.enqueue(id);
        return raw(id);
    }
    @Transactional
    public JsonNode remove(int id) {
        JsonNode original=raw(id);
        boolean progress=Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM spring_draft.draft_maps d JOIN spring_draft.draft_sessions s ON s.id=d.draft_session_id WHERE s.match_id=?)",Boolean.class,id));
        if(progress || !original.path("status").asText().equals("SCHEDULED") || original.path("gameNumber").asInt()>0)
            throw new DraftHttpException(HttpStatus.CONFLICT,"Reset this match before deleting it.");
        jdbc.update("DELETE FROM spring_draft.draft_sessions WHERE match_id=?",id);
        jdbc.update("DELETE FROM public.\"DraftAction\" WHERE \"draftId\" IN (SELECT id FROM public.\"DraftTable\" WHERE \"matchId\"=?)",id);
        jdbc.update("DELETE FROM public.\"DraftTable\" WHERE \"matchId\"=?",id);
        jdbc.update("DELETE FROM public.\"PlayerStat\" WHERE \"matchId\"=?",id);
        jdbc.update("DELETE FROM public.\"Match\" WHERE id=?",id);
        return original;
    }
    @Transactional
    public Map<String,Object> updateWeekMaps(int tournamentId,int week,Object config) {
        if (tournamentId<1 || week<1 || (config!=null && !(config instanceof Map))) throw new IllegalArgumentException("Invalid week maps configuration.");
        List<Integer> ids=jdbc.queryForList("SELECT id FROM public.\"Match\" WHERE \"tournamentId\"=? AND type='ROUNDROBIN' AND semanas=?",Integer.class,tournamentId,week);
        if (ids.isEmpty()) throw new IllegalArgumentException("No matches found for week "+week+".");
        for (int id:ids) jdbc.update("UPDATE public.\"Match\" SET \"mapsAllowedByRound\"=?::jsonb WHERE id=?",config==null?null:json.stringify(config),id);
        return Map.of("message","Updated "+ids.size()+" matches in week "+week,"matches",ids.stream().map(this::raw).toList());
    }
    public Map<String,Object> weekMaps(int tournamentId,int week) {
        JsonNode value=json.first("SELECT COALESCE(\"mapsAllowedByRound\",'null'::jsonb)::text FROM public.\"Match\" WHERE \"tournamentId\"=? AND type='ROUNDROBIN' AND semanas=? LIMIT 1",tournamentId,week).orElse(null);
        var result=new java.util.HashMap<String,Object>();result.put("mapsAllowedByRound",value);return result;
    }
}
