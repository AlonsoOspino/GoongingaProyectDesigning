package com.overtimeproductions.goonginga.draft.bans;

import com.overtimeproductions.goonginga.draft.domain.BanSelection;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.domain.HeroChoice;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public final class BanPhase {
    public DraftState submitBan(DraftState state, long teamId, HeroChoice hero) {
        state.requirePhase(DraftPhase.HERO_BANS);
        state.requireTurn(teamId);
        List<BanSelection> bans = state.bans();
        if (bans.size() >= 4 || bans.stream().filter(ban -> ban.teamId() == teamId).count() >= 2) {
            throw new DraftRuleViolation("Each map has four ban turns, two per team.");
        }
        if (hero != null) {
            if (bans.stream().anyMatch(ban -> ban.hero() != null && ban.hero().id() == hero.id())) {
                throw new DraftRuleViolation("Hero was already banned on this map.");
            }
            if (bans.stream().filter(ban -> ban.hero() != null && ban.hero().role() == hero.role()).count() >= 2) {
                throw new DraftRuleViolation("At most two heroes of each role can be banned per map.");
            }
        }
        List<BanSelection> nextBans = new ArrayList<>(bans);
        nextBans.add(new BanSelection(teamId, hero)); // null hero is an explicit NO BAN.
        boolean complete = nextBans.size() == 4;
        return state.toBuilder()
                .bans(nextBans)
                .turnTeamId(complete ? null : state.otherTeam(teamId))
                .phase(complete ? DraftPhase.PLAYING : DraftPhase.HERO_BANS)
                .build();
    }
}
