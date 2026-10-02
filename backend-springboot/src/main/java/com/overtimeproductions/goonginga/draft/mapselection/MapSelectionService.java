package com.overtimeproductions.goonginga.draft.mapselection;

import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.application.*;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MapSelectionService {
    private final DraftCommands commands;
    private final DraftWorkflow workflow;
    private final DraftStore store;
    private final DraftCatalog catalog;
    private final DraftViewMapper views;
    private final Clock clock;

    public MapSelectionService(DraftCommands commands, DraftWorkflow workflow, DraftStore store,
            DraftCatalog catalog, DraftViewMapper views, Clock clock) {
        this.commands=commands; this.workflow=workflow; this.store=store; this.catalog=catalog; this.views=views; this.clock=clock;
    }

    public DraftView type(long id, DraftActor actor, DraftRequests.PickType request) {
        var command = commands.team(id, actor, request.teamId());
        var draft = command.draft();
        var next = workflow.chooseMapType(draft.state(), command.teamId(), request.mapType(),
                catalog.availableTypes(draft.match(), draft.state().usedMapIds(), draft.state().mapNumber()));
        return views.map(store.save(draft, next, clock.instant()));
    }

    public DraftView map(long id, DraftActor actor, DraftRequests.PickMap request) {
        var command = commands.team(id, actor, request.teamId());
        var draft = command.draft();
        var pool = catalog.choices(draft.match());
        var choice = pool.stream().filter(m -> m.id() == request.mapId()).findFirst()
                .orElseThrow(() -> new DraftRuleViolation("Map is not in this match's pool."));
        var next = workflow.chooseMap(draft.state(), command.teamId(), choice, pool);
        return views.map(store.save(draft, next, clock.instant()));
    }

    public DraftView beginBans(long id, DraftActor actor) {
        var draft = commands.manager(id, actor);
        return views.map(store.save(draft, workflow.beginBans(draft.state()), clock.instant()));
    }
}
