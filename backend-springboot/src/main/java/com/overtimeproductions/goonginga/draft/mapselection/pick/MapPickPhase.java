package com.overtimeproductions.goonginga.draft.mapselection.pick;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapChoice;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public final class MapPickPhase {
    public DraftState chooseMap(DraftState state, long teamId, MapChoice choice, Set<MapChoice> availableMaps) {
        state.requirePhase(DraftPhase.MAP_SELECTION);
        state.requireTurn(teamId);
        if (choice == null || choice.type() != state.selectedMapType()
                || state.usedMapIds().contains(choice.id()) || !availableMaps.contains(choice)) {
            throw new DraftRuleViolation("Selected map is unavailable or was already used.");
        }
        Set<Long> usedMaps = new HashSet<>(state.usedMapIds());
        usedMaps.add(choice.id());
        return state.toBuilder()
                .currentMapId(choice.id())
                .lastPickerTeamId(teamId)
                .usedMapIds(usedMaps)
                .phase(DraftPhase.MAP_LOCKED)
                .build();
    }
}
