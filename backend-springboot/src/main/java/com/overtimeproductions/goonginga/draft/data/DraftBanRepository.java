package com.overtimeproductions.goonginga.draft.data;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DraftBanRepository extends JpaRepository<DraftBanEntity, Long> {
    List<DraftBanEntity> findByDraftMapIdInOrderById(Collection<Long> mapIds);
}
