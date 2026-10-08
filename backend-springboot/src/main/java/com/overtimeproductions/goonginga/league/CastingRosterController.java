package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Match-scoped player identities used to reconcile an Overwatch log with its teams. */
@RestController
@Transactional(readOnly=true)
public class CastingRosterController {
    private final MatchRepository matches;
    private final DraftAccess access;
    private final JdbcTemplate jdbc;

    public CastingRosterController(MatchRepository matches, DraftAccess access, JdbcTemplate jdbc) {
        this.matches=matches; this.access=access; this.jdbc=jdbc;
    }

    @GetMapping("/match/{matchId}/casting-roster")
    public List<PlayerIdentity> roster(@PathVariable String matchId, @AuthenticationPrincipal Jwt token) {
        var match = matches.get(matches.resolve(matchId));
        access.requireProduction(access.actor(token), match);
        return jdbc.query("""
                SELECT DISTINCT n.username, p."teamId"
                FROM public."SeasonPlayer" p JOIN public."NetworkMember" n ON n.id=p."memberId"
                WHERE p."tournamentId"=? AND p."teamId" IN (?,?) AND n.status='ACTIVE'
                  AND n.username IS NOT NULL AND btrim(n.username)<>''
                ORDER BY p."teamId", n.username
                """, (row, index) -> new PlayerIdentity(row.getString("username"), row.getInt("teamId")),
                match.tournamentId(), match.teamAId(), match.teamBId());
    }

    public record PlayerIdentity(String username, int teamId) {}
}
