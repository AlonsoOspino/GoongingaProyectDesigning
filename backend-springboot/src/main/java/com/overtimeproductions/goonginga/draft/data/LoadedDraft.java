package com.overtimeproductions.goonginga.draft.data;

import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import java.util.List;

public record LoadedDraft(DraftSessionEntity session, MatchInfo match, List<DraftMapEntity> maps,
        List<DraftBanEntity> bans, DraftState state) {
    public DraftMapEntity currentMap() {
        return maps.stream().filter(m -> m.getMapNumber() == state.mapNumber() && m.getResultRecordedAt() == null)
                .findFirst().orElse(null);
    }
}
