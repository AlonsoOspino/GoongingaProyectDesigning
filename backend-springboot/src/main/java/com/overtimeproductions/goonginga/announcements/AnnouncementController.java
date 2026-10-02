package com.overtimeproductions.goonginga.announcements;

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
@RequestMapping("/announcements")
public class AnnouncementController {
    private final AnnouncementService announcements;
    private final ApiPermissions access;
    private final ImageStorage images;
    private final String publicBase;
    public AnnouncementController(AnnouncementService announcements,ApiPermissions access,ImageStorage images,
            @Value("${PUBLIC_API_BASE_URL:}") String publicBase) {
        this.announcements=announcements;this.access=access;this.images=images;this.publicBase=publicBase;
    }
    public record ReorderInput(List<Integer> ids) {}
    @GetMapping("/active") public Map<String,Object> active() { return announcements.active(); }
    @GetMapping public List<JsonNode> all(@AuthenticationPrincipal Jwt token) { access.manager(token); return announcements.all(); }
    @GetMapping("/settings") public Map<String,Object> settings(@AuthenticationPrincipal Jwt token) { access.manager(token); return announcements.settingsResponse(); }
    @PatchMapping("/settings") public Map<String,Object> settingsUpdate(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        return announcements.updateSettings(input,access.manager(token).memberId());
    }
    @PatchMapping("/reorder") public Map<String,Object> reorder(@AuthenticationPrincipal Jwt token,@RequestBody ReorderInput input) {
        return announcements.reorder(input.ids(),access.manager(token).memberId());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        return announcements.create(input,access.manager(token).memberId());
    }
    @PatchMapping("/{id}") public JsonNode update(@PathVariable int id,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        return announcements.update(id,input,access.manager(token).memberId());
    }
    @DeleteMapping("/{id}") public Map<String,Object> remove(@PathVariable int id,@AuthenticationPrincipal Jwt token) {
        access.manager(token);return announcements.remove(id);
    }
    @PostMapping("/image") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,String> upload(@AuthenticationPrincipal Jwt token,@RequestPart("image") MultipartFile image,HttpServletRequest request) {
        access.manager(token);
        String path=images.storeUpload("announcements",image);
        String base=publicBase.isBlank()?request.getScheme()+"://"+request.getServerName()
                +((request.getServerPort()==80 || request.getServerPort()==443)?"":":"+request.getServerPort()):publicBase;
        return Map.of("url",base.replaceAll("/+$","")+path);
    }
}
