package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/** Mutable transaction context; it is saved once after a validated command. */
public final class FeudTurn {
    public final FeudSnapshot game;
    private final JsonSql json;
    public ObjectNode state;
    public String phase;
    public Instant deadline;
    public Instant startedAt;
    public Instant finishedAt;
    public Integer winnerTeamId;
    public FeudTurn(FeudSnapshot game,JsonSql json) {
        this.game=game;this.json=json;this.state=(ObjectNode)json.parse(game.state().toString());
        phase=game.phase();deadline=instant(game.game(),"timerEndsAt");
        startedAt=instant(game.game(),"startedAt");finishedAt=instant(game.game(),"finishedAt");
        winnerTeamId=FeudProjection.number(game.game(),"winningTeamId");
    }
    public void put(String key,Object value) { state.set(key,json.parse(json.stringify(value))); }
    public String text(String key) { return FeudProjection.text(state,key); }
    public int number(String key) { return state.path(key).asInt(0); }
    public Integer nullableNumber(String key) { return FeudProjection.number(state,key); }
    public List<Integer> ids(String key) {
        var ids=new ArrayList<Integer>();JsonNode value=state.path(key);
        if (value.isArray()) value.forEach(item -> ids.add(item.asInt()));return ids;
    }
    public void reveal(int id) { var ids=ids("revealedAnswerIds");if (!ids.contains(id)) ids.add(id);put("revealedAnswerIds",ids); }
    public void phase(String next) { phase=next;put("phase",next); }
    public void timer(int seconds) { deadline=Instant.now().plusSeconds(seconds); }
    public void answerTimer() { timer(state.path("config").path("answerSeconds").asInt(20)); }
    public void event(String type,String label) { put("lastEvent",FeudProjection.row("id",java.util.UUID.randomUUID().toString(),"type",type,"label",label,"at",Instant.now().toString())); }
    public void require(String... phases) {
        if (Arrays.stream(phases).noneMatch(phase::equals)) throw new DraftHttpException(HttpStatus.CONFLICT,"This action is not available during "+phase.replace('_',' ')+".");
    }
    public static Instant instant(JsonNode row,String key) {
        String value=FeudProjection.text(row,key);return value==null?null:Instant.parse(value);
    }
    public static String other(String side) { return "ALPHA".equals(side)?"BETA":"ALPHA"; }
}
