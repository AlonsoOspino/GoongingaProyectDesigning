package com.overtimeproductions.goonginga.draft.data;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import com.overtimeproductions.goonginga.draft.context.DraftCatalog;
import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.context.MatchRepository;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

/** Loads one aggregate and persists only the changes produced by a phase. */
@Repository
public class DraftStore {
    private final DraftSessionRepository sessions;
    private final DraftMapRepository maps;
    private final DraftBanRepository bans;
    private final MatchRepository matches;
    private final DraftCatalog catalog;

    public DraftStore(DraftSessionRepository sessions, DraftMapRepository maps, DraftBanRepository bans,
            MatchRepository matches, DraftCatalog catalog) {
        this.sessions = sessions;
        this.maps = maps;
        this.bans = bans;
        this.matches = matches;
        this.catalog = catalog;
    }

    public LoadedDraft get(long id) {
        var session = sessions.findById(id).orElseThrow(() -> missing());
        return assemble(session, matches.get(session.getMatchId()));
    }

    public LoadedDraft byMatch(int matchId) {
        var session = sessions.findByMatchId(matchId).orElseThrow(() -> missing());
        return assemble(session, matches.get(matchId));
    }

    /** Every writer acquires Match first, then DraftSession, in the same order. */
    public LoadedDraft lock(long id) {
        int matchId = sessions.findMatchId(id).orElseThrow(() -> missing());
        var match = matches.lock(matchId);
        var session = sessions.findLockedById(id).orElseThrow(() -> missing());
        return assemble(session, match);
    }

    public LoadedDraft lockByMatch(int id) {
        var match = matches.lock(id);
        var reference = sessions.findByMatchId(id).orElseThrow(() -> missing());
        return assemble(sessions.findLockedById(reference.getId()).orElseThrow(() -> missing()), match);
    }

    public LoadedDraft create(MatchInfo match, DraftState state, Instant now) {
        var session = sessions.saveAndFlush(new DraftSessionEntity(state, now));
        return assemble(session, match);
    }

    public boolean exists(int matchId) { return sessions.findByMatchId(matchId).isPresent(); }

    public LoadedDraft save(LoadedDraft loaded, DraftState next, Instant now) {
        requireRecordedMaps(loaded);
        var before = loaded.state();
        var current = loaded.currentMap();
        if (before.currentMapId() == null && next.currentMapId() != null) {
            current = maps.saveAndFlush(new DraftMapEntity(loaded.session().getId(), next.mapNumber(),
                    Math.toIntExact(next.currentMapId()), next.selectedMapType(), Math.toIntExact(next.lastPickerTeamId()), now));
        }
        if (next.bans().size() > before.bans().size()) {
            var ban = next.bans().getLast();
            bans.save(new DraftBanEntity(current.getId(), next.bans().size(), Math.toIntExact(ban.teamId()),
                    ban.hero() == null ? null : Math.toIntExact(ban.hero().id()), now));
        }
        if (next.phase() == DraftPhase.PLAYING && before.phase() != DraftPhase.PLAYING) {
            current.startPlaying(now);
            matches.startPlaying(loaded.match().id(), now);
        }
        if (next.results().size() > before.results().size()) {
            var result = next.results().getLast();
            current.recordResult(result.winnerTeamId() == null ? null : Math.toIntExact(result.winnerTeamId()), now);
        }
        Duration hold = before.phase() != next.phase() ? Duration.ofSeconds(5) : Duration.ofSeconds(3);
        loaded.session().apply(next, now, hold);
        if (next.phase() == DraftPhase.FINISHED || next.phase() == DraftPhase.PREPARATION) loaded.session().resume(now);
        sessions.flush();
        return get(loaded.session().getId());
    }

    public LoadedDraft reset(LoadedDraft loaded, DraftState initial, Instant now) {
        maps.deleteByDraftSessionId(loaded.session().getId());
        loaded.session().resume(now);
        loaded.session().apply(initial, now, Duration.ZERO);
        sessions.flush();
        return get(loaded.session().getId());
    }

    public void flush() { sessions.flush(); }

