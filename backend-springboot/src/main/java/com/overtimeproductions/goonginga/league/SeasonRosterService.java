package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class SeasonRosterService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public SeasonRosterService(JdbcTemplate jdbc,JsonSql json) { this.jdbc=jdbc; this.json=json; }
    public List<JsonNode> tournaments() { return json.list("SELECT jsonb_build_object('id',id,'name',name,'startDate',\"startDate\",'state',state)::text FROM public.\"Tournament\" ORDER BY \"startDate\" DESC,id DESC"); }
    private JsonNode tournament(int id) { return json.first("SELECT jsonb_build_object('id',id,'name',name,'startDate',\"startDate\",'state',state)::text FROM public.\"Tournament\" WHERE id=?",id)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Tournament not found.")); }
    public Map<String,Object> roster(int id) {
        JsonNode tournament=tournament(id);
        List<JsonNode> teams=json.list("SELECT jsonb_build_object('id',team.id,'name',team.name,'playoffSeed',team.\"playoffSeed\",'divisionId',team.\"divisionId\",'divisionName',d.name)::text FROM public.\"Team\" team LEFT JOIN public.\"TournamentDivision\" d ON d.id=team.\"divisionId\" WHERE team.\"tournamentId\"=? ORDER BY d.\"sortOrder\" NULLS LAST,team.\"playoffSeed\" NULLS LAST,team.name",id);
        List<JsonNode> assigned=json.list("""
                SELECT (jsonb_build_object('id',sp.id,'memberId',sp."memberId",'teamId',sp."teamId",'role',sp.role,'joinedAt',sp."joinedAt") ||
                  jsonb_build_object('member',jsonb_build_object('id',nm.id,'username',nm.username,'nickname',nm.nickname,'avatarUrl',nm."avatarUrl")))::text
                FROM public."SeasonPlayer" sp JOIN public."NetworkMember" nm ON nm.id=sp."memberId"
                WHERE sp."tournamentId"=? ORDER BY sp."teamId" NULLS LAST,nm.username
                """,id);
        List<JsonNode> unassigned=json.list("""
                SELECT jsonb_build_object('id',nm.id,'username',nm.username,'nickname',nm.nickname,'avatarUrl',nm."avatarUrl")::text
                FROM public."NetworkMember" nm WHERE nm.status='ACTIVE' AND NOT EXISTS
                  (SELECT 1 FROM public."SeasonPlayer" sp WHERE sp."tournamentId"=? AND sp."memberId"=nm.id)
                ORDER BY nm.username
                """,id);
        return Map.of("tournament",tournament,"teams",teams,"assigned",assigned,"unassigned",unassigned);
    }
    private JsonNode assignment(int id,int memberId) {
        return json.first("""
                SELECT (jsonb_build_object('id',sp.id,'memberId',sp."memberId",'teamId',sp."teamId",'role',sp.role,'joinedAt',sp."joinedAt") ||
                  jsonb_build_object('member',jsonb_build_object('id',nm.id,'username',nm.username,'nickname',nm.nickname,'avatarUrl',nm."avatarUrl")))::text
                FROM public."SeasonPlayer" sp JOIN public."NetworkMember" nm ON nm.id=sp."memberId"
                WHERE sp."tournamentId"=? AND sp."memberId"=?
                """,id,memberId).orElseThrow();
    }
    @Transactional(isolation=Isolation.SERIALIZABLE)
    public Map<String,Object> assign(int tournamentId,int memberId,String role,Integer teamId) {
        if (tournamentId<1 || memberId<1 || !("CAPTAIN".equals(role) || "PLAYER".equals(role)) || (teamId!=null && teamId<1) || ("CAPTAIN".equals(role) && teamId==null))
            throw new IllegalArgumentException("Valid role and teamId are required.");
        JsonNode tournament=tournament(tournamentId);
        JsonNode member=json.first("SELECT jsonb_build_object('id',id,'username',username,'status',status,'role',role)::text FROM public.\"NetworkMember\" WHERE id=?",memberId)
                .orElseThrow(() -> new DraftHttpException(HttpStatus.BAD_REQUEST,"The selected Network Member does not exist."));
        if (!"ACTIVE".equals(member.get("status").asText())) throw new IllegalArgumentException("The selected Network Member is not active.");
        if (teamId!=null && !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Team\" WHERE id=? AND \"tournamentId\"=?)",Boolean.class,teamId,tournamentId)))
            throw new IllegalArgumentException("The selected team does not belong to this season.");
        Map<String,Object> demoted=null;
        if ("CAPTAIN".equals(role)) {
            JsonNode incumbent=json.first("""
                    SELECT jsonb_build_object('id',sp.id,'memberId',sp."memberId",'username',nm.username,'role',nm.role)::text
                    FROM public."SeasonPlayer" sp JOIN public."NetworkMember" nm ON nm.id=sp."memberId"
                    WHERE sp."tournamentId"=? AND sp."teamId"=? AND sp.role='CAPTAIN' AND sp."memberId"<>? LIMIT 1
                    """,tournamentId,teamId,memberId).orElse(null);
            if (incumbent!=null) {
                jdbc.update("UPDATE public.\"SeasonPlayer\" SET role='PLAYER',\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",incumbent.get("id").asInt());
                demoted=Map.of("memberId",incumbent.get("memberId").asInt(),"username",incumbent.get("username").asText());
                if (!"FINISHED".equals(tournament.get("state").asText()) && "CAPTAIN".equals(incumbent.get("role").asText()))
                    jdbc.update("UPDATE public.\"NetworkMember\" SET role='DEFAULT',\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",incumbent.get("memberId").asInt());
            }
        }
        jdbc.update("""
                INSERT INTO public."SeasonPlayer" ("memberId","tournamentId","teamId",role,"joinedAt","createdAt","updatedAt")
                VALUES (?,?,?,?::"SeasonPlayerRole",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                ON CONFLICT ("memberId","tournamentId") DO UPDATE SET "teamId"=EXCLUDED."teamId",role=EXCLUDED.role,"updatedAt"=CURRENT_TIMESTAMP
                """,memberId,tournamentId,teamId,role);
        if (!"FINISHED".equals(tournament.get("state").asText())) {
            String oldRole=member.get("role").asText();
            String newRole=("CAPTAIN".equals(oldRole) || "DEFAULT".equals(oldRole)) ? ("CAPTAIN".equals(role)?"CAPTAIN":"DEFAULT") : oldRole;
            jdbc.update("UPDATE public.\"NetworkMember\" SET \"teamId\"=?,role=?::\"MemberRole\",\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",teamId,newRole,memberId);
        }
        var response=new java.util.HashMap<String,Object>();
        response.put("seasonPlayer",assignment(tournamentId,memberId));
        response.put("demoted",demoted);
        return response;
    }
    @Transactional(isolation=Isolation.SERIALIZABLE)
    public Map<String,Object> remove(int tournamentId,int memberId) {
        JsonNode tournament=tournament(tournamentId);
        JsonNode existing=json.first("SELECT jsonb_build_object('id',sp.id,'role',nm.role)::text FROM public.\"SeasonPlayer\" sp JOIN public.\"NetworkMember\" nm ON nm.id=sp.\"memberId\" WHERE sp.\"tournamentId\"=? AND sp.\"memberId\"=?",tournamentId,memberId)
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"This member is not assigned to the season."));
        jdbc.update("DELETE FROM public.\"SeasonPlayer\" WHERE id=?",existing.get("id").asInt());
        if (!"FINISHED".equals(tournament.get("state").asText())) {
            String oldRole=existing.get("role").asText();
            String newRole=("CAPTAIN".equals(oldRole) || "DEFAULT".equals(oldRole))?"DEFAULT":oldRole;
            jdbc.update("UPDATE public.\"NetworkMember\" SET \"teamId\"=NULL,role=?::\"MemberRole\",\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",newRole,memberId);
        }
        return Map.of("memberId",memberId);
    }
}
