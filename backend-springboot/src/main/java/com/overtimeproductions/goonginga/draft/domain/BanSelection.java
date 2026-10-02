package com.overtimeproductions.goonginga.draft.domain;

// A null hero represents NO BAN, which still consumes one of the four turns.
public record BanSelection(long teamId, HeroChoice hero) {}
