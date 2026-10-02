package com.overtimeproductions.goonginga.familyfeud.questions;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class FeudQuestionService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public FeudQuestionService(JdbcTemplate jdbc, JsonSql json) { this.jdbc=jdbc;this.json=json; }

    private static final String QUERY="""
            SELECT (to_jsonb(q) || jsonb_build_object('answers',
                   COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.rank)
                             FROM public."FeudAnswer" a WHERE a."questionId"=q.id),'[]'::jsonb)))::text
            FROM public."FeudQuestion" q
            """;

    public List<JsonNode> list() { return json.list(QUERY+" ORDER BY q.pack,q.category,q.id DESC"); }
    public JsonNode get(int id) { return json.first(QUERY+" WHERE q.id=?",id)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"Family Feud question not found.")); }

    @Transactional
    public JsonNode create(Map<String,Object> input,int memberId) {
        Question question=normalize(input);
        int id=jdbc.queryForObject("""
                INSERT INTO public."FeudQuestion" (question,category,pack,active,"createdById","updatedAt")
                VALUES (?,?,?,?,?,now()) RETURNING id
                """,Integer.class,question.text,question.category,question.pack,question.active,memberId);
        insertAnswers(id,question.answers);
        return get(id);
    }

    @Transactional
    public Map<String,Object> importMany(Map<String,Object> body,int memberId) {
        if (!(body.get("questions") instanceof List<?> source) || source.isEmpty() || source.size()>50)
            throw new IllegalArgumentException("Import between 1 and 50 questions at a time.");
        String fallbackPack=clean(body.get("pack"),80), fallbackCategory=clean(body.get("category"),48);
        var questions=new ArrayList<JsonNode>();
        for (Object raw:source) {
            if (!(raw instanceof Map<?,?> item)) throw new IllegalArgumentException("Each question must be an object.");
            var input=new java.util.HashMap<String,Object>();
            item.forEach((key,value) -> { if (key instanceof String k) input.put(k,value); });
            if (clean(input.get("pack"),80).isBlank()) input.put("pack",fallbackPack.isBlank()?"Imported questions":fallbackPack);
            if (clean(input.get("category"),48).isBlank()) input.put("category",fallbackCategory.isBlank()?"GENERAL":fallbackCategory);
            questions.add(create(input,memberId));
        }
        return Map.of("count",questions.size(),"questions",questions);
    }

    @Transactional
    public JsonNode update(int id,Map<String,Object> input) {
        get(id);
        Question question=normalize(input);
        jdbc.update("DELETE FROM public.\"FeudAnswer\" WHERE \"questionId\"=?",id);
        jdbc.update("UPDATE public.\"FeudQuestion\" SET question=?,category=?,pack=?,active=?,\"updatedAt\"=now() WHERE id=?",
                question.text,question.category,question.pack,question.active,id);
        insertAnswers(id,question.answers);
        return get(id);
    }

    @Transactional
    public JsonNode deactivate(int id) {
        get(id);
        jdbc.update("UPDATE public.\"FeudQuestion\" SET active=false,\"updatedAt\"=now() WHERE id=?",id);
        return get(id);
    }

    private void insertAnswers(int questionId,List<Answer> answers) {
        int rank=1;
        for (Answer answer:answers) {
            jdbc.update("""
                    INSERT INTO public."FeudAnswer" ("questionId",answer,points,rank,aliases)
                    VALUES (?,?,?,?,ARRAY(SELECT jsonb_array_elements_text(?::jsonb)))
                    """,questionId,answer.text,answer.points,rank++,json.stringify(answer.aliases));
        }
    }

    private static Question normalize(Map<String,Object> input) {
        String text=clean(input.get("question"),240),category=clean(input.get("category"),48).toUpperCase(),pack=clean(input.get("pack"),80);
        if (text.isBlank()) throw new IllegalArgumentException("Question text is required.");
        if (category.isBlank()) category="GENERAL";
        if (pack.isBlank()) pack="Core Set";
        if (!(input.get("answers") instanceof List<?> values) || values.size()<2 || values.size()>10)
            throw new IllegalArgumentException("Add between 2 and 10 survey answers.");
        var answers=new ArrayList<Answer>();
        for (Object raw:values) {
            if (!(raw instanceof Map<?,?> item)) throw new IllegalArgumentException("Every survey answer needs text.");
            String answer=clean(item.get("answer"),120);
            if (answer.isBlank()) throw new IllegalArgumentException("Every survey answer needs text.");
            int points=0;
            if (item.get("points") instanceof Number n) points=Math.max(0,Math.min(100,n.intValue()));
            var aliases=new ArrayList<String>();
            if (item.get("aliases") instanceof List<?> source)
                for (Object alias:source) { String value=clean(alias,80); if (!value.isBlank() && aliases.size()<20) aliases.add(value); }
            answers.add(new Answer(answer,points,List.copyOf(aliases)));
        }
        return new Question(text,category,pack,!Boolean.FALSE.equals(input.get("active")),List.copyOf(answers));
    }

    private static String clean(Object raw,int max) {
        return raw instanceof String text ? text.trim().replaceAll("\\s+"," ").substring(0,Math.min(max,text.trim().replaceAll("\\s+"," ").length())) : "";
    }
    private record Question(String text,String category,String pack,boolean active,List<Answer> answers) {}
    private record Answer(String text,int points,List<String> aliases) {}
}
