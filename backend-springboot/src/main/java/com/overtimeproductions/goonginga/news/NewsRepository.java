package com.overtimeproductions.goonginga.news;

import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NewsRepository {
    private final JdbcTemplate jdbc;
    public NewsRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<NewsItem> findAll() {
        return jdbc.query("SELECT * FROM public.\"News\" ORDER BY \"updatedAt\" DESC", this::map);
    }

    public Optional<NewsItem> findById(int id) {
        return jdbc.query("SELECT * FROM public.\"News\" WHERE id=?", this::map, id).stream().findFirst();
    }

    public NewsItem insert(String title, String content, String imageUrl) {
        int id = jdbc.queryForObject("INSERT INTO public.\"News\" (title,content,\"imageUrl\") VALUES (?,?,?) RETURNING id",
                Integer.class, title, content, imageUrl);
        return findById(id).orElseThrow();
    }

    public NewsItem update(int id, String title, String content, String imageUrl) {
        jdbc.update("UPDATE public.\"News\" SET title=?,content=?,\"imageUrl\"=?,\"updatedAt\"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=?",
                title, content, imageUrl, id);
        return findById(id).orElseThrow();
    }

    public void remove(int id) { jdbc.update("DELETE FROM public.\"News\" WHERE id=?", id); }

    private NewsItem map(java.sql.ResultSet row, int number) throws java.sql.SQLException {
        return new NewsItem(row.getInt("id"), row.getString("title"), row.getString("content"), row.getString("imageUrl"),
                MatchRepository.instant(row, "createdAt"), MatchRepository.instant(row, "updatedAt"));
    }
}
