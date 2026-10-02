package com.overtimeproductions.goonginga.minigames;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;

@Repository
public class MiniGameRepository {
    private static final String GAME="""
            SELECT (to_jsonb(g) || jsonb_build_object(
              'createdBy',jsonb_build_object('id',creator.id,'username',creator.username,'avatarUrl',creator."avatarUrl"),
              'underDevelopmentBy',CASE WHEN developer.id IS NULL THEN NULL ELSE
                  jsonb_build_object('id',developer.id,'username',developer.username,'avatarUrl',developer."avatarUrl") END,
              'currentPlayer',CASE WHEN current.id IS NULL THEN NULL ELSE
                  jsonb_build_object('id',current.id,'username',current.username,'avatarUrl',current."avatarUrl") END,
              'participants',COALESCE((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('member',
                  jsonb_build_object('id',member.id,'username',member.username,'avatarUrl',member."avatarUrl"))
                  ORDER BY p.score DESC,p.id ASC)
                  FROM public."MiniGameParticipant" p JOIN public."NetworkMember" member ON member.id=p."memberId"
                  WHERE p."gameId"=g.id),'[]'::jsonb)))::text
            FROM public."MiniGame" g
            JOIN public."NetworkMember" creator ON creator.id=g."createdById"
            LEFT JOIN public."NetworkMember" developer ON developer.id=g."underDevelopmentById"
            LEFT JOIN public."NetworkMember" current ON current.id=NULLIF(g.state->>'turnMemberId','')::integer
            """;
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public MiniGameRepository(JdbcTemplate jdbc,JsonSql json) { this.jdbc=jdbc;this.json=json; }
    public JsonNode get(String slug) { return json.first(GAME+" WHERE g.slug=?",slug)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Minigame not found.")); }
    public List<JsonNode> list() { return json.list(GAME+" WHERE g.status IN ('LIVE','UNDER_DEVELOPMENT') ORDER BY g.\"updatedAt\" DESC"); }
    public JsonNode activeJeopardy() { return json.first(GAME+" WHERE g.\"gameType\"='JEOPARDY' AND g.status='LIVE' ORDER BY g.\"updatedAt\" DESC,g.id DESC LIMIT 1")
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"No Jeopardy game is currently available.")); }
    public boolean memberActive(int id) { return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"NetworkMember\" WHERE id=? AND status='ACTIVE')",Boolean.class,id)); }
    public List<Integer> participants(int gameId) { return jdbc.queryForList("SELECT \"memberId\" FROM public.\"MiniGameParticipant\" WHERE \"gameId\"=? ORDER BY id",Integer.class,gameId); }
    public int create(String slug,String title,String description,String cover,String gameType,String config,String state,int actor) {
        return jdbc.queryForObject("""
                INSERT INTO public."MiniGame" (slug,title,description,"coverImageUrl","gameType",status,phase,config,state,"createdById","createdAt","updatedAt")
                VALUES (?,?,?,?,?::"MiniGameType",'LIVE','CREATED',?::jsonb,?::jsonb,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id
                """,Integer.class,slug,title,description,cover,gameType,config,state,actor);
    }
    public void participant(int gameId,int memberId) {
        jdbc.update("INSERT INTO public.\"MiniGameParticipant\" (\"gameId\",\"memberId\",score,\"createdAt\",\"updatedAt\") VALUES (?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",gameId,memberId);
    }
    public void updateGame(int id,String title,String slug,String description,String cover,String config) {
        jdbc.update("""
                UPDATE public."MiniGame" SET title=?,slug=?,description=?,"coverImageUrl"=?,config=?::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE id=?
                """,title,slug,description,cover,config,id);
    }
    public void status(int id,String status,Integer developer) {
        jdbc.update("UPDATE public.\"MiniGame\" SET status=?::\"MiniGameStatus\",\"underDevelopmentById\"=?,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",status,developer,id);
    }
    public void phaseState(int id,String phase,String state) {
        jdbc.update("UPDATE public.\"MiniGame\" SET phase=?::\"JeopardyPhase\",state=?::jsonb,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",phase,state,id);
    }
    public void state(int id,String state) { jdbc.update("UPDATE public.\"MiniGame\" SET state=?::jsonb,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",state,id); }
    public void score(int gameId,int memberId,int delta) { jdbc.update("UPDATE public.\"MiniGameParticipant\" SET score=score+?,\"updatedAt\"=CURRENT_TIMESTAMP WHERE \"gameId\"=? AND \"memberId\"=?",delta,gameId,memberId); }
    public void remove(int id) { jdbc.update("DELETE FROM public.\"MiniGame\" WHERE id=?",id); }
    public void cover(int id,String url) { jdbc.update("UPDATE public.\"MiniGame\" SET \"coverImageUrl\"=?,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",url,id); }
    public List<JsonNode> members(String search) {
        return json.list("SELECT jsonb_build_object('id',id,'username',username,'avatarUrl',\"avatarUrl\")::text FROM public.\"NetworkMember\" WHERE status='ACTIVE' AND username ILIKE ? ORDER BY username LIMIT 12","%"+search+"%");
    }
    public JsonNode familyFeudDeveloper() {
        return json.first("""
                SELECT jsonb_build_object('id',id,'username',username,'avatarUrl',"avatarUrl")::text
                FROM public."NetworkMember" WHERE status='ACTIVE' AND 'DEVELOPER'=ANY(roles::text[])
                ORDER BY "createdAt",id LIMIT 1
                """).orElse(null);
    }
}
