package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.data.LoadedDraft;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import java.time.Clock;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A fresh match owns a draft before captains or production open its table. */
@Service
@Transactional
public class DraftProvisioningService {
    private final DraftStore store;
    private final MatchRepository matches;
    private final DraftCatalog catalog;
    private final FirstPickerPolicy pickers;
    private final Clock clock;

    public DraftProvisioningService(DraftStore store, MatchRepository matches, DraftCatalog catalog,
            FirstPickerPolicy pickers, Clock clock) {
        this.store=store; this.matches=matches; this.catalog=catalog; this.pickers=pickers; this.clock=clock;
    }

    public Optional<LoadedDraft> ensure(int matchId) {
        // Serialize with every draft writer and concurrent requests for this match.
        var match = matches.lock(matchId);
        if (store.exists(matchId)) return Optional.of(store.byMatch(matchId));
        if (!isUnplayed(match) || matches.hasLegacyProgress(matchId)) return Optional.empty();
        var state = DraftState.newDraft(matchId, match.teamAId(), match.teamBId(), match.effectiveBestOf(),
                pickers.choose(match, catalog.team(match.teamAId()), catalog.team(match.teamBId())));
        return Optional.of(store.create(match, state, clock.instant()));
    }

    public LoadedDraft require(int matchId) {
        return ensure(matchId).orElseThrow(() -> new DraftRuleViolation(
                "Create Spring drafts only for unplayed matches. Existing drafts require an audited data migration."));
    }

    public void ensureScheduledMatches() {
        for (int matchId : matches.unprovisionedScheduledIds()) ensure(matchId);
    }

    public LoadedDraft freshForEdit(int matchId) {
        var loaded = store.lockByMatch(matchId);
        if (!isUnplayed(loaded.match()) || loaded.state().phase() != com.overtimeproductions.goonginga.draft.domain.DraftPhase.PREPARATION
                || loaded.state().mapNumber() != 1 || !loaded.maps().isEmpty() || !loaded.bans().isEmpty())
            throw new com.overtimeproductions.goonginga.draft.api.DraftHttpException(org.springframework.http.HttpStatus.CONFLICT,
                    "Use draft phase commands or reset before changing a match that has started.");
        return loaded;
    }

    public void reconfigure(LoadedDraft before, boolean choosePicker) {
        var match = matches.get(before.match().id());
        long picker = choosePicker ? pickers.choose(match, catalog.team(match.teamAId()), catalog.team(match.teamBId())) : before.state().turnTeamId();
        var state = DraftState.newDraft(match.id(), match.teamAId(), match.teamBId(), match.effectiveBestOf(), picker);
        store.save(before, state, clock.instant());
    }

    private static boolean isUnplayed(MatchInfo match) {
        return "SCHEDULED".equals(match.status()) && match.gameNumber() == 0
                && match.mapWinsTeamA() == 0 && match.mapWinsTeamB() == 0
                && match.mapStartedAt() == null
                && (match.mapResults() == null || (match.mapResults().isArray() && match.mapResults().isEmpty()));
    }
}
