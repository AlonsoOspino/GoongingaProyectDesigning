package com.overtimeproductions.goonginga.overlay;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/overlay-assets/leaderboard")
public class LeaderboardAssetController {
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final ApiPermissions access;
    public LeaderboardAssetController(JdbcTemplate jdbc,JsonSql json,ApiPermissions access) { this.jdbc=jdbc; this.json=json; this.access=access; }
    private void match(int id) {
        if (id<1 || !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Match\" WHERE id=?)",Boolean.class,id)))
            throw new DraftHttpException(HttpStatus.NOT_FOUND,"Match not found.");
    }
    private JsonNode shared() {
        return json.first("SELECT jsonb_build_object('id',id,'matchId',\"matchId\",'backgroundImageUrl',\"backgroundImageUrl\",'settings',settings,'createdAt',\"createdAt\",'updatedAt',\"updatedAt\")::text FROM public.\"LeaderboardOverlayAsset\" ORDER BY \"updatedAt\" DESC,id DESC LIMIT 1").orElse(null);
    }
    @GetMapping("/{matchId}")
    public Object get(@PathVariable int matchId) {
        match(matchId);
        JsonNode asset=shared();
        if (asset!=null) return asset;
        var empty=new HashMap<String,Object>();
        empty.put("matchId",matchId); empty.put("backgroundImageUrl",null); empty.put("settings",null);
        empty.put("createdAt",null); empty.put("updatedAt",null);
        return empty;
    }
    @PutMapping("/{matchId}") @Transactional
    public JsonNode upsert(@PathVariable int matchId,@AuthenticationPrincipal Jwt token,@RequestBody Map<String,Object> input) {
        access.manager(token); match(matchId);
        if (input.isEmpty() || input.keySet().stream().anyMatch(k -> !k.equals("backgroundImageUrl") && !k.equals("settings")))
            throw new IllegalArgumentException("No valid fields to update.");
        if (input.containsKey("settings") && input.get("settings")!=null && !(input.get("settings") instanceof Map))
            throw new IllegalArgumentException("settings must be an object or null.");
        if (input.containsKey("backgroundImageUrl") && input.get("backgroundImageUrl")!=null && !(input.get("backgroundImageUrl") instanceof String))
            throw new IllegalArgumentException("backgroundImageUrl must be a string or null.");
        JsonNode existing=shared();
        String background=input.containsKey("backgroundImageUrl") ? trim((String) input.get("backgroundImageUrl"))
                : existing==null || existing.get("backgroundImageUrl").isNull()?null:existing.get("backgroundImageUrl").asText();
        String settings=input.containsKey("settings") ? (input.get("settings")==null?null:json.stringify(input.get("settings")))
                : existing==null || existing.get("settings").isNull()?null:json.stringify(existing.get("settings"));
        if (existing==null) {
            jdbc.update("INSERT INTO public.\"LeaderboardOverlayAsset\" (\"matchId\",\"backgroundImageUrl\",settings,\"createdAt\",\"updatedAt\") VALUES (?,?,?::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",matchId,background,settings);
        } else {
            jdbc.update("UPDATE public.\"LeaderboardOverlayAsset\" SET \"backgroundImageUrl\"=?,settings=?::jsonb,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=?",background,settings,existing.get("id").asInt());
        }
        return shared();
    }
    private static String trim(String value) { return value==null || value.isBlank()?null:value.trim(); }
}
