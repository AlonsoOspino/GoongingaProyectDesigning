package com.overtimeproductions.goonginga.network;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/network-members")
public class NetworkMemberController {
    private final NetworkMemberService members;
    private final ApiPermissions access;
    public NetworkMemberController(NetworkMemberService members,ApiPermissions access) { this.members=members; this.access=access; }
    public record RoleInput(List<String> roles) {}
    @GetMapping("/recent") public List<JsonNode> recent(@RequestParam(defaultValue="5") int limit) { return members.recent(limit); }
    @GetMapping("/me") public JsonNode me(@AuthenticationPrincipal Jwt token) { return members.current(access.actor(token).memberId()); }
    @GetMapping("/me/capabilities") public Map<String,Object> capabilities(@AuthenticationPrincipal Jwt token) {
        var actor=access.actor(token); return members.capabilities(actor.memberId(),actor.roles());
    }
    @GetMapping("/admin/users") public List<JsonNode> users(@AuthenticationPrincipal Jwt token,@RequestParam(required=false) String search) {
        access.require(token,"ADMIN","DEVELOPER"); return members.adminUsers(search);
    }
    @PatchMapping("/admin/users/{id}/roles") public JsonNode roles(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody RoleInput input) {
        access.require(token,"ADMIN","DEVELOPER"); return members.updateRoles(id,input.roles());
    }
    @GetMapping("/players") public List<JsonNode> players() { return members.leaguePlayers(); }
    @GetMapping("/players/{id}") public JsonNode player(@PathVariable int id,@AuthenticationPrincipal Jwt token) {
        requireSelfOrAdmin(id,token); return members.leagueProfile(id);
    }
    @PutMapping("/players/{id}") public JsonNode updatePlayer(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        requireSelfOrAdmin(id,token); return members.updateProfile(id,input,false);
    }
    @PutMapping("/admin/players/{id}") public JsonNode adminUpdatePlayer(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        access.admin(token); return members.updateProfile(id,input,true);
    }
    private void requireSelfOrAdmin(int id,Jwt token) {
        var actor=access.actor(token);
        if (actor.memberId()!=id && !actor.roles().contains("ADMIN"))
            throw new DraftHttpException(HttpStatus.FORBIDDEN,"Forbidden.");
    }
}
