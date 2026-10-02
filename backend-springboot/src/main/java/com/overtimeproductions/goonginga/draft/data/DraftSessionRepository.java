package com.overtimeproductions.goonginga.draft.data;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

public interface DraftSessionRepository extends JpaRepository<DraftSessionEntity, Long> {
    Optional<DraftSessionEntity> findByMatchId(int matchId);

    @Query("select d.matchId from DraftSessionEntity d where d.id = :id")
    Optional<Integer> findMatchId(long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DraftSessionEntity d where d.id = :id")
    Optional<DraftSessionEntity> findLockedById(long id);

    @Query("select d.id from DraftSessionEntity d where d.pausedAt is null and d.turnDeadlineAt <= :now order by d.turnDeadlineAt")
    List<Long> findDueIds(Instant now, Pageable limit);
}
