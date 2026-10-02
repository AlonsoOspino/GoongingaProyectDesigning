package com.overtimeproductions.goonginga.news;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class NewsService {
    private final NewsRepository news;
    public NewsService(NewsRepository news) { this.news = news; }

    @Transactional(readOnly = true)
    public List<NewsItem> all() { return news.findAll(); }

    @Transactional(readOnly = true)
    public NewsItem get(int id) {
        return news.findById(id).orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "News not found."));
    }

    @Transactional
    public NewsItem create(JsonNode data) {
        return news.insert(required(data, "title"), required(data, "content"), optional(data, "imageUrl"));
    }

    @Transactional
    public NewsItem update(int id, JsonNode data) {
        var previous = get(id);
        if (data == null || !data.isObject() || data.isEmpty()) throw new IllegalArgumentException("No valid fields to update.");
        for (var field : data.properties()) {
            if (!List.of("title", "content", "imageUrl").contains(field.getKey())) throw new IllegalArgumentException("Unknown news field.");
        }
        String title = data.has("title") ? required(data, "title") : previous.title();
        String content = data.has("content") ? required(data, "content") : previous.content();
        String image = data.has("imageUrl") ? optional(data, "imageUrl") : previous.imageUrl();
        return news.update(id, title, content, image);
    }

    @Transactional
    public void remove(int id) { get(id); news.remove(id); }

    private static String required(JsonNode data, String field) {
        if (data == null || !data.has(field) || !data.get(field).isTextual() || data.get(field).asText().isBlank()) {
            throw new IllegalArgumentException(field + " is required.");
        }
        return data.get(field).asText().trim();
    }

    private static String optional(JsonNode data, String field) {
        if (data == null || !data.has(field) || data.get(field).isNull()) return null;
        if (!data.get(field).isTextual()) throw new IllegalArgumentException(field + " must be text or null.");
        String value = data.get(field).asText().trim();
        return value.isEmpty() ? null : value;
    }
}
