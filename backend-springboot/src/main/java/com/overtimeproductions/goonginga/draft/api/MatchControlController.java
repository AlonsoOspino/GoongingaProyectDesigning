package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.application.MatchControlService;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class MatchControlController {
    private final MatchControlService matches;
    private final DraftAccess access;
    private final com.overtimeproductions.goonginga.league.MatchQueryService query;
    public MatchControlController(MatchControlService matches, DraftAccess access, com.overtimeproductions.goonginga.league.MatchQueryService query) { this.matches=matches; this.access=access; this.query=query; }

    @PutMapping("/match/captain/update/{id}")
    public tools.jackson.databind.JsonNode readiness(@PathVariable int id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.Readiness request) {
        matches.readiness(id, access.actor(token), request);return query.get(String.valueOf(id));
    }

    @PatchMapping("/match/manager/{id}/overlay")
    public tools.jackson.databind.JsonNode overlay(@PathVariable int id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.Overlay request) {
        matches.overlay(id, access.actor(token), request);return query.get(String.valueOf(id));
    }
}
