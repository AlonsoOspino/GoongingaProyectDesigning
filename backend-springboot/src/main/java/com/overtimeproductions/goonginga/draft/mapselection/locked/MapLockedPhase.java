package com.overtimeproductions.goonginga.draft.mapselection.locked;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import org.springframework.stereotype.Component;

@Component
public final class MapLockedPhase {
    public DraftState beginBans(DraftState state) {
        state.requirePhase(DraftPhase.MAP_LOCKED);
        // The map picker takes the first ban turn in the existing rules.
        return state.toBuilder()
                .turnTeamId(state.lastPickerTeamId())
                .phase(DraftPhase.HERO_BANS)
                .build();
    }
}
