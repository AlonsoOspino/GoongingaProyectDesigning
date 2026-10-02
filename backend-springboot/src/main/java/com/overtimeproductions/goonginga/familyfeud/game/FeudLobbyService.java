package com.overtimeproductions.goonginga.familyfeud.game;

import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.row;
import static com.overtimeproductions.goonginga.familyfeud.game.FeudProjection.text;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.familyfeud.questions.FeudQuestionService;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Service
public class FeudLobbyService {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final FeudGameRepository games;
    private final FeudQuestionService questions;
    private final FeudProjection projection;
    private final FeudIdentity identity;
    private final FeudEvents events;
    private final FeudGuestTokens tokens;
    private final TransactionTemplate transactions;
    private final SecureRandom random=new SecureRandom();
    public FeudLobbyService(JdbcTemplate jdbc,JsonSql json,FeudGameRepository games,FeudQuestionService questions,
            FeudProjection projection,FeudIdentity identity,FeudEvents events,FeudGuestTokens tokens,PlatformTransactionManager transactionManager) {
        this.jdbc=jdbc;this.json=json;this.games=games;this.questions=questions;this.projection=projection;
        this.identity=identity;this.events=events;this.tokens=tokens;
        this.transactions=new TransactionTemplate(transactionManager);
    }
    private static String clean(Object raw,int max) {
        if (!(raw instanceof String value)) return "";
        String cleaned=value.trim().replaceAll("\\s+"," ");return cleaned.substring(0,Math.min(max,cleaned.length()));
    }
    private static int config(Object raw,int fallback,int min,int max) {
        int value=raw instanceof Number number?number.intValue():fallback;
        return Math.max(min,Math.min(max,value==0?fallback:value));
    }
    private static Map<String,Object> defaultState(Map<String,Object> input) {
        var cfg=row("maxPlayersPerTeam",config(input.get("maxPlayersPerTeam"),5,1,8),
                "answerSeconds",config(input.get("answerSeconds"),20,5,90),
                "roundCount",config(input.get("roundCount"),4,1,8),
                "fastMoneyTarget",config(input.get("fastMoneyTarget"),200,50,500),
                "category",clean(input.get("category"),48).isBlank()?null:clean(input.get("category"),48),
                "pack",clean(input.get("pack"),80).isBlank()?null:clean(input.get("pack"),80));
        return row("schemaVersion",2,"phase","LOBBY","previousPhase",null,"teamsLocked",false,
                "currentRound",0,"usedQuestionIds",List.of(),"revealedAnswerIds",List.of(),
                "pendingExternalWinnerMemberId",null,"pendingResponseId",null,"activeMemberId",null,
                "activeSide",null,"playPassWinnerSide",null,"roundWinnerSide",null,"turnIndex",0,
                "faceOffResults",List.of(),"pausedRemainingMs",null,"fastMoney",null,"lastEvent",null,"config",cfg);
    }
    private String code() {
        for (int attempt=0;attempt<30;attempt++) {
            String value="FF-"+(1000+random.nextInt(9000));
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"FamilyFeudGame\" WHERE code=? OR \"roomId\"=?)",Boolean.class,value,value))) return value;
        }
        throw new IllegalStateException("A unique game code could not be generated.");
    }
    private String token() {
        byte[] bytes=new byte[12];random.nextBytes(bytes);return java.util.HexFormat.of().withUpperCase().formatHex(bytes);
    }
    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String,Object> create(Map<String,Object> input,FeudIdentity.Viewer viewer) {
        starterQuestions(viewer.id());
        String code=code(),title=clean(input.get("title"),80);
        if (title.isBlank()) title="Family Feud";
        Map<String,Object> config=input.get("config") instanceof Map<?,?> source?(Map<String,Object>)source:Map.of();
        int id=jdbc.queryForObject("""
                INSERT INTO public."FamilyFeudGame"
                (code,"roomId","alphaInviteToken","betaInviteToken",title,status,phase,state,"managerMemberId","updatedAt")
                VALUES (?,?,?,?,?,'LOBBY'::"FeudGameStatus",'LOBBY',?::jsonb,?,now()) RETURNING id
                """,Integer.class,code,code,token(),token(),title,json.stringify(defaultState(config)),viewer.id());
        jdbc.update("INSERT INTO public.\"FeudParticipant\" (\"gameId\",\"memberId\",role,ready) VALUES (?,?,'MANAGER'::\"FeudParticipantRole\",true)",id,viewer.id());
        String alpha=clean(input.get("teamAlphaName"),48),beta=clean(input.get("teamBetaName"),48);
        jdbc.update("INSERT INTO public.\"FeudTeam\" (\"gameId\",side,name,color,\"updatedAt\") VALUES (?,'ALPHA'::\"FeudTeamSide\",?,'#28C7FA',now())",id,alpha.isBlank()?"Team Nova":alpha);
        jdbc.update("INSERT INTO public.\"FeudTeam\" (\"gameId\",side,name,color,\"updatedAt\") VALUES (?,'BETA'::\"FeudTeamSide\",?,'#FF4D8D',now())",id,beta.isBlank()?"Team Pulse":beta);
        FeudSnapshot game=games.get(id,false);
        return projection.view(game,"manager",viewer);
    }
    private void starterQuestions(int memberId) {
        Integer count=jdbc.queryForObject("SELECT count(*) FROM public.\"FeudQuestion\"",Integer.class);
        if (count!=null && count>0) return;
        seed(memberId,"Name something players do while waiting in a game queue.","GAMING",new String[]{"Watch videos","Check their phone","Talk in voice chat","Get a snack","Practice"},new int[]{32,26,18,14,10});
        seed(memberId,"Name something that can ruin a team game night.","GAMING",new String[]{"Bad connection","A teammate leaves","Arguments","A late player","Server problems"},new int[]{34,25,18,13,10});
        seed(memberId,"Name something people do when they cannot sleep.","GENERAL",new String[]{"Check their phone","Watch television","Read","Listen to music","Get a drink"},new int[]{36,24,17,13,10});
        seed(memberId,"Name something people forget when leaving home.","GENERAL",new String[]{"Keys","Phone","Wallet","Headphones","Lunch"},new int[]{38,27,18,10,7});
        seed(memberId,"Name something a competitive player blames after a loss.","COMMUNITY",new String[]{"Teammates","Lag","Matchmaking","Balance","Their equipment"},new int[]{31,25,19,15,10});
        seed(memberId,"Name something you hear during an intense match.","COMMUNITY",new String[]{"Callouts","Complaints","Celebrating","Keyboard sounds","Silence"},new int[]{35,24,18,13,10});
    }
    private void seed(int memberId,String question,String category,String[] names,int[] points) {
        var answers=new ArrayList<Map<String,Object>>();
        for (int i=0;i<names.length;i++) answers.add(Map.of("answer",names[i],"points",points[i],"aliases",List.of()));
        questions.create(Map.of("question",question,"category",category,"pack","Family Feud Starter","answers",answers),memberId);
    }
    public List<Map<String,Object>> list() { return games.ids().stream().map(id -> projection.summary(games.get(id,false))).toList(); }
    public Map<String,Object> get(String code,String view,FeudIdentity.Viewer viewer) { return projection.view(games.get(code),view,viewer); }

    @Transactional
    public Map<String,Object> developmentMode(String code,boolean enabled) {
        FeudSnapshot game=games.lock(code);
        jdbc.update("UPDATE public.\"FamilyFeudGame\" SET \"developmentMode\"=?,version=version+1,\"updatedAt\"=now() WHERE id=?",enabled,game.id());
        if (!enabled) for (JsonNode participant:game.participants()) if (text(participant.get("member"),"discordUserId").startsWith("FEUD_GUEST:"))
            removeGuest(game,participant.get("memberId").asInt());
        FeudSnapshot updated=games.get(game.id(),false);events.publishAfterCommit(updated.code(),updated.version());
        return projection.summary(updated);
    }
    @Transactional
    public Map<String,Object> join(String code,Map<String,Object> input,FeudIdentity.Viewer viewer) {
        FeudSnapshot game=games.lock(code);
        if (!game.phase().equals("LOBBY") || game.state().path("teamsLocked").asBoolean()) throw new DraftHttpException(HttpStatus.CONFLICT,"Teams are locked for this match.");
        if (Integer.valueOf(viewer.id()).equals(FeudProjection.number(game.game(),"managerMemberId"))) throw new DraftHttpException(HttpStatus.CONFLICT,"The manager cannot occupy a captain seat.");
        String invite=clean(input.get("inviteToken"),80).toUpperCase();
        String role=invite.isBlank() && "SPECTATOR".equals(String.valueOf(input.get("role")).toUpperCase())?"SPECTATOR":"PLAYER";
        String side="BETA".equals(String.valueOf(input.get("side")).toUpperCase())?"BETA":"ALPHA";
        if (!invite.isBlank()) {
            if (invite.equals(text(game.game(),"alphaInviteToken"))) side="ALPHA";
            else if (invite.equals(text(game.game(),"betaInviteToken"))) side="BETA";
            else throw new DraftHttpException(HttpStatus.FORBIDDEN,"This captain invitation is invalid.");
        }
        JsonNode team=role.equals("PLAYER")?game.team(side):null;
        JsonNode existing=game.participant(viewer.id());
        JsonNode other=game.team(side.equals("ALPHA")?"BETA":"ALPHA");
        if (!invite.isBlank() && Integer.valueOf(viewer.id()).equals(FeudProjection.number(other,"captainMemberId")))
            throw new DraftHttpException(HttpStatus.CONFLICT,"You are already the captain of the other team.");
        if (team!=null) {
            int teamId=team.get("id").asInt();
            if (!invite.isBlank() && FeudProjection.number(team,"captainMemberId")!=null
                    && FeudProjection.number(team,"captainMemberId")!=viewer.id()) throw new DraftHttpException(HttpStatus.CONFLICT,"Team already has a captain.");
            if (existing==null || !Integer.valueOf(teamId).equals(FeudProjection.number(existing,"teamId")))
                if (playerCount(game,side)>=game.state().path("config").path("maxPlayersPerTeam").asInt(5))
                    throw new DraftHttpException(HttpStatus.CONFLICT,"Team is full.");
        }
        if(existing!=null && !java.util.Objects.equals(FeudProjection.number(existing,"teamId"),team==null?null:team.path("id").asInt())) {
            for(JsonNode oldTeam:game.teams())if(Integer.valueOf(viewer.id()).equals(FeudProjection.number(oldTeam,"captainMemberId"))) {
                Integer replacement=game.participants().stream().filter(p->p.path("memberId").asInt()!=viewer.id()&&"PLAYER".equals(text(p,"role"))&&java.util.Objects.equals(FeudProjection.number(p,"teamId"),oldTeam.path("id").asInt())&&FeudProjection.active(p))
                        .map(p->p.path("memberId").asInt()).findFirst().orElse(null);
                jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=?,\"updatedAt\"=now() WHERE id=?",replacement,oldTeam.path("id").asInt());
            }
        }
        jdbc.update("""
                INSERT INTO public."FeudParticipant" ("gameId","teamId","memberId",role,ready)
                VALUES (?,?,?,?::"FeudParticipantRole",?)
                ON CONFLICT ("gameId","memberId") DO UPDATE SET "teamId"=EXCLUDED."teamId",role=EXCLUDED.role,
                  ready=EXCLUDED.ready,"lastSeenAt"=now()
                """,game.id(),team==null?null:team.get("id").asInt(),viewer.id(),role,!invite.isBlank());
        if (!invite.isBlank()) jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=?,\"updatedAt\"=now() WHERE id=?",viewer.id(),team.get("id").asInt());
        FeudSnapshot updated=bump(game);
        return projection.view(updated,"lobby",viewer);
    }
    private static long playerCount(FeudSnapshot game,String side) {
        return game.participants().stream().filter(p -> "PLAYER".equals(text(p,"role")) && side.equals(game.participantSide(p)) && FeudProjection.active(p)).count();
    }
    @Transactional
    public Map<String,Object> joinGuest(String code,Map<String,Object> input) {
        String name=clean(input.get("name"),32);
        if (name.length()<2) throw new IllegalArgumentException("Enter a test player name with at least two characters.");
        String side="BETA".equals(String.valueOf(input.get("side")).toUpperCase())?"BETA":"ALPHA";
        FeudSnapshot game=games.lock(code);
        if (!game.game().path("developmentMode").asBoolean()) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Development mode is not enabled for this game.");
        if (!game.phase().equals("LOBBY") || game.state().path("teamsLocked").asBoolean()) throw new DraftHttpException(HttpStatus.CONFLICT,"This test lobby is already locked.");
        JsonNode team=game.team(side);
        if (playerCount(game,side)>=game.state().path("config").path("maxPlayersPerTeam").asInt(5)) throw new DraftHttpException(HttpStatus.CONFLICT,"Team is full.");
        int memberId=jdbc.queryForObject("""
                INSERT INTO public."NetworkMember" ("discordUserId",username,nickname,"updatedAt")
                VALUES (?,?,?,now()) RETURNING id
                """,Integer.class,"FEUD_GUEST:"+game.id()+":"+UUID.randomUUID(),name,name);
        jdbc.update("INSERT INTO public.\"FeudParticipant\" (\"gameId\",\"teamId\",\"memberId\",role,ready) VALUES (?,?,?,'PLAYER'::\"FeudParticipantRole\",true)",
                game.id(),team.get("id").asInt(),memberId);
        if (team.path("captainMemberId").isNull()) jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=? WHERE id=?",memberId,team.get("id").asInt());
        FeudSnapshot updated=bump(game);
        String token=tokens.issue(memberId,updated.code(),name);
        return row("token",token,"game",projection.view(updated,"lobby",new FeudIdentity.Viewer(memberId,"FEUD_GUEST",java.util.Set.of("MEMBER"))));
    }
    @Transactional
    public void heartbeat(String code,FeudIdentity.Viewer viewer) {
        FeudSnapshot game=games.get(code);
        jdbc.update("UPDATE public.\"FeudParticipant\" SET \"lastSeenAt\"=now() WHERE \"gameId\"=? AND \"memberId\"=?",game.id(),viewer.id());
    }
    @Transactional
    public void leaveGuest(String code,FeudIdentity.Viewer viewer) {
        if (!viewer.guest()) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Only a test player can leave this development session.");
        FeudSnapshot game=games.get(code);
        int id=viewer.id();
        jdbc.update("UPDATE public.\"FeudParticipant\" SET \"lastSeenAt\"='epoch'::timestamp WHERE \"gameId\"=? AND \"memberId\"=?",game.id(),id);
        CompletableFuture.delayedExecutor(5,TimeUnit.SECONDS).execute(() -> {
            try { transactions.executeWithoutResult(status -> removeGuestIfStillGone(code,id)); } catch (RuntimeException ignored) { }
        });
    }
    @Transactional
    public void removeGuestIfStillGone(String code,int memberId) {
        FeudSnapshot game=games.lock(code);
        JsonNode participant=game.participant(memberId);
        if (participant==null || !text(participant.get("member"),"discordUserId").startsWith("FEUD_GUEST:")) return;
        String seen=text(participant,"lastSeenAt");
        if (seen!=null && Instant.parse(seen).isAfter(Instant.now().minusSeconds(5))) return;
        removeGuest(game,memberId);bump(game);
    }
    private void removeGuest(FeudSnapshot game,int memberId) {
        JsonNode participant=game.participant(memberId);
        if (participant==null) return;
        Integer teamId=FeudProjection.number(participant,"teamId");
        Integer replacement=teamId==null?null:jdbc.queryForList("""
                SELECT p."memberId" FROM public."FeudParticipant" p JOIN public."NetworkMember" n ON n.id=p."memberId"
                WHERE p."gameId"=? AND p."teamId"=? AND p."memberId"<>? AND p.role='PLAYER'
                AND (n."discordUserId" NOT LIKE 'FEUD_GUEST:%' OR p."lastSeenAt">timezone('UTC',now())-interval '120 seconds')
                ORDER BY p."joinedAt",p.id LIMIT 1
                """,Integer.class,game.id(),teamId,memberId).stream().findFirst().orElse(null);
        JsonNode currentState=json.first("SELECT state::text FROM public.\"FamilyFeudGame\" WHERE id=?",game.id()).orElse(game.state());
        if (Integer.valueOf(memberId).equals(FeudProjection.number(currentState,"activeMemberId"))) {
            var state=(tools.jackson.databind.node.ObjectNode)json.parse(currentState.toString());
            state.set("activeMemberId",json.parse(json.stringify(replacement)));
            jdbc.update("UPDATE public.\"FamilyFeudGame\" SET state=?::jsonb WHERE id=?",json.stringify(state),game.id());
        }
        jdbc.update("DELETE FROM public.\"FeudParticipant\" WHERE id=?",participant.get("id").asInt());
        JsonNode team=game.teams().stream().filter(t -> Integer.valueOf(memberId).equals(FeudProjection.number(t,"captainMemberId"))).findFirst().orElse(null);
        if (team!=null) jdbc.update("UPDATE public.\"FeudTeam\" SET \"captainMemberId\"=? WHERE id=?",replacement,team.get("id").asInt());
        boolean retained=Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"FeudFaceOff\" WHERE \"teamARepresentativeId\"=? OR \"teamBRepresentativeId\"=?)",Boolean.class,memberId,memberId));
        if (!retained) jdbc.update("DELETE FROM public.\"NetworkMember\" WHERE id=? AND \"discordUserId\" LIKE 'FEUD_GUEST:%'",memberId);
    }
    @Transactional
    public void delete(String code,FeudIdentity.Viewer viewer) {
        FeudSnapshot game=games.lock(code);identity.requireManager(game,viewer);
        jdbc.update("DELETE FROM public.\"FamilyFeudGame\" WHERE id=?",game.id());
        jdbc.update("DELETE FROM public.\"NetworkMember\" WHERE \"discordUserId\" LIKE ?", "FEUD_GUEST:"+game.id()+":%");
        events.publishAfterCommit(game.code(),game.version()+1);
    }
    private FeudSnapshot bump(FeudSnapshot game) {
        jdbc.update("UPDATE public.\"FamilyFeudGame\" SET version=version+1,\"updatedAt\"=now() WHERE id=?",game.id());
        FeudSnapshot updated=games.get(game.id(),false);events.publishAfterCommit(updated.code(),updated.version());return updated;
    }
}
