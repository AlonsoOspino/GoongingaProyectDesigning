package com.overtimeproductions.goonginga.draft.migration;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.preparation.DraftProvisioningService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/** Compatibility reads and administrator repair of legacy records awaiting import. */
@Service
@Transactional
public class LegacyDraftArchiveService {
    private static final Set<String> TABLE_FIELDS=Set.of("currentTurnTeamId","phase","phaseStartedAt","bannedHeroes","pickedMaps","currentMapId","selectedMapType");
    private static final Set<String> ACTION_FIELDS=Set.of("draftId","teamId","action","value","gameNumber","order","createdAt");
    private final JsonSql json;
    private final JdbcTemplate jdbc;
    private final DraftStore drafts;
    private final DraftViewMapper views;
    private final DraftProvisioningService provisioning;
    public LegacyDraftArchiveService(JsonSql json,JdbcTemplate jdbc,DraftStore drafts,DraftViewMapper views,
            DraftProvisioningService provisioning) {
        this.json=json;this.jdbc=jdbc;this.drafts=drafts;this.views=views;
        this.provisioning=provisioning;
    }
    private JsonNode rawTable(long id) {
        return json.first("SELECT to_jsonb(d)::text FROM public.\"DraftTable\" d WHERE id=?",id)
                .orElseThrow(()->new DraftHttpException(HttpStatus.NOT_FOUND,"Legacy draft table not found."));
    }
    private JsonNode rawAction(long id) {
        return json.first("SELECT to_jsonb(a)::text FROM public.\"DraftAction\" a WHERE id=?",id)
                .orElseThrow(()->new DraftHttpException(HttpStatus.NOT_FOUND,"Legacy draft action not found."));
    }
    private void editable(long id) {
        int match=rawTable(id).path("matchId").asInt();
        jdbc.queryForList("SELECT id FROM public.\"Match\" WHERE id=? FOR UPDATE",Integer.class,match);
        if(drafts.exists(match))throw new DraftHttpException(HttpStatus.CONFLICT,
                "This draft has migrated. Use /draft phase commands; legacy history is read-only.");
    }
    public List<Object> tables() {
        provisioning.ensureScheduledMatches();
        var rows=new ArrayList<Object>(json.list("""
            SELECT to_jsonb(d)::text FROM public."DraftTable" d JOIN public."Match" m ON m.id=d."matchId"
            JOIN public."Tournament" t ON t.id=m."tournamentId" WHERE t.name<>'GGL Developer Draft App'
            AND NOT EXISTS(SELECT 1 FROM spring_draft.draft_sessions s WHERE s.match_id=m.id) ORDER BY d.id
            """));
        for(int id:jdbc.queryForList("""
            SELECT s.match_id FROM spring_draft.draft_sessions s JOIN public."Match" m ON m.id=s.match_id
            JOIN public."Tournament" t ON t.id=m."tournamentId" WHERE t.name<>'GGL Developer Draft App' ORDER BY s.id
            """,Integer.class))rows.add(views.map(drafts.byMatch(id)));
        return rows;
    }
    public Object byMatch(int id) {
        provisioning.ensure(id);
        if(drafts.exists(id))return views.map(drafts.byMatch(id));
        return json.first("""
            SELECT (to_jsonb(d)||jsonb_build_object('actions',COALESCE(
              (SELECT jsonb_agg(to_jsonb(a) ORDER BY a."order") FROM public."DraftAction" a WHERE a."draftId"=d.id),'[]'::jsonb),
              'match',to_jsonb(m)||jsonb_build_object('teamA',to_jsonb(a),'teamB',to_jsonb(b))))::text
            FROM public."DraftTable" d JOIN public."Match" m ON m.id=d."matchId"
            JOIN public."Team" a ON a.id=m."teamAId" JOIN public."Team" b ON b.id=m."teamBId" WHERE m.id=?
            """,id).orElseThrow(()->new DraftHttpException(HttpStatus.NOT_FOUND,"Draft table not found for this match."));
    }
    public List<Object> actions() {
        var rows=new ArrayList<Object>(json.list("""
            SELECT to_jsonb(a)::text FROM public."DraftAction" a JOIN public."DraftTable" d ON d.id=a."draftId"
            WHERE NOT EXISTS(SELECT 1 FROM spring_draft.draft_sessions s WHERE s.match_id=d."matchId") ORDER BY a.id
            """));
        for(int id:jdbc.queryForList("SELECT match_id FROM spring_draft.draft_sessions ORDER BY id",Integer.class))
            rows.addAll(views.map(drafts.byMatch(id)).actions());
        return rows;
    }
    public JsonNode updateTable(long id,Map<String,Object> fields) {
        editable(id);update("DraftTable",id,fields,TABLE_FIELDS);return rawTable(id);
    }
    public JsonNode deleteTable(long id) {
        editable(id);JsonNode old=rawTable(id);
        jdbc.update("DELETE FROM public.\"DraftAction\" WHERE \"draftId\"=?",id);
        jdbc.update("DELETE FROM public.\"DraftTable\" WHERE id=?",id);return old;
    }
    public JsonNode createAction(Map<String,Object> fields) {
        if(!(fields.get("draftId") instanceof Number draft))throw new IllegalArgumentException("draftId is required.");
        editable(draft.longValue());
        if(!fields.keySet().containsAll(Set.of("teamId","action","order")))throw new IllegalArgumentException("teamId, action and order are required.");
        var columns=new ArrayList<String>();var values=new ArrayList<String>();var args=new ArrayList<Object>();
        for(var entry:fields.entrySet()) {
            if(!ACTION_FIELDS.contains(entry.getKey()))throw new IllegalArgumentException("Unknown draft action field.");
            columns.add('"'+entry.getKey()+'"');values.add("?"+cast(entry.getKey()));args.add(value(entry.getKey(),entry.getValue()));
        }
        int id=jdbc.queryForObject("INSERT INTO public.\"DraftAction\" ("+String.join(",",columns)+") VALUES ("+String.join(",",values)+") RETURNING id",Integer.class,args.toArray());
        return rawAction(id);
    }
    public JsonNode updateAction(long id,Map<String,Object> fields) {
        editable(rawAction(id).path("draftId").asInt());
        if(fields.get("draftId") instanceof Number target)editable(target.longValue());
        update("DraftAction",id,fields,ACTION_FIELDS);return rawAction(id);
    }
    public JsonNode deleteAction(long id) {
        JsonNode old=rawAction(id);editable(old.path("draftId").asInt());
        jdbc.update("DELETE FROM public.\"DraftAction\" WHERE id=?",id);return old;
    }
    private void update(String table,long id,Map<String,Object> fields,Set<String> allowed) {
        if(fields.isEmpty())throw new IllegalArgumentException("No allowed fields to update.");
        var clauses=new ArrayList<String>();var args=new ArrayList<Object>();
        for(var entry:fields.entrySet()) {
            if(!allowed.contains(entry.getKey()))throw new IllegalArgumentException("Unknown draft field: "+entry.getKey());
            clauses.add('"'+entry.getKey()+"\"=?"+cast(entry.getKey()));args.add(value(entry.getKey(),entry.getValue()));
        }
        args.add(id);jdbc.update("UPDATE public.\""+table+"\" SET "+String.join(",",clauses)+" WHERE id=?",args.toArray());
    }
    private String cast(String field) {
        return switch(field) {case "selectedMapType"->"::\"MapType\"";case "action"->"::\"DraftActionType\"";
            case "bannedHeroes","pickedMaps"->"::jsonb";case "phaseStartedAt","createdAt"->"::timestamp";default->"";};
    }
    private Object value(String field,Object value) {
        if(field.equals("bannedHeroes")||field.equals("pickedMaps"))return json.stringify(value);
        if((field.equals("phaseStartedAt")||field.equals("createdAt"))&&value!=null)
            return java.time.LocalDateTime.ofInstant(java.time.Instant.parse(value.toString()),java.time.ZoneOffset.UTC).toString();
        return value;
    }
}
