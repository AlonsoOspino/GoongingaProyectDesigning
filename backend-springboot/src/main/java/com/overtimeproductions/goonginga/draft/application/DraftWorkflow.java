package com.overtimeproductions.goonginga.draft.application;

import com.overtimeproductions.goonginga.draft.bans.BanPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.HeroChoice;
import com.overtimeproductions.goonginga.draft.domain.MapChoice;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import com.overtimeproductions.goonginga.draft.finished.FinishedPhase;
import com.overtimeproductions.goonginga.draft.mapselection.locked.MapLockedPhase;
import com.overtimeproductions.goonginga.draft.mapselection.pick.MapPickPhase;
import com.overtimeproductions.goonginga.draft.mapselection.type.MapTypePhase;
import com.overtimeproductions.goonginga.draft.playing.PlayingPhase;
import com.overtimeproductions.goonginga.draft.preparation.PreparationPhase;
import com.overtimeproductions.goonginga.draft.result.ResultPhase;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Coordinates the rules. HTTP, database access and permissions live outside the phases. */
@Service
public final class DraftWorkflow {
    private final PreparationPhase preparation;
    private final MapTypePhase mapType;
    private final MapPickPhase mapPick;
    private final MapLockedPhase mapLocked;
    private final BanPhase bans;
    private final PlayingPhase playing;
    private final ResultPhase result;
    private final FinishedPhase finished;

    public DraftWorkflow(PreparationPhase preparation, MapTypePhase mapType, MapPickPhase mapPick,
            MapLockedPhase mapLocked, BanPhase bans, PlayingPhase playing, ResultPhase result,
            FinishedPhase finished) {
        this.preparation = preparation;
        this.mapType = mapType;
        this.mapPick = mapPick;
        this.mapLocked = mapLocked;
        this.bans = bans;
        this.playing = playing;
        this.result = result;
        this.finished = finished;
    }

    public DraftState startMapSelection(DraftState state) {
        return preparation.startMapSelection(state);
    }

    public DraftState chooseMapType(DraftState state, long teamId, MapType choice, Set<MapType> availableTypes) {
        return mapType.chooseType(state, teamId, choice, availableTypes);
    }

    public DraftState chooseMap(DraftState state, long teamId, MapChoice choice, Set<MapChoice> availableMaps) {
        return mapPick.chooseMap(state, teamId, choice, availableMaps);
    }

    public DraftState beginBans(DraftState state) {
        return mapLocked.beginBans(state);
    }

    public DraftState submitBan(DraftState state, long teamId, HeroChoice hero) {
        return bans.submitBan(state, teamId, hero);
    }

    public DraftState endMap(DraftState state) {
        return playing.endMap(state);
    }

    public DraftState recordResult(DraftState state, Long winnerTeamId) {
        return result.recordResult(state, winnerTeamId);
    }

    public FinishedPhase.SeriesSummary summarize(DraftState state) {
        return finished.summarize(state);
    }
}
