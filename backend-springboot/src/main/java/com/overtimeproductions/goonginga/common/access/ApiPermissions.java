package com.overtimeproductions.goonginga.common.access;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/** Existing account roles stay in NetworkMember; JWT roles are never trusted. */
@Component
public class ApiPermissions {
    private final DraftAccess access;
    public ApiPermissions(DraftAccess access) { this.access = access; }

    public DraftActor actor(Jwt token) { return access.actor(token); }

    public DraftActor require(Jwt token, String... roles) {
        var actor = actor(token);
        if (Arrays.stream(roles).noneMatch(actor.roles()::contains)) {
            throw new DraftHttpException(HttpStatus.FORBIDDEN, "This role cannot perform the requested action.");
        }
        return actor;
    }

    public DraftActor manager(Jwt token) { return require(token, "ADMIN", "SOCIAL_MEDIA"); }
    public DraftActor admin(Jwt token) { return require(token, "ADMIN"); }
    public DraftActor editor(Jwt token) { return require(token, "ADMIN", "CONTENT_CREATOR"); }
}
