package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.data.LoadedDraft;
import com.overtimeproductions.goonginga.draft.preparation.DraftProvisioningService;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class DivisionScheduleServiceTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final Query query=new Query();
    private final Season season=new Season();
    private int provisioned;

    @Test
    void generationPersistsOnlyDivisionPairingsAndStartsScheduledSeasonAfterSuccess() {
        var result=service().generateRoundRobin(9,"CONFIRM ROUND ROBIN");
        assertTrue(season.locked);
        assertEquals(12,result.size());
        assertEquals(12,provisioned);
        assertEquals("ROUNDROBIN",season.state);
        for (Object[] match:query.inserted) {
            int a=((Number)match[1]).intValue(),b=((Number)match[2]).intValue();
            assertEquals(a<=4,b<=4);
            assertTrue(((Number)match[5]).intValue()<=3);
        }
    }

    @Test
    void incompleteAssignmentsFailBeforeWritingMatchesOrAdvancingSeason() {
        var participants=new ArrayList<>(query.participants);
        participants.set(0,new RoundRobinPlanner.Participant(1,null));
        query.participants=participants;
        assertThrows(IllegalArgumentException.class,() -> service().generateRoundRobin(9,"CONFIRM ROUND ROBIN"));
        assertEquals("SCHEDULED",season.state);
        assertTrue(query.inserted.isEmpty());
        assertEquals(0,provisioned);
    }

    private MatchAdminService service() {
        var json=new JsonSql(null,mapper) {
            @Override public Optional<JsonNode> first(String sql,Object... args) { return Optional.of(mapper.readTree("{\"id\":"+args[0]+"}")); }
        };
        var divisions=new DivisionService(query,json,season) {
            @Override public List<Integer> ids(int id) { return List.of(10,20); }
        };
        var drafts=new DraftProvisioningService(null,null,null,null,null) {
            @Override public Optional<LoadedDraft> ensure(int id) { provisioned++;return Optional.empty(); }
        };
        return new MatchAdminService(query,json,null,season,null,drafts,divisions);
    }
    private class Season extends TournamentRepository {
        String state="SCHEDULED";boolean locked;
        Season() { super(null,null,null); }
        @Override public void lock(int id) { locked=true; }
        @Override public JsonNode get(int id) { return mapper.readTree("{\"id\":9,\"state\":\""+state+"\"}"); }
        @Override public void update(int id,String name,java.time.Instant date,String state) { this.state=state; }
    }
    private static class Query extends JdbcTemplate {
        List<RoundRobinPlanner.Participant> participants=IntStream.rangeClosed(1,8).mapToObj(id -> new RoundRobinPlanner.Participant(id,id<=4?10:20)).toList();
        List<Object[]> inserted=new ArrayList<>();
        @Override @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql,Class<T> type,Object... arguments) {
            if (type==Boolean.class) return (T)Boolean.FALSE;
            inserted.add(arguments);
            return (T)Integer.valueOf(inserted.size());
        }
        @Override @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql,Class<T> type) { return (List<T>)List.of(101,102); }
        @Override @SuppressWarnings("unchecked")
        public <T> List<T> query(String sql,RowMapper<T> mapper,Object... arguments) { return (List<T>)participants; }
        @Override public int update(String sql,Object... arguments) { return 1; }
    }
}
