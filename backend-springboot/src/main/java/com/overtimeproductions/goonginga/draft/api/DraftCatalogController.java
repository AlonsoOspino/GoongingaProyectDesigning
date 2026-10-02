package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.context.*;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The draft screen needs these catalogs; their administration remains in the existing product. */
@RestController
public class DraftCatalogController {
    private final DraftCatalog catalog;
    public DraftCatalogController(DraftCatalog catalog) { this.catalog = catalog; }
    @GetMapping("/map") public List<MapInfo> maps() { return catalog.allMaps(); }
    @GetMapping("/hero") public List<HeroInfo> heroes() { return catalog.heroes(); }
}
