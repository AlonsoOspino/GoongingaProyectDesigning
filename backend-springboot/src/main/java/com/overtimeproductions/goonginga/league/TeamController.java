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
@RequestMapping("/team")
public class TeamController {
    private final TeamService teams;
    private final ApiPermissions access;
    public TeamController(TeamService teams, ApiPermissions access) { this.teams=teams; this.access=access; }
    public record NewTeam(String name, Integer tournamentId, String logo, String roster,String bannerLeft,String bannerRight,String discordRoleId) {}
    public record ManyTeams(Integer count, Integer tournamentId, String namePrefix) {}

    @GetMapping public List<JsonNode> all(@RequestParam(defaultValue="false") boolean includeDev) { return teams.all(includeDev); }
    @GetMapping("/leaderboard") public List<JsonNode> leaderboard(@RequestParam(required=false) Integer tournamentId) {
        return teams.leaderboard(tournamentId != null && tournamentId > 0 ? tournamentId : null);
    }
    @GetMapping("/{id}") public JsonNode get(@PathVariable int id) { return teams.get(id); }
    @PostMapping("/create") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token, @RequestBody NewTeam input) {
        access.admin(token);
        return teams.create(input.name(),input.tournamentId(),input.logo(),input.roster(),input.bannerLeft(),input.bannerRight(),input.discordRoleId());
    }
    @PostMapping("/create-many") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> createMany(@AuthenticationPrincipal Jwt token, @RequestBody ManyTeams input,
            @RequestParam(required=false) Integer tournamentId) {
        access.admin(token);
        return teams.createMany(input.count(),input.tournamentId()!=null?input.tournamentId():tournamentId,input.namePrefix());
    }
    @PutMapping("/update/{id}")
    public JsonNode captainUpdate(@PathVariable int id, @AuthenticationPrincipal Jwt token, @RequestBody Map<String,Object> input) {
        int memberId=access.actor(token).memberId();
        return teams.update(id,input,memberId);
    }
    @PutMapping("/admin/update/{id}")
    public JsonNode adminUpdate(@PathVariable int id, @AuthenticationPrincipal Jwt token, @RequestBody Map<String,Object> input) {
        access.admin(token);
        return teams.update(id,input,null);
    }
    @DeleteMapping("/delete/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable int id, @AuthenticationPrincipal Jwt token) { access.admin(token); teams.remove(id); }
}
