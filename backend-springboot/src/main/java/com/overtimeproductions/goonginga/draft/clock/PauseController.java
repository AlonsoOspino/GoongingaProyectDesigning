package com.overtimeproductions.goonginga.draft.clock;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class PauseController {
    private final PauseService pauses;
    private final DraftAccess access;
    public PauseController(PauseService pauses, DraftAccess access) { this.pauses=pauses; this.access=access; }

    @PostMapping("/match/manager/{id}/toggle-pause")
    public DraftView.MatchEnvelope toggle(@PathVariable int id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.Pause request) {
        return pauses.toggle(id, access.actor(token), request.paused());
    }
    @PostMapping("/match/captain/{id}/request-pause")
    public DraftView.MatchEnvelope request(@PathVariable int id, @AuthenticationPrincipal Jwt token) { return pauses.request(id, access.actor(token)); }

    @PostMapping("/match/manager/{id}/clear-pause-request")
    public DraftView.MatchEnvelope clear(@PathVariable int id, @AuthenticationPrincipal Jwt token) { return pauses.clear(id, access.actor(token)); }
}
