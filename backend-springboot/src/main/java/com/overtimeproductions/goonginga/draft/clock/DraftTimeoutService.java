package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import java.time.Clock;
import java.util.random.RandomGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DraftTimeoutService {
    private static final Logger log = LoggerFactory.getLogger(DraftTimeoutService.class);
    private final DraftStore store;
    private final DraftCatalog catalog;
    private final TurnTimeouts timeouts;
    private final RandomGenerator random;
    private final Clock clock;

    public DraftTimeoutService(DraftStore store, DraftCatalog catalog, TurnTimeouts timeouts, RandomGenerator random, Clock clock) {
        this.store=store; this.catalog=catalog; this.timeouts=timeouts; this.random=random; this.clock=clock;
    }

    @Transactional
    public void expire(long id) {
        var draft = store.lock(id);
        var deadline = draft.session().getTurnDeadlineAt();
        var now = clock.instant();
        // Another request or worker may have already advanced this draft while we waited for its lock.
        if (draft.session().getPausedAt() != null || deadline == null || now.isBefore(deadline)) return;
        try {
            var state = draft.state();
            var next = switch (state.phase()) {
                case MAP_TYPE_SELECTION -> timeouts.selectFirstAvailableType(state, catalog.availableTypes(draft.match(), state.usedMapIds(), state.mapNumber()));
                case MAP_SELECTION -> timeouts.selectRandomMap(state, catalog.choices(draft.match()), random);
                case HERO_BANS -> timeouts.passBan(state);
                default -> throw new DraftRuleViolation("This phase has no timed turn.");
            };
            store.save(draft, next, now);
        } catch (DraftRuleViolation error) {
            // Keep the phase visible for a manager to repair its pool, without retrying an impossible action every second.
            draft.session().stopClock();
            store.flush();
            log.warn("Draft {} needs manager intervention: {}", id, error.getMessage());
        }
    }
}
