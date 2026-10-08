package com.overtimeproductions.goonginga.draft.application;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.preparation.DraftProvisioningService;
import java.util.List;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class DraftReadService {
    private final DraftStore store;
    private final DraftSessionRepository sessions;
    private final MatchRepository matches;
    private final DraftAccess access;
    private final DraftViewMapper views;
    private final DraftProvisioningService provisioning;

    public DraftReadService(DraftStore store, DraftSessionRepository sessions, MatchRepository matches, DraftAccess access, DraftViewMapper views,
            DraftProvisioningService provisioning) {
        this.store=store; this.sessions=sessions; this.matches=matches; this.access=access; this.views=views;
        this.provisioning=provisioning;
    }

    public DraftView state(long id, Jwt token, String key) {
        var draft = store.get(id);
        access.requireRead(token, key, draft.match());
        return views.map(draft);
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public DraftView byMatch(String reference, Jwt token, String key) {
        int matchId = matches.resolve(reference);
        var draft = provisioning.ensure(matchId).orElseGet(() -> store.byMatch(matchId));
        // This public league read also supplies the broadcast overlays.
        return views.map(draft);
    }

    public DraftView.Share share(String reference, DraftActor actor) {
        var match = matches.get(matches.resolve(reference));
        return new DraftView.Share(match.id(), access.share(actor, match));
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public List<DraftView.PhaseRow> phases() {
        provisioning.ensureScheduledMatches();
        return sessions.findAll().stream().map(s -> new DraftView.PhaseRow(s.getId(), s.getMatchId(), DraftViewMapper.legacyPhase(s.getPhase()), s.getTurnTeamId(), s.getSelectedMapType())).toList();
    }
}
