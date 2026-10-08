package com.overtimeproductions.goonginga.draft.preparation;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.random.RandomGenerator;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class DraftProvisioningServiceTest {
    private final List<String> operations = new ArrayList<>();
    private final Store store = new Store();
    private final Matches matches = new Matches();
    private final Catalog catalog = new Catalog();
    private final Picker pickers = new Picker();
    private final Instant now = Instant.parse("2026-10-08T12:00:00Z");
    private final DraftProvisioningService provisioning = new DraftProvisioningService(
            store, matches, catalog, pickers, Clock.fixed(now, ZoneOffset.UTC));

    @Test
    void freshMatchGetsPreparationBeforeCaptainReadiness() {
        var created = provisioning.ensure(8).orElseThrow();
        assertEquals(DraftPhase.PREPARATION, created.state().phase());
        assertEquals(11L, created.state().turnTeamId());
        assertEquals(1, created.state().mapNumber());
        assertEquals(now, store.createdAt);
        assertEquals(List.of("lock","exists","create"), operations);
    }

    @Test
    void repeatedProvisioningPreservesExistingDraftAndPicker() {
        var existing = provisioning.require(8);
        matches.row = match("ACTIVE",2);
        assertSame(existing, provisioning.require(8));
        assertSame(existing, provisioning.require(8));
        assertEquals(1, store.creations);
        assertEquals(1, pickers.calls);
    }

    @Test
    void playedAndLegacyMatchesRequireMigrationInsteadOfReplacement() {
        matches.row = match("ACTIVE",0);
        assertTrue(provisioning.ensure(8).isEmpty());
        matches.row = match("SCHEDULED",1);
        assertTrue(provisioning.ensure(8).isEmpty());
        matches.row = match("SCHEDULED",0);
        matches.legacyProgress = true;
        assertThrows(DraftRuleViolation.class, () -> provisioning.require(8));
        assertEquals(0, store.creations);
        assertEquals(0, pickers.calls);
    }

    @Test
    void nonemptyResultHistoryIsNeverDiscardedEvenWithZeroCounters() {
        matches.row = new MatchInfo(8,"ROUNDROBIN","SCHEDULED",5,null,1,11,12,0,0,0,0,0,
                null,null,null,null,null,new ObjectMapper().readTree("[{\"gameNumber\":1,\"isDraw\":true}]"),
                null,false,null,null,null,null,null);
        assertTrue(provisioning.ensure(8).isEmpty());
        assertEquals(0, store.creations);
    }

    @Test
    void unstartedDraftCanChangeSeriesFormatWithoutLosingItsPicker() {
        var before = provisioning.require(8);
        assertSame(before, provisioning.freshForEdit(8));
        matches.row = new MatchInfo(8,"ROUNDROBIN","SCHEDULED",7,null,1,11,12,0,0,0,0,0,
                null,null,null,null,null,null,null,false,null,null,null,null,null);
        provisioning.reconfigure(before,false);
        assertEquals(7,store.draft.state().bestOf());
        assertEquals(11L,store.draft.state().turnTeamId());
        assertEquals(1,pickers.calls);
    }

    @Test
    void progressedDraftCannotBeReconfiguredByScheduleEditing() {
        var before = provisioning.require(8);
        store.draft = new LoadedDraft(null,before.match(),List.of(),List.of(),before.state().toBuilder().phase(DraftPhase.MAP_SELECTION).build());
        assertThrows(com.overtimeproductions.goonginga.draft.api.DraftHttpException.class, () -> provisioning.freshForEdit(8));
    }

    private class Store extends DraftStore {
        private LoadedDraft draft;
        private int creations;
        private Instant createdAt;
        Store() { super(null,null,null,null,null); }
        @Override public boolean exists(int id) { operations.add("exists"); return draft != null; }
        @Override public LoadedDraft byMatch(int id) { return draft; }
        @Override public LoadedDraft lockByMatch(int id) { return draft; }
        @Override public LoadedDraft save(LoadedDraft before,DraftState next,Instant at) {
            return draft = new LoadedDraft(before.session(),matches.row,List.of(),List.of(),next);
        }
        @Override public LoadedDraft create(MatchInfo match, DraftState state, Instant at) {
            operations.add("create"); creations++; createdAt = at;
            return draft = new LoadedDraft(null,match,List.of(),List.of(),state);
        }
    }
    private class Matches extends MatchRepository {
        private MatchInfo row = match("SCHEDULED",0);
        private boolean legacyProgress;
        Matches() { super(null,null); }
        @Override public MatchInfo lock(int id) { operations.add("lock"); return row; }
        @Override public MatchInfo get(int id) { return row; }
        @Override public boolean hasLegacyProgress(int id) { return legacyProgress; }
    }
    private static class Catalog extends DraftCatalog {
        Catalog() { super(null); }
        @Override public TeamInfo team(int id) { return new TeamInfo(id,"Team "+id,null,null,null,1,0,0,0,0,null); }
    }
    private static class Picker extends FirstPickerPolicy {
        private int calls;
        Picker() { super(RandomGenerator.getDefault()); }
        @Override public long choose(MatchInfo match,TeamInfo a,TeamInfo b) { calls++; return a.id(); }
    }
    private static MatchInfo match(String status, int games) {
        return new MatchInfo(8,"ROUNDROBIN",status,5,null,1,11,12,0,0,0,0,games,null,null,null,null,
                null,null,null,false,null,null,null,null,null);
    }
}
