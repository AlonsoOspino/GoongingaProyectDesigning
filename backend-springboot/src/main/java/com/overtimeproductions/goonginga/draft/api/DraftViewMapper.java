package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.clock.TurnClock;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.data.LoadedDraft;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import com.overtimeproductions.goonginga.practice.PracticeDisplayRepository;

@Component
public class DraftViewMapper {
    private final DraftCatalog catalog;
    private final TurnClock turns;
    private final Clock clock;
    private final PracticeDisplayRepository practice;

    public DraftViewMapper(DraftCatalog catalog, TurnClock turns, Clock clock,PracticeDisplayRepository practice) {
        this.catalog = catalog;
        this.turns = turns;
        this.clock = clock;
        this.practice=practice;
    }

    public DraftView map(LoadedDraft draft) {
        var state = draft.state();
        var pool = catalog.pool(draft.match());
        List<MapType> allowed = state.mapNumber() == 1 ? List.of(MapType.CONTROL)
                : List.of(MapType.HYBRID, MapType.PAYLOAD, MapType.PUSH, MapType.FLASHPOINT);
        var available = catalog.availableTypes(draft.match(), state.usedMapIds(), state.mapNumber());
        Map<MapType, Long> counts = new EnumMap<>(MapType.class);
        for (var type : allowed) counts.put(type, pool.stream().filter(m -> m.type() == type && !state.usedMapIds().contains((long) m.id())).count());
        var maps = pool.stream().filter(m -> m.type() == state.selectedMapType() && !state.usedMapIds().contains((long) m.id())).toList();
        var actions = new ArrayList<DraftView.Action>();
        int order = 1;
        for (var pick : draft.maps()) {
            actions.add(new DraftView.Action(pick.getId() * 5, draft.session().getId(), pick.getPickerTeamId(), "PICK", pick.getMapId(),
                    pick.getMapNumber(), order++, pick.getSelectedAt()));
            for (var ban : draft.bans()) {
                if (ban.getDraftMapId() != pick.getId()) continue;
                actions.add(new DraftView.Action(pick.getId() * 5 + ban.getTurnNumber(), draft.session().getId(), ban.getTeamId(),
                        "BAN", ban.getHeroId(), pick.getMapNumber(), order++, ban.getCreatedAt()));
            }
        }
        long seconds = turns.isTimed(state.phase())
                ? turns.remaining(draft.session().getPhaseStartedAt(), clock.instant(), draft.session().getPausedAt()).toSeconds() : 0;
        var display=practice.get(draft.match().id()).orElse(null);
        var displayMatch=display==null?draft.match():draft.match().displayScores(display.scoreA(),display.scoreB());
        List<Long> displayedBans=state.bans().stream().filter(b -> b.hero()!=null).map(b -> b.hero().id()).toList();
        if (display!=null && display.bansA()!=null && display.bansB()!=null) {
            actions.removeIf(a -> a.action().equals("BAN") && a.gameNumber()==state.mapNumber());
            var ids=new ArrayList<Long>();int syntheticOrder=order;
            for (int team:List.of(draft.match().teamAId(),draft.match().teamBId())) {
                var selected=team==draft.match().teamAId()?display.bansA():display.bansB();
                for (Integer hero:selected) {
                    ids.add(hero.longValue());actions.add(new DraftView.Action(-syntheticOrder,draft.session().getId(),team,"BAN",hero,state.mapNumber(),syntheticOrder++,clock.instant()));
                }
            }
            displayedBans=List.copyOf(ids);
        }
        return new DraftView(draft.session().getId(), draft.match().id(), state.turnTeamId(), legacyPhase(state.phase()), state.phase(),
                draft.session().getPhaseStartedAt(), seconds, draft.session().getVersion(), List.copyOf(actions),
                displayedBans,
                draft.maps().stream().map(m -> (long) m.getMapId()).toList(), state.currentMapId(), state.selectedMapType(),
                allowed, available.stream().sorted().toList(), counts, maps, catalog.allMaps(), catalog.heroes(), displayMatch);
    }

    public static String legacyPhase(DraftPhase phase) {
        return switch (phase) {
            case PREPARATION -> "STARTING";
            case MAP_TYPE_SELECTION -> "MAPTYPEPICKING";
            case MAP_SELECTION, MAP_LOCKED -> "MAPPICKING";
            case HERO_BANS -> "BAN";
            case PLAYING -> "PLAYING";
            case RESULT_PENDING -> "ENDMAP";
            case FINISHED -> "FINISHED";
        };
    }
}
