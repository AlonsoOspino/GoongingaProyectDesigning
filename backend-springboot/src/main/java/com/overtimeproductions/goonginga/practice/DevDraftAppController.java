package com.overtimeproductions.goonginga.practice;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.draft.api.DraftRequests;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/dev/draft-app")
public class DevDraftAppController {
    private final DevDraftAppService app;
    private final ApiPermissions permissions;
    public DevDraftAppController(DevDraftAppService app,ApiPermissions permissions) {this.app=app;this.permissions=permissions;}
    @GetMapping public Map<String,Object> state(@AuthenticationPrincipal Jwt jwt) {permissions.require(jwt,"DEVELOPER");return app.state();}
    @PostMapping("/teams") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> team(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {permissions.require(jwt,"DEVELOPER");return app.createTeam(input);}
    @DeleteMapping("/teams/{id}") public Map<String,Object> removeTeam(@AuthenticationPrincipal Jwt jwt,@PathVariable int id) {permissions.require(jwt,"DEVELOPER");return app.deleteTeam(id);}
    @PostMapping("/match") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> match(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {permissions.require(jwt,"DEVELOPER");return app.createMatch(input);}
    @DeleteMapping("/match") public Map<String,Object> removeMatch(@AuthenticationPrincipal Jwt jwt) {permissions.require(jwt,"DEVELOPER");return app.deleteMatch();}
    @PatchMapping("/match/overlay") public Map<String,Object> overlay(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody DraftRequests.Overlay input) {return app.overlay(input,permissions.require(jwt,"DEVELOPER"));}
    @PatchMapping("/match/score") public Map<String,Object> scores(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {permissions.require(jwt,"DEVELOPER");return app.scores(input);}
    @PutMapping("/match/bans") public Map<String,Object> bans(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {permissions.require(jwt,"DEVELOPER");return app.bans(input);}
}
