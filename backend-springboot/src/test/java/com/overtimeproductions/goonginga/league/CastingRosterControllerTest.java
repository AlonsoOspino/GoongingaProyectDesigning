package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.*;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.oauth2.jwt.Jwt;

class CastingRosterControllerTest {
    private final MatchInfo match = new MatchInfo(8,"ROUNDROBIN","SCHEDULED",5,null,9,11,12,0,0,0,0,0,
            null,null,null,null,null,null,null,false,null,null,null,null,null);
    private final MatchRepository matches = new MatchRepository(null,null) {
        @Override public int resolve(String reference) { return 8; }
        @Override public MatchInfo get(int id) { return match; }
    };
    private final Query query = new Query();

    @Test
    void casterReadIsBoundToMatchSeasonAndItsTwoTeams() {
        assertTrue(controller("CASTER").roster("8",null).isEmpty());
        assertArrayEquals(new Object[]{9,11,12},query.arguments);
    }

    @Test
    void captainWithoutProductionRoleIsRejectedBeforeRosterQuery() {
        assertThrows(DraftHttpException.class,() -> controller("CAPTAIN").roster("8",null));
        assertNull(query.arguments);
    }

    private CastingRosterController controller(String role) {
        var access = new DraftAccess(new JdbcTemplate(),"") {
            @Override public DraftActor actor(Jwt token) { return new DraftActor(2,Set.of(role)); }
        };
        return new CastingRosterController(matches,access,query);
    }
    private static class Query extends JdbcTemplate {
        private Object[] arguments;
        @Override public <T> List<T> query(String sql, RowMapper<T> mapper, Object... arguments) {
            this.arguments=arguments;
            return List.of();
        }
    }
}
