package com.overtimeproductions.goonginga.draft.migration;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.*;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.preparation.PreparationService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
public class LegacyDraftArchiveController {
    private final LegacyDraftArchiveService archive;
    private final PreparationService preparation;
    private final ApiPermissions permissions;
    private final DraftAccess access;
    private final MatchRepository matches;
    public LegacyDraftArchiveController(LegacyDraftArchiveService archive,PreparationService preparation,ApiPermissions permissions,DraftAccess access,MatchRepository matches) {
        this.archive=archive;this.preparation=preparation;this.permissions=permissions;this.access=access;this.matches=matches;
    }
    @GetMapping("/draftTable") public List<Object> tables() {return archive.tables();}
    @GetMapping("/draftAction") public List<Object> actions() {return archive.actions();}
    @GetMapping("/draftTable/by-match/{id}")
    public Object byMatch(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestParam(required=false) String key,@RequestHeader(value="X-Draft-Key",required=false) String header) {
        if(token!=null)access.actor(token);
        else if(!access.validKey(key==null?header:key))throw new DraftHttpException(HttpStatus.FORBIDDEN,"Provide a login token or valid draft key.");
        return archive.byMatch(id);
    }
    @PostMapping({"/draftTable/admin/create","/draftTable/manager/create"}) @ResponseStatus(HttpStatus.CREATED)
    public DraftView create(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input,jakarta.servlet.http.HttpServletRequest request) {
        var actor=request.getRequestURI().contains("/admin/")?permissions.admin(token):permissions.manager(token);
        if(!(input.get("matchId") instanceof Number id))throw new IllegalArgumentException("matchId is required.");
        if(input.get("phase")!=null&&!input.get("phase").equals("STARTING"))throw new IllegalArgumentException("New drafts start at STARTING. Use phase commands to advance them.");
        return preparation.create(String.valueOf(id.intValue()),actor);
    }
    @PutMapping({"/draftTable/admin/update/{id}","/draftTable/manager/update/{id}"})
    public JsonNode updateTable(@PathVariable long id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input,jakarta.servlet.http.HttpServletRequest request) {
        if(request.getRequestURI().contains("/admin/"))permissions.admin(token);else permissions.manager(token);
        return archive.updateTable(id,input);
    }
    @DeleteMapping("/draftTable/admin/delete/{id}")
    public JsonNode deleteTable(@PathVariable long id,@AuthenticationPrincipal Jwt token) {permissions.admin(token);return archive.deleteTable(id);}
    @PostMapping("/draftAction/admin/create") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createAction(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {permissions.admin(token);return archive.createAction(input);}
    @PutMapping("/draftAction/admin/update/{id}")
    public JsonNode updateAction(@PathVariable long id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {permissions.admin(token);return archive.updateAction(id,input);}
    @DeleteMapping("/draftAction/admin/delete/{id}")
    public JsonNode deleteAction(@PathVariable long id,@AuthenticationPrincipal Jwt token) {permissions.admin(token);return archive.deleteAction(id);}
    @PostMapping("/draftAction/captain/create")
    public void captainAction(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        if(!(input.get("matchId") instanceof Number id))throw new IllegalArgumentException("matchId is required.");
        access.captainTeam(access.actor(token),matches.get(id.intValue()));
        throw new IllegalArgumentException("Use /draft endpoints for BAN/PICK/SKIP actions to enforce draft rules.");
    }
}
