package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.application.DraftReadService;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class DraftReadController {
    private final DraftReadService reads;
    private final DraftAccess access;
    public DraftReadController(DraftReadService reads, DraftAccess access) { this.reads=reads; this.access=access; }

    @GetMapping("/draft/{id}/state")
    public DraftView state(@PathVariable long id, @AuthenticationPrincipal Jwt token, @RequestParam(required=false) String key) {
        return reads.state(id, token, key);
    }

    @GetMapping("/draft/by-match/{matchId}")
    public DraftView byMatch(@PathVariable String matchId, @AuthenticationPrincipal Jwt token, @RequestParam(required=false) String key) {
        return reads.byMatch(matchId, token, key);
    }

    @GetMapping("/draft/by-match/{matchId}/share")
    public DraftView.Share share(@PathVariable String matchId, @AuthenticationPrincipal Jwt token) {
        return reads.share(matchId, access.actor(token));
    }

}
