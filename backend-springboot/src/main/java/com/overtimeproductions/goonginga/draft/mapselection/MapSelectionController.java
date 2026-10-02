package com.overtimeproductions.goonginga.draft.mapselection;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/draft/{id}")
public class MapSelectionController {
    private final MapSelectionService selection;
    private final DraftAccess access;
    public MapSelectionController(MapSelectionService selection, DraftAccess access) { this.selection=selection; this.access=access; }

    @PostMapping("/pick-map-type")
    public DraftView type(@PathVariable long id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.PickType request) {
        return selection.type(id, access.actor(token), request);
    }

    @PostMapping("/pick-map")
    public DraftView map(@PathVariable long id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.PickMap request) {
        return selection.map(id, access.actor(token), request);
    }

    @PatchMapping("/start-ban")
    public DraftView startBans(@PathVariable long id, @AuthenticationPrincipal Jwt token) { return selection.beginBans(id, access.actor(token)); }
}
