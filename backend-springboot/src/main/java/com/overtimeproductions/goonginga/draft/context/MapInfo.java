package com.overtimeproductions.goonginga.draft.context;

import com.overtimeproductions.goonginga.draft.domain.MapChoice;
import com.overtimeproductions.goonginga.draft.domain.MapType;

public record MapInfo(int id, MapType type, String description, String imgPath) {
    public MapChoice choice() { return new MapChoice(id, type); }
}
