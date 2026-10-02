package com.overtimeproductions.goonginga.draft.playing;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import org.springframework.stereotype.Component;

@Component
public final class PlayingPhase {
    public DraftState endMap(DraftState state) {
        state.requirePhase(DraftPhase.PLAYING);
        return state.toBuilder().phase(DraftPhase.RESULT_PENDING).build();
    }
}
