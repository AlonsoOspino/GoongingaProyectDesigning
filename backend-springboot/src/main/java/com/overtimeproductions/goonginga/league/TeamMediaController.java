package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.common.media.ImageStorage;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Team artwork is shared by the public schedule, draft table and stream overlays. */
@RestController
@RequestMapping("/team/admin")
public class TeamMediaController {
    private static final Set<String> CATEGORIES=Set.of("logo","roster","bannerLeft","bannerRight");
    private final ApiPermissions access;
    private final ImageStorage images;
    private final String publicBase;

    public TeamMediaController(ApiPermissions access,ImageStorage images,
            @Value("${PUBLIC_API_BASE_URL:}") String publicBase) {
        this.access=access;this.images=images;this.publicBase=publicBase;
    }

    @PostMapping(value="/upload-image",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String,String> upload(@AuthenticationPrincipal Jwt token,@RequestPart("image") MultipartFile image,
            @RequestParam(defaultValue="logo") String category) {
        access.admin(token);
        if (!CATEGORIES.contains(category)) throw new IllegalArgumentException("category must be logo, roster, bannerLeft or bannerRight.");
        String path=images.storeUpload("teams/"+category,image);
        // Relative API paths preserve reverse-proxy prefixes such as /backend.
        String url=publicBase.isBlank()?path:publicBase.replaceAll("/+$","")+path;
        return Map.of("imageUrl",url,"url",url);
    }
}
