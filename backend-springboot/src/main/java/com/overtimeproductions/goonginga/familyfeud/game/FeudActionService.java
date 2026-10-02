package com.overtimeproductions.goonginga.familyfeud.game;

import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.row;
import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.number;
import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.text;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.familyfeud.rounds.FeudRoundService;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class FeudActionService {
    private static final Set<String> MANAGER=Set.of("LOCK_TEAMS","MOVE_PLAYER","REMOVE_PLAYER","SET_CAPTAIN","START_GAME",
            "START_FACE_OFF","START_EXTERNAL_FACE_OFF","SET_FACE_OFF_REPRESENTATIVES","RECORD_EXTERNAL_WINNER","CONFIRM_EXTERNAL_WINNER",
            "ACCEPT_RESPONSE","REJECT_RESPONSE","UNDO_RESPONSE","REVEAL_ANSWER","ADD_STRIKE","REMOVE_STRIKE","UNDO_STRIKE",
            "ADJUST_BANK","ADJUST_SCORE","START_STEAL","RESOLVE_STEAL","END_ROUND","NEXT_ROUND","START_FAST_MONEY","END_GAME","PAUSE","RESUME");
    private static final Set<String> ANSWERING=Set.of("FACE_OFF_FIRST_ANSWER","FACE_OFF_SECOND_ANSWER","ROUND_PLAY","STEAL","FAST_MONEY");
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final FeudGameRepository games;
    private final FeudIdentity identity;
    private final FeudProjection projection;
    private final FeudRoundService rounds;
    private final FeudEvents events;
    public FeudActionService(JdbcTemplate jdbc,JsonSql json,FeudGameRepository games,FeudIdentity identity,
            FeudProjection projection,FeudRoundService rounds,FeudEvents events) {
        this.jdbc=jdbc;this.json=json;this.games=games;this.identity=identity;this.projection=projection;this.rounds=rounds;this.events=events;
    }
    @Transactional
    public FeudSnapshot reconcile(String code) {
        FeudSnapshot game=games.lock(code);FeudTurn turn=new FeudTurn(game,json);
        if (turn.deadline!=null && !turn.deadline.isAfter(Instant.now()) && !turn.phase.equals("PAUSED") && rounds.timeout(turn)) {
            turn.put("lastManagerUndo",null);turn.put("lastStrikeUndo",null);save(turn);return games.get(game.id(),false);
        }
        return game;
    }
    @Transactional
    public Map<String,Object> action(String code,Jwt jwt,String action,Map<String,Object> payload) {
        FeudSnapshot game=reconcile(code);
        FeudIdentity.Viewer viewer=identity.viewer(jwt,game,true);
        FeudTurn turn=new FeudTurn(game,json);
        String command=action==null?"":action.trim().toUpperCase();
        if (MANAGER.contains(command)) identity.requireManager(game,viewer);
        if (turn.phase.equals("PAUSED") && !command.equals("RESUME")) throw new DraftHttpException(HttpStatus.CONFLICT,"Resume the match before performing another action.");
        if (!command.equals("UNDO_RESPONSE")) turn.put("lastManagerUndo",null);
        if (!command.equals("UNDO_STRIKE")) turn.put("lastStrikeUndo",null);
        JsonNode participant=game.participant(viewer.id()),round=game.round();
        switch (command) {
            case "SET_READY" -> {
                turn.require("LOBBY");requirePlayer(participant);
                jdbc.update("UPDATE public.\"FeudParticipant\" SET ready=?,\"lastSeenAt\"=now() WHERE id=?",Boolean.TRUE.equals(payload.get("ready")),participant.get("id").asInt());
            }
            case "LOCK_TEAMS" -> { turn.require("LOBBY");turn.put("teamsLocked",Boolean.TRUE.equals(payload.get("locked"))); }
            case "MOVE_PLAYER" -> movePlayer(turn,payload);
            case "REMOVE_PLAYER" -> removePlayer(turn,payload);
            case "SET_CAPTAIN" -> {
                turn.require("LOBBY");JsonNode target=game.participant(id(payload.get("memberId")));requirePlayer(target);
                Integer team=number(target,"teamId");if (team==null) throw new IllegalArgumentException("The captain must be a team player.");
                jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=?,\"updatedAt\"=now() WHERE id=?",target.get("memberId").asInt(),team);
            }
            case "START_GAME" -> {
                turn.require("LOBBY");
                for (String side:List.of("ALPHA","BETA")) {
                    List<JsonNode> players=rounds.players(game,side);
                    if (players.isEmpty()) throw new IllegalArgumentException("Both teams need at least one player.");
                    if (players.stream().anyMatch(p -> !p.path("ready").asBoolean())) throw new IllegalArgumentException("Every player must be ready before the match starts.");
                    JsonNode team=game.team(side);
                    if (number(team,"captainMemberId")==null) jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=? WHERE id=?",players.getFirst().get("memberId").asInt(),team.get("id").asInt());
                }
                turn.put("teamsLocked",true);rounds.start(turn);turn.startedAt=Instant.now();
            }
            case "SET_FACE_OFF_REPRESENTATIVES" -> {
                turn.require("ROUND_INTRO");int alpha=id(payload.get("alphaMemberId")),beta=id(payload.get("betaMemberId"));
                requireTeamPlayer(game,alpha,"ALPHA");requireTeamPlayer(game,beta,"BETA");faceOff(round,alpha,beta,null);
            }
            case "START_FACE_OFF" -> {
                turn.require("ROUND_INTRO");String side=side(payload.get("side"));
                Integer alpha=number(game.team("ALPHA"),"captainMemberId"),beta=number(game.team("BETA"),"captainMemberId");
                if (alpha==null || beta==null) throw new IllegalArgumentException("Both captains must join before the face-off starts.");
                int first=side.equals("ALPHA")?alpha:beta;faceOff(round,alpha,beta,first);
                turn.phase("FACE_OFF_FIRST_ANSWER");turn.put("activeMemberId",first);turn.put("pendingExternalWinnerMemberId",null);turn.put("faceOffResults",List.of());turn.answerTimer();
                roundStatus(round,"FACE_OFF",null);
            }
            case "START_EXTERNAL_FACE_OFF" -> {
                turn.require("ROUND_INTRO");if (game.faceOff()==null) throw new IllegalArgumentException("Select both face-off representatives first.");
                turn.phase("AWAITING_EXTERNAL_FACE_OFF");roundStatus(round,"AWAITING_EXTERNAL_FACE_OFF",null);
            }
            case "RECORD_EXTERNAL_WINNER" -> {
                turn.require("AWAITING_EXTERNAL_FACE_OFF");int winner=id(payload.get("memberId"));
                if (game.faceOff()==null || (game.faceOff().get("teamARepresentativeId").asInt()!=winner && game.faceOff().get("teamBRepresentativeId").asInt()!=winner))
                    throw new IllegalArgumentException("The external winner must be a selected representative.");
                turn.put("pendingExternalWinnerMemberId",winner);
            }
            case "CONFIRM_EXTERNAL_WINNER" -> {
                turn.require("AWAITING_EXTERNAL_FACE_OFF");Integer winner=turn.nullableNumber("pendingExternalWinnerMemberId");
                if (winner==null) throw new IllegalArgumentException("Choose which captain answers first.");
                jdbc.update("UPDATE public.\"FeudFaceOff\" SET \"externalWinnerMemberId\"=? WHERE \"roundId\"=?",winner,round.get("id").asInt());
                turn.phase("FACE_OFF_FIRST_ANSWER");turn.put("activeMemberId",winner);turn.put("pendingExternalWinnerMemberId",null);turn.put("pendingResponseId",null);turn.answerTimer();roundStatus(round,"FACE_OFF",null);
            }
            case "SUBMIT_ANSWER" -> submit(turn,participant,payload,false);
            case "SUBMIT_STEAL_SUGGESTION" -> submit(turn,participant,payload,true);
            case "ACCEPT_RESPONSE","REJECT_RESPONSE" -> {
                if (round==null) throw new IllegalArgumentException("There is no active round.");
                var undo=responseUndo(turn);rounds.resolve(turn,command.equals("ACCEPT_RESPONSE"),optionalId(payload.get("answerId")));turn.put("lastManagerUndo",undo);
            }
            case "UNDO_RESPONSE" -> undoResponse(turn);
            case "SELECT_PLAY_PASS" -> {
                turn.require("PLAY_PASS");
                if (!identity.manager(game,viewer) && !turn.text("playPassWinnerSide").equals(game.participantSide(participant)))
                    throw new DraftHttpException(HttpStatus.FORBIDDEN,"Only the face-off winning team can choose play or pass.");
                String choice=String.valueOf(payload.get("choice")).toUpperCase();
                if (!Set.of("PLAY","PASS").contains(choice)) throw new IllegalArgumentException("Choose PLAY or PASS.");
                String active=choice.equals("PLAY")?turn.text("playPassWinnerSide"):FeudTurn.other(turn.text("playPassWinnerSide"));
                turn.phase("ROUND_PLAY");turn.put("activeSide",active);turn.put("turnIndex",0);turn.put("activeMemberId",rounds.nextPlayer(game,active,-1));turn.put("pendingResponseId",null);turn.answerTimer();
                roundStatus(round,"ROUND_PLAY",game.team(active).get("id").asInt());
            }
            case "REVEAL_ANSWER" -> {
                int answer=id(payload.get("answerId"));if (game.answers().stream().noneMatch(a -> a.get("id").asInt()==answer)) throw new IllegalArgumentException("Select a valid survey answer.");turn.reveal(answer);
            }
            case "ADD_STRIKE","REMOVE_STRIKE" -> {
                turn.require("ROUND_PLAY","STEAL");
                var undo=command.equals("ADD_STRIKE")?strikeUndo(turn):null;
                int strikes=Math.max(0,Math.min(3,round.get("strikes").asInt()+(command.equals("ADD_STRIKE")?1:-1)));
                jdbc.update("UPDATE public.\"FeudRound\" SET strikes=? WHERE id=?",strikes,round.get("id").asInt());
                if (command.equals("ADD_STRIKE")) turn.event("INCORRECT","INCORRECT");
                if (strikes>=3 && turn.phase.equals("ROUND_PLAY")) rounds.steal(turn);
                if (undo!=null) turn.put("lastStrikeUndo",undo);
            }
            case "UNDO_STRIKE" -> undoStrike(turn);
            case "ADJUST_BANK" -> {
                if (round==null) throw new IllegalArgumentException("There is no active round.");
                jdbc.update("UPDATE public.\"FeudRound\" SET \"roundBank\"=? WHERE id=?",score(payload.get("value")),round.get("id").asInt());
            }
            case "ADJUST_SCORE" -> {
                JsonNode team=game.team(side(payload.get("side")));
                jdbc.update("UPDATE public.\"FeudTeam\" SET score=?,\"updatedAt\"=now() WHERE id=?",score(payload.get("value")),team.get("id").asInt());
            }
            case "START_STEAL" -> { turn.require("ROUND_PLAY");rounds.steal(turn); }
            case "RESOLVE_STEAL" -> { turn.require("STEAL");rounds.resolve(turn,Boolean.TRUE.equals(payload.get("correct")),optionalId(payload.get("answerId"))); }
            case "END_ROUND" -> {
                turn.require("ROUND_PLAY","STEAL","ROUND_RESULTS");
                String winner=payload.get("winnerSide")==null?turn.text("roundWinnerSide"):side(payload.get("winnerSide"));
                if (winner==null) winner=turn.text("activeSide");
                rounds.finishRound(turn,winner,turn.phase.equals("ROUND_RESULTS")?0:round.get("roundBank").asInt());
            }
            case "NEXT_ROUND" -> {
                turn.require("ROUND_RESULTS");
                if (turn.number("currentRound")>=turn.state.path("config").path("roundCount").asInt(4)) throw new IllegalArgumentException("All rounds are complete. Finish the game.");
                rounds.start(turn);
            }
            case "START_FAST_MONEY" -> {
                turn.require("ROUND_RESULTS");var selected=new ArrayList<Integer>();
                if (payload.get("memberIds") instanceof List<?> source) for (Object value:source) selected.add(id(value));
                rounds.startFastMoney(turn,selected);
            }
            case "END_GAME" -> {
                JsonNode winner=game.teams().stream().max(Comparator.comparingInt(t -> t.get("score").asInt())).orElseThrow();
                turn.phase("FINISHED");turn.put("activeMemberId",null);turn.put("activeSide",null);turn.deadline=null;turn.finishedAt=Instant.now();turn.winnerTeamId=winner.get("id").asInt();
            }
            case "PAUSE" -> {
                if (Set.of("LOBBY","FINISHED","PAUSED").contains(turn.phase)) throw new DraftHttpException(HttpStatus.CONFLICT,"This match cannot be paused right now.");
                turn.put("previousPhase",turn.phase);turn.put("pausedRemainingMs",turn.deadline==null?null:Math.max(0,turn.deadline.toEpochMilli()-System.currentTimeMillis()));turn.phase("PAUSED");turn.deadline=null;
            }
            case "RESUME" -> {
                turn.require("PAUSED");String previous=turn.text("previousPhase");turn.phase(previous==null?"ROUND_INTRO":previous);
                JsonNode remaining=turn.state.path("pausedRemainingMs");turn.deadline=remaining.isNull()?null:Instant.now().plusMillis(remaining.asLong());turn.put("previousPhase",null);turn.put("pausedRemainingMs",null);
            }
            default -> throw new IllegalArgumentException("Unknown Family Feud action.");
        }
        save(turn);FeudSnapshot updated=games.get(game.id(),false);
        return projection.view(updated,identity.manager(updated,viewer)?"manager":"player",viewer);
    }
    private void save(FeudTurn turn) {
        turn.put("phase",turn.phase);
        int changed=jdbc.update("""
                UPDATE public."FamilyFeudGame" SET state=?::jsonb,status=?::"FeudGameStatus",phase=?,round=?,
                "timerEndsAt"=?,"startedAt"=?,"finishedAt"=?,"winningTeamId"=?,version=version+1,"updatedAt"=now()
                WHERE id=? AND version=?
                """,json.stringify(turn.state),turn.phase,turn.phase,turn.number("currentRound")==0?null:turn.number("currentRound"),
                utc(turn.deadline),utc(turn.startedAt),utc(turn.finishedAt),turn.winnerTeamId,turn.game.id(),turn.game.version());
        if (changed!=1) throw new DraftHttpException(HttpStatus.CONFLICT,"The match changed in another session. Please retry your action.");
        events.publishAfterCommit(turn.game.code(),turn.game.version()+1);
    }
    private void movePlayer(FeudTurn turn,Map<String,Object> payload) {
        turn.require("LOBBY");JsonNode target=turn.game.participant(id(payload.get("memberId")));requirePlayer(target);
        String side=side(payload.get("side"));JsonNode team=turn.game.team(side);
        if (!Integer.valueOf(team.get("id").asInt()).equals(number(target,"teamId"))
                && rounds.players(turn.game,side).size()>=turn.state.path("config").path("maxPlayersPerTeam").asInt(5)) throw new DraftHttpException(HttpStatus.CONFLICT,"Team is full.");
        replaceCaptain(turn.game,target);
        jdbc.update("UPDATE public.\"FeudParticipant\" SET \"teamId\"=?,ready=false WHERE id=?",team.get("id").asInt(),target.get("id").asInt());
    }
    private void removePlayer(FeudTurn turn,Map<String,Object> payload) {
        turn.require("LOBBY");JsonNode target=turn.game.participant(id(payload.get("memberId")));
        if (target==null || "MANAGER".equals(text(target,"role"))) throw new IllegalArgumentException("Select a removable participant.");
        replaceCaptain(turn.game,target);jdbc.update("DELETE FROM public.\"FeudParticipant\" WHERE id=?",target.get("id").asInt());
        String discord=text(target.get("member"),"discordUserId");
        if (discord!=null && discord.startsWith("FEUD_GUEST:")) jdbc.update("DELETE FROM public.\"NetworkMember\" WHERE id=?",target.get("memberId").asInt());
    }
    private void replaceCaptain(FeudSnapshot game,JsonNode target) {
        String side=game.participantSide(target);if (side==null) return;
        JsonNode team=game.team(side);int member=target.get("memberId").asInt();
        if (!Integer.valueOf(member).equals(number(team,"captainMemberId"))) return;
        Integer replacement=rounds.players(game,side).stream().filter(p -> p.get("memberId").asInt()!=member).map(p -> p.get("memberId").asInt()).findFirst().orElse(null);
        jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=? WHERE id=?",replacement,team.get("id").asInt());
    }
    private void submit(FeudTurn turn,JsonNode participant,Map<String,Object> payload,boolean suggestion) {
        if (suggestion) turn.require("STEAL");
        else if (!ANSWERING.contains(turn.phase)) throw new DraftHttpException(HttpStatus.CONFLICT,"Answers are closed right now.");
        requirePlayer(participant);
        if (suggestion) {
            if (!turn.text("activeSide").equals(turn.game.participantSide(participant))) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Only the stealing team can discuss answers.");
        } else {
            if (!Integer.valueOf(participant.get("memberId").asInt()).equals(turn.nullableNumber("activeMemberId"))) throw new DraftHttpException(HttpStatus.CONFLICT,"It is not your turn.");
            if (turn.nullableNumber("pendingResponseId")!=null) throw new DraftHttpException(HttpStatus.CONFLICT,"Your previous answer is awaiting the manager.");
            if (turn.deadline!=null && turn.deadline.isBefore(Instant.now())) throw new DraftHttpException(HttpStatus.CONFLICT,"The answer timer has expired.");
        }
        String answer=payload.get("text") instanceof String value?value.trim().replaceAll("\\s+"," "):"";
        if (answer.isBlank()) throw new IllegalArgumentException("Enter an answer before submitting.");
        if (answer.length()>120) answer=answer.substring(0,120);
        String type=suggestion?"STEAL_SUGGESTION":turn.phase.startsWith("FACE_OFF")?"FACE_OFF":turn.phase.equals("STEAL")?"STEAL_FINAL":turn.phase.equals("FAST_MONEY")?"FAST_MONEY":"ROUND";
        int id=jdbc.queryForObject("INSERT INTO public.\"FeudResponse\" (\"roundId\",\"participantId\",\"memberId\",text,\"responseType\") VALUES (?,?,?,?,?::\"FeudResponseType\") RETURNING id",
                Integer.class,turn.game.round().get("id").asInt(),participant.get("id").asInt(),participant.get("memberId").asInt(),answer,type);
        if (!suggestion) {turn.put("pendingResponseId",id);turn.deadline=null;}
    }
    private void faceOff(JsonNode round,int alpha,int beta,Integer first) {
        if (round==null) throw new IllegalArgumentException("There is no active round.");
        jdbc.update("""
                INSERT INTO public."FeudFaceOff" ("roundId","teamARepresentativeId","teamBRepresentativeId","externalWinnerMemberId") VALUES (?,?,?,?)
                ON CONFLICT ("roundId") DO UPDATE SET "teamARepresentativeId"=EXCLUDED."teamARepresentativeId",
                "teamBRepresentativeId"=EXCLUDED."teamBRepresentativeId","externalWinnerMemberId"=EXCLUDED."externalWinnerMemberId",
                "familyWinnerTeamId"=NULL,"resolvedAt"=NULL
                """,round.get("id").asInt(),alpha,beta,first);
    }
    private void roundStatus(JsonNode round,String status,Integer activeTeam) {
        jdbc.update("UPDATE public.\"FeudRound\" SET status=?::\"FeudRoundStatus\",\"activeTeamId\"=? WHERE id=?",status,activeTeam,round.get("id").asInt());
    }
    private Map<String,Object> responseUndo(FeudTurn turn) {
        JsonNode round=turn.game.round(),face=turn.game.faceOff();
        return row("kind","RESPONSE","expectedVersion",turn.game.version()+1,"state",json.parse(turn.state.toString()),"status",turn.phase,
                "timerEndsAt",turn.deadline==null?null:turn.deadline.toString(),"responseId",turn.nullableNumber("pendingResponseId"),
                "round",round,"teams",turn.game.teams(),"faceOff",face);
    }
    private Map<String,Object> strikeUndo(FeudTurn turn) {
        return row("kind","STRIKE","expectedVersion",turn.game.version()+1,"state",json.parse(turn.state.toString()),"status",turn.phase,
                "timerEndsAt",turn.deadline==null?null:turn.deadline.toString(),"round",turn.game.round());
    }
    private JsonNode undo(FeudTurn turn,String key,String kind) {
        JsonNode undo=turn.state.path(key);
        if (!kind.equals(text(undo,"kind")) || undo.path("expectedVersion").asInt()!=turn.game.version())
            throw new DraftHttpException(HttpStatus.CONFLICT,"That action can no longer be undone because the game has moved on.");
        return undo;
    }
    private void undoResponse(FeudTurn turn) {
        JsonNode undo=undo(turn,"lastManagerUndo","RESPONSE"),round=undo.path("round");
        jdbc.update("UPDATE public.\"FeudResponse\" SET \"matchedAnswerId\"=NULL,correct=NULL,points=0,\"resolvedAt\"=NULL WHERE id=?",undo.path("responseId").asInt());
        jdbc.update("UPDATE public.\"FeudRound\" SET status=?::\"FeudRoundStatus\",\"activeTeamId\"=?,\"roundBank\"=?,strikes=?,\"finishedAt\"=? WHERE id=?",
                text(round,"status"),number(round,"activeTeamId"),round.path("roundBank").asInt(),round.path("strikes").asInt(),utc(FeudTurn.instant(round,"finishedAt")),turn.game.round().get("id").asInt());
        for (JsonNode team:undo.path("teams")) jdbc.update("UPDATE public.\"FeudTeam\" SET score=? WHERE id=?",team.path("score").asInt(),team.path("id").asInt());
        JsonNode face=undo.path("faceOff");
        if (!face.isNull() && turn.game.faceOff()!=null) jdbc.update("UPDATE public.\"FeudFaceOff\" SET \"familyWinnerTeamId\"=?,\"resolvedAt\"=? WHERE \"roundId\"=?",
                number(face,"familyWinnerTeamId"),utc(FeudTurn.instant(face,"resolvedAt")),turn.game.round().get("id").asInt());
        restore(turn,undo,"lastManagerUndo","ANSWER RESTORED");
    }
    private void undoStrike(FeudTurn turn) {
        JsonNode undo=undo(turn,"lastStrikeUndo","STRIKE"),round=undo.path("round");
        jdbc.update("UPDATE public.\"FeudRound\" SET status=?::\"FeudRoundStatus\",\"activeTeamId\"=?,strikes=? WHERE id=?",
                text(round,"status"),number(round,"activeTeamId"),round.path("strikes").asInt(),turn.game.round().get("id").asInt());
        restore(turn,undo,"lastStrikeUndo","STRIKE RESTORED");
    }
    private void restore(FeudTurn turn,JsonNode undo,String key,String label) {
        turn.state=(ObjectNode)json.parse(undo.get("state").toString());turn.phase=text(undo,"status");turn.deadline=FeudTurn.instant(undo,"timerEndsAt");
        turn.put(key,null);turn.event("RECOVERED",label);
    }
    private static void requirePlayer(JsonNode participant) {
        if (participant==null || !"PLAYER".equals(text(participant,"role"))) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Only an active player can perform this action.");
    }
    private void requireTeamPlayer(FeudSnapshot game,int member,String side) {
        JsonNode player=game.participant(member);requirePlayer(player);
        if (!side.equals(game.participantSide(player)) || !FeudProjection.active(player)) throw new IllegalArgumentException("Choose one active representative from each team.");
    }
    private static int id(Object raw) {
        if (!(raw instanceof Number n) || n.doubleValue()!=Math.rint(n.doubleValue()) || n.longValue()<1 || n.longValue()>Integer.MAX_VALUE)
            throw new IllegalArgumentException("Member id must be a positive integer.");return n.intValue();
    }
    private static Integer optionalId(Object raw) { return raw==null?null:id(raw); }
    private static String side(Object raw) {
        String value=String.valueOf(raw).toUpperCase();if (!Set.of("ALPHA","BETA").contains(value)) throw new IllegalArgumentException("Select a valid team.");return value;
    }
    private static int score(Object raw) {
        if (!(raw instanceof Number n) || n.doubleValue()!=Math.rint(n.doubleValue()) || n.longValue()<0 || n.longValue()>Integer.MAX_VALUE)
            throw new IllegalArgumentException("Score must be a nonnegative integer.");return n.intValue();
    }
    private static LocalDateTime utc(Instant value) { return value==null?null:LocalDateTime.ofInstant(value,ZoneOffset.UTC); }
}
