package com.overtimeproductions.goonginga.draft.result;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapResult;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public final class ResultPhase {
    public DraftState undoResult(DraftState state) {
        state.requirePhase(DraftPhase.PREPARATION);
        if (state.results().isEmpty()) throw new DraftRuleViolation("No result to undo.");
        var last = state.results().getLast();
        int a = state.winsA() - (last.winnerTeamId() != null && last.winnerTeamId() == state.teamAId() ? 1 : 0);
        int b = state.winsB() - (last.winnerTeamId() != null && last.winnerTeamId() == state.teamBId() ? 1 : 0);
        return state.toBuilder().mapNumber(last.mapNumber()).wins(a, b)
                .results(state.results().subList(0, state.results().size() - 1))
                .phase(DraftPhase.RESULT_PENDING).turnTeamId(null).currentMapId(last.mapId()).build();
    }

    public DraftState recordResult(DraftState state, Long winnerTeamId) {
        state.requirePhase(DraftPhase.RESULT_PENDING);
        if (state.currentMapId() == null || state.lastPickerTeamId() == null) {
            throw new DraftRuleViolation("A map must be selected before recording its result.");
        }
        if (winnerTeamId != null && !state.hasTeam(winnerTeamId)) {
            throw new DraftRuleViolation("Winner must be one of the match teams.");
        }

        int winsA = state.winsA() + (winnerTeamId != null && winnerTeamId == state.teamAId() ? 1 : 0);
        int winsB = state.winsB() + (winnerTeamId != null && winnerTeamId == state.teamBId() ? 1 : 0);
        boolean finished = winsA >= state.requiredWins() || winsB >= state.requiredWins();
        long nextPicker = winnerTeamId == null
                ? state.otherTeam(state.lastPickerTeamId())
                : state.otherTeam(winnerTeamId);

        List<MapResult> results = new ArrayList<>(state.results());
        results.add(new MapResult(state.mapNumber(), state.currentMapId(), winnerTeamId));
        return state.toBuilder()
                .wins(winsA, winsB)
                .results(results)
                .mapNumber(finished ? state.mapNumber() : state.mapNumber() + 1)
                .phase(finished ? DraftPhase.FINISHED : DraftPhase.PREPARATION)
                .turnTeamId(finished ? null : nextPicker)
                .currentMapId(null)
                .selectedMapType(null)
                .bans(List.of())
                .build();
    }
}
