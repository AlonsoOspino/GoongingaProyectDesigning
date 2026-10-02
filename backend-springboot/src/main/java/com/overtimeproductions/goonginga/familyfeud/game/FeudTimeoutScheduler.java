package com.overtimeproductions.goonginga.familyfeud.game;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="feud.timeouts-enabled",havingValue="true",matchIfMissing=true)
public class FeudTimeoutScheduler {
    private static final Logger log=LoggerFactory.getLogger(FeudTimeoutScheduler.class);
    private final JdbcTemplate jdbc;
    private final FeudActionService actions;
    private final FeudLobbyService lobby;
    public FeudTimeoutScheduler(JdbcTemplate jdbc,FeudActionService actions,FeudLobbyService lobby) { this.jdbc=jdbc;this.actions=actions;this.lobby=lobby; }
    @Scheduled(fixedDelay=1000)
    public void expire() {
        for (String code:jdbc.queryForList("SELECT COALESCE(code,\"roomId\") FROM public.\"FamilyFeudGame\" WHERE \"timerEndsAt\"<=timezone('UTC',now()) AND status<>'PAUSED' ORDER BY \"timerEndsAt\" LIMIT 100",String.class)) {
            try { actions.reconcile(code); } catch (RuntimeException failure) { log.error("Could not resolve Family Feud timer for {}",code,failure); }
        }
    }
    @Scheduled(fixedDelay=30000)
    public void cleanGuests() {
        jdbc.query("""
                SELECT COALESCE(g.code,g."roomId") AS code,p."memberId" FROM public."FeudParticipant" p
                JOIN public."FamilyFeudGame" g ON g.id=p."gameId" JOIN public."NetworkMember" n ON n.id=p."memberId"
                WHERE n."discordUserId" LIKE 'FEUD_GUEST:%' AND p."lastSeenAt"<timezone('UTC',now())-interval '120 seconds'
                """,rs -> {
            try { lobby.removeGuestIfStillGone(rs.getString("code"),rs.getInt("memberId")); }
            catch (RuntimeException failure) { log.warn("Could not remove expired Family Feud guest",failure); }
        });
    }
}
