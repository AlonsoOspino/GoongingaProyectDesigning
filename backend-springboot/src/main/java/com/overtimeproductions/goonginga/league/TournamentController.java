package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/tournament")
public class TournamentController {
    private final TournamentService tournaments;
    private final ApiPermissions access;
    private final DivisionService divisions;
    public TournamentController(TournamentService tournaments,ApiPermissions access,DivisionService divisions) { this.tournaments=tournaments; this.access=access; this.divisions=divisions; }
    public record TournamentInput(String name,String startDate,String state,List<String> divisionNames,String teamFormation,Integer targetTeamCount) {}
    public record DivisionsInput(List<DivisionService.DivisionInput> divisions) {}
    public record PlayoffInput(List<Integer> teamIds) {}
    public record CountdownInput(String startDate) {}
    @GetMapping public List<JsonNode> all() { return tournaments.all(); }
    @GetMapping("/current") public JsonNode current() { return tournaments.current(); }
    @PostMapping("/create") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token,@RequestBody TournamentInput input) {
        access.admin(token); return tournaments.create(input.name(),input.startDate(),input.divisionNames(),input.teamFormation(),input.targetTeamCount());
    }
    @PutMapping("/update/{id}") public JsonNode update(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody TournamentInput input) {
        access.admin(token); return tournaments.update(id,input.name(),input.startDate(),input.state());
    }
    @PatchMapping("/{id}/countdown") public JsonNode countdown(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody CountdownInput input) {
        access.admin(token); return tournaments.countdown(id,input.startDate());
    }
    @DeleteMapping("/delete/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable int id,@AuthenticationPrincipal Jwt token) { access.admin(token); tournaments.remove(id); }
    @GetMapping("/{id}/divisions") public List<JsonNode> divisions(@PathVariable int id) { return divisions.all(id); }
    @PutMapping("/{id}/divisions") public JsonNode divisions(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody DivisionsInput input) {
        access.admin(token); return divisions.replace(id,input.divisions());
    }
    @PostMapping("/{id}/start-playoffs") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode startPlayoffs(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody PlayoffInput input) {
        access.admin(token); return tournaments.startPlayoffs(id,input.teamIds());
    }
}
