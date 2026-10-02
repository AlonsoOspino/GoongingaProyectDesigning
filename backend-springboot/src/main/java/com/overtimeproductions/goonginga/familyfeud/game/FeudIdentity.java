package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.Arrays;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class FeudIdentity {
    public record Viewer(int id,String accountType,Set<String> roles) {
        public boolean guest() { return "FEUD_GUEST".equals(accountType); }
    }
    private final JdbcTemplate jdbc;
    public FeudIdentity(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Viewer viewer(Jwt jwt,FeudSnapshot game,boolean required) {
        if (jwt==null) {
            if (required) throw new DraftHttpException(HttpStatus.UNAUTHORIZED,"A Family Feud session is required.");
            return null;
        }
        String type=jwt.getClaimAsString("accountType");
        Object claim=jwt.getClaim("id");
        if (!(claim instanceof Number value) || value.longValue()<1 || value.longValue()>Integer.MAX_VALUE
                || type==null || !Set.of("NETWORK_MEMBER","FEUD_GUEST").contains(type))
            throw new DraftHttpException(HttpStatus.UNAUTHORIZED,"Invalid Family Feud session.");
        int id=value.intValue();
        var row=jdbc.query("SELECT \"discordUserId\",roles::text[] AS roles FROM public.\"NetworkMember\" WHERE id=? AND status='ACTIVE'",
                (rs,n) -> new Object[] {rs.getString(1),(String[])rs.getArray(2).getArray()},id).stream().findFirst()
                .orElseThrow(() -> new DraftHttpException(HttpStatus.UNAUTHORIZED,"This Family Feud session has expired."));
        boolean guest="FEUD_GUEST".equals(type);
        if (guest && (!String.valueOf(row[0]).startsWith("FEUD_GUEST:") || game==null
                || !game.game().path("developmentMode").asBoolean()
                || !game.code().equalsIgnoreCase(jwt.getClaimAsString("feudGameCode"))))
            throw new DraftHttpException(HttpStatus.FORBIDDEN,"This development session is not valid for this game.");
        return new Viewer(id,type,Set.copyOf(Arrays.asList((String[])row[1])));
    }
    public boolean manager(FeudSnapshot game,Viewer viewer) {
        return viewer!=null && !viewer.guest() && (game.game().path("managerMemberId").asInt()==viewer.id()
                || viewer.roles().contains("ADMIN") || viewer.roles().contains("SOCIAL_MEDIA"));
    }
    public void requireManager(FeudSnapshot game,Viewer viewer) {
        if (!manager(game,viewer)) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Only the assigned match manager can perform this action.");
    }
}
