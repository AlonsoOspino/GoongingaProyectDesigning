package com.overtimeproductions.goonginga.catalog;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.draft.context.HeroInfo;
import com.overtimeproductions.goonginga.draft.domain.HeroRole;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/hero")
public class HeroAdminController {
    private final HeroAdminService heroes;
    private final ApiPermissions access;
    public HeroAdminController(HeroAdminService heroes, ApiPermissions access) { this.heroes = heroes; this.access = access; }

    public record HeroInput(String name, HeroRole role, String imageUrl, String heroGift) {}

    @PostMapping(value="/create", consumes=MediaType.APPLICATION_JSON_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public HeroInfo createJson(@AuthenticationPrincipal Jwt token, @RequestBody HeroInput input) {
        access.admin(token);
        return heroes.create(input.name(), input.role(), input.imageUrl(), null, input.heroGift(), null);
    }

    @PostMapping(value="/create", consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public HeroInfo create(@AuthenticationPrincipal Jwt token, @RequestParam String name, @RequestParam HeroRole role,
            @RequestParam(required=false) String imageUrl, @RequestPart(required=false) MultipartFile image,
            @RequestParam(required=false) String heroGift, @RequestPart(required=false) MultipartFile gift) {
        access.admin(token);
        return heroes.create(name, role, imageUrl, image, heroGift, gift);
    }

    @DeleteMapping("/delete/{id}")
    public HeroInfo remove(@PathVariable int id, @AuthenticationPrincipal Jwt token) {
        access.admin(token);
        return heroes.remove(id);
    }
}
