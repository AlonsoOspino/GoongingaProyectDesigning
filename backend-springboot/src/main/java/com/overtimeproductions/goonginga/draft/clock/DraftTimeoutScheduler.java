package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.data.DraftSessionRepository;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="draft.timeouts-enabled", havingValue="true", matchIfMissing=true)
public class DraftTimeoutScheduler {
    private static final Logger log = LoggerFactory.getLogger(DraftTimeoutScheduler.class);
    private final DraftSessionRepository sessions;
    private final DraftTimeoutService timeouts;
    private final Clock clock;

    public DraftTimeoutScheduler(DraftSessionRepository sessions, DraftTimeoutService timeouts, Clock clock) {
        this.sessions=sessions; this.timeouts=timeouts; this.clock=clock;
    }

    @Scheduled(fixedDelayString="${draft.timeout-poll-ms:1000}")
    public void tick() {
        for (long id : sessions.findDueIds(clock.instant(), PageRequest.of(0, 100))) {
            try { timeouts.expire(id); }
            catch (RuntimeException error) { log.error("Could not apply timeout for draft {}", id, error); }
        }
    }
}
