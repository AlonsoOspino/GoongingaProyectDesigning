package com.overtimeproductions.goonginga.draft.result;

import com.overtimeproductions.goonginga.draft.access.DraftAccess;
import com.overtimeproductions.goonginga.draft.api.DraftRequests;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class ResultController {
    private final ResultService results;
    private final DraftAccess access;
    private final com.overtimeproductions.goonginga.league.MatchQueryService query;
    public ResultController(ResultService results, DraftAccess access, com.overtimeproductions.goonginga.league.MatchQueryService query) { this.results=results; this.access=access; this.query=query; }

    @PostMapping("/match/{id}/result")
    public tools.jackson.databind.JsonNode record(@PathVariable int id, @AuthenticationPrincipal Jwt token, @Valid @RequestBody DraftRequests.Result request) {
        results.record(id, access.actor(token), request.winnerTeamId());return query.get(String.valueOf(id));
    }

    @PostMapping("/match/{id}/undo-result")
    public tools.jackson.databind.JsonNode undo(@PathVariable int id, @AuthenticationPrincipal Jwt token) { results.undo(id, access.actor(token));return query.get(String.valueOf(id)); }
}
