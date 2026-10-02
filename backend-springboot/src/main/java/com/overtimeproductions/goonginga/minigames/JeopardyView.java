package com.overtimeproductions.goonginga.minigames;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class JeopardyView {
    private final ObjectMapper mapper;
    private final JsonSql json;
    private final Map<String,Object> defaultConfig;
    public JeopardyView(ObjectMapper mapper,JsonSql json,@Value("classpath:minigames/default-jeopardy.json") Resource resource) throws IOException {
        this.mapper=mapper;this.json=json;
        try (var input=resource.getInputStream()) { this.defaultConfig=mapper.readValue(input,Map.class); }
    }
    @SuppressWarnings("unchecked") public Map<String,Object> map(Object raw) {
        if (raw==null) return Map.of();
        if (raw instanceof Map<?,?> value) return (Map<String,Object>) value;
        if (raw instanceof JsonNode node) return mapper.readValue(json.stringify(node),Map.class);
        return Map.of();
    }
    public static String text(Object raw,int max) {
        String value=raw instanceof String s?s.trim():"";
        return value.length()>max?value.substring(0,max):value;
    }
    public static String slug(String raw) {
        String ascii=Normalizer.normalize(text(raw,100),Normalizer.Form.NFKD).replaceAll("\\p{M}","");
        String value=ascii.toLowerCase().replaceAll("[^a-z0-9]+","-").replaceAll("^-+|-+$","");
        return value.length()>64?value.substring(0,64):value;
    }
    private static String id(Object value,String fallback) {
        String result=text(value,80).replaceAll("[^a-zA-Z0-9_-]","");
        return result.isEmpty()?fallback:result;
    }
    private static int intValue(Object value,int fallback) {
        try { return Integer.parseInt(String.valueOf(value)); } catch (RuntimeException ignored) { return fallback; }
    }
    private static Integer positive(Object value) {
        int parsed=intValue(value,0);return parsed>0?parsed:null;
    }
    public Map<String,Object> config(Object raw) {
        Map<String,Object> source=map(raw);
        var categories=new ArrayList<Map<String,Object>>();
        if (source.get("categories") instanceof List<?> original) {
            for (int i=0;i<Math.min(5,original.size());i++) {
                Map<String,Object> category=map(original.get(i));
                var questions=new ArrayList<Map<String,Object>>();
                if (category.get("questions") instanceof List<?> rows) {
                    for (int j=0;j<Math.min(5,rows.size());j++) {
                        Map<String,Object> question=map(rows.get(j));
                        String prompt=text(question.get("question"),1000),answer=text(question.get("answer"),1000);
                        if (prompt.isEmpty() || answer.isEmpty()) continue;
                        questions.add(Map.of("id",id(question.get("id"),"question-"+(i+1)+"-"+(j+1)),
                                "question",prompt,"answer",answer,"reward",Math.min(1000000,Math.max(1,intValue(question.get("reward"),100)))));
                    }
                }
                String name=text(category.get("name"),80);
                categories.add(Map.of("id",id(category.get("id"),"category-"+(i+1)),"name",name.isEmpty()?"Category "+(i+1):name,"questions",questions));
            }
        }
        return categories.isEmpty()?defaultConfig:Map.of("categories",categories);
    }
    public Map<String,Object> state(Object raw) {
        Map<String,Object> source=map(raw);
        var used=new ArrayList<String>();
        if (source.get("usedQuestionIds") instanceof List<?> values)
            for (Object value:values) { String v=text(value,100);if (!v.isEmpty() && !used.contains(v) && used.size()<25) used.add(v); }
        var results=new ArrayList<Map<String,Object>>();
        if (source.get("questionResults") instanceof List<?> values)
            for (Object value:values) {
                if (results.size()>=150) break;
                Map<String,Object> result=map(value);String questionId=text(result.get("questionId"),100);
                if (questionId.isEmpty()) continue;
                var item=new HashMap<String,Object>();item.put("questionId",questionId);
                item.put("memberId",positive(result.get("memberId")));
                item.put("reward",Math.min(1000000,Math.max(-1000000,intValue(result.get("reward"),0))));results.add(item);
            }
        var order=new ArrayList<Integer>();
        if (source.get("displayOrderMemberIds") instanceof List<?> values)
            for (Object value:values) { Integer id=positive(value);if (id!=null && !order.contains(id) && order.size()<5) order.add(id); }
        var state=new LinkedHashMap<String,Object>();
        state.put("turnMemberId",positive(source.get("turnMemberId")));
        state.put("requestedQuestionId",emptyNull(text(source.get("requestedQuestionId"),100)));
        state.put("currentQuestionId",emptyNull(text(source.get("currentQuestionId"),100)));
        state.put("usedQuestionIds",used);state.put("revealed",Boolean.TRUE.equals(source.get("revealed")));
        state.put("responseText",text(source.get("responseText"),1000));
        state.put("answerCorrect",source.get("answerCorrect") instanceof Boolean?source.get("answerCorrect"):null);
        state.put("respondedAt",emptyNull(text(source.get("respondedAt"),80)));
        state.put("questionResults",results);state.put("displayOrderMemberIds",order);
        return state;
    }
    private static String emptyNull(String value) { return value.isBlank()?null:value; }
    @SuppressWarnings("unchecked") public Map<String,Object> question(Map<String,Object> config,String id) {
        for (Object rawCategory:(List<?>)config.get("categories")) {
            Map<String,Object> category=map(rawCategory);
            for (Object rawQuestion:(List<?>)category.get("questions")) {
                Map<String,Object> question=map(rawQuestion);
                if (id.equals(question.get("id"))) {
                    var result=new HashMap<>(question);
                    result.put("categoryId",category.get("id"));result.put("categoryName",category.get("name"));return result;
                }
            }
        }
        return null;
    }
    public Map<String,Object> publicBoard(Map<String,Object> config,Map<String,Object> state) {
        Set<String> used=new HashSet<>((List<String>)state.get("usedQuestionIds"));
        Map<String,Map<String,Object>> results=new HashMap<>();
        for (Object raw:(List<?>)state.get("questionResults")) {
            Map<String,Object> result=map(raw);results.put(String.valueOf(result.get("questionId")),result);
        }
        var categories=new ArrayList<Map<String,Object>>();
        for (Object rawCategory:(List<?>)config.get("categories")) {
            Map<String,Object> category=map(rawCategory);
            var questions=new ArrayList<Map<String,Object>>();
            for (Object rawQuestion:(List<?>)category.get("questions")) {
                Map<String,Object> question=map(rawQuestion);
                String id=String.valueOf(question.get("id"));Map<String,Object> result=results.get(id);
                var item=new HashMap<String,Object>();
                item.put("id",id);item.put("reward",question.get("reward"));item.put("used",used.contains(id));
                item.put("selected",id.equals(state.get("currentQuestionId")));item.put("requested",id.equals(state.get("requestedQuestionId")));
                item.put("answeredMemberId",result==null?null:result.get("memberId"));
                item.put("unanswered",result!=null && result.get("memberId")==null);
                item.put("scoreDelta",result==null || result.get("memberId")==null?0:result.get("reward"));
                questions.add(item);
            }
            categories.add(Map.of("id",category.get("id"),"name",category.get("name"),"questions",questions));
        }
        return Map.of("categories",categories);
    }
    public Map<String,Object> render(JsonNode game,boolean manage) {
        String gameType=game.get("gameType").asText(),phase=game.get("phase").asText();
        Map<String,Object> config=gameType.equals("JEOPARDY")?config(game.get("config")):map(game.get("config"));
        Map<String,Object> state=state(game.get("state"));
        String questionId=(String)state.get("currentQuestionId");
        Map<String,Object> current=questionId==null?null:question(config,questionId);
        var result=new HashMap<String,Object>();
        for (String field:List.of("id","slug","title","description","coverImageUrl","gameType","status","phase","createdAt","updatedAt","createdBy","underDevelopmentBy","currentPlayer","participants"))
            result.put(field,game.get(field));
        result.put("board",gameType.equals("JEOPARDY")?publicBoard(config,state):null);
        var gameState=new HashMap<String,Object>();
        for (String field:List.of("turnMemberId","requestedQuestionId","currentQuestionId","revealed","questionResults","displayOrderMemberIds"))
            gameState.put(field,state.get(field));
        boolean show=phase.equals("RESPONDED") || phase.equals("FINALIZED");
        gameState.put("responseText",show?state.get("responseText"):"");
        gameState.put("answerCorrect",show?state.get("answerCorrect"):null);
        if (current==null) gameState.put("currentQuestion",null);
        else gameState.put("currentQuestion",Map.of("id",current.get("id"),"categoryName",current.get("categoryName"),"reward",current.get("reward"),"question",current.get("question")));
        result.put("gameState",gameState);
        if (manage) { result.put("config",config);result.put("state",state);result.put("currentQuestion",current); }
        return result;
    }
}