    public LoadedDraft undo(LoadedDraft loaded, DraftState restored, Instant now) {
        requireRecordedMaps(loaded);
        loaded.maps().getLast().undoResult();
        loaded.session().resume(now);
        loaded.session().apply(restored, now, Duration.ZERO);
        sessions.flush();
        return get(loaded.session().getId());
    }

    private LoadedDraft assemble(DraftSessionEntity session, MatchInfo match) {
        var picks = maps.findByDraftSessionIdOrderByMapNumber(session.getId());
        if (session.isSummaryOnlyResult()) {
            int bestOf=match.effectiveBestOf(),requiredWins=(bestOf+1)/2;
            int a=match.mapWinsTeamA(),b=match.mapWinsTeamB();
            boolean emptyResults=match.mapResults()==null || match.mapResults().isNull()
                    || (match.mapResults().isArray() && match.mapResults().isEmpty());
            boolean completedScore=requiredWins>0 && a>=0 && b>=0
                    && ((a==requiredWins && b<requiredWins) || (b==requiredWins && a<requiredWins));
            if (!"FINISHED".equals(match.status()) || session.getPhase()!=DraftPhase.FINISHED || !picks.isEmpty()
                    || match.gameNumber()!=0 || !emptyResults || !completedScore)
                throw new DraftHttpException(HttpStatus.CONFLICT,"The historical series summary is inconsistent. Audit its result before using this match.");
            var state=new DraftState(match.id(),match.teamAId(),match.teamBId(),session.getMapNumber(),bestOf,
                    a,b,DraftPhase.FINISHED,null,null,null,null,java.util.Set.of(),List.of(),List.of());
            return new LoadedDraft(session,match,List.of(),List.of(),state);
        }
        var turns = picks.isEmpty() ? List.<DraftBanEntity>of()
                : bans.findByDraftMapIdInOrderById(picks.stream().map(DraftMapEntity::getId).toList());
        var current = picks.stream().filter(m -> m.getMapNumber() == session.getMapNumber() && m.getResultRecordedAt() == null).findFirst().orElse(null);
        Map<Integer, HeroChoice> heroes = catalog.heroes().stream().collect(Collectors.toMap(h -> h.id(), h -> h.choice()));
        List<BanSelection> activeBans = current == null ? List.of() : turns.stream().filter(b -> b.getDraftMapId() == current.getId())
                .map(b -> new BanSelection(b.getTeamId(), b.getHeroId() == null ? null : heroes.get(b.getHeroId()))).toList();
        var results = picks.stream().filter(m -> m.getResultRecordedAt() != null)
                .map(m -> new MapResult(m.getMapNumber(), m.getMapId(), asLong(m.getWinnerTeamId()))).toList();
        int winsA = (int) results.stream().filter(r -> r.winnerTeamId() != null && r.winnerTeamId() == match.teamAId()).count();
        int winsB = (int) results.stream().filter(r -> r.winnerTeamId() != null && r.winnerTeamId() == match.teamBId()).count();
        if (winsA != match.mapWinsTeamA() || winsB != match.mapWinsTeamB() || results.size() != match.gameNumber()) {
            throw new DraftHttpException(HttpStatus.CONFLICT, "Match score differs from Spring draft history. Complete the data migration before using this match.");
        }
        Long picker = picks.isEmpty() ? null : (long) picks.getLast().getPickerTeamId();
        var state = new DraftState(match.id(), match.teamAId(), match.teamBId(), session.getMapNumber(), match.effectiveBestOf(),
                winsA, winsB, session.getPhase(), asLong(session.getTurnTeamId()), session.getSelectedMapType(),
                current == null ? null : (long) current.getMapId(), picker,
                picks.stream().map(m -> (long) m.getMapId()).collect(Collectors.toSet()), activeBans, results);
        return new LoadedDraft(session, match, picks, turns, state);
    }

    private static Long asLong(Integer value) { return value == null ? null : value.longValue(); }
    private static void requireRecordedMaps(LoadedDraft loaded) {
        if (loaded.session().isSummaryOnlyResult())
            throw new DraftHttpException(HttpStatus.CONFLICT,"This historical series has only a recorded final score. Reset it before running a new draft.");
    }
    private static DraftHttpException missing() { return new DraftHttpException(HttpStatus.NOT_FOUND, "Draft not found."); }
}
