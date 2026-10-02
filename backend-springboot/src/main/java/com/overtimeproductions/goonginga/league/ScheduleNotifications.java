package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

/** Durable schedule notification queue. Enqueue participates in the match transaction. */
@Service
public class ScheduleNotifications {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final TransactionTemplate transactions;
    private final String webhook,appUrl;
    private final boolean enabled;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    public ScheduleNotifications(JdbcTemplate jdbc,JsonSql json,TransactionTemplate transactions,
            @Value("${DISCORD_WEBHOOK_URL:}") String webhook,@Value("${APP_URL:}") String appUrl,
            @Value("${notifications.enabled:true}") boolean enabled) {
        this.jdbc=jdbc;this.json=json;this.transactions=transactions;this.webhook=webhook.replaceAll("/+$","");
        this.appUrl=appUrl.replaceAll("/+$","");this.enabled=enabled;
    }
    public void enqueue(int id) {
        if(!enabled||webhook.isBlank())return;
        jdbc.update("""
            INSERT INTO spring_draft.schedule_notifications(match_id,start_at)
            SELECT id,"startDate" FROM public."Match" WHERE id=? AND "startDate" IS NOT NULL
            ON CONFLICT(match_id) DO UPDATE SET start_at=excluded.start_at,
              pending=(schedule_notifications.delivered_start_at IS DISTINCT FROM excluded.start_at),
              attempts=0,next_attempt_at=now(),updated_at=now(),last_error=NULL
            """,id);
    }
    @Scheduled(fixedDelay=2000)
    public void deliver() {
        if(!enabled||webhook.isBlank())return;
        transactions.executeWithoutResult(status -> {
            List<Integer> ids=jdbc.queryForList("""
                SELECT match_id FROM spring_draft.schedule_notifications
                WHERE pending AND next_attempt_at<=now() ORDER BY next_attempt_at
                LIMIT 1 FOR UPDATE SKIP LOCKED
                """,Integer.class);
            if(ids.isEmpty())return;
            int id=ids.getFirst();
            JsonNode match=json.first("""
                SELECT (to_jsonb(m)||jsonb_build_object('teamA',to_jsonb(a),'teamB',to_jsonb(b)))::text
                FROM public."Match" m JOIN public."Team" a ON a.id=m."teamAId"
                JOIN public."Team" b ON b.id=m."teamBId" WHERE m.id=?
                """,id).orElse(null);
            if(match==null||match.path("startDate").isNull()) {
                jdbc.update("UPDATE spring_draft.schedule_notifications SET pending=false WHERE match_id=?",id);return;
            }
            try {
                String message=match.path("discordMessageId").asText("");
                String body=json.stringify(payload(match,!message.isBlank()));
                HttpResponse<String> response=null;
                if(!message.isBlank()) response=send(webhook+"/messages/"+message,"PATCH",body);
                if(response==null||response.statusCode()==404) {
                    response=send(webhook+(webhook.contains("?")?"&":"?")+"wait=true","POST",json.stringify(payload(match,false)));
                    if(response.statusCode()/100==2) {
                        message=json.parse(response.body()).path("id").asText("");
                        if(message.isBlank())throw new IllegalStateException("Missing Discord message id");
                        jdbc.update("UPDATE public.\"Match\" SET \"discordMessageId\"=? WHERE id=?",message,id);
                    }
                }
                if(response.statusCode()/100!=2)throw new IllegalStateException("Discord HTTP "+response.statusCode());
                jdbc.update("""
                    UPDATE spring_draft.schedule_notifications SET pending=false,delivered_start_at=start_at,
                    attempts=0,last_error=NULL,updated_at=now() WHERE match_id=?
                    """,id);
            } catch(Exception error) {
                // Store only a category/status; Discord URLs and response bodies can contain secrets.
                String reason=error instanceof IllegalStateException?error.getMessage():error.getClass().getSimpleName();
                jdbc.update("""
                    UPDATE spring_draft.schedule_notifications SET attempts=attempts+1,
                    next_attempt_at=now()+make_interval(secs=>LEAST(3600,5*power(2,LEAST(attempts,9)))::integer),
                    last_error=?,updated_at=now() WHERE match_id=?
                    """,reason.substring(0,Math.min(160,reason.length())),id);
            }
        });
    }
    private HttpResponse<String> send(String url,String method,String body)throws Exception {
        var request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10))
                .header("Content-Type","application/json").method(method,HttpRequest.BodyPublishers.ofString(body)).build();
        return http.send(request,HttpResponse.BodyHandlers.ofString());
    }
    private Map<String,Object> payload(JsonNode match,boolean edit) {
        JsonNode a=match.path("teamA"),b=match.path("teamB");
        String title=a.path("name").asText()+" vs "+b.path("name").asText();
        Instant start=Instant.parse(match.path("startDate").asText());
        ZonedDateTime eastern=start.atZone(ZoneId.of("America/New_York"));
        String formatted=eastern.format(DateTimeFormatter.ofPattern("d MMMM h:mm a z",Locale.US));
        var roles=new LinkedHashSet<String>();
        for(JsonNode team:List.of(a,b)) {
            String role=team.path("discordRoleId").asText("").replaceAll("[<@&>]","").strip();
            if(role.matches("[0-9]+"))roles.add(role);
        }
        String mentions=roles.stream().map(r->"<@&"+r+">").collect(java.util.stream.Collectors.joining(" "));
        var embed=new LinkedHashMap<String,Object>();
        embed.put("color",edit?0xf59e0b:0x5865f2);
        embed.put("author",Map.of("name",edit?"GGL - MATCH UPDATED":"GGL - MATCH LOCKED IN"));
        embed.put("title",title);embed.put("description",(edit?"**Schedule Update**":"**A new series has been scheduled**")+"\n\n**Start**\n"+formatted);
        embed.put("fields",List.of(Map.of("name","Team One","value",a.path("name").asText(),"inline",true),
                Map.of("name","Series","value","Best of "+match.path("bestOf").asInt(),"inline",true),
                Map.of("name","Team Two","value",b.path("name").asText(),"inline",true)));
        if(!appUrl.isBlank())embed.put("image",Map.of("url",appUrl+"/match/"+a.path("id").asInt()+"/"+b.path("id").asInt()+"/vs-image?v="+start.toEpochMilli()));
        embed.put("footer",Map.of("text","GGL"));embed.put("timestamp",Instant.now().toString());
        return Map.of("content",(mentions.isBlank()?"":mentions+" ")+"Your match has been "+(edit?"rescheduled":"scheduled"),
                "embeds",List.of(embed),"allowed_mentions",Map.of("parse",List.of(),"roles",roles));
    }
}
