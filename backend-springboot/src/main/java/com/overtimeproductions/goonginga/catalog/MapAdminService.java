package com.overtimeproductions.goonginga.catalog;

import com.overtimeproductions.goonginga.common.media.ImageStorage;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.MapInfo;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MapAdminService {
    private final JdbcTemplate jdbc;
    private final DraftCatalog catalog;
    private final ImageStorage images;
    public MapAdminService(JdbcTemplate jdbc, DraftCatalog catalog, ImageStorage images) {
        this.jdbc = jdbc; this.catalog = catalog; this.images = images;
    }

    @Transactional
    public MapInfo create(String name, MapType type, String imageUrl, MultipartFile image) {
        String description = required(name, "name");
        if (type == null) throw new IllegalArgumentException("type is required.");
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Map\" WHERE type=?::\"MapType\" AND lower(description)=lower(?))",
                Boolean.class, type.name(), description))) throw new IllegalArgumentException("A map with the same name and type already exists.");
        boolean uploaded = imageUrl == null || imageUrl.isBlank();
        String path = uploaded ? images.store("maps", image) : assetUrl(imageUrl);
        try {
            int id = jdbc.queryForObject("INSERT INTO public.\"Map\" (type,description,\"imgPath\") VALUES (?::\"MapType\",?,?) RETURNING id",
                    Integer.class, type.name(), description, path);
            return catalog.allMaps().stream().filter(m -> m.id() == id).findFirst().orElseThrow();
        } catch (RuntimeException error) {
            if (uploaded) images.deleteStored("maps", path);
            throw error;
        }
    }

    @Transactional
    public MapInfo remove(int id) {
        MapInfo existing = catalog.allMaps().stream().filter(m -> m.id() == id).findFirst()
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "Map not found."));
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM spring_draft.draft_maps WHERE map_id=? AND result_recorded_at IS NULL)",Boolean.class,id)))
            throw new DraftHttpException(HttpStatus.CONFLICT,"This map is selected in an unfinished draft.");
        jdbc.update("DELETE FROM public.\"Map\" WHERE id=?", id);
        afterCommit(() -> images.deleteStored("maps", existing.imgPath()));
        return existing;
    }

    static String required(String value, String label) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required.");
        return value.trim();
    }

    static String assetUrl(String value) {
        String path = required(value, "imageUrl");
        if (!path.startsWith("/") && !path.matches("(?i)^https?://.+")) throw new IllegalArgumentException("imageUrl must be a public path or HTTP URL.");
        return path;
    }

    static void afterCommit(Runnable action) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { action.run(); }
        });
    }
}
