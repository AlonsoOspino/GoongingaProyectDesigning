package com.overtimeproductions.goonginga.draft.access;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import java.util.Set;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class DraftProductionAccessTest {
    private final DraftAccess access = new DraftAccess(new JdbcTemplate() {
        @Override public <T> List<T> queryForList(String sql, Class<T> type, Object... arguments) { return List.of(); }
    },"broadcast-key");
    private final MatchInfo match = new MatchInfo(8,"ROUNDROBIN","SCHEDULED",5,null,1,11,12,0,0,0,0,0,
            null,null,null,null,null,null,null,false,null,null,null,null,null);

    @Test
    void casterCanRunProductionAndShareButCannotManageOrActForTeams() {
        var caster = new DraftActor(2,Set.of("CASTER"));
        assertDoesNotThrow(() -> access.requireProduction(caster,match));
        assertEquals("broadcast-key",access.share(caster,match));
        assertThrows(DraftHttpException.class,() -> access.requireManager(caster,match));
        assertThrows(DraftHttpException.class,() -> access.actingTeam(caster,match,11L));
    }

    @Test
    void captainRoleAloneDoesNotGrantProductionControls() {
        assertThrows(DraftHttpException.class,() -> access.requireProduction(new DraftActor(3,Set.of("CAPTAIN")),match));
    }

    @Test
    void developerProductionControlsRemainLimitedToPractice() {
        assertThrows(DraftHttpException.class,() -> access.requireProduction(new DraftActor(4,Set.of("DEVELOPER")),match));
        var practice = new MatchInfo(8,"PRACTICE","SCHEDULED",5,null,1,11,12,0,0,0,0,0,
                null,null,null,null,null,null,null,false,null,null,null,null,null);
        assertDoesNotThrow(() -> access.requireProduction(new DraftActor(4,Set.of("DEVELOPER")),practice));
    }
}
