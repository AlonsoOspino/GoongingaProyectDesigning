package com.overtimeproductions.goonginga.news;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/news")
public class NewsController {
    private final NewsService service;
    private final ApiPermissions access;
    public NewsController(NewsService service, ApiPermissions access) { this.service=service; this.access=access; }

    @GetMapping public List<NewsItem> all() { return service.all(); }
    @GetMapping("/{id}") public NewsItem get(@PathVariable int id) { return service.get(id); }

    @PostMapping("/create") @ResponseStatus(HttpStatus.CREATED)
    public NewsItem create(@AuthenticationPrincipal Jwt token, @RequestBody JsonNode data) {
        access.editor(token);
        return service.create(data);
    }

    @PutMapping("/update/{id}")
    public NewsItem update(@PathVariable int id, @AuthenticationPrincipal Jwt token, @RequestBody JsonNode data) {
        access.editor(token);
        return service.update(id, data);
    }

    @DeleteMapping("/delete/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable int id, @AuthenticationPrincipal Jwt token) { access.editor(token); service.remove(id); }
}
