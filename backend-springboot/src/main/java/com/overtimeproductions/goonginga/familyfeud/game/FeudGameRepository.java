package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;

@Repository
public class FeudGameRepository {
    private final JsonSql json;
    private final JdbcTemplate jdbc;
    public FeudGameRepository(JsonSql json,JdbcTemplate jdbc) { this.json=json;this.jdbc=jdbc; }
    public List<Integer> ids() { return jdbc.queryForList("SELECT id FROM public.\"FamilyFeudGame\" ORDER BY \"createdAt\" DESC",Integer.class); }
    public FeudSnapshot get(String code) {
        int id=jdbc.queryForList("SELECT id FROM public.\"FamilyFeudGame\" WHERE upper(COALESCE(code,''))=upper(?) OR \"roomId\"=? LIMIT 1",Integer.class,code,code)
                .stream().findFirst().orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Family Feud game not found."));
        return get(id,false);
    }
    public FeudSnapshot lock(String code) {
        int id=jdbc.queryForList("SELECT id FROM public.\"FamilyFeudGame\" WHERE upper(COALESCE(code,''))=upper(?) OR \"roomId\"=? FOR UPDATE",Integer.class,code,code)
                .stream().findFirst().orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Family Feud game not found."));
        return get(id,false);
    }
    public FeudSnapshot get(int id,boolean lock) {
        if (lock) jdbc.queryForList("SELECT id FROM public.\"FamilyFeudGame\" WHERE id=? FOR UPDATE",Integer.class,id);
        JsonNode game=json.first("SELECT to_jsonb(g)::text FROM public.\"FamilyFeudGame\" g WHERE id=?",id)
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Family Feud game not found."));
        JsonNode manager=game.path("managerMemberId").isNull()?null:json.first("SELECT to_jsonb(n)::text FROM public.\"NetworkMember\" n WHERE id=?",game.get("managerMemberId").asInt()).orElse(null);
        List<JsonNode> teams=json.list("SELECT to_jsonb(t)::text FROM public.\"FeudTeam\" t WHERE \"gameId\"=? ORDER BY side",id);
        List<JsonNode> participants=json.list("""
                SELECT (to_jsonb(p) || jsonb_build_object('member',to_jsonb(n)))::text
                FROM public."FeudParticipant" p JOIN public."NetworkMember" n ON n.id=p."memberId"
                WHERE p."gameId"=? ORDER BY p."joinedAt",p.id
                """,id);
        JsonNode round=json.first("SELECT to_jsonb(r)::text FROM public.\"FeudRound\" r WHERE \"gameId\"=? ORDER BY \"roundNumber\" DESC LIMIT 1",id).orElse(null);
        JsonNode question=null,faceOff=null;
        List<JsonNode> answers=List.of(),responses=List.of();
        if (round!=null) {
            int roundId=round.get("id").asInt();
            question=json.first("SELECT to_jsonb(q)::text FROM public.\"FeudQuestion\" q WHERE id=?",round.get("questionId").asInt()).orElse(null);
            answers=json.list("SELECT to_jsonb(a)::text FROM public.\"FeudAnswer\" a WHERE \"questionId\"=? ORDER BY rank",round.get("questionId").asInt());
            responses=json.list("""
                    SELECT (to_jsonb(r) || jsonb_build_object('member',to_jsonb(n),'matchedAnswer',to_jsonb(a)))::text
                    FROM public."FeudResponse" r LEFT JOIN public."NetworkMember" n ON n.id=r."memberId"
                    LEFT JOIN public."FeudAnswer" a ON a.id=r."matchedAnswerId"
                    WHERE r."roundId"=? ORDER BY r."createdAt",r.id
                    """,roundId);
            faceOff=json.first("SELECT to_jsonb(f)::text FROM public.\"FeudFaceOff\" f WHERE \"roundId\"=?",roundId).orElse(null);
        }
        return new FeudSnapshot(game,manager,teams,participants,round,question,answers,responses,faceOff);
    }
}
