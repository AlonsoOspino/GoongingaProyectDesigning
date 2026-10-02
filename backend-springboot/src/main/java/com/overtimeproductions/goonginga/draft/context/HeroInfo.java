package com.overtimeproductions.goonginga.draft.context;

import com.overtimeproductions.goonginga.draft.domain.HeroChoice;
import com.overtimeproductions.goonginga.draft.domain.HeroRole;

public record HeroInfo(int id, String name, HeroRole role, String imgPath, String heroGift) {
    public HeroChoice choice() { return new HeroChoice(id, role); }
}
