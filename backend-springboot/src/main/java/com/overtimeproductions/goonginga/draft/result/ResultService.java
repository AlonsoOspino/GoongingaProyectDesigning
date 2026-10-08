package com.overtimeproductions.goonginga.draft.result;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.DraftPhase;
import com.overtimeproductions.goonginga.league.PlayoffProgressionService;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ResultService {
    private final DraftStore store;
    private final MatchRepository matches;
    private final DraftAccess access;
    private final ResultPhase rules;
    private final Clock clock;
    private final PlayoffProgressionService playoffs;

    public ResultService(DraftStore store, MatchRepository matches, DraftAccess access, ResultPhase rules, Clock clock, PlayoffProgressionService playoffs) {
        this.store=store; this.matches=matches; this.access=access; this.rules=rules; this.clock=clock; this.playoffs=playoffs;
    }

    public MatchInfo record(int matchId, DraftActor actor, Long winner) {
        return record(matchId, actor, winner, null, null);
    }

    public MatchInfo record(int matchId, DraftActor actor, Long winner, Integer expectedGameNumber, Integer expectedMapId) {
        matches.lockBracketTournament(matchId);
        var draft = store.lockByMatch(matchId);
        access.requireProduction(actor, draft.match());
        com.overtimeproductions.goonginga.draft.application.MapCommandScope.require(draft.state(), expectedGameNumber, expectedMapId);
        var next = rules.recordResult(draft.state(), winner);
        matches.lockTeams(draft.match());
        if (winner != null) matches.adjustMapStanding(Math.toIntExact(winner), Math.toIntExact(next.otherTeam(winner)), 1);
        if (next.phase() == DraftPhase.FINISHED && !draft.match().isBracket()) {
            int seriesWinner = next.winsA() > next.winsB() ? draft.match().teamAId() : draft.match().teamBId();
            matches.adjustSeriesStanding(seriesWinner, Math.toIntExact(next.otherTeam(seriesWinner)), 1);
        }
        matches.syncScore(next);
        store.save(draft, next, clock.instant());
        if (next.phase() == DraftPhase.FINISHED && draft.match().isBracket()) {
            int seriesWinner = next.winsA() > next.winsB() ? draft.match().teamAId() : draft.match().teamBId();
            playoffs.finish(draft.match(), seriesWinner);
        }
        return matches.get(matchId);
    }

    public MatchInfo undo(int matchId, DraftActor actor) {
        matches.lockBracketTournament(matchId);
        var draft = store.lockByMatch(matchId);
        access.requireManager(actor, draft.match());
        var restored = rules.undoResult(draft.state());
        matches.lockTeams(draft.match());
        var last = draft.state().results().getLast();
        if (last.winnerTeamId() != null) matches.adjustMapStanding(Math.toIntExact(last.winnerTeamId()), Math.toIntExact(restored.otherTeam(last.winnerTeamId())), -1);
        matches.syncScore(restored);
        store.undo(draft, restored, clock.instant());
        return matches.get(matchId);
    }
}
