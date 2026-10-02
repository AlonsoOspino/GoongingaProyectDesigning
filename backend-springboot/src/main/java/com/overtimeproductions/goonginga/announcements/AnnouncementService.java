package com.overtimeproductions.goonginga.announcements;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.league.TournamentService;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class AnnouncementService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final ObjectMapper mapper;
    private final AnnouncementTemplates templates;
    public AnnouncementService(JdbcTemplate jdbc,JsonSql json,ObjectMapper mapper,AnnouncementTemplates templates) {
        this.jdbc=jdbc;this.json=json;this.mapper=mapper;this.templates=templates;
    }
    private static final String SELECT="jsonb_build_object('id',id,'name',name,'type',type,'content',content,'countdownAt',\"countdownAt\",'published',published,'order',\"order\",'createdAt',\"createdAt\",'updatedAt',\"updatedAt\")::text";
    public List<JsonNode> all() { return json.list("SELECT "+SELECT+" FROM public.\"Announcement\" ORDER BY \"order\",id"); }
    private JsonNode get(int id) { return json.first("SELECT "+SELECT+" FROM public.\"Announcement\" WHERE id=?",id)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Announcement not found.")); }
    private JsonNode state() {
        jdbc.update("""
                INSERT INTO public."AnnouncementMode" (id,enabled,mode,"createdAt","updatedAt")
                VALUES (1,true,'TOURNAMENT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING
                """);
        return json.first("SELECT to_jsonb(s)::text FROM public.\"AnnouncementMode\" s WHERE id=1").orElseThrow();
    }
    private Map<String,Object> settingsMap(JsonNode s) {
        var result=new HashMap<String,Object>();
        result.put("enabled",s.get("enabled").asBoolean());result.put("mode",s.get("mode").asText());
        result.put("activeAnnouncementId",s.get("activeAnnouncementId").isNull()?null:s.get("activeAnnouncementId").asInt());
        result.put("updatedAt",s.get("updatedAt"));
        return result;
    }
    public Map<String,Object> settingsResponse() { return settingsMap(state()); }
    public Map<String,Object> active() {
        JsonNode s=state();
        boolean enabled=s.get("enabled").asBoolean();
        String mode="CUSTOM".equals(s.get("mode").asText())?"CUSTOM":"TOURNAMENT";
        if (!enabled || mode.equals("TOURNAMENT")) return Map.of("enabled",enabled,"mode",mode,"announcements",List.of());
        Integer activeId=s.get("activeAnnouncementId").isNull()?null:s.get("activeAnnouncementId").asInt();
        List<JsonNode> rows=activeId==null?
                json.list("SELECT "+SELECT+" FROM public.\"Announcement\" WHERE published=true ORDER BY \"order\",id"):
                json.list("SELECT "+SELECT+" FROM public.\"Announcement\" WHERE published=true AND id=? ORDER BY \"order\",id",activeId);
        var announcements=new ArrayList<Map<String,Object>>();
        for (JsonNode row:rows) {
            var item=new HashMap<String,Object>();
            for (String field:List.of("id","name","type","content","countdownAt","order")) item.put(field,row.get(field));
            item.put("payload",payload(row));
            announcements.add(item);
        }
        return Map.of("enabled",true,"mode",mode,"announcements",announcements);
    }
    private Object payload(JsonNode row) {
        String type=row.get("type").asText();
        JsonNode content=row.get("content");
        if (type.equals("CUSTOM") || type.equals("FORM")) return null;
        if (type.equals("MINIGAME")) {
            String slug=content.hasNonNull("minigameSlug")?content.get("minigameSlug").asText():"";
            JsonNode game=slug.isBlank()?null:json.first("""
                    SELECT jsonb_build_object('slug',slug,'title',title,'description',description,'coverImageUrl',"coverImageUrl",
                      'gameType',"gameType",'status',status,'phase',phase,'updatedAt',"updatedAt")::text
                    FROM public."MiniGame" WHERE slug=?
                    """,slug).orElse(null);
            var result=new HashMap<String,Object>();result.put("state",game!=null && "LIVE".equals(game.get("status").asText())?"LIVE":"IDLE");result.put("game",game);return result;
        }
        JsonNode match=null;
        if (content.hasNonNull("matchId")) match=matchPayload("WHERE m.id=?",content.get("matchId").asInt());
        if (match!=null && !"FINISHED".equals(match.get("status").asText()))
            return Map.of("state","ACTIVE".equals(match.get("status").asText())?"LIVE":"UPCOMING","match",match);
        match=matchPayload("WHERE m.status='ACTIVE' ORDER BY m.\"startDate\" NULLS LAST,m.id LIMIT 1");
        if (match!=null) return Map.of("state","LIVE","match",match);
        match=matchPayload("WHERE m.status='SCHEDULED' AND m.\"startDate\">=CURRENT_TIMESTAMP ORDER BY m.\"startDate\",m.id LIMIT 1");
        if (match!=null) return Map.of("state","UPCOMING","match",match);
        match=matchPayload("WHERE m.status='FINISHED' ORDER BY m.\"startDate\" DESC NULLS LAST,m.id DESC LIMIT 1");
        var result=new HashMap<String,Object>();result.put("state",match==null?"IDLE":"RESULT");result.put("match",match);return result;
    }
    private JsonNode matchPayload(String tail,Object... args) {
        return json.first("""
                SELECT jsonb_build_object('id',m.id,'title',m.title,'type',m.type,'bestOf',m."bestOf",'status',m.status,
                  'startDate',m."startDate",'mapWinsTeamA',m."mapWinsTeamA",'mapWinsTeamB',m."mapWinsTeamB",'gameNumber',m."gameNumber",
                  'teamA',jsonb_build_object('id',a.id,'name',a.name,'logo',a.logo),
                  'teamB',jsonb_build_object('id',b.id,'name',b.name,'logo',b.logo))::text
                FROM public."Match" m JOIN public."Team" a ON a.id=m."teamAId" JOIN public."Team" b ON b.id=m."teamBId"
                """+tail,args).orElse(null);
    }
    private static String name(Object raw) {
        String value=raw==null?"":String.valueOf(raw).trim();
        if (value.isBlank()) throw new IllegalArgumentException("Give this announcement a name.");
        return value.length()>120?value.substring(0,120):value;
    }
    private static LocalDateTime countdown(Object raw) {
        if (raw==null || "".equals(raw)) return null;
        try { return LocalDateTime.ofInstant(TournamentService.parseDate(String.valueOf(raw)),ZoneOffset.UTC); }
        catch (RuntimeException error) { return null; }
    }
    @SuppressWarnings("unchecked") private Map<String,Object> content(JsonNode node) {
        return mapper.readValue(json.stringify(node),Map.class);
    }
    @Transactional
    public JsonNode create(Map<String,Object> input,int actor) {
        String type=templates.type((String)input.get("type"));
        Map<String,Object> content=templates.validate(type,input.get("content"));
        int order=jdbc.queryForObject("SELECT COALESCE(MAX(\"order\"),-1)+1 FROM public.\"Announcement\"",Integer.class);
        int id=jdbc.queryForObject("""
                INSERT INTO public."Announcement" (name,type,content,"countdownAt",published,"order","createdById","updatedById","createdAt","updatedAt")
                VALUES (?,?::"AnnouncementType",?::jsonb,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id
                """,Integer.class,name(input.get("name")),type,json.stringify(content),countdown(input.get("countdownAt")),Boolean.TRUE.equals(input.get("published")),order,actor,actor);
        return get(id);
    }
    @Transactional
    public JsonNode update(int id,Map<String,Object> input,int actor) {
        JsonNode old=get(id);
        String type=templates.type(input.get("type")==null?old.get("type").asText():String.valueOf(input.get("type")));
        Object rawContent=input.containsKey("content")?input.get("content"):content(old.get("content"));
        Map<String,Object> content=templates.validate(type,rawContent);
        String name=input.containsKey("name")?name(input.get("name")):old.get("name").asText();
        LocalDateTime countdown=input.containsKey("countdownAt")?countdown(input.get("countdownAt")):
                (old.get("countdownAt").isNull()?null:countdown(old.get("countdownAt").asText()));
        boolean published=input.get("published") instanceof Boolean b?b:old.get("published").asBoolean();
        jdbc.update("""
                UPDATE public."Announcement" SET name=?,type=?::"AnnouncementType",content=?::jsonb,"countdownAt"=?,
                  published=?,"updatedById"=?,"updatedAt"=CURRENT_TIMESTAMP WHERE id=?
                """,name,type,json.stringify(content),countdown,published,actor,id);
        return get(id);
    }
    @Transactional
    public Map<String,Object> remove(int id) { get(id);jdbc.update("DELETE FROM public.\"Announcement\" WHERE id=?",id);return Map.of("deleted",true,"id",id); }
    @Transactional
    public Map<String,Object> reorder(List<Integer> ids,int actor) {
        if (ids==null || ids.isEmpty() || ids.stream().anyMatch(id -> id==null || id<1) || new HashSet<>(ids).size()!=ids.size())
            throw new IllegalArgumentException("Announcement order must contain unique valid ids.");
        for (int id:ids) get(id);
        for (int i=0;i<ids.size();i++) jdbc.update("UPDATE public.\"Announcement\" SET \"order\"=?,\"updatedById\"=?,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",i,actor,ids.get(i));
        return Map.of("ids",ids);
    }
    @Transactional
    public Map<String,Object> updateSettings(Map<String,Object> input,int actor) {
        state();
        var clauses=new ArrayList<String>();var args=new ArrayList<Object>();
        if (input.containsKey("enabled")) {
            if (!(input.get("enabled") instanceof Boolean)) throw new IllegalArgumentException("Enabled must be true or false.");
            clauses.add("enabled=?");args.add(input.get("enabled"));
        }
        if (input.containsKey("mode")) {
            String mode=String.valueOf(input.get("mode")).toUpperCase();
            if (!Set.of("TOURNAMENT","CUSTOM").contains(mode)) throw new IllegalArgumentException("mode must be TOURNAMENT or CUSTOM.");
            clauses.add("mode=?");args.add(mode);
        }
        if (input.containsKey("activeAnnouncementId")) {
            Object raw=input.get("activeAnnouncementId");
            int id=raw==null?0:Integer.parseInt(String.valueOf(raw));
            if (id<0) throw new IllegalArgumentException("Invalid active announcement id.");
            clauses.add("\"activeAnnouncementId\"=?");args.add(id==0?null:id);
        }
        clauses.add("\"updatedById\"=?");args.add(actor);
        clauses.add("\"updatedAt\"=CURRENT_TIMESTAMP");
        args.add(1);
        jdbc.update("UPDATE public.\"AnnouncementMode\" SET "+String.join(",",clauses)+" WHERE id=?",args.toArray());
        return settingsResponse();
    }
}
