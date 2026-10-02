package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/family-feud/games")
public class FeudGameController {
    private final FeudLobbyService lobby;
    private final FeudActionService actions;
    private final FeudGameRepository games;
    private final FeudIdentity identity;
    private final FeudProjection projection;
    private final FeudEvents events;
    private final ApiPermissions permissions;
    public FeudGameController(FeudLobbyService lobby,FeudActionService actions,FeudGameRepository games,
            FeudIdentity identity,FeudProjection projection,FeudEvents events,ApiPermissions permissions) {
        this.lobby=lobby;this.actions=actions;this.games=games;this.identity=identity;
        this.projection=projection;this.events=events;this.permissions=permissions;
    }
    @GetMapping public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt) { permissions.manager(jwt);return lobby.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        permissions.manager(jwt);return lobby.create(input,identity.viewer(jwt,null,true));
    }
    @GetMapping("/{code}") public Map<String,Object> get(@PathVariable String code,@RequestParam(defaultValue="spectator") String view,@AuthenticationPrincipal Jwt jwt) {
        FeudSnapshot game=actions.reconcile(code);return projection.view(game,view,identity.viewer(jwt,game,false));
    }
    @GetMapping(value="/{code}/events",produces="text/event-stream")
    public SseEmitter events(@PathVariable String code,@RequestParam(defaultValue="spectator") String view,@AuthenticationPrincipal Jwt jwt) {
        FeudSnapshot game=actions.reconcile(code);projection.view(game,view,identity.viewer(jwt,game,false));return events.subscribe(game.code(),game.version());
    }
    @PostMapping("/{code}/join") public Map<String,Object> join(@PathVariable String code,@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        permissions.actor(jwt);FeudSnapshot game=games.get(code);return lobby.join(code,input,identity.viewer(jwt,game,true));
    }
    @PatchMapping("/{code}/development-mode") public Map<String,Object> development(@PathVariable String code,@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        permissions.manager(jwt);
        if (!(input.get("enabled") instanceof Boolean enabled)) throw new IllegalArgumentException("enabled must be a boolean.");
        return lobby.developmentMode(code,enabled);
    }
    @PostMapping("/{code}/development-guests") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> guest(@PathVariable String code,@RequestBody Map<String,Object> input) { return lobby.joinGuest(code,input); }
    @DeleteMapping("/{code}/development-guests/me") @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String,String> leaveGuest(@PathVariable String code,@AuthenticationPrincipal Jwt jwt) {
        FeudSnapshot game=games.get(code);lobby.leaveGuest(code,identity.viewer(jwt,game,true));
        return Map.of("message","Test player will be removed unless this tab reconnects.");
    }
    @PostMapping("/{code}/heartbeat") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void heartbeat(@PathVariable String code,@AuthenticationPrincipal Jwt jwt) {
        FeudSnapshot game=games.get(code);lobby.heartbeat(code,identity.viewer(jwt,game,true));
    }
    @SuppressWarnings("unchecked")
    @PostMapping("/{code}/actions") public Map<String,Object> action(@PathVariable String code,@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        Map<String,Object> payload=input.get("payload") instanceof Map<?,?> values?(Map<String,Object>)values:Map.of();
        return actions.action(code,jwt,input.get("action") instanceof String command?command:"",payload);
    }
    @DeleteMapping("/{code}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String code,@AuthenticationPrincipal Jwt jwt) {
        permissions.actor(jwt);FeudSnapshot game=games.get(code);lobby.delete(code,identity.viewer(jwt,game,true));
    }
}
