package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.DraftView;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class PreparationController {
    private final PreparationService preparation;
    private final DraftResetService resets;
    private final DraftAccess access;
    private final com.overtimeproductions.goonginga.league.MatchQueryService query;

    public PreparationController(PreparationService preparation, DraftResetService resets, DraftAccess access, com.overtimeproductions.goonginga.league.MatchQueryService query) {
        this.preparation=preparation; this.resets=resets; this.access=access;
        this.query=query;
    }

    @PostMapping("/draft/{matchId}")
    public DraftView create(@PathVariable String matchId, @AuthenticationPrincipal Jwt token) {
        return preparation.create(matchId, access.actor(token));
    }

    @PatchMapping("/draft/{id}/start-map-picking")
    public DraftView start(@PathVariable long id, @AuthenticationPrincipal Jwt token) {
        return preparation.start(id, access.actor(token));
    }

    @PostMapping("/draft/{id}/yield-first-pick")
    public DraftView yield(@PathVariable long id, @AuthenticationPrincipal Jwt token) {
        return preparation.yieldFirstPick(id, access.actor(token));
    }

    @PostMapping("/match/manager/reset/{id}")
    public tools.jackson.databind.JsonNode reset(@PathVariable int id, @AuthenticationPrincipal Jwt token) { resets.reset(id, access.actor(token));return query.get(String.valueOf(id)); }
}
