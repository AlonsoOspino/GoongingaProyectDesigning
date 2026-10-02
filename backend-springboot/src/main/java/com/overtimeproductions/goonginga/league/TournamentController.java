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
    public TournamentController(TournamentService tournaments,ApiPermissions access) { this.tournaments=tournaments; this.access=access; }
    public record TournamentInput(String name,String startDate,String state) {}
    public record PlayoffInput(List<Integer> teamIds) {}
    @GetMapping public List<JsonNode> all() { return tournaments.all(); }
    @GetMapping("/current") public JsonNode current() { return tournaments.current(); }
    @PostMapping("/create") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token,@RequestBody TournamentInput input) {
        access.admin(token); return tournaments.create(input.name(),input.startDate());
    }
    @PutMapping("/update/{id}") public JsonNode update(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody TournamentInput input) {
        access.admin(token); return tournaments.update(id,input.name(),input.startDate(),input.state());
    }
    @DeleteMapping("/delete/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable int id,@AuthenticationPrincipal Jwt token) { access.admin(token); tournaments.remove(id); }
    @PostMapping("/{id}/start-playoffs") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode startPlayoffs(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody PlayoffInput input) {
        access.admin(token); return tournaments.startPlayoffs(id,input.teamIds());
    }
}
