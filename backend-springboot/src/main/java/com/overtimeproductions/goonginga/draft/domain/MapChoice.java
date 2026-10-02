package com.overtimeproductions.goonginga.draft.domain;

public record MapChoice(long id, MapType type) {
    public MapChoice {
        if (id <= 0 || type == null) {
            throw new IllegalArgumentException("A map needs a positive id and a type.");
        }
    }
}
