package com.overtimeproductions.goonginga.familyfeud.game;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FeudGuestTokens {
    private final String secret;
    private final JsonSql json;
    public FeudGuestTokens(@Value("${draft.jwt-secret:}") String secret,JsonSql json) { this.secret=secret;this.json=json; }
    public String issue(int id,String code,String name) {
        if (secret.isBlank()) throw new IllegalStateException("Guest sessions are not configured.");
        long now=Instant.now().getEpochSecond();
        String header=Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload=Base64.getUrlEncoder().withoutPadding().encodeToString(json.stringify(Map.of(
                "id",id,"accountType","FEUD_GUEST","guest",true,"feudGameCode",code,"username",name,
                "iat",now,"exp",now+12*3600)).getBytes(StandardCharsets.UTF_8));
        String data=header+"."+payload;
        try {
            Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            return data+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) { throw new IllegalStateException("Could not issue guest session.",failure); }
    }
}
