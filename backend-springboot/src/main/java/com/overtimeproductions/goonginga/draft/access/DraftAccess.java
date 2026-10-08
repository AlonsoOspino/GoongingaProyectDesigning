package com.overtimeproductions.goonginga.draft.access;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/** Roles and captain membership are read from PostgreSQL on each request. */
@Component
public class DraftAccess {
    private final JdbcTemplate jdbc;
    private final String shareKey;

    public DraftAccess(JdbcTemplate jdbc, @Value("${draft.share-key:}") String shareKey) {
        this.jdbc = jdbc;
        this.shareKey = shareKey;
    }

    public DraftActor actor(Jwt token) {
        if (token == null || !"NETWORK_MEMBER".equals(token.getClaimAsString("accountType"))) throw unauthorized();
        Object claim = token.getClaim("id");
        if (!(claim instanceof Number id) || id.longValue() < 1 || id.longValue() > Integer.MAX_VALUE) throw unauthorized();
        return jdbc.query("SELECT roles::text[] AS roles FROM public.\"NetworkMember\" WHERE id=? AND status='ACTIVE'", (r, n) -> {
            String[] roles = (String[]) r.getArray("roles").getArray();
            return new DraftActor(id.intValue(), Set.copyOf(Arrays.asList(roles)));
        }, id.intValue()).stream().findFirst().orElseThrow(() -> unauthorized());
    }

    public void requireManager(DraftActor actor, MatchInfo match) {
        if (actor.isManager() || (actor.isDeveloper() && "PRACTICE".equals(match.type()))) return;
        throw forbidden("Only a manager can perform this action.");
    }

    public void requireProduction(DraftActor actor, MatchInfo match) {
        if (actor.isProduction() || (actor.isDeveloper() && "PRACTICE".equals(match.type()))) return;
        throw forbidden("Only production staff can perform this action.");
    }

    public int captainTeam(DraftActor actor, MatchInfo match) {
        return jdbc.queryForList("""
                SELECT "teamId" FROM public."SeasonPlayer"
                WHERE "memberId"=? AND "tournamentId"=? AND role='CAPTAIN' AND "teamId" IN (?,?)
                """, Integer.class, actor.memberId(), match.tournamentId(), match.teamAId(), match.teamBId())
                .stream().findFirst().orElseThrow(() -> forbidden("You must be a captain of this match."));
    }

    public long actingTeam(DraftActor actor, MatchInfo match, Long requested) {
        if (actor.isManager() || (actor.isDeveloper() && "PRACTICE".equals(match.type()))) {
            if (requested == null || !match.hasTeam(requested)) throw forbidden("Choose a team belonging to this match.");
            return requested;
        }
        long ownTeam = captainTeam(actor, match);
        if (requested != null && requested != ownTeam) throw forbidden("A captain can only act for their own team.");
        return ownTeam;
    }

    public void requireRead(Jwt token, String key, MatchInfo match) {
        if (validKey(key)) return;
        var actor = actor(token);
        if (actor.isProduction() || (actor.isDeveloper() && "PRACTICE".equals(match.type()))) return;
        captainTeam(actor, match);
    }

    public String share(DraftActor actor, MatchInfo match) {
        if (!actor.isProduction() && !(actor.isDeveloper() && "PRACTICE".equals(match.type()))) captainTeam(actor, match);
        if (shareKey.isBlank()) throw new DraftHttpException(HttpStatus.SERVICE_UNAVAILABLE, "Draft sharing is not configured.");
        return shareKey;
    }

    public boolean validKey(String value) {
        return value != null && !shareKey.isBlank() && MessageDigest.isEqual(value.getBytes(StandardCharsets.UTF_8), shareKey.getBytes(StandardCharsets.UTF_8));
    }
    private static DraftHttpException unauthorized() { return new DraftHttpException(HttpStatus.UNAUTHORIZED, "An active network session is required."); }
    private static DraftHttpException forbidden(String message) { return new DraftHttpException(HttpStatus.FORBIDDEN, message); }
}
