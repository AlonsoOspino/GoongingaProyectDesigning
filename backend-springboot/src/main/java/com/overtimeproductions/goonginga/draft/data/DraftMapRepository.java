package com.overtimeproductions.goonginga.draft.data;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DraftMapRepository extends JpaRepository<DraftMapEntity, Long> {
    List<DraftMapEntity> findByDraftSessionIdOrderByMapNumber(long sessionId);
    void deleteByDraftSessionId(long sessionId);
}
