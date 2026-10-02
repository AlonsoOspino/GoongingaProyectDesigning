package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.bans.BanPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.MapChoice;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import com.overtimeproductions.goonginga.draft.mapselection.pick.MapPickPhase;
import com.overtimeproductions.goonginga.draft.mapselection.type.MapTypePhase;
import java.util.Comparator;
import java.util.Set;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

/** Timeout choices reuse the same phase rules as human commands. */
@Component
public final class TurnTimeouts {
    private final MapTypePhase mapType;
    private final MapPickPhase mapPick;
    private final BanPhase bans;

    public TurnTimeouts(MapTypePhase mapType, MapPickPhase mapPick, BanPhase bans) {
        this.mapType = mapType;
        this.mapPick = mapPick;
        this.bans = bans;
    }

    public DraftState selectFirstAvailableType(DraftState state, Set<MapType> availableTypes) {
        state.requirePhase(DraftPhase.MAP_TYPE_SELECTION);
        MapType choice = availableTypes.stream()
                .filter(type -> type != MapType.CONTROL)
                .min(Comparator.comparingInt(Enum::ordinal))
                .orElseThrow(() -> new DraftRuleViolation("No map type is available for timeout selection."));
        return mapType.chooseType(state, state.turnTeamId(), choice, availableTypes);
    }

    public DraftState selectRandomMap(DraftState state, Set<MapChoice> availableMaps, RandomGenerator random) {
        state.requirePhase(DraftPhase.MAP_SELECTION);
        var choices = availableMaps.stream()
                .filter(map -> map.type() == state.selectedMapType() && !state.usedMapIds().contains(map.id()))
                .sorted(Comparator.comparingLong(MapChoice::id))
                .toList();
        if (choices.isEmpty()) {
            throw new DraftRuleViolation("No map is available for timeout selection.");
        }
        return mapPick.chooseMap(state, state.turnTeamId(), choices.get(random.nextInt(choices.size())), availableMaps);
    }

    public DraftState passBan(DraftState state) {
        state.requirePhase(DraftPhase.HERO_BANS);
        return bans.submitBan(state, state.turnTeamId(), null);
    }
}
