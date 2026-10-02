package com.overtimeproductions.goonginga.draft.migration;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/migrations/legacy-drafts")
public class LegacyDraftMigrationController {
    private final LegacyDraftMigrationService migration;
    private final ApiPermissions permissions;
    public LegacyDraftMigrationController(LegacyDraftMigrationService migration,ApiPermissions permissions) {
        this.migration=migration;this.permissions=permissions;
    }
    @GetMapping public LegacyDraftMigrationService.Report review(@AuthenticationPrincipal Jwt jwt) {
        permissions.admin(jwt); return migration.review();
    }
    @PostMapping public LegacyDraftMigrationService.Report apply(@AuthenticationPrincipal Jwt jwt) {
        permissions.admin(jwt); return migration.apply();
    }
}
