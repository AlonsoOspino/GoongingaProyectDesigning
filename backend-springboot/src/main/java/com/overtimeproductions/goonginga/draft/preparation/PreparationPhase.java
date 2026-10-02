package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import org.springframework.stereotype.Component;

@Component
public final class PreparationPhase {
    public DraftState startMapSelection(DraftState state) {
        state.requirePhase(DraftPhase.PREPARATION);
        // The first map is always Control. Later maps let the previous loser choose a type.
        return state.toBuilder()
                .phase(state.mapNumber() == 1 ? DraftPhase.MAP_SELECTION : DraftPhase.MAP_TYPE_SELECTION)
                .selectedMapType(state.mapNumber() == 1 ? MapType.CONTROL : null)
                .currentMapId(null)
                .bans(java.util.List.of())
                .build();
    }
}
