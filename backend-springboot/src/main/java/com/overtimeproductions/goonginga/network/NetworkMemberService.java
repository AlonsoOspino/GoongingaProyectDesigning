package com.overtimeproductions.goonginga.network;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.ArrayList;
import java.util.Arrays;
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
public class NetworkMemberService {
    private static final String PUBLIC_COLUMNS="id,username,\"avatarUrl\",roles,nickname,\"profilePic\",role,rank,\"teamId\"";
    private static final Set<String> ROLES=Set.of("MEMBER","ADMIN","CASTER","DEVELOPER","SEASON_PLAYER","MODERATOR","COMMUNITY_MANAGER","CONTENT_CREATOR","SOCIAL_MEDIA");
    private static final Set<String> SELF_FIELDS=Set.of("nickname","profilePic","heroVideoFolderPath","obsWebsocketUrl","obsWebsocketPassword");
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public NetworkMemberService(JdbcTemplate jdbc,JsonSql json) { this.jdbc=jdbc; this.json=json; }
    private List<JsonNode> selected(String fields,String where,String order,Object... args) {
        return json.list("SELECT to_jsonb(n)::text FROM (SELECT "+fields+" FROM public.\"NetworkMember\" "+where+" "+order+") n",args);
    }
    private JsonNode one(String fields,int id) {
        return selected(fields,"WHERE id=?","",id).stream().findFirst()
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Network User not found."));
    }
    public List<JsonNode> recent(int limit) {
        int safe=Math.min(12,Math.max(1,limit));
        return selected(PUBLIC_COLUMNS+",\"createdAt\"","WHERE status='ACTIVE' AND \"discordUserId\" NOT LIKE 'FEUD_GUEST:%'","ORDER BY \"createdAt\" DESC LIMIT ?",safe);
    }
    public JsonNode current(int id) { return one("id,username,\"avatarUrl\",roles,status",id); }
    public Map<String,Object> capabilities(int id,Set<String> roles) {
        List<JsonNode> captainOf=json.list("""
                SELECT jsonb_build_object('tournamentId',sp."tournamentId",'teamId',sp."teamId")::text
                FROM public."SeasonPlayer" sp JOIN public."Tournament" t ON t.id=sp."tournamentId"
                WHERE sp."memberId"=? AND sp.role='CAPTAIN' AND sp."teamId" IS NOT NULL AND t.state <> 'FINISHED'
                ORDER BY sp."tournamentId",sp."teamId"
                """,id);
        return Map.of("isAdmin",roles.contains("ADMIN"),"isCaster",roles.contains("CASTER"),"isCaptain",!captainOf.isEmpty(),"captainOf",captainOf);
    }
    public List<JsonNode> adminUsers(String search) {
        String value=search==null?"":search.trim();
        if (value.length()>80) value=value.substring(0,80);
        return selected(PUBLIC_COLUMNS+",status,\"createdAt\",\"updatedAt\"","WHERE username ILIKE ?","ORDER BY \"createdAt\" DESC,id DESC LIMIT 200","%"+value+"%");
    }
    public JsonNode adminUser(int id) { return one(PUBLIC_COLUMNS+",status,\"createdAt\",\"updatedAt\"",id); }
    @Transactional
    public JsonNode updateRoles(int id,List<String> requested) {
        adminUser(id);
        if (requested==null) requested=List.of();
        var normalized=new ArrayList<String>();
        normalized.add("MEMBER");
        for (String role:requested) {
            if (!ROLES.contains(role)) throw new IllegalArgumentException("Unknown role: "+role);
            if (!normalized.contains(role)) normalized.add(role);
        }
        jdbc.update("UPDATE public.\"NetworkMember\" SET roles=?::\"NetworkMemberRole\"[],\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?","{"+String.join(",",normalized)+"}",id);
        return adminUser(id);
    }
    public List<JsonNode> leaguePlayers() {
        return json.list("""
                SELECT jsonb_build_object('id',id,'nickname',COALESCE(nickname,username),'user',username,'role',role,
                  'profilePic',COALESCE("profilePic","avatarUrl"),'rank',rank,'teamId',"teamId")::text
                FROM public."NetworkMember" WHERE status='ACTIVE' ORDER BY "teamId" NULLS LAST,username
                """);
    }
    public JsonNode leagueProfile(int id) {
        return json.first("""
                SELECT jsonb_build_object('id',id,'nickname',COALESCE(nickname,username),'user',username,'role',role,
                  'profilePic',COALESCE("profilePic","avatarUrl"),'rank',rank,'teamId',"teamId",
                  'heroVideoFolderPath',"heroVideoFolderPath",'obsWebsocketUrl',"obsWebsocketUrl",
                  'obsWebsocketPassword',"obsWebsocketPassword")::text
                FROM public."NetworkMember" WHERE id=?
                """,id).orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Network Member not found."));
    }
    @Transactional
    public JsonNode updateProfile(int id,Map<String,Object> changes,boolean admin) {
        var allowed=admin?Set.of("nickname","profilePic","rank"):SELF_FIELDS;
        if (changes.keySet().stream().anyMatch(k -> !allowed.contains(k)))
            throw new IllegalArgumentException("Competitive role and team assignments must be managed from the Season Roster.");
        adminUser(id);
        if (!changes.isEmpty()) {
            var fields=new ArrayList<String>();
            var args=new ArrayList<Object>();
            for (var entry:changes.entrySet()) {
                fields.add("\""+entry.getKey()+"\"=?");
                args.add(entry.getValue());
            }
            fields.add("\"updatedAt\"=CURRENT_TIMESTAMP");
            args.add(id);
            jdbc.update("UPDATE public.\"NetworkMember\" SET "+String.join(",",fields)+" WHERE id=?",args.toArray());
        }
        return admin?adminUser(id):leagueProfile(id);
    }
}
