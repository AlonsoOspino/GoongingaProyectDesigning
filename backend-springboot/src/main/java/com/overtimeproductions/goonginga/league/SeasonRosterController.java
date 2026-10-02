package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/season-roster")
public class SeasonRosterController {
    private final SeasonRosterService roster;
    private final ApiPermissions access;
    public SeasonRosterController(SeasonRosterService roster,ApiPermissions access) { this.roster=roster; this.access=access; }
    public record Assignment(String role,Integer teamId) {}
    @GetMapping("/tournaments") public List<JsonNode> tournaments(@AuthenticationPrincipal Jwt token) { access.admin(token); return roster.tournaments(); }
    @GetMapping("/{tournamentId}") public Map<String,Object> get(@PathVariable int tournamentId,@AuthenticationPrincipal Jwt token) {
        access.admin(token); return roster.roster(tournamentId);
    }
    @PutMapping("/{tournamentId}/members/{memberId}")
    public Map<String,Object> assign(@PathVariable int tournamentId,@PathVariable int memberId,@AuthenticationPrincipal Jwt token,@RequestBody Assignment input) {
        access.admin(token); return roster.assign(tournamentId,memberId,input.role(),input.teamId());
    }
    @DeleteMapping("/{tournamentId}/members/{memberId}")
    public Map<String,Object> remove(@PathVariable int tournamentId,@PathVariable int memberId,@AuthenticationPrincipal Jwt token) {
        access.admin(token); return roster.remove(tournamentId,memberId);
    }
}
