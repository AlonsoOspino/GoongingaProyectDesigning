package com.overtimeproductions.goonginga.draft.bans;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class BanController {
    private final BanService bans;
    private final DraftAccess access;

    public BanController(BanService bans, DraftAccess access) {
        this.bans = bans;
        this.access = access;
    }

    @PostMapping("/draft/{id}/ban-hero")
    public DraftView ban(@PathVariable long id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.BanHero request) {
        return bans.submit(id, access.actor(token), request);
    }
}
