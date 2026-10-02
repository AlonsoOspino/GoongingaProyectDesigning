package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

/** Timing is orthogonal to the draft phase; pause is not another phase. */
@Component
public final class TurnClock {
    public static final Duration TURN_LIMIT = Duration.ofSeconds(95);

    public boolean isTimed(DraftPhase phase) {
        return phase == DraftPhase.MAP_TYPE_SELECTION
                || phase == DraftPhase.MAP_SELECTION
                || phase == DraftPhase.HERO_BANS;
    }

    public Duration remaining(Instant startedAt, Instant now, Instant pausedAt) {
        Instant reference = pausedAt == null ? now : pausedAt;
        Duration elapsed = Duration.between(startedAt, reference);
        if (elapsed.isNegative()) {
            elapsed = Duration.ZERO;
        }
        Duration remaining = TURN_LIMIT.minus(elapsed);
        return remaining.isNegative() ? Duration.ZERO : remaining;
    }

    public Instant shiftStartAfterPause(Instant startedAt, Instant pausedAt, Instant resumedAt) {
        if (resumedAt.isBefore(pausedAt)) {
            throw new IllegalArgumentException("Resume time cannot precede pause time.");
        }
        return startedAt.plus(Duration.between(pausedAt, resumedAt));
    }
}
