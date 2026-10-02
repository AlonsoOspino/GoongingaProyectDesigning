package com.overtimeproductions.goonginga.draft.domain;

// A null winner represents a draw.
public record MapResult(int mapNumber, long mapId, Long winnerTeamId) {}
