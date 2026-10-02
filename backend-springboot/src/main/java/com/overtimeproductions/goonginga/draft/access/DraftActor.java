package com.overtimeproductions.goonginga.draft.access;

import java.util.Set;

public record DraftActor(int memberId, Set<String> roles) {
    public DraftActor { roles = Set.copyOf(roles); }
    public boolean isManager() { return roles.contains("ADMIN") || roles.contains("SOCIAL_MEDIA"); }
    public boolean isDeveloper() { return roles.contains("DEVELOPER"); }
}
