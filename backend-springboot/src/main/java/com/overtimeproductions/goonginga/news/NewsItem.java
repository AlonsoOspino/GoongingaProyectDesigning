package com.overtimeproductions.goonginga.news;

import java.time.Instant;

public record NewsItem(int id, String title, String content, String imageUrl, Instant createdAt, Instant updatedAt) {}
