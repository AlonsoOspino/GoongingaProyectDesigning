package com.overtimeproductions.goonginga.draft.data;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class HistoricalSeriesSummaryTest {
    private final Instant now=Instant.parse("2026-10-08T12:00:00Z");
    private final List<DraftMapEntity> picks=new ArrayList<>();
    private DraftSessionEntity session;
    private MatchInfo match;
    private DraftStore store;

    @BeforeEach
    void setUp() throws Exception {
        match=match("FINISHED",4,2,0,null);
        session=new DraftSessionEntity(DraftState.newDraft(43,11,12,7,11).toBuilder()
                .phase(DraftPhase.FINISHED).turnTeamId(null).build(),now);
        field(session,"id",1L);
        field(session,"summaryOnlyResult",true);
        var sessions=proxy(DraftSessionRepository.class,(method,args) -> switch(method) {
            case "findByMatchId","findById" -> Optional.of(session);
            case "flush" -> null;
            default -> throw new UnsupportedOperationException(method);
        });
        var maps=proxy(DraftMapRepository.class,(method,args) -> switch(method) {
            case "findByDraftSessionIdOrderByMapNumber" -> List.copyOf(picks);
            case "deleteByDraftSessionId" -> { picks.clear();yield null; }
            default -> throw new UnsupportedOperationException(method);
        });
        var bans=proxy(DraftBanRepository.class,(method,args) -> List.of());
        var matches=new MatchRepository(null,null) {
            @Override public MatchInfo get(int id) { return match; }
        };
        var catalog=new DraftCatalog(null) {
            @Override public List<com.overtimeproductions.goonginga.draft.context.HeroInfo> heroes() { return List.of(); }
        };
        store=new DraftStore(sessions,maps,bans,matches,catalog);
    }

    @Test
    void explicitlyRecordedFinalScoreLoadsWithoutInventingMapResults() {
        var loaded=store.byMatch(43);
        assertEquals(4,loaded.state().winsA());
        assertEquals(2,loaded.state().winsB());
        assertEquals(DraftPhase.FINISHED,loaded.state().phase());
        assertEquals(7,loaded.state().bestOf());
        assertTrue(loaded.maps().isEmpty());
        assertTrue(loaded.state().results().isEmpty());
        assertTrue(loaded.state().usedMapIds().isEmpty());
        assertNull(loaded.state().currentMapId());
        match=match("FINISHED",2,4,0,null);
        assertEquals(4,store.byMatch(43).state().winsB());
    }

    @Test
    void unmarkedFinalScoresStillRequireMatchingRecordedMaps() throws Exception {
        field(session,"summaryOnlyResult",false);
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
    }

    @Test
    void summaryFlagRejectsUnfinishedSeriesAndContradictoryHistory() throws Exception {
        match=match("SCHEDULED",4,2,0,null);
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
        match=match("FINISHED",4,2,6,null);
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
        match=match("FINISHED",4,2,0,new ObjectMapper().readTree("[{\"gameNumber\":1}]"));
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
        match=match("FINISHED",4,2,0,null);
        field(session,"phase",DraftPhase.PREPARATION);
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
    }

    @Test
    void summaryMustHaveExactlyOneValidSeriesWinner() {
        for (int[] score:List.of(new int[]{3,2},new int[]{4,4},new int[]{5,2},new int[]{4,-1},new int[]{-1,4},new int[]{0,0})) {
            match=match("FINISHED",score[0],score[1],0,null);
            assertThrows(DraftHttpException.class,() -> store.byMatch(43));
        }
    }

    @Test
    void summaryFlagNeverBypassesActualMapHistory() {
        picks.add(new DraftMapEntity(1,1,101,MapType.CONTROL,11,now));
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
    }

    @Test
    void ordinaryDraftStillLoadsRecordedMapsAndRejectsCorruptedTotals() throws Exception {
        field(session,"summaryOnlyResult",false);
        field(session,"phase",DraftPhase.PREPARATION);
        field(session,"mapNumber",2);
        var map=new DraftMapEntity(1,1,101,MapType.CONTROL,11,now);
        map.recordResult(11,now);picks.add(map);
        match=match("ACTIVE",1,0,1,null);
        var loaded=store.byMatch(43);
        assertEquals(1,loaded.state().winsA());
        assertEquals(1,loaded.state().results().size());
        match=match("ACTIVE",2,0,1,null);
        assertThrows(DraftHttpException.class,() -> store.byMatch(43));
    }

    @Test
    void resetClearsTheMarkerAndRestoresAnOrdinaryFreshDraft() {
        var loaded=store.byMatch(43);
        match=match("SCHEDULED",0,0,0,null);
        var initial=DraftState.newDraft(43,11,12,7,11);
        var reset=store.reset(loaded,initial,now);
        assertFalse(session.isSummaryOnlyResult());
        assertEquals(0,reset.state().winsA());
        assertEquals(0,reset.state().winsB());
        assertEquals(DraftPhase.PREPARATION,reset.state().phase());
    }

    @Test
    void phaseWritesAndUndoCannotReuseAnAuditedSummaryAsAPlayedDraft() {
        var loaded=store.byMatch(43);
        assertThrows(DraftHttpException.class,() -> store.save(loaded,loaded.state(),now));
        assertThrows(DraftHttpException.class,() -> store.undo(loaded,loaded.state(),now));
        assertTrue(session.isSummaryOnlyResult());
        assertTrue(picks.isEmpty());
    }

    private MatchInfo match(String status,int a,int b,int games,JsonNode results) {
        return new MatchInfo(43,"FINALS",status,7,null,1,11,12,0,0,a,b,games,null,"Grand Final",3,1,
                null,results,null,false,null,null,null,null,null);
    }
    private static void field(Object target,String name,Object value) throws Exception {
        var field=target.getClass().getDeclaredField(name);field.setAccessible(true);field.set(target,value);
    }
    private interface Handler { Object invoke(String method,Object[] args); }
    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type,Handler handler) {
        return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(object,method,args) -> handler.invoke(method.getName(),args));
    }
}
