package com.overtimeproductions.goonginga.draft.mapselection.type;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public final class MapTypePhase {
    public DraftState chooseType(DraftState state, long teamId, MapType choice, Set<MapType> availableTypes) {
        state.requirePhase(DraftPhase.MAP_TYPE_SELECTION);
        state.requireTurn(teamId);
        if (choice == null || choice == MapType.CONTROL || !availableTypes.contains(choice)) {
            throw new DraftRuleViolation("Selected map type is unavailable for this match.");
        }
        return state.toBuilder()
                .selectedMapType(choice)
                .phase(DraftPhase.MAP_SELECTION)
                .build();
    }
}
