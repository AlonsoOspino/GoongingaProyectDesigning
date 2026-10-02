package com.overtimeproductions.goonginga.draft.api;

import com.overtimeproductions.goonginga.draft.domain.MapType;
import jakarta.validation.constraints.*;
import java.time.Instant;

public final class DraftRequests {
    private DraftRequests() {}
    public record PickType(@NotNull MapType mapType, @Positive Long teamId) {}
    public record PickMap(@NotNull @Positive Integer mapId, @Positive Long teamId) {}
    public record BanHero(@Positive Integer heroId, @Positive Long teamId) {}
    public record Result(@Positive Long winnerTeamId) {}
    public record Pause(@NotNull Boolean paused) {}
    public record Readiness(@Min(0) @Max(1) Integer teamAready, @Min(0) @Max(1) Integer teamBready, Instant startDate) {}
    public record Overlay(MapType focusType, @Positive Integer focusMapId) {}
}
