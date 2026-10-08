package com.overtimeproductions.goonginga.draft.playing;

import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.application.*;
import com.overtimeproductions.goonginga.draft.data.DraftStore;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlayingService {
    private final DraftCommands commands;
    private final DraftWorkflow workflow;
    private final DraftStore store;
    private final DraftViewMapper views;
    private final Clock clock;

    public PlayingService(DraftCommands commands, DraftWorkflow workflow, DraftStore store, DraftViewMapper views, Clock clock) {
        this.commands=commands; this.workflow=workflow; this.store=store; this.views=views; this.clock=clock;
    }

    public DraftView end(long id, DraftActor actor) {
        return end(id, actor, null, null);
    }

    public DraftView end(long id, DraftActor actor, Integer expectedGameNumber, Integer expectedMapId) {
        var draft = commands.production(id, actor);
        MapCommandScope.require(draft.state(), expectedGameNumber, expectedMapId);
        return views.map(store.save(draft, workflow.endMap(draft.state()), clock.instant()));
    }
}
