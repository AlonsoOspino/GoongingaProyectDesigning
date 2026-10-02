package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;

@Repository
public class TournamentRepository {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public TournamentRepository(JdbcTemplate jdbc, JsonSql json) { this.jdbc=jdbc; this.json=json; }
    public List<JsonNode> all() { return json.list("SELECT to_jsonb(t)::text FROM public.\"Tournament\" t WHERE name <> 'GGL Developer Draft App' ORDER BY id"); }
    public JsonNode get(int id) { return json.first("SELECT to_jsonb(t)::text FROM public.\"Tournament\" t WHERE id=?",id)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Tournament not found.")); }
    public Optional<JsonNode> active() { return json.first("SELECT to_jsonb(t)::text FROM public.\"Tournament\" t WHERE name <> 'GGL Developer Draft App' AND state <> 'FINISHED' ORDER BY \"startDate\" DESC,id DESC LIMIT 1"); }
    public Optional<JsonNode> recent() { return json.first("SELECT to_jsonb(t)::text FROM public.\"Tournament\" t WHERE name <> 'GGL Developer Draft App' ORDER BY \"startDate\" DESC,id DESC LIMIT 1"); }
    public boolean nameExists(String name) { return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Tournament\" WHERE name=?)",Boolean.class,name)); }
    public int create(String name, Instant date) { return jdbc.queryForObject("INSERT INTO public.\"Tournament\" (name,\"startDate\",state) VALUES (?,?,'SCHEDULED'::\"TournamentState\") RETURNING id",Integer.class,name,utc(date)); }
    public void update(int id,String name,Instant date,String state) {
        jdbc.update("UPDATE public.\"Tournament\" SET name=COALESCE(?,name),\"startDate\"=COALESCE(?,\"startDate\"),state=COALESCE(?::\"TournamentState\",state) WHERE id=?",name,date==null?null:utc(date),state,id);
    }
    public void remove(int id) { jdbc.update("DELETE FROM public.\"Tournament\" WHERE id=?",id); }
    public void lock(int id) { jdbc.queryForList("SELECT id FROM public.\"Tournament\" WHERE id=? FOR UPDATE",Integer.class,id); }
    public int unfinishedRoundRobin(int id) { return jdbc.queryForObject("SELECT count(*) FROM public.\"Match\" WHERE \"tournamentId\"=? AND type='ROUNDROBIN' AND status <> 'FINISHED'",Integer.class,id); }
    public boolean hasPlayoffs(int id) { return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Match\" WHERE \"tournamentId\"=? AND \"playoffRound\" IS NOT NULL)",Boolean.class,id)); }
    public void seedTeams(int tournamentId,List<Integer> ids) {
        jdbc.update("UPDATE public.\"Team\" SET \"playoffSeed\"=NULL,state='ELIMINATED' WHERE \"tournamentId\"=?",tournamentId);
        for (int i=0;i<ids.size();i++) jdbc.update("UPDATE public.\"Team\" SET \"playoffSeed\"=?,state='ACTIVE' WHERE id=?",i+1,ids.get(i));
    }
    public void createQuarterfinal(int tournamentId,int teamA,int teamB,int slot) {
        int matchId=jdbc.queryForObject("""
                INSERT INTO public."Match" (type,"bestOf",status,"tournamentId","teamAId","teamBId",title,"playoffRound","playoffSlot")
                VALUES ('PLAYOFFS',5,'SCHEDULED',?,?,?,?,1,?) RETURNING id
                """,Integer.class,tournamentId,teamA,teamB,"Quarterfinal "+slot,slot);
        jdbc.update("INSERT INTO public.\"_AllowedMaps\" (\"A\",\"B\") SELECT id,? FROM public.\"Map\"",matchId);
    }
    public JsonNode bracket(int id) {
        return json.first("""
                SELECT (to_jsonb(t) || jsonb_build_object(
                  'teams', COALESCE((SELECT jsonb_agg(to_jsonb(team) ORDER BY team."playoffSeed") FROM public."Team" team WHERE team."tournamentId"=t.id),'[]'::jsonb),
                  'matches', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m."playoffSlot") FROM public."Match" m WHERE m."tournamentId"=t.id AND m."playoffRound" IS NOT NULL),'[]'::jsonb)))::text
                FROM public."Tournament" t WHERE t.id=?
                """,id).orElseThrow();
    }
    private static LocalDateTime utc(Instant date) { return LocalDateTime.ofInstant(date,ZoneOffset.UTC); }
}
