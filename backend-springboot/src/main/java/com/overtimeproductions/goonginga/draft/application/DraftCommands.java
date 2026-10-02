package com.overtimeproductions.goonginga.draft.application;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import java.time.Clock;
import org.springframework.stereotype.Component;

@Component
public class DraftCommands {
    private final DraftStore store;
    private final DraftAccess access;
    private final Clock clock;

    public DraftCommands(DraftStore store, DraftAccess access, Clock clock) {
        this.store = store;
        this.access = access;
        this.clock = clock;
    }

    public LoadedDraft manager(long id, DraftActor actor) {
        var draft = store.lock(id);
        access.requireManager(actor, draft.match());
        requireRunning(draft);
        return draft;
    }

    public TeamCommand team(long id, DraftActor actor, Long requested) {
        var draft = store.lock(id);
        long teamId = access.actingTeam(actor, draft.match(), requested);
        requireRunning(draft);
        if (draft.session().getTurnDeadlineAt() != null && !clock.instant().isBefore(draft.session().getTurnDeadlineAt())) {
            throw new DraftRuleViolation("The turn expired. Reload after the server applies its automatic action.");
        }
        return new TeamCommand(draft, teamId);
    }

    private static void requireRunning(LoadedDraft draft) {
        if (draft.session().getPausedAt() != null) throw new DraftRuleViolation("Resume the draft before performing this action.");
    }
    public record TeamCommand(LoadedDraft draft, long teamId) {}
}
