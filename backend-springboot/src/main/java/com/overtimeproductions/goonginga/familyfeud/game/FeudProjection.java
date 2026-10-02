package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Limits each view to the information available in the existing Family Feud UI. */
@Component
public class FeudProjection {
    private final FeudIdentity identity;
    public FeudProjection(FeudIdentity identity) { this.identity=identity; }
    public static Map<String,Object> row(Object... pairs) {
        var result=new LinkedHashMap<String,Object>();
        for (int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    public static String text(JsonNode row,String key) { JsonNode value=row==null?null:row.get(key);return value==null || value.isNull()?null:value.asText(); }
    public static Integer number(JsonNode row,String key) { JsonNode value=row==null?null:row.get(key);return value==null || value.isNull()?null:value.asInt(); }
    private static boolean truth(JsonNode row,String key) { return row!=null && row.path(key).asBoolean(false); }
    public static String name(JsonNode member) {
        String nickname=text(member,"nickname");if (nickname!=null && !nickname.isBlank()) return nickname;
        String username=text(member,"username");return username==null?"Player":username;
    }
    public static String image(JsonNode member) { String profile=text(member,"profilePic");return profile!=null?profile:text(member,"avatarUrl"); }
    private static boolean guest(JsonNode participant) { String discord=text(participant==null?null:participant.get("member"),"discordUserId");return discord!=null && discord.startsWith("FEUD_GUEST:"); }
    private static long seen(JsonNode participant) {
        String value=text(participant,"lastSeenAt");
        if (value==null) return 0;
        try { return Instant.parse(value).toEpochMilli(); } catch (RuntimeException ignored) { return 0; }
    }
    public static boolean active(JsonNode participant) { return !guest(participant) || System.currentTimeMillis()-seen(participant)<120000; }
    private static boolean connected(JsonNode participant) { return System.currentTimeMillis()-seen(participant)<45000; }
    private static List<Integer> ids(JsonNode values) {
        var result=new ArrayList<Integer>();if (values!=null && values.isArray()) values.forEach(v -> result.add(v.asInt()));return result;
    }
    private static String normalize(String value) {
        return Normalizer.normalize(value==null?"":value.toLowerCase(),Normalizer.Form.NFD)
                .replaceAll("\\p{M}","").replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+"," ").trim();
    }
    private static Map<String,Object> publicPlayer(JsonNode participant) {
        return row("name",name(participant.get("member")),"avatarUrl",image(participant.get("member")),
                "ready",truth(participant,"ready"),"connected",connected(participant),"isGuest",guest(participant));
    }
    private JsonNode participant(FeudSnapshot game,Integer id) { return id==null?null:game.participant(id); }
    private static Map<String,Object> miniPlayer(JsonNode participant) {
        return participant==null?null:row("name",name(participant.get("member")),"avatarUrl",image(participant.get("member")));
    }

    public Map<String,Object> summary(FeudSnapshot game) {
        List<JsonNode> players=game.participants().stream().filter(p -> "PLAYER".equals(text(p,"role")) && active(p)).toList();
        return row("id",game.id(),"code",game.code(),"title",text(game.game(),"title"),"phase",game.phase(),
                "developmentMode",truth(game.game(),"developmentMode"),
                "manager",row("name",name(game.manager()),"avatarUrl",image(game.manager())),
                "teams",game.teams().stream().map(t -> row("side",text(t,"side"),"name",text(t,"name"),"score",number(t,"score"))).toList(),
                "playerCount",players.size(),"guestCount",players.stream().filter(FeudProjection::guest).count(),
                "createdAt",text(game.game(),"createdAt"),"updatedAt",text(game.game(),"updatedAt"));
    }

    public Map<String,Object> view(FeudSnapshot game,String requested,FeudIdentity.Viewer viewer) {
        String view=requested==null?"spectator":requested;
        boolean manager="manager".equals(view) && identity.manager(game,viewer);
        boolean player="player".equals(view) || "lobby".equals(view);
        if ("manager".equals(view) && !manager)
            throw new DraftHttpException(viewer==null?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN,"Only the assigned match manager can open this control room.");
        if (player && viewer==null) throw new DraftHttpException(HttpStatus.UNAUTHORIZED,"Sign in to open this view.");
        JsonNode me=viewer==null?null:game.participant(viewer.id());
        if (player && me==null && !game.phase().equals("LOBBY"))
            throw new DraftHttpException(HttpStatus.FORBIDDEN,"Join this match before opening the player view.");
        JsonNode state=game.state(),round=game.round(),faceOff=game.faceOff();
        var revealed=new HashSet<>(ids(state.path("revealedAnswerIds")));
        boolean showQuestion=manager || !Set.of("LOBBY","ROUND_INTRO","AWAITING_EXTERNAL_FACE_OFF").contains(game.phase());
        JsonNode fast=game.phase().equals("FAST_MONEY")?state.path("fastMoney"):null;
        JsonNode fastQuestion=fast!=null && fast.path("questions").isArray() && fast.path("questionIndex").asInt()<fast.path("questions").size()
                ?fast.path("questions").get(fast.path("questionIndex").asInt()):null;
        var board=new ArrayList<Map<String,Object>>();
        if (fastQuestion!=null && fastQuestion.path("answers").isArray()) {
            for (JsonNode answer:fastQuestion.path("answers")) board.add(boardAnswer(answer,false,manager));
        } else for (JsonNode answer:game.answers()) board.add(boardAnswer(answer,revealed.contains(answer.get("id").asInt()),manager));
        String side=game.participantSide(me);
        JsonNode current=participant(game,number(state,"activeMemberId"));
        JsonNode alpha=participant(game,number(faceOff,"teamARepresentativeId"));
        JsonNode beta=participant(game,number(faceOff,"teamBRepresentativeId"));
        JsonNode winner=participant(game,number(faceOff,"externalWinnerMemberId"));
        var teams=new ArrayList<Map<String,Object>>();
        for (JsonNode team:game.teams()) {
            int id=team.get("id").asInt();
            List<JsonNode> members=game.participants().stream().filter(p -> "PLAYER".equals(text(p,"role"))
                    && Integer.valueOf(id).equals(number(p,"teamId")) && active(p)).toList();
            JsonNode captain=participant(game,number(team,"captainMemberId"));
            var projected=row("side",text(team,"side"),"name",text(team,"name"),"color",text(team,"color"),
                    "score",number(team,"score"),"captainName",captain==null?null:name(captain.get("member")),
                    "players",members.stream().map(FeudProjection::publicPlayer).toList());
            if (manager) {
                projected.put("id",id);projected.put("captainMemberId",number(team,"captainMemberId"));
                projected.put("managerPlayers",members.stream().map(p -> {
                    var item=row("memberId",number(p,"memberId"));item.putAll(publicPlayer(p));return item;
                }).toList());
            }
            teams.add(projected);
        }
        Map<String,Object> roundView=null;
        if (round!=null) {
            Map<String,Object> face=null;
            if (faceOff!=null) {
                JsonNode pendingWinner=manager?participant(game,number(state,"pendingExternalWinnerMemberId")):null;
                face=row("alpha",miniPlayer(alpha),"beta",miniPlayer(beta),"externalWinner",
                        winner==null?null:row("name",name(winner.get("member")),"side",game.participantSide(winner)),
                        "familyWinnerSide",text(state,"playPassWinnerSide"));
                if (manager) face.put("pendingWinnerName",pendingWinner==null?null:name(pendingWinner.get("member")));
            }
            roundView=row("number",number(round,"roundNumber"),"multiplier",number(round,"multiplier"),
                    "question",showQuestion?(fastQuestion==null?text(game.question(),"question"):text(fastQuestion,"question")):null,
                    "category",showQuestion?(fastQuestion==null?text(game.question(),"category"):"FAST MONEY"):null,
                    "bank",number(round,"roundBank"),"strikes",number(round,"strikes"),
                    "activeSide",text(state,"activeSide"),"currentPlayer",current==null?null:publicPlayer(current),
                    "answerPending",number(state,"pendingResponseId")!=null,"board",board,"faceOff",face,
                    "roundWinnerSide",text(state,"roundWinnerSide"));
        }
        Map<String,Object> meView=null;
        if (me!=null) {
            JsonNode own=side==null?null:game.team(side);
            meView=row("role",text(me,"role"),"side",side,"ready",truth(me,"ready"),
                    "isCaptain",own!=null && Integer.valueOf(viewer.id()).equals(number(own,"captainMemberId")),
                    "isCurrentPlayer",Integer.valueOf(viewer.id()).equals(number(state,"activeMemberId")),"isGuest",guest(me));
        }
        var gameView=row("code",game.code(),"title",text(game.game(),"title"),"phase",game.phase(),
                "pausedPhase",game.phase().equals("PAUSED")?text(state,"previousPhase"):null,
                "currentRound",state.path("currentRound").asInt(0),"version",game.version(),
                "developmentMode",truth(game.game(),"developmentMode"),"lastEvent",state.path("lastEvent").isNull()?null:state.get("lastEvent"),
                "timerEndsAt",text(game.game(),"timerEndsAt"),"manager",row("name",name(game.manager()),"avatarUrl",image(game.manager())),
                "config",state.path("config"),"teamsLocked",truth(state,"teamsLocked"),
                "canJoin",game.phase().equals("LOBBY") && !truth(state,"teamsLocked"));
        var result=row("serverNow",Instant.now().toString(),"game",gameView,"teams",teams,"round",roundView,"me",meView);
        if (fast!=null && !fast.isNull()) {
            var viewFast=row("questionIndex",fast.path("questionIndex").asInt(),"questionCount",fast.path("questions").size(),
                    "activePlayerIndex",fast.path("activePlayerIndex").asInt(),"total",fast.path("total").asInt(),
                    "target",state.path("config").path("fastMoneyTarget").asInt(200),"complete",truth(fast,"complete"));
            if (manager || truth(fast,"complete")) viewFast.put("responses",fast.path("responses"));
            result.put("fastMoney",viewFast);
        }
        if (manager) result.put("manager",managerView(game,state,revealed));
        else if (player && side!=null) {
            String ownSide=side;
            var suggestions=game.phase().equals("STEAL") && ownSide.equals(text(state,"activeSide"))
                    ?game.responses().stream().filter(r -> "STEAL_SUGGESTION".equals(text(r,"responseType")) && r.path("resolvedAt").isNull())
                    .map(r -> row("text",text(r,"text"),"playerName",name(r.get("member")))).toList():List.of();
            result.put("teamPrivate",row("suggestions",suggestions));
        }
        return result;
    }

    private static Map<String,Object> boardAnswer(JsonNode answer,boolean revealed,boolean manager) {
        var result=row("rank",number(answer,"rank"),"revealed",revealed);
        if (manager || revealed) { result.put("answer",text(answer,"answer"));result.put("points",number(answer,"points")); }
        if (manager) { result.put("id",number(answer,"id"));result.put("aliases",answer.path("aliases")); }
        return result;
    }
    private Map<String,Object> managerView(FeudSnapshot game,JsonNode state,Set<Integer> revealed) {
        Integer pendingId=number(state,"pendingResponseId");
        JsonNode pending=pendingId==null?null:game.responses().stream().filter(r -> r.get("id").asInt()==pendingId).findFirst().orElse(null);
        Map<String,Object> pendingView=null;
        if (pending!=null) {
            String guess=normalize(text(pending,"text"));
            var suggested=game.answers().stream().filter(a -> {
                var candidates=new ArrayList<String>();candidates.add(text(a,"answer"));
                if (a.path("aliases").isArray()) a.path("aliases").forEach(v -> candidates.add(v.asText()));
                return !guess.isBlank() && candidates.stream().map(FeudProjection::normalize).anyMatch(v -> !v.isBlank() && (v.equals(guess) || v.contains(guess) || guess.contains(v) || similarity(v,guess)>=.72));
            }).map(a -> a.get("id").asInt()).toList();
            pendingView=row("id",pendingId,"text",text(pending,"text"),"playerName",name(pending.get("member")),"suggestedAnswerIds",suggested);
        }
        return row("captainInvites",row("alpha",text(game.game(),"alphaInviteToken"),"beta",text(game.game(),"betaInviteToken")),
                "participants",game.participants().stream().filter(FeudProjection::active).map(p -> row(
                        "memberId",number(p,"memberId"),"name",name(p.get("member")),"avatarUrl",image(p.get("member")),
                        "role",text(p,"role"),"teamSide",game.participantSide(p),"ready",truth(p,"ready"),
                        "connected",connected(p),"isGuest",guest(p))).toList(),
                "pendingResponse",pendingView,"canUndoResponse","RESPONSE".equals(text(state.path("lastManagerUndo"),"kind")),
                "canUndoStrike","STRIKE".equals(text(state.path("lastStrikeUndo"),"kind")),
                "rawState",row("pendingExternalWinnerMemberId",number(state,"pendingExternalWinnerMemberId"),
                        "activeMemberId",number(state,"activeMemberId"),"playPassWinnerSide",text(state,"playPassWinnerSide"),
                        "revealedAnswerIds",List.copyOf(revealed)));
    }

    private static double similarity(String a,String b) {
        int[] previous=new int[b.length()+1];for(int j=0;j<=b.length();j++)previous[j]=j;
        for(int i=1;i<=a.length();i++) {
            int[] next=new int[b.length()+1];next[0]=i;
            for(int j=1;j<=b.length();j++)next[j]=Math.min(Math.min(next[j-1]+1,previous[j]+1),previous[j-1]+(a.charAt(i-1)==b.charAt(j-1)?0:1));
            previous=next;
        }
        return 1.0-(double)previous[b.length()]/Math.max(a.length(),b.length());
    }
}
