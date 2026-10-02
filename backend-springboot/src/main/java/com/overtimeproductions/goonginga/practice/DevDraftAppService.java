package com.overtimeproductions.goonginga.practice;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.api.DraftRequests;
import com.overtimeproductions.goonginga.draft.application.MatchControlService;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.league.MatchQueryService;
import com.overtimeproductions.goonginga.league.TeamRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
@Transactional
public class DevDraftAppService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final TeamRepository teams;
    private final DraftCatalog catalog;
    private final MatchRepository matches;
    private final MatchQueryService query;
    private final DraftStore drafts;
    private final MatchControlService controls;
    private final PracticeDisplayRepository display;
    private final Clock clock;
    public DevDraftAppService(JdbcTemplate jdbc,JsonSql json,TeamRepository teams,DraftCatalog catalog,MatchRepository matches,
            MatchQueryService query,DraftStore drafts,MatchControlService controls,PracticeDisplayRepository display,Clock clock) {
        this.jdbc=jdbc;this.json=json;this.teams=teams;this.catalog=catalog;this.matches=matches;this.query=query;
        this.drafts=drafts;this.controls=controls;this.display=display;this.clock=clock;
    }
    private int tournament() {
        jdbc.queryForList("SELECT pg_advisory_xact_lock(778931205)");
        var ids=jdbc.queryForList("SELECT id FROM public.\"Tournament\" WHERE name='GGL Developer Draft App' ORDER BY id LIMIT 1",Integer.class);
        int id=ids.isEmpty()?jdbc.queryForObject("INSERT INTO public.\"Tournament\" (name,\"startDate\",state) VALUES ('GGL Developer Draft App','1990-01-01'::timestamp,'FINISHED'::\"TournamentState\") RETURNING id",Integer.class):ids.getFirst();
        jdbc.update("UPDATE public.\"Tournament\" SET state='FINISHED',\"startDate\"='1990-01-01'::timestamp WHERE id=?",id);return id;
    }
    private Integer matchId(int tournamentId) {
        return jdbc.queryForList("SELECT id FROM public.\"Match\" WHERE \"tournamentId\"=? AND title='Developer Match' ORDER BY id DESC LIMIT 1",Integer.class,tournamentId).stream().findFirst().orElse(null);
    }
    private int requireMatch() {
        Integer id=matchId(tournament());if (id==null) throw new DraftHttpException(HttpStatus.NOT_FOUND,"Developer match not found.");return id;
    }
    public Map<String,Object> state() {
        int tournament=tournament();Integer matchId=matchId(tournament);
        var result=new LinkedHashMap<String,Object>();result.put("teams",teams.forTournament(tournament));result.put("maps",catalog.allMaps());result.put("heroes",catalog.heroes());
        var bans=new LinkedHashMap<String,Object>();bans.put("teamA",List.of());bans.put("teamB",List.of());
        JsonNode match=null;
        if (matchId!=null) {
            ObjectNode object=(ObjectNode)query.get(String.valueOf(matchId));
            object.set("teamA",teams.get(object.get("teamAId").asInt()));object.set("teamB",teams.get(object.get("teamBId").asInt()));match=object;
            var current=display.get(matchId).orElse(null);
            if (current!=null && current.bansA()!=null && current.bansB()!=null) {bans.put("teamA",current.bansA());bans.put("teamB",current.bansB());}
        }
        result.put("match",match);result.put("bans",bans);return result;
    }
    public Map<String,Object> createTeam(Map<String,Object> input) {
        String name=input.get("name") instanceof String n?n.trim():"",logo=input.get("logo") instanceof String l?l.trim():"";
        if (name.isBlank() || name.length()>60) throw new IllegalArgumentException("Team name must contain between 1 and 60 characters.");
        if (logo.isBlank() || logo.length()>2048 || !(logo.startsWith("/") || logo.matches("(?i)^https?://.*"))) throw new IllegalArgumentException("Team logo must be an absolute URL or public path.");
        int tournament=tournament();
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Team\" WHERE \"tournamentId\"=? AND lower(name)=lower(?))",Boolean.class,tournament,name)))
            throw new DraftHttpException(HttpStatus.CONFLICT,"A developer team with that name already exists.");
        teams.create(name,tournament,logo,null,null,null,null);return state();
    }
    public Map<String,Object> deleteTeam(int id) {
        if (teams.get(id).get("tournamentId").asInt()!=tournament()) throw new DraftHttpException(HttpStatus.NOT_FOUND,"Developer team not found.");
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Match\" WHERE \"teamAId\"=? OR \"teamBId\"=?)",Boolean.class,id,id)))
            throw new DraftHttpException(HttpStatus.CONFLICT,"Delete the developer match before deleting this team.");
        teams.remove(id);return state();
    }
    public Map<String,Object> createMatch(Map<String,Object> input) {
        int a=integer(input.get("teamAId"),true),b=integer(input.get("teamBId"),true),tournament=tournament();
        if (a==b) throw new IllegalArgumentException("Choose two different teams.");
        if (matchId(tournament)!=null) throw new DraftHttpException(HttpStatus.CONFLICT,"A developer match already exists.");
        if (teams.get(a).get("tournamentId").asInt()!=tournament || teams.get(b).get("tournamentId").asInt()!=tournament) throw new IllegalArgumentException("Both teams must come from the developer pool.");
        List<Integer> maps=ids(input.get("mapIds"),Integer.MAX_VALUE);
        if (maps.isEmpty()) throw new IllegalArgumentException("Select at least one valid map.");
        SetValidator.validateMapIds(maps,catalog.allMaps().stream().map(m -> m.id()).toList());
        var pools=new LinkedHashMap<String,Object>();for (int i=1;i<=5;i++) pools.put(String.valueOf(i),maps);
        int id=jdbc.queryForObject("""
                INSERT INTO public."Match" (type,title,"bestOf",status,"tournamentId","teamAId","teamBId",semanas,"mapsAllowedByRound")
                VALUES ('PRACTICE','Developer Match',5,'SCHEDULED',?,?,?,1,?::jsonb) RETURNING id
                """,Integer.class,tournament,a,b,json.stringify(pools));
        for (int map:maps) jdbc.update("INSERT INTO public.\"_AllowedMaps\" (\"A\",\"B\") VALUES (?,?)",map,id);
        drafts.create(matches.lock(id),DraftState.newDraft(id,a,b,5,a),clock.instant());display.create(id);return state();
    }
    public Map<String,Object> deleteMatch() {
        int id=requireMatch();matches.lock(id);
        jdbc.update("DELETE FROM spring_draft.draft_sessions WHERE match_id=?",id);
        jdbc.update("DELETE FROM public.\"DraftAction\" WHERE \"draftId\" IN (SELECT id FROM public.\"DraftTable\" WHERE \"matchId\"=?)",id);
        jdbc.update("DELETE FROM public.\"DraftTable\" WHERE \"matchId\"=?",id);
        jdbc.update("DELETE FROM public.\"PlayerStat\" WHERE \"matchId\"=?",id);jdbc.update("DELETE FROM public.\"LeaderboardOverlayAsset\" WHERE \"matchId\"=?",id);
        jdbc.update("DELETE FROM public.\"Match\" WHERE id=?",id);return state();
    }
    public Map<String,Object> overlay(DraftRequests.Overlay input,DraftActor actor) {controls.overlay(requireMatch(),actor,input);return state();}
    public Map<String,Object> scores(Map<String,Object> input) {display.scores(requireMatch(),integer(input.get("mapWinsTeamA"),false),integer(input.get("mapWinsTeamB"),false));return state();}
    public Map<String,Object> bans(Map<String,Object> input) {
        List<Integer> a=ids(input.get("teamABans"),2),b=ids(input.get("teamBBans"),2);var all=new ArrayList<>(a);all.addAll(b);
        if (new HashSet<>(all).size()!=all.size()) throw new IllegalArgumentException("A hero can only be banned once.");
        var known=catalog.heroes();var roles=new java.util.HashMap<String,Integer>();
        for (int id:all) {
            var hero=known.stream().filter(h -> h.id()==id).findFirst().orElseThrow(() -> new IllegalArgumentException("Selected hero does not exist."));
            if (roles.merge(hero.role().name(),1,Integer::sum)>2) throw new IllegalArgumentException("No more than two heroes from the same role can be banned.");
        }
        display.bans(requireMatch(),a,b);return state();
    }
    private static int integer(Object raw,boolean positive) {
        if (!(raw instanceof Number n) || n.doubleValue()!=Math.rint(n.doubleValue()) || n.longValue()<(positive?1:0) || n.longValue()>Integer.MAX_VALUE)
            throw new IllegalArgumentException("Value must be a valid integer.");return n.intValue();
    }
    private static List<Integer> ids(Object raw,int max) {
        if (!(raw instanceof List<?> values)) throw new IllegalArgumentException("Expected an array of ids.");
        var result=new ArrayList<Integer>();for (Object value:values) if (value!=null) result.add(integer(value,true));
        if (result.size()>max || new HashSet<>(result).size()!=result.size()) throw new IllegalArgumentException("Invalid or repeated ids.");return List.copyOf(result);
    }
    private static class SetValidator {
        static void validateMapIds(List<Integer> selected,List<Integer> known) {if (!new HashSet<>(known).containsAll(selected)) throw new IllegalArgumentException("Selected map does not exist.");}
    }
}
