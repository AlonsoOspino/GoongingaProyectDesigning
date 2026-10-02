package com.overtimeproductions.goonginga.league;

import java.util.List;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/match")
public class MatchReadController {
    private final MatchQueryService matches;
    public MatchReadController(MatchQueryService matches) { this.matches=matches; }
    @GetMapping public List<JsonNode> all(@RequestParam(required=false) Integer tournamentId,
            @RequestParam(required=false) Integer semanas,@RequestParam(required=false) String type) {
        return matches.all(tournamentId,semanas,type);
    }
    @GetMapping("/soonest") public JsonNode soonest() { return matches.soonest(); }
    @GetMapping("/active") public List<JsonNode> active() { return matches.active(); }
    @GetMapping("/{id}") public JsonNode get(@PathVariable String id) { return matches.get(id); }
}
