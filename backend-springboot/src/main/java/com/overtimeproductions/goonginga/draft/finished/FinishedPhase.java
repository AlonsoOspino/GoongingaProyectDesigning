package com.overtimeproductions.goonginga.draft.finished;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import org.springframework.stereotype.Component;

@Component
public final class FinishedPhase {
    public SeriesSummary summarize(DraftState state) {
        state.requirePhase(DraftPhase.FINISHED);
        long winnerTeamId = state.winsA() > state.winsB() ? state.teamAId() : state.teamBId();
        return new SeriesSummary(winnerTeamId, state.winsA(), state.winsB(), state.results().size());
    }

    public record SeriesSummary(long winnerTeamId, int winsA, int winsB, int mapsPlayed) {}
}
