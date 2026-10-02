package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.api.DraftView;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PauseService {
    private final DraftStore store;
    private final MatchRepository matches;
    private final DraftAccess access;
    private final Clock clock;

    public PauseService(DraftStore store, MatchRepository matches, DraftAccess access, Clock clock) {
        this.store=store; this.matches=matches; this.access=access; this.clock=clock;
    }

    public DraftView.MatchEnvelope toggle(int matchId, DraftActor actor, boolean paused) {
        var draft = store.lockByMatch(matchId);
        access.requireManager(actor, draft.match());
        if (draft.state().phase() == DraftPhase.FINISHED) throw new DraftRuleViolation("The series has finished.");
        var now = clock.instant();
        if (paused) draft.session().pause(now); else draft.session().resume(now);
        matches.pause(matchId, paused, paused ? draft.session().getPausedAt() : now);
        store.flush();
        return new DraftView.MatchEnvelope(paused ? "Timer paused" : "Timer resumed", matches.get(matchId));
    }

    public DraftView.MatchEnvelope request(int matchId, DraftActor actor) {
        var draft = store.lockByMatch(matchId);
        int team = access.captainTeam(actor, draft.match());
        if (draft.state().phase() == DraftPhase.FINISHED) throw new DraftRuleViolation("The series has finished.");
        matches.requestPause(matchId, team, clock.instant());
        return new DraftView.MatchEnvelope("Pause requested", matches.get(matchId));
    }

    public DraftView.MatchEnvelope clear(int matchId, DraftActor actor) {
        var draft = store.lockByMatch(matchId);
        access.requireManager(actor, draft.match());
        matches.clearPauseRequest(matchId);
        return new DraftView.MatchEnvelope("Pause request cleared", matches.get(matchId));
    }
}
