package com.overtimeproductions.goonginga.familyfeud.rounds;

import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.row;
import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.text;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.familyfeud.game.*;
import com.overtimeproductions.goonginga.familyfeud.questions.FeudQuestionService;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class FeudRoundService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final FeudQuestionService questions;
    private final SecureRandom random=new SecureRandom();
    public FeudRoundService(JdbcTemplate jdbc,JsonSql json,FeudQuestionService questions) { this.jdbc=jdbc;this.json=json;this.questions=questions; }

    public List<JsonNode> players(FeudSnapshot game,String side) {
        return game.participants().stream().filter(p -> "PLAYER".equals(text(p,"role"))
                && side.equals(game.participantSide(p)) && FeudProjection.active(p)).toList();
    }
    public Integer nextPlayer(FeudSnapshot game,String side,int currentIndex) {
        var players=players(game,side);return players.isEmpty()?null:players.get(Math.floorMod(currentIndex+1,players.size())).get("memberId").asInt();
    }
    public void start(FeudTurn turn) {
        String category=text(turn.state.path("config"),"category"),pack=text(turn.state.path("config"),"pack");
        var available=questions.list().stream().filter(q -> q.path("active").asBoolean() && q.path("answers").size()>0
                && !turn.ids("usedQuestionIds").contains(q.get("id").asInt())
                && (category==null || category.equals(text(q,"category"))) && (pack==null || pack.equals(text(q,"pack")))).toList();
        if (available.isEmpty()) throw new IllegalArgumentException("There are no unused active questions in the selected question pack.");
        JsonNode question=available.get(random.nextInt(available.size()));
        int number=turn.number("currentRound")+1,multiplier=number>=4?3:number>=3?2:1;
        jdbc.update("""
                INSERT INTO public."FeudRound" ("gameId","questionId","roundNumber",multiplier,status)
                VALUES (?,?,?,?,'ROUND_INTRO'::"FeudRoundStatus")
                """,turn.game.id(),question.get("id").asInt(),number,multiplier);
        turn.phase("ROUND_INTRO");turn.put("currentRound",number);
        var used=turn.ids("usedQuestionIds");used.add(question.get("id").asInt());turn.put("usedQuestionIds",used);
        turn.put("revealedAnswerIds",List.of());turn.put("pendingExternalWinnerMemberId",null);turn.put("pendingResponseId",null);
        turn.put("activeMemberId",null);turn.put("activeSide",null);turn.put("playPassWinnerSide",null);turn.put("roundWinnerSide",null);
        turn.put("turnIndex",-1);turn.put("faceOffResults",List.of());turn.deadline=null;
    }
    public void steal(FeudTurn turn) {
        String side=FeudTurn.other(turn.text("activeSide"));
        JsonNode team=turn.game.team(side);Integer captain=FeudProjection.number(team,"captainMemberId");
        turn.phase("STEAL");turn.put("activeSide",side);turn.put("activeMemberId",captain==null?nextPlayer(turn.game,side,-1):captain);
        turn.put("pendingResponseId",null);turn.put("turnIndex",-1);turn.answerTimer();
        jdbc.update("UPDATE public.\"FeudRound\" SET status='STEAL'::\"FeudRoundStatus\",\"activeTeamId\"=? WHERE id=?",team.get("id").asInt(),turn.game.round().get("id").asInt());
    }
    public void resolve(FeudTurn turn,boolean correct,Integer answerId) {
        JsonNode round=turn.game.round();
        if (round==null) throw new IllegalArgumentException("There is no active round.");
        Integer pendingId=turn.nullableNumber("pendingResponseId");
        JsonNode pending=pendingId==null?null:turn.game.responses().stream().filter(r -> r.get("id").asInt()==pendingId).findFirst().orElse(null);
        if (pending==null || !pending.path("resolvedAt").isNull()) throw new IllegalArgumentException("There is no unanswered submission to resolve.");
        List<JsonNode> pool=answerPool(turn);
        JsonNode answer=answerId==null?null:pool.stream().filter(a -> a.get("id").asInt()==answerId).findFirst().orElse(null);
        if (correct && answer==null) throw new IllegalArgumentException("Select a valid survey answer.");
        if (correct && turn.phase.equals("ROUND_PLAY") && turn.ids("revealedAnswerIds").contains(answerId))
            throw new DraftHttpException(HttpStatus.CONFLICT,"That survey answer is already on the board.");
        if (correct && turn.phase.equals("FAST_MONEY")) {
            JsonNode fast=turn.state.path("fastMoney");
            if (fast.path("activePlayerIndex").asInt()==1) for (JsonNode prior:fast.path("responses"))
                if (prior.path("playerIndex").asInt()==0 && prior.path("questionIndex").asInt()==fast.path("questionIndex").asInt()
                        && prior.path("answerId").asInt()==answerId) throw new DraftHttpException(HttpStatus.CONFLICT,"Duplicate answer: ask the player for another response.");
        }
        int points=correct?answer.get("points").asInt()*(turn.phase.equals("FAST_MONEY")?1:round.get("multiplier").asInt()):0;
        jdbc.update("UPDATE public.\"FeudResponse\" SET \"matchedAnswerId\"=?,correct=?,points=?,\"resolvedAt\"=now() WHERE id=?",
                answer==null?null:answer.get("id").asInt(),correct,points,pendingId);
        turn.event(correct?"CORRECT":"INCORRECT",correct?"ANSWER REVEALED":"INCORRECT");
        String phase=turn.phase;
        if (phase.startsWith("FACE_OFF")) {
            if (correct) { turn.reveal(answerId);bank(round.get("id").asInt(),points); }
            faceOff(turn,pending.get("memberId").asInt(),correct?answer.get("rank").asInt():null);
        } else if (phase.equals("ROUND_PLAY")) {
            if (correct) { bank(round.get("id").asInt(),points);turn.reveal(answerId);nextTurn(turn); }
            else wrong(turn);
        } else if (phase.equals("STEAL")) {
            boolean add=correct && !turn.ids("revealedAnswerIds").contains(answerId);
            if (add) { bank(round.get("id").asInt(),points);turn.reveal(answerId); }
            finishRound(turn,correct?turn.text("activeSide"):FeudTurn.other(turn.text("activeSide")),
                    round.get("roundBank").asInt()+(add?points:0));
        } else if (phase.equals("FAST_MONEY")) fastResponse(turn,text(pending,"text"),answer,correct);
        else throw new DraftHttpException(HttpStatus.CONFLICT,"The pending answer cannot be resolved in this phase.");
    }
    private List<JsonNode> answerPool(FeudTurn turn) {
        if (!turn.phase.equals("FAST_MONEY")) return turn.game.answers();
        JsonNode fast=turn.state.path("fastMoney"),question=fast.path("questions").get(fast.path("questionIndex").asInt());
        var pool=new ArrayList<JsonNode>();question.path("answers").forEach(pool::add);return pool;
    }
    private void bank(int roundId,int points) { jdbc.update("UPDATE public.\"FeudRound\" SET \"roundBank\"=\"roundBank\"+? WHERE id=?",points,roundId); }
    private void nextTurn(FeudTurn turn) {
        int index=turn.number("turnIndex");turn.put("activeMemberId",nextPlayer(turn.game,turn.text("activeSide"),index));
        turn.put("turnIndex",index+1);turn.put("pendingResponseId",null);turn.answerTimer();
    }
    private void wrong(FeudTurn turn) {
        int strikes=Math.min(3,turn.game.round().path("strikes").asInt()+1);
        jdbc.update("UPDATE public.\"FeudRound\" SET strikes=? WHERE id=?",strikes,turn.game.round().get("id").asInt());
        if (strikes>=3) steal(turn);else nextTurn(turn);
    }
    private void faceOff(FeudTurn turn,int memberId,Integer rank) {
        JsonNode face=turn.game.faceOff();
        if (face==null) throw new IllegalArgumentException("Face-off representatives are missing.");
        int first=face.get("externalWinnerMemberId").asInt();
        int second=first==face.get("teamARepresentativeId").asInt()?face.get("teamBRepresentativeId").asInt():face.get("teamARepresentativeId").asInt();
        var results=new ArrayList<JsonNode>();turn.state.path("faceOffResults").forEach(results::add);
        results.add(json.parse(json.stringify(row("memberId",memberId,"rank",rank))));turn.put("faceOffResults",results);
        turn.put("pendingResponseId",null);
        if (turn.phase.equals("FACE_OFF_FIRST_ANSWER")) {
            turn.phase("FACE_OFF_SECOND_ANSWER");turn.put("activeMemberId",second);turn.answerTimer();return;
        }
        Integer firstRank=null,secondRank=null;
        for (JsonNode result:results) {
            if (result.path("memberId").asInt()==first) firstRank=FeudProjection.number(result,"rank");
            if (result.path("memberId").asInt()==second) secondRank=FeudProjection.number(result,"rank");
        }
        int winner=secondRank!=null && (firstRank==null || secondRank<firstRank)?second:first;
        JsonNode participant=turn.game.participant(winner);
        // Representative IDs preserve their original sides after a guest leaves.
        // The team wins the face-off; its captain or manager can choose play/pass.
        String side=winner==face.get("teamARepresentativeId").asInt()?"ALPHA":"BETA";
        JsonNode team=turn.game.team(side);
        Integer actingMember=winner;
        if (participant==null || !FeudProjection.active(participant)) {
            Integer captain=FeudProjection.number(team,"captainMemberId");
            JsonNode captainPlayer=captain==null?null:turn.game.participant(captain);
            actingMember=captainPlayer!=null && FeudProjection.active(captainPlayer)?captain:nextPlayer(turn.game,side,-1);
        }
        jdbc.update("UPDATE public.\"FeudFaceOff\" SET \"familyWinnerTeamId\"=?,\"resolvedAt\"=now() WHERE \"roundId\"=?",team.get("id").asInt(),turn.game.round().get("id").asInt());
        turn.phase("PLAY_PASS");turn.put("activeMemberId",actingMember);turn.put("playPassWinnerSide",side);turn.deadline=null;
        jdbc.update("UPDATE public.\"FeudRound\" SET status='PLAY_PASS'::\"FeudRoundStatus\" WHERE id=?",turn.game.round().get("id").asInt());
    }
    public void finishRound(FeudTurn turn,String winnerSide,int award) {
        JsonNode team=turn.game.team(winnerSide);
        if (team==null) throw new IllegalArgumentException("Select the round winner.");
        jdbc.update("UPDATE public.\"FeudTeam\" SET score=score+?,\"updatedAt\"=now() WHERE id=?",award,team.get("id").asInt());
        jdbc.update("UPDATE public.\"FeudRound\" SET status='ROUND_RESULTS'::\"FeudRoundStatus\",\"finishedAt\"=now() WHERE id=?",turn.game.round().get("id").asInt());
        turn.phase("ROUND_RESULTS");turn.put("roundWinnerSide",winnerSide);turn.put("pendingResponseId",null);turn.put("activeMemberId",null);turn.deadline=null;
    }
    public void startFastMoney(FeudTurn turn,List<Integer> memberIds) {
        JsonNode winner=turn.game.teams().stream().max(Comparator.comparingInt(t -> t.get("score").asInt())).orElseThrow();
        if (memberIds.size()!=2 || memberIds.get(0).equals(memberIds.get(1)) || memberIds.stream().anyMatch(id -> {
            JsonNode p=turn.game.participant(id);return p==null || !Integer.valueOf(winner.get("id").asInt()).equals(FeudProjection.number(p,"teamId"));
        })) throw new IllegalArgumentException("Select two different players from the leading team.");
        var selected=questions.list().stream().filter(q -> q.path("active").asBoolean()).sorted(Comparator.comparingInt(q -> q.get("id").asInt())).limit(5).toList();
        if (selected.size()<5) throw new IllegalArgumentException("Fast Money needs at least five active questions.");
        turn.phase("FAST_MONEY");turn.put("activeSide",text(winner,"side"));turn.put("activeMemberId",memberIds.getFirst());turn.put("pendingResponseId",null);
        turn.put("fastMoney",row("playerIds",memberIds,"activePlayerIndex",0,"questionIndex",0,"total",0,
                "responses",List.of(),"complete",false,"questions",selected));turn.timer(20);
    }
    private void fastResponse(FeudTurn turn,String text,JsonNode answer,boolean correct) {
        ObjectNode fast=(ObjectNode)json.parse(turn.state.path("fastMoney").toString());
        var responses=new ArrayList<JsonNode>();fast.path("responses").forEach(responses::add);
        int index=fast.path("questionIndex").asInt(),player=fast.path("activePlayerIndex").asInt();
        if(correct&&player==1&&responses.stream().anyMatch(r->r.path("playerIndex").asInt()==0&&r.path("questionIndex").asInt()==index&&r.path("answerId").asInt()==answer.path("id").asInt()))
            throw new DraftHttpException(HttpStatus.CONFLICT,"DUPLICATE ANSWER — ask the player for another response.");
        responses.add(json.parse(json.stringify(row("playerIndex",player,"questionIndex",index,"text",text,
                "answerId",answer==null?null:answer.get("id").asInt(),"answer",answer==null?null:FeudProjection.text(answer,"answer"),
                "points",correct?answer.get("points").asInt():0))));
        fast.set("responses",json.parse(json.stringify(responses)));
        fast.put("total",fast.path("total").asInt()+(correct?answer.get("points").asInt():0));
        turn.put("pendingResponseId",null);
        if (!correct) { turn.put("fastMoney",fast);turn.timer(10);return; }
        advanceFast(turn,fast);
    }
    private void advanceFast(FeudTurn turn,ObjectNode fast) {
        int index=fast.path("questionIndex").asInt(),player=fast.path("activePlayerIndex").asInt();
        if (index<fast.path("questions").size()-1) { fast.put("questionIndex",index+1);turn.timer(player==0?20:25); }
        else if (player==0) { fast.put("activePlayerIndex",1);fast.put("questionIndex",0);turn.put("activeMemberId",fast.path("playerIds").get(1).asInt());turn.timer(25); }
        else { fast.put("complete",true);turn.put("activeMemberId",null);turn.deadline=null; }
        turn.put("fastMoney",fast);
    }
    public boolean timeout(FeudTurn turn) {
        if (turn.game.round()==null || turn.nullableNumber("pendingResponseId")!=null) return false;
        turn.event("NO_ANSWER","NO ANSWER");
        if (turn.phase.startsWith("FACE_OFF")) {
            JsonNode face=turn.game.faceOff();
            if (face==null) throw new IllegalArgumentException("Face-off representatives are missing.");
            int first=face.get("externalWinnerMemberId").asInt();
            int second=first==face.get("teamARepresentativeId").asInt()?face.get("teamBRepresentativeId").asInt():face.get("teamARepresentativeId").asInt();
            faceOff(turn,turn.phase.equals("FACE_OFF_FIRST_ANSWER")?first:second,null);
        }
        else if (turn.phase.equals("ROUND_PLAY")) wrong(turn);
        else if (turn.phase.equals("STEAL")) finishRound(turn,FeudTurn.other(turn.text("activeSide")),turn.game.round().get("roundBank").asInt());
        else if (turn.phase.equals("FAST_MONEY")) {
            ObjectNode fast=(ObjectNode)json.parse(turn.state.path("fastMoney").toString());
            var responses=new ArrayList<JsonNode>();fast.path("responses").forEach(responses::add);
            responses.add(json.parse(json.stringify(row("playerIndex",fast.path("activePlayerIndex").asInt(),"questionIndex",fast.path("questionIndex").asInt(),
                    "text","NO ANSWER","answerId",null,"answer",null,"points",0))));
            fast.set("responses",json.parse(json.stringify(responses)));advanceFast(turn,fast);
        } else return false;
        return true;
    }
}
