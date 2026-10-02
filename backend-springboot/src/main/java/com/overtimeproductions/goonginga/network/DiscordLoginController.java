package com.overtimeproductions.goonginga.network;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/network-auth/discord")
public class DiscordLoginController {
    private static final String COOKIE="goonginga_network_oauth_state";
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final SecureRandom random=new SecureRandom();
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final String clientId,clientSecret,guildId,redirectUri,frontend,minigames,secret,cookiePath;
    private final String apiBase,authorizeUrl;
    private final boolean secure;
    public DiscordLoginController(JdbcTemplate jdbc,JsonSql json,
            @Value("${DISCORD_CLIENT_ID:}") String clientId,@Value("${DISCORD_CLIENT_SECRET:}") String clientSecret,
            @Value("${DISCORD_GUILD_ID:}") String guildId,@Value("${DISCORD_REDIRECT_URI:}") String redirectUri,
            @Value("${NETWORK_FRONTEND_URL:}") String frontend,@Value("${NETWORK_MINIGAMES_FRONTEND_URL:}") String minigames,
            @Value("${draft.jwt-secret:}") String secret,@Value("${NETWORK_AUTH_PUBLIC_PATH_PREFIX:}") String prefix,
            @Value("${NODE_ENV:development}") String environment,
            @Value("${discord.api-base-url:https://discord.com/api/v10}") String apiBase,
            @Value("${discord.authorize-url:https://discord.com/oauth2/authorize}") String authorizeUrl) {
        this.jdbc=jdbc; this.json=json; this.clientId=clientId; this.clientSecret=clientSecret; this.guildId=guildId;
        this.redirectUri=redirectUri; this.frontend=frontend; this.minigames=minigames; this.secret=secret;
        this.cookiePath=(prefix.isBlank()?"":("/"+prefix.replaceAll("^/+|/+$", "")))+"/network-auth/discord";
        this.secure="production".equals(environment);
        this.apiBase=apiBase.replaceAll("/+$","");this.authorizeUrl=authorizeUrl;
    }
    private void configured() {
        if (clientId.isBlank() || clientSecret.isBlank() || guildId.isBlank() || redirectUri.isBlank() || frontend.isBlank() || secret.isBlank())
            throw new IllegalStateException("Missing Discord network configuration.");
    }
    private static String encode(String value) { return URLEncoder.encode(value,StandardCharsets.UTF_8); }
    private String frontend(String requested) {
        if (requested==null || requested.isBlank()) return frontend;
        try {
            URI candidate=URI.create(requested);
            String origin=candidate.getScheme()+"://"+candidate.getAuthority();
            if (origin.equals(origin(frontend)) || (!minigames.isBlank() && origin.equals(origin(minigames)))) return origin;
        } catch (RuntimeException ignored) { }
        return frontend;
    }
    private static String origin(String url) { URI u=URI.create(url); return u.getScheme()+"://"+u.getAuthority(); }
    private String cookie(String value,int age) {
        return COOKIE+"="+value+"; Path="+cookiePath+"; Max-Age="+age+"; HttpOnly; SameSite=Lax"+(secure?"; Secure":"");
    }
    private ResponseEntity<Void> redirect(String url,String setCookie) {
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION,url).header(HttpHeaders.SET_COOKIE,setCookie).build();
    }
    private ResponseEntity<Void> error(String base,String message) {
        return redirect(base+"/login?discord_error="+encode(message),cookie("",0));
    }
    @GetMapping
    public ResponseEntity<?> start(@RequestParam(name="return_to",required=false) String requested) {
        try { configured(); } catch (RuntimeException error) { return ResponseEntity.status(503).body(Map.of("message",error.getMessage())); }
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String state=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String destination=frontend(requested);
        String encodedDestination=Base64.getUrlEncoder().withoutPadding().encodeToString(destination.getBytes(StandardCharsets.UTF_8));
        String url=authorizeUrl+"?client_id="+encode(clientId)+"&response_type=code&redirect_uri="+encode(redirectUri)
                +"&scope="+encode("identify guilds.members.read")+"&state="+encode(state)+"&prompt=consent";
        return redirect(url,cookie(state+"."+encodedDestination,600));
    }
    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam(required=false) String code,@RequestParam(required=false) String state,
            @RequestParam(required=false) String error,@CookieValue(value=COOKIE,required=false) String cookie) {
        try { configured(); } catch (RuntimeException failure) { return ResponseEntity.status(503).body(Map.of("message",failure.getMessage())); }
        String destination=frontend;
        String expected="";
        if (cookie!=null) {
            try {
                String saved=java.net.URLDecoder.decode(cookie,StandardCharsets.UTF_8);
                if(saved.startsWith("{")) {
                    JsonNode legacy=json.parse(saved);expected=legacy.path("state").asText("");destination=frontend(legacy.path("frontendUrl").asText(""));
                } else {
                    String[] parts=saved.split("\\.",2);expected=parts[0];
                    if(parts.length==2)destination=frontend(new String(Base64.getUrlDecoder().decode(parts[1]),StandardCharsets.UTF_8));
                }
            } catch(RuntimeException invalid) {expected="";}
        }
        if (error!=null) return error(destination,"Discord authorization was cancelled.");
        if (state==null || expected.isBlank() || !MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8),expected.getBytes(StandardCharsets.UTF_8)))
            return error(destination,"Your Discord login expired. Please try again.");
        if (code==null || code.isBlank()) return error(destination,"Discord did not return an authorization code.");
        try {
            String accessToken=exchange(code);
            JsonNode user=requestJson("/users/@me",accessToken);
            JsonNode guild=requestJson("/users/@me/guilds/"+encode(guildId)+"/member",accessToken);
            if (guild.has("pending") && guild.get("pending").asBoolean())
                return error(destination,"Complete Discord's membership screening for GGL, then try again.");
            String discordId=user.get("id").asText();
            String username=user.hasNonNull("global_name")?user.get("global_name").asText():user.get("username").asText();
            String avatar=avatar(user);
            LocalDateTime joinedAt=LocalDateTime.ofInstant(guild.hasNonNull("joined_at")?Instant.parse(guild.get("joined_at").asText()):Instant.now(),ZoneOffset.UTC);
            int id=upsert(discordId,username,avatar,joinedAt);
            JsonNode member=json.first("SELECT to_jsonb(n)::text FROM (SELECT id,username,\"avatarUrl\",roles,nickname,\"profilePic\",role,\"teamId\" FROM public.\"NetworkMember\" WHERE id=?) n",id).orElseThrow();
            String token=sign(member);
            return redirect(destination+"/login#network_token="+encode(token),cookie("",0));
        } catch (DiscordException failure) {
            if (failure.status==401 || failure.status==403 || failure.status==404)
                return error(destination,"Join the GGL Discord server before registering.");
            return error(destination,"We could not finish your Discord login. Please try again.");
        } catch (RuntimeException failure) {
            return error(destination,"We could not finish your Discord login. Please try again.");
        }
    }
    private String exchange(String code) {
        String form="client_id="+encode(clientId)+"&client_secret="+encode(clientSecret)+"&grant_type=authorization_code&code="+encode(code)+"&redirect_uri="+encode(redirectUri);
        HttpRequest request=HttpRequest.newBuilder(URI.create(apiBase+"/oauth2/token")).timeout(java.time.Duration.ofSeconds(10))
                .header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)).build();
        JsonNode result=send(request);
        if (!result.hasNonNull("access_token")) throw new IllegalStateException("Discord did not return an access token.");
        return result.get("access_token").asText();
    }
    private JsonNode requestJson(String path,String token) {
        return send(HttpRequest.newBuilder(URI.create(apiBase+path)).timeout(java.time.Duration.ofSeconds(10)).header("Authorization","Bearer "+token).GET().build());
    }
    private JsonNode send(HttpRequest request) {
        try {
            HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString());
            if (response.statusCode()<200 || response.statusCode()>=300) throw new DiscordException(response.statusCode());
            return json.parse(response.body());
        } catch (java.io.IOException|InterruptedException failure) {
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new IllegalStateException("Discord is unavailable.",failure);
        }
    }
    private static String avatar(JsonNode user) {
        String id=user.get("id").asText();
        if (user.hasNonNull("avatar")) return "https://cdn.discordapp.com/avatars/"+id+"/"+user.get("avatar").asText()+".png?size=256";
        return "https://cdn.discordapp.com/embed/avatars/"+new java.math.BigInteger(id).mod(java.math.BigInteger.valueOf(6))+".png";
    }
    private int upsert(String discordId,String username,String avatar,LocalDateTime joined) {
        return jdbc.queryForObject("""
                INSERT INTO public."NetworkMember" ("discordUserId",username,"avatarUrl",nickname,"profilePic","discordJoinedGglAt","discordLastVerifiedAt","createdAt","updatedAt")
                VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                ON CONFLICT ("discordUserId") DO UPDATE SET username=EXCLUDED.username,"avatarUrl"=EXCLUDED."avatarUrl",
                  nickname=EXCLUDED.nickname,"profilePic"=EXCLUDED."profilePic",status='ACTIVE'::"NetworkMemberStatus",
                  "discordJoinedGglAt"=EXCLUDED."discordJoinedGglAt","discordLastVerifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
                RETURNING id
                """,Integer.class,discordId,username,avatar,username,avatar,joined);
    }
    private String sign(JsonNode member) {
        long now=Instant.now().getEpochSecond();
        String header=Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        var claims=new java.util.LinkedHashMap<String,Object>();
        for(String field:java.util.List.of("id","username","avatarUrl","roles","nickname","profilePic","role","teamId"))claims.put(field,member.get(field));
        claims.put("accountType","NETWORK_MEMBER");claims.put("iat",now);claims.put("exp",now+7*24*3600);
        String payload=Base64.getUrlEncoder().withoutPadding().encodeToString(json.stringify(claims).getBytes(StandardCharsets.UTF_8));
        String signingInput=header+"."+payload;
        try {
            Mac mac=Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            return signingInput+"."+Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) { throw new IllegalStateException("Could not issue session token.",failure); }
    }
    private static final class DiscordException extends RuntimeException {
        final int status;
        DiscordException(int status) { super("Discord status "+status); this.status=status; }
    }
}
