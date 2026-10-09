package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DivisionServiceTest {
    @Test
    void manualRegularSeasonMatchRejectsCrossDivisionAndUnassignedTeams() {
        var query=new DivisionQuery();
        var divisions=new DivisionService(query,null,null);
        divisions.validateMatch(9,"ROUNDROBIN",1,2);
        query.assignments=List.of(10,20);
        assertThrows(IllegalArgumentException.class,() -> divisions.validateMatch(9,"ROUNDROBIN",1,2));
        query.assignments=Arrays.asList(10,null);
        assertThrows(IllegalArgumentException.class,() -> divisions.validateMatch(9,"ROUNDROBIN",1,2));
    }

    @Test
    void playoffsCanCrossDivisionsAndLegacySeasonsKeepSinglePoolRules() {
        var query=new DivisionQuery();query.assignments=List.of(10,20);
        var divisions=new DivisionService(query,null,null);
        divisions.validateMatch(9,"PLAYOFFS",1,2);
        assertEquals(0,query.assignmentReads);
        query.ids=List.of();
        divisions.validateMatch(8,"ROUNDROBIN",1,2);
        assertEquals(0,query.assignmentReads);
    }

    @Test
    void bulkAssignmentsRejectDuplicateTeamsAndOtherSeasonIdsBeforeWriting() {
        var valid=List.of(new DivisionService.DivisionInput(10,"Division A",List.of(1,2)),new DivisionService.DivisionInput(20,"Division B",List.of(3,4)));
        assertDoesNotThrow(() -> DivisionService.validateInputs(valid,Set.of(10,20),Set.of(1,2,3,4)));
        var duplicate=List.of(valid.getFirst(),new DivisionService.DivisionInput(20,"Division B",List.of(2,3)));
        assertThrows(IllegalArgumentException.class,() -> DivisionService.validateInputs(duplicate,Set.of(10,20),Set.of(1,2,3,4)));
        assertThrows(IllegalArgumentException.class,() -> DivisionService.validateInputs(valid,Set.of(10,30),Set.of(1,2,3,4)));
        assertThrows(IllegalArgumentException.class,() -> DivisionService.validateInputs(valid,Set.of(10,20),Set.of(1,2,3,5)));
    }

    private static class DivisionQuery extends JdbcTemplate {
        List<Integer> assignments=List.of(10,10);
        List<Integer> ids=List.of(10,20);
        int assignmentReads;
        @Override @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql,Class<T> type,Object... arguments) { return (List<T>)ids; }
        @Override @SuppressWarnings("unchecked")
        public <T> List<T> query(String sql,RowMapper<T> mapper,Object... arguments) { assignmentReads++;return (List<T>)assignments; }
    }
}
