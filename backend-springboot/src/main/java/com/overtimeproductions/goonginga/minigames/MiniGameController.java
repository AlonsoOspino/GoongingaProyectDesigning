package com.overtimeproductions.goonginga.minigames;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.common.media.ImageStorage;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/minigames")
public class MiniGameController {
    private final MiniGameService games;
    private final ApiPermissions access;
    private final ImageStorage images;
    private final String publicBase;
    public MiniGameController(MiniGameService games,ApiPermissions access,ImageStorage images,@Value("${PUBLIC_API_BASE_URL:}") String publicBase) {
        this.games=games;this.access=access;this.images=images;this.publicBase=publicBase;
    }
    public record StatusInput(String status) {}
    public record AwardInput(String questionId,Integer memberId,String result) {}
    public record ScoreInput(Integer memberId,Integer delta) {}
    public record OrderInput(List<Integer> memberIds) {}
    @GetMapping("/games") public List<Map<String,Object>> all() { return games.all(); }
    @GetMapping("/system/family-feud") public Map<String,Object> familyFeudStatus() { return games.familyFeudStatus(); }
    @GetMapping("/jeopardy/active") public Map<String,Object> activeJeopardy() { return games.activeJeopardy(); }
    @GetMapping("/games/{slug}") public Map<String,Object> game(@PathVariable String slug) { return games.get(slug,false); }
    @GetMapping("/games/{slug}/manage") public Map<String,Object> manage(@PathVariable String slug,@AuthenticationPrincipal Jwt token) {
        games.operator(slug,access.actor(token));return games.get(slug,true);
    }
    @GetMapping("/members") public List<JsonNode> members(@AuthenticationPrincipal Jwt token,@RequestParam(required=false) String search) {
        access.manager(token);return games.members(search);
    }
    @PostMapping("/games") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        return games.create(input,access.manager(token).memberId());
    }
    @PatchMapping("/games/{slug}") public Map<String,Object> update(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        games.operator(slug,access.actor(token));return games.update(slug,input);
    }
    @DeleteMapping("/games/{slug}") public Map<String,Object> remove(@PathVariable String slug,@AuthenticationPrincipal Jwt token) {
        access.manager(token);return games.remove(slug);
    }
    @PatchMapping("/games/{slug}/status") public Map<String,Object> status(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestBody StatusInput input) {
        int actor=access.require(token,"DEVELOPER","ADMIN").memberId();return games.status(slug,input.status(),actor);
    }
    @PostMapping("/games/{slug}/start") public Map<String,Object> start(@PathVariable String slug,@AuthenticationPrincipal Jwt token) {
        games.operator(slug,access.actor(token));return games.start(slug);
    }
    @PostMapping("/games/{slug}/award") public Map<String,Object> award(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestBody AwardInput input) {
        games.operator(slug,access.actor(token));return games.award(slug,input.questionId(),input.memberId(),input.result());
    }
    @PostMapping("/games/{slug}/score") public Map<String,Object> score(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestBody ScoreInput input) {
        games.operator(slug,access.actor(token));
        if (input.memberId()==null || input.delta()==null) throw new IllegalArgumentException("memberId and delta are required.");
        return games.score(slug,input.memberId(),input.delta());
    }
    @PostMapping("/games/{slug}/display-order") public Map<String,Object> order(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestBody OrderInput input) {
        games.operator(slug,access.actor(token));return games.order(slug,input.memberIds());
    }
    @PostMapping("/games/{slug}/finalize") public Map<String,Object> finalizeGame(@PathVariable String slug,@AuthenticationPrincipal Jwt token) {
        games.operator(slug,access.actor(token));return games.finalizeGame(slug);
    }
    @PostMapping("/games/{slug}/cover") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> cover(@PathVariable String slug,@AuthenticationPrincipal Jwt token,@RequestPart("image") MultipartFile image,HttpServletRequest request) {
        games.operator(slug,access.actor(token));
        String path=images.storeUpload("minigames",image);
        String base=publicBase.isBlank()?request.getScheme()+"://"+request.getServerName()
                +((request.getServerPort()==80 || request.getServerPort()==443)?"":":"+request.getServerPort()):publicBase;
        String url=base.replaceAll("/+$","")+path;
        return Map.of("url",url,"game",games.cover(slug,url));
    }
}
