package com.overtimeproductions.goonginga.draft.data;

import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.Duration;
import com.overtimeproductions.goonginga.draft.domain.DraftState;
import com.overtimeproductions.goonginga.draft.clock.TurnClock;

/** Maps one draft to one existing Match row. The SQL migration owns the table definition. */
@Entity
@Table(schema = "spring_draft", name = "draft_sessions")
public class DraftSessionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false, unique = true)
    private int matchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 32)
    private DraftPhase phase;

    @Column(name = "map_number", nullable = false)
    private int mapNumber;

    @Column(name = "turn_team_id")
    private Integer turnTeamId;

    @Enumerated(EnumType.STRING)
    @Column(name = "selected_map_type", length = 16)
    private MapType selectedMapType;

    @Column(name = "phase_started_at", nullable = false)
    private Instant phaseStartedAt;

    @Column(name = "turn_deadline_at")
    private Instant turnDeadlineAt;

    @Column(name = "paused_at")
    private Instant pausedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    protected DraftSessionEntity() {
        // Required by JPA when reading a row from PostgreSQL.
    }

    public DraftSessionEntity(DraftState state, Instant now) {
        matchId = Math.toIntExact(state.matchId());
        apply(state, now, Duration.ZERO);
    }

    /** A state change starts a new turn; an ordinary read never resets the clock. */
    public void apply(DraftState state, Instant now, Duration broadcastHold) {
        phase = state.phase();
        mapNumber = state.mapNumber();
        turnTeamId = state.turnTeamId() == null ? null : Math.toIntExact(state.turnTeamId());
        selectedMapType = state.selectedMapType();
        phaseStartedAt = now.plus(broadcastHold);
        boolean timed = phase == DraftPhase.MAP_TYPE_SELECTION
                || phase == DraftPhase.MAP_SELECTION || phase == DraftPhase.HERO_BANS;
        turnDeadlineAt = timed ? phaseStartedAt.plus(TurnClock.TURN_LIMIT) : null;
    }

    public void pause(Instant now) {
        if (pausedAt == null) pausedAt = now;
    }

    public void resume(Instant now) {
        if (pausedAt == null) return;
        Duration duration = Duration.between(pausedAt, now);
        phaseStartedAt = phaseStartedAt.plus(duration);
        if (turnDeadlineAt != null) turnDeadlineAt = turnDeadlineAt.plus(duration);
        pausedAt = null;
    }

    public void stopClock() { turnDeadlineAt = null; }

    public Long getId() { return id; }
    public int getMatchId() { return matchId; }
    public DraftPhase getPhase() { return phase; }
    public int getMapNumber() { return mapNumber; }
    public Integer getTurnTeamId() { return turnTeamId; }
    public MapType getSelectedMapType() { return selectedMapType; }
    public Instant getPhaseStartedAt() { return phaseStartedAt; }
    public Instant getTurnDeadlineAt() { return turnDeadlineAt; }
    public Instant getPausedAt() { return pausedAt; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
