package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.application.*;
import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PreparationService {
    private final DraftStore store;
    private final MatchRepository matches;
    private final DraftCatalog catalog;
    private final DraftAccess access;
    private final DraftCommands commands;
    private final DraftProvisioningService provisioning;
    private final DraftWorkflow workflow;
    private final DraftViewMapper views;
    private final Clock clock;

    public PreparationService(DraftStore store, MatchRepository matches, DraftCatalog catalog, DraftAccess access,
            DraftCommands commands, DraftProvisioningService provisioning, DraftWorkflow workflow, DraftViewMapper views, Clock clock) {
        this.store=store; this.matches=matches; this.catalog=catalog; this.access=access;
        this.commands=commands; this.provisioning=provisioning; this.workflow=workflow; this.views=views; this.clock=clock;
    }

    public DraftView create(String reference, DraftActor actor) {
        var match = matches.lock(matches.resolve(reference));
        access.requireManager(actor, match);
        return views.map(provisioning.require(match.id()));
    }

    public DraftView start(long id, DraftActor actor) {
        var draft = commands.production(id, actor);
        if (catalog.availableTypes(draft.match(), draft.state().usedMapIds(), draft.state().mapNumber()).isEmpty()) {
            throw new DraftRuleViolation("No unplayed map is available in the configured pool.");
        }
        var next = workflow.startMapSelection(draft.state());
        matches.start(draft.match().id());
        return views.map(store.save(draft, next, clock.instant()));
    }

    public DraftView yieldFirstPick(long id, DraftActor actor) {
        var draft = store.lock(id);
        int team = access.captainTeam(actor, draft.match());
        var state = draft.state();
        state.requirePhase(DraftPhase.PREPARATION);
        state.requireTurn(team);
        var a = catalog.team(draft.match().teamAId());
        var b = catalog.team(draft.match().teamBId());
        if (!draft.match().isBracket() || state.mapNumber() != 1 || a.playoffSeed() == null || b.playoffSeed() == null
                || a.playoffSeed().equals(b.playoffSeed()) || (team == a.id() ? a.playoffSeed() > b.playoffSeed() : b.playoffSeed() > a.playoffSeed())) {
            throw new DraftRuleViolation("Only the higher seeded captain may yield the first playoff pick.");
        }
        if (draft.session().getPausedAt() != null) throw new DraftRuleViolation("Resume the draft first.");
        return views.map(store.save(draft, state.toBuilder().turnTeamId(state.otherTeam(team)).build(), clock.instant()));
    }
}
