package com.overtimeproductions.goonginga.common.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;

/** Keeps uploaded binary files outside the image, under the mounted media volume. */
@Component
public class ImageStorage {
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", "png", "image/jpeg", "jpg", "image/jpg", "jpg",
            "image/webp", "webp", "image/gif", "gif", "image/avif", "avif");
    private final Path root;

    public ImageStorage(@Value("${media.root:uploads}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }

    public String store(String category, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("An image is required.");
        if (file.getSize() > 10 * 1024 * 1024) throw new IllegalArgumentException("Image exceeds 10 MB.");
        String extension = EXTENSIONS.get(file.getContentType());
        if (extension == null) throw new IllegalArgumentException("Unsupported image format.");
        try {
            byte[] bytes = file.getBytes();
            if (!matches(extension, bytes)) throw new IllegalArgumentException("Image data does not match its media type.");
            Path target = root.resolve(category).resolve(UUID.randomUUID() + "." + extension).normalize();
            if (!target.startsWith(root)) throw new IllegalArgumentException("Invalid image path.");
            Files.createDirectories(target.getParent());
            Files.write(target, bytes, StandardOpenOption.CREATE_NEW);
            return "/assets/" + category + "/" + target.getFileName();
        } catch (IOException error) {
            throw new DraftHttpException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save image.");
        }
    }

    public String storeUpload(String category, MultipartFile file) {
        return store(category,file).replaceFirst("^/assets/", "/uploads/");
    }

    public void deleteStored(String category, String publicPath) {
        String prefix = "/assets/" + category + "/";
        if (publicPath == null || !publicPath.startsWith(prefix)) return;
        String name = publicPath.substring(prefix.length());
        if (name.contains("/") || name.contains("\\") || name.isBlank()) return;
        Path target = root.resolve(category).resolve(name).normalize();
        if (!target.startsWith(root)) return;
        try { Files.deleteIfExists(target); } catch (IOException ignored) { }
    }

    private static boolean matches(String extension, byte[] b) {
        if (extension.equals("png")) return b.length > 8 && u(b,0)==0x89 && u(b,1)==0x50 && u(b,2)==0x4e && u(b,3)==0x47;
        if (extension.equals("jpg")) return b.length > 3 && u(b,0)==0xff && u(b,1)==0xd8 && u(b,2)==0xff;
        if (extension.equals("gif")) return b.length > 6 && b[0]=='G' && b[1]=='I' && b[2]=='F' && b[3]=='8';
        if (extension.equals("webp")) return b.length > 12 && b[0]=='R' && b[1]=='I' && b[2]=='F' && b[3]=='F'
                && b[8]=='W' && b[9]=='E' && b[10]=='B' && b[11]=='P';
        return b.length > 12 && b[4]=='f' && b[5]=='t' && b[6]=='y' && b[7]=='p'
                && b[8]=='a' && b[9]=='v' && b[10]=='i' && b[11]=='f';
    }
    private static int u(byte[] bytes, int i) { return bytes[i] & 0xff; }
}
