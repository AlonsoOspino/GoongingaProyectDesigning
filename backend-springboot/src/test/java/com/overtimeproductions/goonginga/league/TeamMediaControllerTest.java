package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import com.overtimeproductions.goonginga.common.media.ImageStorage;
import com.overtimeproductions.goonginga.draft.access.DraftActor;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;

class TeamMediaControllerTest {
    @TempDir Path media;
    private boolean authorized=true;
    private final ApiPermissions permissions=new ApiPermissions(null) {
        @Override public DraftActor admin(Jwt token) {
            if (!authorized) throw new DraftHttpException(HttpStatus.FORBIDDEN,"Admin required.");
            return new DraftActor(1,Set.of("ADMIN"));
        }
    };
    private TeamMediaController controller() { return new TeamMediaController(permissions,new ImageStorage(media.toString()),"https://api.example.test/"); }
    private static MultipartFile png() {
        return new Upload("image/png",java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=="));
    }

    @Test
    void artworkUploadReturnsPersistentPublicUrlForEachTeamSlot() throws IOException {
        for (String category:Set.of("logo","roster","bannerLeft","bannerRight")) {
            var result=controller().upload(null,png(),category);
            assertEquals(result.get("imageUrl"),result.get("url"));
            assertTrue(result.get("imageUrl").startsWith("https://api.example.test/uploads/teams/"+category+"/"));
            try (var files=Files.list(media.resolve("teams").resolve(category))) {
                assertEquals(1,files.count());
            }
        }
    }

    @Test
    void unsafeCategoryAndUnprivilegedCallerCannotWriteArtwork() throws IOException {
        assertThrows(IllegalArgumentException.class,() -> controller().upload(null,png(),"../../outside"));
        authorized=false;
        assertThrows(DraftHttpException.class,() -> controller().upload(null,png(),"logo"));
        try (var files=Files.list(media)) { assertEquals(0,files.count()); }
    }

    @Test
    void imageBytesMustMatchTheDeclaredTypeAndStayWithinTheUploadLimit() throws IOException {
        assertThrows(IllegalArgumentException.class,() -> controller().upload(null,new Upload("image/png","not an image".getBytes()),"logo"));
        assertThrows(IllegalArgumentException.class,() -> controller().upload(null,new Upload("image/svg+xml","<svg/>".getBytes()),"logo"));
        assertThrows(IllegalArgumentException.class,() -> controller().upload(null,new Upload("image/png",new byte[10*1024*1024+1]),"logo"));
        try (var files=Files.list(media)) { assertEquals(0,files.count()); }
    }

    @Test
    void urlsPreserveReverseProxyPrefixAndUseRelativeApiPathsWithoutConfiguredOrigin() {
        var relative=new TeamMediaController(permissions,new ImageStorage(media.toString()),"").upload(null,png(),"logo");
        assertTrue(relative.get("imageUrl").startsWith("/uploads/teams/logo/"));
        var prefixed=new TeamMediaController(permissions,new ImageStorage(media.toString()),"https://example.test/backend/").upload(null,png(),"logo");
        assertTrue(prefixed.get("imageUrl").startsWith("https://example.test/backend/uploads/teams/logo/"));
    }

    private record Upload(String contentType,byte[] bytes) implements MultipartFile {
        @Override public String getName() { return "image"; }
        @Override public String getOriginalFilename() { return "image.png"; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return bytes.length==0; }
        @Override public long getSize() { return bytes.length; }
        @Override public byte[] getBytes() { return bytes; }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
        @Override public void transferTo(File target) throws IOException { Files.write(target.toPath(),bytes); }
    }
}
