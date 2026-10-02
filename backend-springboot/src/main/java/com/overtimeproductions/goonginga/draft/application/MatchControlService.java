package com.overtimeproductions.goonginga.draft.application;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.api.DraftRequests;
import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MatchControlService {
    private final MatchRepository matches;
    private final DraftCatalog catalog;
    private final DraftAccess access;
    private final com.overtimeproductions.goonginga.league.ScheduleNotifications notifications;

    public MatchControlService(MatchRepository matches, DraftCatalog catalog, DraftAccess access, com.overtimeproductions.goonginga.league.ScheduleNotifications notifications) {
        this.matches=matches; this.catalog=catalog; this.access=access;
        this.notifications=notifications;
    }

    public MatchInfo readiness(int id, DraftActor actor, DraftRequests.Readiness request) {
        var match = matches.lock(id);
        int team = access.captainTeam(actor, match);
        if ("FINISHED".equals(match.status())) throw new DraftRuleViolation("The series has finished.");
        Integer own = team == match.teamAId() ? request.teamAready() : request.teamBready();
        Integer other = team == match.teamAId() ? request.teamBready() : request.teamAready();
        if (other != null) throw new DraftRuleViolation("Only your own team's readiness may be changed.");
        if (own == null && request.startDate() == null) throw new DraftRuleViolation("Specify readiness or startDate.");
        if (own != null) matches.readiness(id, team == match.teamAId(), own);
        if (request.startDate() != null) { matches.schedule(id, request.startDate()); notifications.enqueue(id); }
        return matches.get(id);
    }

    public MatchInfo overlay(int id, DraftActor actor, DraftRequests.Overlay request) {
        var match = matches.lock(id);
        access.requireManager(actor, match);
        if (request.focusMapId() != null && (request.focusType() == null || catalog.pool(match).stream()
                .noneMatch(m -> m.id() == request.focusMapId() && m.type() == request.focusType()))) {
            throw new DraftRuleViolation("Focused map must belong to the selected mode and pool.");
        }
        matches.overlay(id, request.focusType(), request.focusMapId());
        return matches.get(id);
    }
}
