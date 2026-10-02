package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/match")
public class MatchAdminController {
    private final MatchAdminService matches;
    private final ApiPermissions access;
    public MatchAdminController(MatchAdminService matches,ApiPermissions access) { this.matches=matches;this.access=access; }
    public record RoundRobinInput(Integer tournamentId,String confirmationText) {}
    public record WeekMapsInput(Integer tournamentId,Integer semanas,Object mapsAllowedByRound) {}
    @PostMapping("/admin/create") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        access.admin(token); return matches.create(input);
    }
    @PostMapping("/admin/generate-round-robin") @ResponseStatus(HttpStatus.CREATED)
    public List<JsonNode> generate(@AuthenticationPrincipal Jwt token,@RequestBody RoundRobinInput input) {
        access.admin(token);
        if (input.tournamentId()==null) throw new IllegalArgumentException("tournamentId is required.");
        return matches.generateRoundRobin(input.tournamentId(),input.confirmationText());
    }
    @PutMapping("/admin/update/{id}")
    public JsonNode update(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        access.admin(token); return matches.update(id,input,false);
    }
    @PutMapping("/manager/update/{id}")
    public JsonNode managerUpdate(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        access.manager(token); return matches.update(id,input,true);
    }
    @DeleteMapping("/admin/delete/{id}")
    public JsonNode remove(@PathVariable int id,@AuthenticationPrincipal Jwt token) { access.admin(token); return matches.remove(id); }
    @PutMapping("/admin/week-maps")
    public Map<String,Object> updateWeekMaps(@AuthenticationPrincipal Jwt token,@RequestBody WeekMapsInput input) {
        access.admin(token);
        if (input.tournamentId()==null || input.semanas()==null) throw new IllegalArgumentException("tournamentId and semanas are required.");
        return matches.updateWeekMaps(input.tournamentId(),input.semanas(),input.mapsAllowedByRound());
    }
    @GetMapping("/admin/week-maps/{tournamentId}/{semanas}")
    public Map<String,Object> weekMaps(@PathVariable int tournamentId,@PathVariable int semanas,@AuthenticationPrincipal Jwt token) {
        access.admin(token); return matches.weekMaps(tournamentId,semanas);
    }
}
