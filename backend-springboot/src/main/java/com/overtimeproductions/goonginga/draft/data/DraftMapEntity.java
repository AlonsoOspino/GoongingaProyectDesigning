package com.overtimeproductions.goonginga.draft.data;

import com.overtimeproductions.goonginga.draft.domain.MapType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** One map pick and its eventual result; both belong to the same numbered map. */
@Entity
@Table(schema = "spring_draft", name = "draft_maps")
public class DraftMapEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "draft_session_id", nullable = false)
    private long draftSessionId;

    @Column(name = "map_number", nullable = false)
    private int mapNumber;

    @Column(name = "map_id", nullable = false)
    private int mapId;

    @Enumerated(EnumType.STRING)
    @Column(name = "map_type", length = 16)
    private MapType mapType;

    @Column(name = "picker_team_id", nullable = false)
    private int pickerTeamId;

    @Column(name = "selected_at", nullable = false, insertable = false, updatable = false)
    private Instant selectedAt;

    @Column(name = "play_started_at")
    private Instant playStartedAt;

    @Column(name = "result_recorded_at")
    private Instant resultRecordedAt;

    @Column(name = "winner_team_id")
    private Integer winnerTeamId;

    @Column(name = "is_draw", nullable = false)
    private boolean draw;

    protected DraftMapEntity() {
        // Required by JPA.
    }

    public DraftMapEntity(long sessionId, int number, int mapId, MapType type, int pickerTeamId, Instant now) {
        this.draftSessionId = sessionId;
        this.mapNumber = number;
        this.mapId = mapId;
        this.mapType = type;
        this.pickerTeamId = pickerTeamId;
        this.selectedAt = now;
    }

    public void startPlaying(Instant now) { playStartedAt = now; }

    public void recordResult(Integer winner, Instant now) {
        winnerTeamId = winner;
        draw = winner == null;
        resultRecordedAt = now;
    }

    public void undoResult() {
        winnerTeamId = null;
        draw = false;
        resultRecordedAt = null;
    }

    public Long getId() { return id; }
    public long getDraftSessionId() { return draftSessionId; }
    public int getMapNumber() { return mapNumber; }
    public int getMapId() { return mapId; }
    public MapType getMapType() { return mapType; }
    public int getPickerTeamId() { return pickerTeamId; }
    public Instant getSelectedAt() { return selectedAt; }
    public Instant getPlayStartedAt() { return playStartedAt; }
    public Instant getResultRecordedAt() { return resultRecordedAt; }
    public Integer getWinnerTeamId() { return winnerTeamId; }
    public boolean isDraw() { return draw; }
}
