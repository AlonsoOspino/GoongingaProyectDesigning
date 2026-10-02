package com.overtimeproductions.goonginga.minigames;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
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

@Service
public class MiniGameService {
    private static final Set<String> GAME_TYPES=Set.of("JEOPARDY","FAMILY_FEUD","CUSTOM");
    private final MiniGameRepository games;
    private final JeopardyView view;
    private final JsonSql json;
    private final JdbcTemplate jdbc;
    public MiniGameService(MiniGameRepository games,JeopardyView view,JsonSql json,JdbcTemplate jdbc) {
        this.games=games;this.view=view;this.json=json;this.jdbc=jdbc;
    }
    public List<Map<String,Object>> all() { return games.list().stream().map(game -> view.render(game,false)).toList(); }
    public Map<String,Object> get(String slug,boolean manage) { return view.render(games.get(JeopardyView.slug(slug)),manage); }
    public Map<String,Object> activeJeopardy() { return view.render(games.activeJeopardy(),false); }
    public Map<String,Object> familyFeudStatus() {
        var result=new HashMap<String,Object>();
        result.put("slug","family-feud");result.put("title","Family Feud");
        result.put("description","The Overtime Productions Family Feud experience is getting its next big upgrade.");
        result.put("coverImageUrl","/family-feud-stage.png");result.put("status","UNDER_DEVELOPMENT");
        result.put("underDevelopmentBy",games.familyFeudDeveloper());return result;
    }
    public void operator(String slug,DraftActor actor) {
        if (actor.roles().contains("ADMIN") || actor.roles().contains("SOCIAL_MEDIA")) return;
        if (!actor.roles().contains("CASTER")) throw new DraftHttpException(HttpStatus.FORBIDDEN,"You do not have permission for this Minigames action.");
        if (!"JEOPARDY".equals(games.get(JeopardyView.slug(slug)).get("gameType").asText()))
            throw new DraftHttpException(HttpStatus.FORBIDDEN,"Casters can only control Jeopardy games.");
    }
    private static int positive(Object value) {
        try { int parsed=Integer.parseInt(String.valueOf(value)); return parsed>0?parsed:0; }
        catch (RuntimeException ignored) { return 0; }
    }
    private List<Integer> ids(Object raw) {
        var result=new ArrayList<Integer>();
        if (raw instanceof List<?> values) for (Object value:values) {
            int id=positive(value);if (id>0 && !result.contains(id) && result.size()<100) result.add(id);
        }
        return result;
    }
    private void validMembers(List<Integer> ids) {
        for (int id:ids) if (!games.memberActive(id)) throw new IllegalArgumentException("One or more selected members are unavailable.");
    }
    @Transactional
    public Map<String,Object> create(Map<String,Object> input,int actor) {
        String title=JeopardyView.text(input.get("title"),120);
        String slug=JeopardyView.slug(input.get("slug") instanceof String s?s:title);
        String gameType=JeopardyView.text(input.get("gameType"),30).toUpperCase();
        if (gameType.isBlank()) gameType="JEOPARDY";
        if (title.isBlank()) throw new IllegalArgumentException("A title is required.");
        if (slug.isBlank()) throw new IllegalArgumentException("Enter a valid route, for example /quiz-night.");
        if (!GAME_TYPES.contains(gameType)) throw new IllegalArgumentException("Unknown game type.");
        List<Integer> members=ids(input.get("participantIds"));
        if (gameType.equals("JEOPARDY") && members.isEmpty()) throw new IllegalArgumentException("Select at least one Network Member for this Jeopardy game.");
        validMembers(members);
        Map<String,Object> config=gameType.equals("JEOPARDY")?view.config(input.get("config")):Map.of();
        Map<String,Object> state=view.state(Map.of("displayOrderMemberIds",members.stream().limit(5).toList()));
        int id=games.create(slug,title,JeopardyView.text(input.get("description"),1500),
                emptyNull(JeopardyView.text(input.get("coverImageUrl"),2048)),gameType,json.stringify(config),json.stringify(state),actor);
        for (int memberId:members) games.participant(id,memberId);
        return get(slug,true);
    }
    private static String emptyNull(String value) { return value.isBlank()?null:value; }
    @Transactional
    public Map<String,Object> update(String slug,Map<String,Object> input) {
        JsonNode existing=games.get(JeopardyView.slug(slug));
        int id=existing.get("id").asInt();
        String title=input.containsKey("title")?JeopardyView.text(input.get("title"),120):existing.get("title").asText();
        if (title.isBlank()) throw new IllegalArgumentException("A title is required.");
        String nextSlug=input.containsKey("slug")?JeopardyView.slug(String.valueOf(input.get("slug"))):existing.get("slug").asText();
        if (nextSlug.isBlank()) throw new IllegalArgumentException("Enter a valid route.");
        if (input.containsKey("participantIds")) {
            if (!"CREATED".equals(existing.get("phase").asText())) throw new DraftHttpException(HttpStatus.CONFLICT,"Participants can only be changed before the game starts.");
            List<Integer> members=ids(input.get("participantIds"));
            if (members.isEmpty()) throw new IllegalArgumentException("Select at least one Network Member.");
            validMembers(members);
            jdbc.update("DELETE FROM public.\"MiniGameParticipant\" WHERE \"gameId\"=?",id);
            for (int memberId:members) games.participant(id,memberId);
        }
        String description=input.containsKey("description")?JeopardyView.text(input.get("description"),1500):existing.get("description").asText();
        String cover=input.containsKey("coverImageUrl")?emptyNull(JeopardyView.text(input.get("coverImageUrl"),2048)):
                (existing.get("coverImageUrl").isNull()?null:existing.get("coverImageUrl").asText());
        Object config=input.containsKey("config") && "JEOPARDY".equals(existing.get("gameType").asText())?
                view.config(input.get("config")):existing.get("config");
        games.updateGame(id,title,nextSlug,description,cover,json.stringify(config));
        return get(nextSlug,true);
    }
    @Transactional
    public Map<String,Object> status(String slug,String status,int actor) {
        String normalized=status==null?"":status.trim().toUpperCase();
        if (!Set.of("LIVE","UNDER_DEVELOPMENT").contains(normalized)) throw new IllegalArgumentException("Unknown game status.");
        JsonNode game=games.get(JeopardyView.slug(slug));
        games.status(game.get("id").asInt(),normalized,normalized.equals("UNDER_DEVELOPMENT")?actor:null);
        return get(game.get("slug").asText(),true);
    }
    @Transactional
    public Map<String,Object> remove(String slug) {
        JsonNode game=games.get(JeopardyView.slug(slug));
        if (!"JEOPARDY".equals(game.get("gameType").asText())) throw new IllegalArgumentException("Only Jeopardy games can be removed here.");
        games.remove(game.get("id").asInt());return Map.of("deleted",true,"slug",game.get("slug").asText());
    }
    public List<JsonNode> members(String search) { return games.members(JeopardyView.text(search,80)); }
    @Transactional
    public Map<String,Object> start(String slug) {
        JsonNode game=games.get(JeopardyView.slug(slug));
        int id=game.get("id").asInt();
        if (!"JEOPARDY".equals(game.get("gameType").asText())) throw new IllegalArgumentException("This is not a Jeopardy game.");
        List<Integer> members=games.participants(id);
        if (members.isEmpty()) throw new DraftHttpException(HttpStatus.CONFLICT,"Add participants before starting.");
        if (!"CREATED".equals(game.get("phase").asText())) throw new DraftHttpException(HttpStatus.CONFLICT,"This game has already started.");
        Map<String,Object> state=view.state(game.get("state"));
        if (((List<?>)state.get("displayOrderMemberIds")).isEmpty()) state.put("displayOrderMemberIds",members.stream().sorted().limit(5).toList());
        games.phaseState(id,"PICKING_QUESTION",json.stringify(state));
        return get(slug,true);
    }
    @Transactional
    public Map<String,Object> award(String slug,String questionId,Integer memberId,String result) {
        JsonNode game=games.get(JeopardyView.slug(slug));int gameId=game.get("id").asInt();
        if (!"JEOPARDY".equals(game.get("gameType").asText()) || !"PICKING_QUESTION".equals(game.get("phase").asText()))
            throw new DraftHttpException(HttpStatus.CONFLICT,"Jeopardy is not accepting results.");
        Map<String,Object> config=view.config(game.get("config"));Map<String,Object> state=view.state(game.get("state"));
        Map<String,Object> question=view.question(config,JeopardyView.text(questionId,100));
        if (question==null || ((List<?>)state.get("usedQuestionIds")).contains(questionId)) throw new IllegalArgumentException("That question is not available.");
        String outcome=result!=null && Set.of("ADD","SUBTRACT","NO_ANSWER").contains(result)?result:(memberId==null?"NO_ANSWER":"ADD");
        List<Integer> roster=games.participants(gameId);
        if (outcome.equals("NO_ANSWER") && memberId!=null) throw new IllegalArgumentException("No-answer results cannot be assigned to a participant.");
        if (!outcome.equals("NO_ANSWER") && (memberId==null || !roster.contains(memberId))) throw new IllegalArgumentException("Choose a participant from this Jeopardy roster.");
        var priorWrong=new HashSet<Integer>();
        List<Map<String,Object>> results=(List<Map<String,Object>>)state.get("questionResults");
        for (Map<String,Object> entry:results) if (questionId.equals(entry.get("questionId")) && entry.get("memberId")!=null && ((Number)entry.get("reward")).intValue()<0)
            priorWrong.add(((Number)entry.get("memberId")).intValue());
        if (outcome.equals("SUBTRACT") && priorWrong.contains(memberId)) throw new DraftHttpException(HttpStatus.CONFLICT,"This participant has already attempted this question.");
        if (outcome.equals("SUBTRACT")) priorWrong.add(memberId);
        boolean close=!outcome.equals("SUBTRACT") || (!roster.isEmpty() && priorWrong.containsAll(roster));
        int reward=((Number)question.get("reward")).intValue();
        int delta=outcome.equals("SUBTRACT")?-reward:outcome.equals("ADD")?reward:0;
        var entry=new HashMap<String,Object>();entry.put("questionId",questionId);entry.put("memberId",memberId);entry.put("reward",delta);results.add(entry);
        if (outcome.equals("SUBTRACT") && close) { var empty=new HashMap<String,Object>();empty.put("questionId",questionId);empty.put("memberId",null);empty.put("reward",0);results.add(empty); }
        if (close) ((List<String>)state.get("usedQuestionIds")).add(questionId);
        if (memberId!=null) games.score(gameId,memberId,delta);
        games.state(gameId,json.stringify(state));
        return get(slug,true);
    }
    @Transactional
    public Map<String,Object> score(String slug,int memberId,int delta) {
        JsonNode game=games.get(JeopardyView.slug(slug));int gameId=game.get("id").asInt();
        if (!"JEOPARDY".equals(game.get("gameType").asText())) throw new IllegalArgumentException("This is not a Jeopardy game.");
        if (memberId<1 || delta==0 || Math.abs((long)delta)>1000000 || !games.participants(gameId).contains(memberId))
            throw new IllegalArgumentException("Choose a participant and a point amount between 1 and 1,000,000.");
        games.score(gameId,memberId,delta);return get(slug,true);
    }
    @Transactional
    public Map<String,Object> order(String slug,List<Integer> requested) {
        JsonNode game=games.get(JeopardyView.slug(slug));int id=game.get("id").asInt();
        if (!"JEOPARDY".equals(game.get("gameType").asText())) throw new IllegalArgumentException("This is not a Jeopardy game.");
        var roster=new HashSet<>(games.participants(id));var order=new ArrayList<Integer>();
        if (requested!=null) for (Integer memberId:requested)
            if (memberId!=null && roster.contains(memberId) && !order.contains(memberId) && order.size()<5) order.add(memberId);
        if (order.isEmpty()) throw new IllegalArgumentException("Choose at least one participant for the stream layout.");
        Map<String,Object> state=view.state(game.get("state"));state.put("displayOrderMemberIds",order);
        games.state(id,json.stringify(state));return get(slug,true);
    }
    @Transactional
    public Map<String,Object> finalizeGame(String slug) {
        JsonNode game=games.get(JeopardyView.slug(slug));
        if (!"JEOPARDY".equals(game.get("gameType").asText()) || "CREATED".equals(game.get("phase").asText()))
            throw new DraftHttpException(HttpStatus.CONFLICT,"Start Jeopardy before finalizing it.");
        games.phaseState(game.get("id").asInt(),"FINALIZED",json.stringify(game.get("state")));
        return get(slug,true);
    }
    @Transactional
    public Map<String,Object> cover(String slug,String url) {
        JsonNode game=games.get(JeopardyView.slug(slug));games.cover(game.get("id").asInt(),url);return get(slug,true);
    }
}
