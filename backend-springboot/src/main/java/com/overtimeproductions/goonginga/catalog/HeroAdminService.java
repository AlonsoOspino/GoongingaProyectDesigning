package com.overtimeproductions.goonginga.catalog;

import com.overtimeproductions.goonginga.common.media.ImageStorage;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.HeroInfo;
import com.overtimeproductions.goonginga.draft.domain.HeroRole;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HeroAdminService {
    private final JdbcTemplate jdbc;
    private final DraftCatalog catalog;
    private final ImageStorage images;
    public HeroAdminService(JdbcTemplate jdbc, DraftCatalog catalog, ImageStorage images) {
        this.jdbc = jdbc; this.catalog = catalog; this.images = images;
    }

    @Transactional
    public HeroInfo create(String name, HeroRole role, String imageUrl, MultipartFile image, String heroGift, MultipartFile gift) {
        String safeName = MapAdminService.required(name, "name");
        if (role == null) throw new IllegalArgumentException("role is required.");
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Hero\" WHERE lower(name)=lower(?))",
                Boolean.class, safeName))) throw new IllegalArgumentException("A hero with the same name already exists.");
        boolean uploaded = imageUrl == null || imageUrl.isBlank();
        String path = uploaded ? images.store("heroes", image) : MapAdminService.assetUrl(imageUrl);
        boolean giftUploaded = gift != null && !gift.isEmpty() && (heroGift == null || heroGift.isBlank());
        String giftPath = null;
        try {
            giftPath = heroGift != null && !heroGift.isBlank() ? MapAdminService.assetUrl(heroGift)
                    : giftUploaded ? images.store("hero-gifts", gift) : null;
            int id = jdbc.queryForObject("INSERT INTO public.\"Hero\" (name,role,\"imgPath\",\"heroGift\") VALUES (?,?::\"HeroRole\",?,?) RETURNING id",
                    Integer.class, safeName, role.name(), path, giftPath);
            return catalog.heroes().stream().filter(h -> h.id() == id).findFirst().orElseThrow();
        } catch (RuntimeException error) {
            if (uploaded) images.deleteStored("heroes", path);
            if (giftUploaded) images.deleteStored("hero-gifts", giftPath);
            throw error;
        }
    }

    @Transactional
    public HeroInfo remove(int id) {
        HeroInfo existing = catalog.heroes().stream().filter(h -> h.id() == id).findFirst()
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "Hero not found."));
        jdbc.update("DELETE FROM public.\"Hero\" WHERE id=?", id);
        MapAdminService.afterCommit(() -> {
            images.deleteStored("heroes", existing.imgPath());
            images.deleteStored("hero-gifts", existing.heroGift());
        });
        return existing;
    }
}
