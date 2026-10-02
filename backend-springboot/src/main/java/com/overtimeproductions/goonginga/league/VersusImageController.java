package com.overtimeproductions.goonginga.league;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class VersusImageController {
    private final VersusImageService images;
    public VersusImageController(VersusImageService images) {this.images=images;}
    @GetMapping(value="/match/{teamAId}/{teamBId}/vs-image",produces=MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> image(@PathVariable int teamAId,@PathVariable int teamBId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(images.generate(teamAId,teamBId));
    }
}
