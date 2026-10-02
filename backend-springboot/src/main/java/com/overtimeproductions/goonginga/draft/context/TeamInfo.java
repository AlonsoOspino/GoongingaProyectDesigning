package com.overtimeproductions.goonginga.draft.context;

public record TeamInfo(int id, String name, String logo, String bannerLeft, String bannerRight,
        int tournamentId, int victories, int defeats, int mapWins, int mapLoses, Integer playoffSeed) {}
