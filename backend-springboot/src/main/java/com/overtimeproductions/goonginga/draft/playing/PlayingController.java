package com.overtimeproductions.goonginga.draft.playing;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.DraftView;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class PlayingController {
    private final PlayingService playing;
    private final DraftAccess access;
    public PlayingController(PlayingService playing, DraftAccess access) { this.playing=playing; this.access=access; }

    @PatchMapping({"/draft/{id}/end-game", "/draft/{id}/end-map"})
    public DraftView end(@PathVariable long id, @AuthenticationPrincipal Jwt token,
            @jakarta.validation.Valid @RequestBody(required=false) com.overtimeproductions.goonginga.draft.api.DraftRequests.MapIdentity request) {
        return playing.end(id, access.actor(token), request == null ? null : request.expectedGameNumber(), request == null ? null : request.expectedMapId());
    }
}
