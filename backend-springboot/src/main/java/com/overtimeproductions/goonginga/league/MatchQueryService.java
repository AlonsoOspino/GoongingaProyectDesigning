package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import java.util.List;
import java.util.ArrayList;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.api.DraftViewMapper;
import com.overtimeproductions.goonginga.practice.PracticeDisplayRepository;

@Service
@org.springframework.transaction.annotation.Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
public class MatchQueryService {
    private final JsonSql json;
    private final MatchRepository matches;
    private final DraftStore drafts;
    private final DraftViewMapper views;
    private final PracticeDisplayRepository practice;
    public MatchQueryService(JsonSql json,MatchRepository matches,DraftStore drafts,DraftViewMapper views,PracticeDisplayRepository practice) {
        this.json=json;this.matches=matches;this.drafts=drafts;this.views=views;this.practice=practice;
    }
    public JsonNode get(String id) {
        int matchId=matches.resolve(id);
        JsonNode result=json.first("""
                SELECT (to_jsonb(m) || jsonb_build_object('draft',
                  (SELECT to_jsonb(d) || jsonb_build_object('actions',COALESCE(
                    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a."order") FROM public."DraftAction" a WHERE a."draftId"=d.id),'[]'::jsonb))
                  FROM public."DraftTable" d WHERE d."matchId"=m.id)))::text
                FROM public."Match" m WHERE m.id=?
                """,matchId).orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Match not found."));
        ObjectNode object=(ObjectNode)result;
        if (drafts.exists(matchId)) object.set("draft",json.parse(json.stringify(views.map(drafts.byMatch(matchId)))));
        practice.get(matchId).ifPresent(display -> {
            if (display.scoreA()!=null) object.put("mapWinsTeamA",display.scoreA());
            if (display.scoreB()!=null) object.put("mapWinsTeamB",display.scoreB());
        });
        return object;
    }
    public List<JsonNode> all(Integer tournamentId,Integer semanas,String type) {
        var sql=new StringBuilder("SELECT to_jsonb(m)::text FROM public.\"Match\" m JOIN public.\"Tournament\" t ON t.id=m.\"tournamentId\" WHERE t.name <> 'GGL Developer Draft App'");
        var args=new ArrayList<Object>();
        if (tournamentId!=null) { sql.append(" AND m.\"tournamentId\"=?"); args.add(tournamentId); }
        if (semanas!=null) { sql.append(" AND m.semanas=?"); args.add(semanas); }
        if (type!=null && !type.isBlank()) { sql.append(" AND m.type=?::\"MatchType\""); args.add(type.toUpperCase()); }
        sql.append(" ORDER BY m.id");
        return json.list(sql.toString(),args.toArray());
    }
    public JsonNode soonest() {
        return json.first("""
                SELECT to_jsonb(m)::text FROM public."Match" m JOIN public."Tournament" t ON t.id=m."tournamentId"
                WHERE t.name <> 'GGL Developer Draft App' AND m.status='SCHEDULED' AND m."startDate" IS NOT NULL
                ORDER BY m."startDate" ASC LIMIT 1
                """).orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"No upcoming matches found."));
    }
    public List<JsonNode> active() {
        return json.list("""
                SELECT to_jsonb(m)::text FROM public."Match" m JOIN public."Tournament" t ON t.id=m."tournamentId"
                WHERE t.name <> 'GGL Developer Draft App' AND m.status='ACTIVE' ORDER BY m.id
                """);
    }
}
