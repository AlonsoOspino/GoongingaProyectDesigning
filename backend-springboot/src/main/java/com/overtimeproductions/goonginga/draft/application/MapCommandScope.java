package com.overtimeproductions.goonginga.draft.application;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import org.springframework.http.HttpStatus;

/** Prevent a delayed log or another caster's request from acting on a later map. */
public final class MapCommandScope {
    private MapCommandScope() {}
    public static void require(DraftState state, Integer number, Integer mapId) {
        if (number == null && mapId == null) return; // Existing manager clients remain compatible.
        if (number == null || mapId == null || number < 1 || mapId < 1)
            throw new IllegalArgumentException("Provide both expectedGameNumber and expectedMapId.");
        if (state.mapNumber() != number || state.currentMapId() == null || state.currentMapId() != mapId.longValue())
            throw new DraftHttpException(HttpStatus.CONFLICT, "The active round changed. Review this result before retrying.");
    }
}
