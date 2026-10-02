package com.overtimeproductions.goonginga.draft.data;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** One immutable ban turn. A null heroId means the team passed its turn. */
@Entity
@Table(schema = "spring_draft", name = "draft_bans")
public class DraftBanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "draft_map_id", nullable = false)
    private long draftMapId;

    @Column(name = "turn_number", nullable = false)
    private short turnNumber;

    @Column(name = "team_id", nullable = false)
    private int teamId;

    @Column(name = "hero_id")
    private Integer heroId;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected DraftBanEntity() {
        // Required by JPA.
    }

    public DraftBanEntity(long mapId, int turn, int teamId, Integer heroId, Instant now) {
        this.draftMapId = mapId;
        this.turnNumber = (short) turn;
        this.teamId = teamId;
        this.heroId = heroId;
        this.createdAt = now;
    }

    public Long getId() { return id; }
    public long getDraftMapId() { return draftMapId; }
    public short getTurnNumber() { return turnNumber; }
    public int getTeamId() { return teamId; }
    public Integer getHeroId() { return heroId; }
    public Instant getCreatedAt() { return createdAt; }
}
