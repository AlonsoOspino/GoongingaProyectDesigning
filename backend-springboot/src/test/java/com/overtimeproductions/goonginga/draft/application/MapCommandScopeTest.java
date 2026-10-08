package com.overtimeproductions.goonginga.draft.application;

import static org.junit.jupiter.api.Assertions.*;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class MapCommandScopeTest {
    private DraftState pending(int number, long map) {
        return DraftState.newDraft(8,11,12,5,11).toBuilder().mapNumber(number)
                .phase(DraftPhase.RESULT_PENDING).currentMapId(map).build();
    }
    @Test void staleLogCannotMutateLaterRoundOnTheSameMap() {
        var error = assertThrows(DraftHttpException.class, () -> MapCommandScope.require(pending(2,81),1,81));
        assertEquals(HttpStatus.CONFLICT,error.status());
    }
    @Test void resetThenDifferentMapRejectsTheOldLog() {
        assertThrows(DraftHttpException.class, () -> MapCommandScope.require(pending(1,82),1,81));
    }
    @Test void exactMapAndExistingManagerRequestsAreAccepted() {
        assertDoesNotThrow(() -> MapCommandScope.require(pending(1,81),1,81));
        assertDoesNotThrow(() -> MapCommandScope.require(pending(1,81),null,null));
    }
    @Test void partialIdentityIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> MapCommandScope.require(pending(1,81),1,null));
        assertThrows(IllegalArgumentException.class, () -> MapCommandScope.require(pending(1,81),null,81));
    }
}
