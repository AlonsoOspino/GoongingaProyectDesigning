package com.overtimeproductions.goonginga.stats;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class PlayerStatService {
    private static final Set<String> MAP_TYPES=Set.of("CONTROL","HYBRID","PAYLOAD","PUSH","FLASHPOINT");
    private static final Set<String> ROLES=Set.of("TANK","DPS","SUPPORT");
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public PlayerStatService(JdbcTemplate jdbc,JsonSql json) { this.jdbc=jdbc; this.json=json; }
    public List<JsonNode> list(Integer userId,boolean publicView) {
        String userFields=publicView?"'id',nm.id,'nickname',nm.nickname,'role',nm.role,'teamId',nm.\"teamId\""
                :"'id',nm.id,'nickname',nm.nickname,'username',nm.username,'role',nm.role,'teamId',nm.\"teamId\"";
        return json.list("SELECT (to_jsonb(s) || jsonb_build_object('user',jsonb_build_object("+userFields+")))::text "
                +"FROM public.\"PlayerStat\" s JOIN public.\"NetworkMember\" nm ON nm.id=s.\"userId\" "
                +(userId==null?"":"WHERE s.\"userId\"=? ")+"ORDER BY s.\"createdAt\" DESC",
                userId==null?new Object[]{}:new Object[]{userId});
    }
    private static int number(Object raw,String field,boolean positive) {
        try {
            double parsed=raw instanceof Number n?n.doubleValue():Double.parseDouble(String.valueOf(raw));
            if (!Double.isFinite(parsed) || parsed!=Math.rint(parsed) || parsed<(positive?1:0) || parsed>Integer.MAX_VALUE)
                throw new IllegalArgumentException(field+" must be a "+(positive?"positive":"non-negative")+" integer.");
            return (int)parsed;
        } catch (NumberFormatException error) { throw new IllegalArgumentException(field+" must be a "+(positive?"positive":"non-negative")+" integer."); }
    }
    private static String choice(Object raw,Set<String> allowed,String field) {
        String value=String.valueOf(raw).trim().toUpperCase();
        if (!allowed.contains(value)) throw new IllegalArgumentException(field+" has an invalid value.");
        return value;
    }
    private static int duration(Object raw) {
        if (raw instanceof Number) return number(raw,"gameDuration",true);
        String text=String.valueOf(raw).trim();
        String[] parts=text.split(":");
        if (parts.length==2 && parts[0].matches("\\d{1,3}") && parts[1].matches("\\d{2}"))
            return Integer.parseInt(parts[0])*60+Integer.parseInt(parts[1]);
        if (parts.length==3 && parts[0].matches("\\d{1,2}") && parts[1].matches("\\d{2}") && parts[2].matches("\\d{2}"))
            return Integer.parseInt(parts[0])*3600+Integer.parseInt(parts[1])*60+Integer.parseInt(parts[2]);
        throw new IllegalArgumentException("gameDuration must be positive seconds or use mm:ss / hh:mm:ss.");
    }
    private record Stat(int userId,int matchId,int gameNumber,int damage,int healing,int mitigation,int kills,int assists,int deaths,int gameDuration,String mapType,String role) {}
    private Stat normalize(Map<String,Object> input) {
        int userId=number(input.get("userId"),"userId",true);
        int matchId=number(input.get("matchId"),"matchId",true);
        int gameNumber=number(input.get("gameNumber"),"gameNumber",true);
        if (!belongs(matchId,userId)) throw new IllegalArgumentException("User does not belong to this match teams.");
        return new Stat(userId,matchId,gameNumber,number(input.get("damage"),"damage",false),number(input.get("healing"),"healing",false),
                number(input.get("mitigation"),"mitigation",false),number(input.get("kills"),"kills",false),number(input.get("assists"),"assists",false),
                number(input.get("deaths"),"deaths",false),duration(input.get("gameDuration")),
                choice(input.get("mapType"),MAP_TYPES,"mapType"),choice(input.get("role"),ROLES,"role"));
    }
    private boolean belongs(int matchId,int userId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM public."Match" m JOIN public."SeasonPlayer" sp
                ON sp."tournamentId"=m."tournamentId" AND sp."teamId" IN (m."teamAId",m."teamBId")
                WHERE m.id=? AND sp."memberId"=?)
                """,Boolean.class,matchId,userId));
    }
    private static double per10(int value,int duration) { return Math.round(((double)value/Math.max(1,duration))*60000d)/100d; }
    private JsonNode insert(Stat s) {
        int id=jdbc.queryForObject("""
                INSERT INTO public."PlayerStat" ("userId","matchId","gameNumber",damage,healing,mitigation,kills,assists,deaths,
                  "gameDuration","mapType",role,"damagePer10","healingPer10","mitigationPer10","killsPer10","assistsPer10","deathsPer10","createdAt")
                VALUES (?,?,?,?,?,?,?,?,?,?,?::"MapType",?::"HeroRole",?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id
                """,Integer.class,s.userId,s.matchId,s.gameNumber,s.damage,s.healing,s.mitigation,s.kills,s.assists,s.deaths,s.gameDuration,
                s.mapType,s.role,per10(s.damage,s.gameDuration),per10(s.healing,s.gameDuration),per10(s.mitigation,s.gameDuration),
                per10(s.kills,s.gameDuration),per10(s.assists,s.gameDuration),per10(s.deaths,s.gameDuration));
        return json.first("SELECT to_jsonb(s)::text FROM public.\"PlayerStat\" s WHERE id=?",id).orElseThrow();
    }
    @Transactional
    public JsonNode create(Map<String,Object> input,int requester,boolean canSubmitOthers) {
        var data=new java.util.HashMap<>(input);
        if (!data.containsKey("userId") || data.get("userId")==null || "".equals(data.get("userId"))) data.put("userId",requester);
        int userId=number(data.get("userId"),"userId",true);
        if (!canSubmitOthers && userId!=requester) throw new com.overtimeproductions.goonginga.draft.api.DraftHttpException(org.springframework.http.HttpStatus.FORBIDDEN,"You can only submit stats for your own user.");
        return insert(normalize(data));
    }
    @Transactional(isolation=Isolation.SERIALIZABLE)
    public Map<String,Object> batch(int matchId,List<Map<String,Object>> games) {
        if (matchId<1 || games==null || games.isEmpty() || games.size()>20) throw new IllegalArgumentException("games must include between 1 and 20 entries.");
        var normalized=new ArrayList<Stat>();
        for (Map<String,Object> game:games) {
            int gameNumber=number(game.get("gameNumber"),"gameNumber",true);
            String mapType=choice(game.get("mapType"),MAP_TYPES,"mapType");
            int gameDuration=duration(game.get("gameDuration"));
            Object rawRows=game.get("rows");
            if (!(rawRows instanceof List<?> rows) || rows.isEmpty() || rows.size()>10) throw new IllegalArgumentException("Each game must include between 1 and 10 players.");
            var seen=new HashSet<Integer>();
            for (Object raw:rows) {
                if (!(raw instanceof Map<?,?> row)) throw new IllegalArgumentException("Invalid player row.");
                if (row.get("userId")==null || "".equals(row.get("userId"))) continue;
                int userId=number(row.get("userId"),"userId",true);
                if (!seen.add(userId)) throw new IllegalArgumentException("A user appears more than once in one game.");
                var data=new java.util.HashMap<String,Object>();
                row.forEach((key,value)->data.put(String.valueOf(key),value));
                data.put("matchId",matchId);data.put("gameNumber",gameNumber);data.put("mapType",mapType);data.put("gameDuration",gameDuration);
                normalized.add(normalize(data));
            }
        }
        if (normalized.isEmpty()) throw new IllegalArgumentException("Select at least one match player before saving stats.");
        for (int gameNumber:normalized.stream().map(Stat::gameNumber).distinct().toList())
            jdbc.update("DELETE FROM public.\"PlayerStat\" WHERE \"matchId\"=? AND \"gameNumber\"=?",matchId,gameNumber);
        List<JsonNode> created=normalized.stream().map(this::insert).toList();
        return Map.of("count",created.size(),"stats",created);
    }
}
