package com.overtimeproductions.goonginga.stats;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/playerStat")
public class PlayerStatController {
    private final PlayerStatService stats;
    private final ApiPermissions access;
    public PlayerStatController(PlayerStatService stats,ApiPermissions access) { this.stats=stats; this.access=access; }
    public record BatchInput(Integer matchId,List<Map<String,Object>> games) {}
    @GetMapping("/public") public List<JsonNode> publicStats() { return stats.list(null,true); }
    @GetMapping("/public/user/{userId}") public List<JsonNode> publicUser(@PathVariable int userId) { return stats.list(userId,true); }
    @GetMapping public List<JsonNode> all(@AuthenticationPrincipal Jwt token) { access.manager(token); return stats.list(null,false); }
    @GetMapping("/mine") public List<JsonNode> mine(@AuthenticationPrincipal Jwt token) { return stats.list(access.actor(token).memberId(),false); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        var actor=access.actor(token);
        return stats.create(input,actor.memberId(),actor.isManager());
    }
    @PostMapping("/batch") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> batch(@AuthenticationPrincipal Jwt token,@RequestBody BatchInput input) {
        access.manager(token);
        if (input.matchId()==null) throw new IllegalArgumentException("matchId is required.");
        return stats.batch(input.matchId(),input.games());
    }
}
