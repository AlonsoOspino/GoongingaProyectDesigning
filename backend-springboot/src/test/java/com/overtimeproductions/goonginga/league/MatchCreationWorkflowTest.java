package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.data.LoadedDraft;
import com.overtimeproductions.goonginga.draft.preparation.DraftProvisioningService;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class MatchCreationWorkflowTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final Query query=new Query();
    private String seasonState="SCHEDULED";
    private boolean divisionAllowed=true;
    private int provisioned;
    private final TournamentRepository tournaments=new TournamentRepository(null,null,null) {
        @Override public void lock(int id) {}
        @Override public JsonNode get(int id) { return mapper.readTree("{\"id\":9,\"state\":\""+seasonState+"\"}"); }
        @Override public void update(int id,String name,java.time.Instant date,String state) { seasonState=state; }
    };
    private MatchAdminService service() {
        var json=new JsonSql(null,mapper) {
            @Override public Optional<JsonNode> first(String sql,Object... arguments) { return Optional.of(mapper.readTree("{\"id\":99,\"semanas\":2,\"divisionId\":10}")); }
        };
        var divisions=new DivisionService(null,null,tournaments) {
            @Override public void validateMatch(int season,String type,int a,int b) {
                if (!divisionAllowed) throw new IllegalArgumentException("Teams are in different divisions.");
            }
        };
        var drafts=new DraftProvisioningService(null,null,null,null,null) {
            @Override public Optional<LoadedDraft> ensure(int matchId) { provisioned++;return Optional.empty(); }
        };
        return new MatchAdminService(query,json,null,tournaments,null,drafts,divisions);
    }
    private Map<String,Object> input() {
        return new HashMap<>(Map.of("tournamentId",9,"teamAId",1,"teamBId",2,"type","ROUNDROBIN","semanas",2,"bestOf",5,"startDate","2026-10-18T02:00:00Z"));
    }

    @Test
    void creatingWeeklyMatchPersistsScheduleAndProvisionsTheDraftImmediately() {
        var match=service().create(input());
        assertEquals(99,match.path("id").asInt());
        assertEquals(1,provisioned);
        assertEquals(2,query.inserted[5]);
        assertEquals("SCHEDULED",query.inserted[7]);
        assertEquals("2026-10-18T02:00",query.inserted[8]);
        assertEquals(List.of(101,102),query.connectedMaps);
        assertEquals("ROUNDROBIN",seasonState);
    }

    @Test
    void unknownOrEmptyExplicitMapPoolsFailBeforeCreatingDraft() {
        var unknown=input();unknown.put("allowedMaps",Map.of("connect",List.of(Map.of("id",999))));
        assertThrows(IllegalArgumentException.class,() -> service().create(unknown));
        var empty=input();empty.put("allowedMaps",Map.of("connect",List.of()));
        assertThrows(IllegalArgumentException.class,() -> service().create(empty));
        assertNull(query.inserted);
        assertEquals(0,provisioned);
        assertEquals("SCHEDULED",seasonState);
    }

    @Test
    void divisionAndWeeklyConflictsFailBeforeCreatingMatchOrDraft() {
        divisionAllowed=false;
        assertThrows(IllegalArgumentException.class,() -> service().create(input()));
        divisionAllowed=true;query.conflicts=1;
        assertThrows(IllegalArgumentException.class,() -> service().create(input()));
        assertNull(query.inserted);
        assertEquals(0,provisioned);
    }

    @Test
    void unfinishedOrInvalidSeriesCannotBypassDraftResultFlow() {
        for (String status:new String[]{"ACTIVE","FINISHED"}) {
            var input=input();input.put("status",status);
            assertThrows(IllegalArgumentException.class,() -> service().create(input));
        }
        var even=input();even.put("bestOf",4);
        assertThrows(IllegalArgumentException.class,() -> service().create(even));
        seasonState="FINISHED";
        assertThrows(IllegalArgumentException.class,() -> service().create(input()));
        assertNull(query.inserted);
        assertEquals(0,provisioned);
    }

    private static class Query extends JdbcTemplate {
        Object[] inserted;
        int conflicts;
        List<Integer> connectedMaps=new ArrayList<>();
        @Override @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql,Class<T> type,Object... arguments) {
            if (sql.startsWith("INSERT")) { inserted=arguments;return (T)Integer.valueOf(99); }
            if (sql.contains("FROM public.\"Team\"")) return (T)Integer.valueOf(2);
            return (T)Integer.valueOf(conflicts);
        }
        @Override @SuppressWarnings("unchecked")
        public <T> List<T> queryForList(String sql,Class<T> type) { return (List<T>)List.of(101,102); }
        @Override public int update(String sql,Object... arguments) { connectedMaps.add((Integer)arguments[0]);return 1; }
    }
}
