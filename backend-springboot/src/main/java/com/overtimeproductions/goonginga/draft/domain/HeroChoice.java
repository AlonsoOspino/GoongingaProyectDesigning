package com.overtimeproductions.goonginga.draft.domain;

public record HeroChoice(long id, HeroRole role) {
    public HeroChoice {
        if (id <= 0 || role == null) {
            throw new IllegalArgumentException("A hero needs a positive id and a role.");
        }
    }
}
