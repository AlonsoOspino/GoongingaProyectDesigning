package com.overtimeproductions.goonginga.draft.bans;

import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.application.*;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BanService {
    private final DraftCommands commands;
    private final DraftWorkflow workflow;
    private final DraftStore store;
    private final DraftCatalog catalog;
    private final DraftViewMapper views;
    private final Clock clock;

    public BanService(DraftCommands commands, DraftWorkflow workflow, DraftStore store,
            DraftCatalog catalog, DraftViewMapper views, Clock clock) {
        this.commands = commands;
        this.workflow = workflow;
        this.store = store;
        this.catalog = catalog;
        this.views = views;
        this.clock = clock;
    }

    public DraftView submit(long id, DraftActor actor, DraftRequests.BanHero request) {
        var command = commands.team(id, actor, request.teamId());
        var hero = request.heroId() == null ? null : catalog.hero(request.heroId()).choice();
        var next = workflow.submitBan(command.draft().state(), command.teamId(), hero);
        return views.map(store.save(command.draft(), next, clock.instant()));
    }
}
