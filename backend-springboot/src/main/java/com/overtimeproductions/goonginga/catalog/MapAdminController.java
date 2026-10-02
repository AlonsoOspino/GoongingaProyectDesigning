package com.overtimeproductions.goonginga.catalog;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.draft.context.MapInfo;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/map")
public class MapAdminController {
    private final MapAdminService maps;
    private final ApiPermissions access;
    public MapAdminController(MapAdminService maps, ApiPermissions access) { this.maps = maps; this.access = access; }

    public record MapInput(String name, MapType type, String imageUrl) {}

    @PostMapping(value="/create", consumes=MediaType.APPLICATION_JSON_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public MapInfo createJson(@AuthenticationPrincipal Jwt token, @RequestBody MapInput input) {
        access.admin(token);
        return maps.create(input.name(), input.type(), input.imageUrl(), null);
    }

    @PostMapping(value="/create", consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public MapInfo create(@AuthenticationPrincipal Jwt token, @RequestParam String name, @RequestParam MapType type,
            @RequestParam(required=false) String imageUrl, @RequestPart(required=false) MultipartFile image) {
        access.admin(token);
        return maps.create(name, type, imageUrl, image);
    }

    @DeleteMapping("/delete/{id}")
    public MapInfo remove(@PathVariable int id, @AuthenticationPrincipal Jwt token) {
        access.admin(token);
        return maps.remove(id);
    }
}
