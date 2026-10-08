package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.access.*;
import com.overtimeproductions.goonginga.draft.context.*;
import com.overtimeproductions.goonginga.draft.data.*;
import com.overtimeproductions.goonginga.draft.domain.*;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DraftResetService {
    private final DraftStore store;
    private final MatchRepository matches;
    private final DraftCatalog catalog;
    private final DraftAccess access;
    private final FirstPickerPolicy pickers;
    private final Clock clock;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public DraftResetService(DraftStore store, MatchRepository matches, DraftCatalog catalog, DraftAccess access, FirstPickerPolicy pickers, Clock clock, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.store=store; this.matches=matches; this.catalog=catalog; this.access=access; this.pickers=pickers; this.clock=clock;
        this.jdbc=jdbc;
    }

    public MatchInfo reset(int id, DraftActor actor) {
        matches.lockBracketTournament(id);
        var match=matches.lock(id);
        access.requireManager(actor,match);
        var draft=store.exists(id)?store.lockByMatch(id):null;
        if(match.isBracket() && match.playoffRound()!=null) {
            var later=jdbc.queryForList("SELECT id FROM public.\"Match\" WHERE \"tournamentId\"=? AND \"playoffRound\">? ORDER BY id FOR UPDATE",Integer.class,match.tournamentId(),match.playoffRound());
            for(int dependent:later) {
                var next=matches.get(dependent);
                boolean started=store.exists(dependent) && (!store.byMatch(dependent).maps().isEmpty() || store.byMatch(dependent).state().phase()!=DraftPhase.PREPARATION);
                if(!next.status().equals("SCHEDULED") || next.gameNumber()>0 || started || matches.hasLegacyProgress(dependent))
                    throw new DraftRuleViolation("Reset dependent playoff match "+dependent+" first; it has already started.");
            }
            for(int dependent:later) {
                jdbc.update("DELETE FROM spring_draft.draft_sessions WHERE match_id=?",dependent);
                deleteLegacy(dependent);
                jdbc.update("DELETE FROM public.\"PlayerStat\" WHERE \"matchId\"=?",dependent);
                jdbc.update("DELETE FROM public.\"Match\" WHERE id=?",dependent);
            }
        }
        matches.lockTeams(match);
        if(match.mapResults()!=null && match.mapResults().isArray())for(var result:match.mapResults()) {
            if(!result.path("winnerTeamId").isNull() && result.path("winnerTeamId").asInt()>0) {
                int winner=result.path("winnerTeamId").asInt();
                matches.adjustMapStanding(winner,winner==match.teamAId()?match.teamBId():match.teamAId(),-1);
            }
        }
        if(match.status().equals("FINISHED") && match.mapWinsTeamA()!=match.mapWinsTeamB()) {
            int winner=match.mapWinsTeamA()>match.mapWinsTeamB()?match.teamAId():match.teamBId(),loser=winner==match.teamAId()?match.teamBId():match.teamAId();
            if(!match.isBracket())matches.adjustSeriesStanding(winner,loser,-1);
            else {
                jdbc.update("UPDATE public.\"Team\" SET state='ACTIVE' WHERE id=?",loser);
                if(Integer.valueOf(3).equals(match.playoffRound())||match.type().equals("FINALS"))
                    jdbc.update("UPDATE public.\"Tournament\" SET state='FINALS' WHERE id=?",match.tournamentId());
            }
        }
        jdbc.update("DELETE FROM public.\"PlayerStat\" WHERE \"matchId\"=?",id);
        jdbc.update("DELETE FROM spring_draft.practice_display_controls WHERE match_id=?",id);
        jdbc.update("DELETE FROM spring_draft.schedule_notifications WHERE match_id=?",id);
        deleteLegacy(id);
        matches.reset(id);
        var initial = DraftState.newDraft(id,match.teamAId(),match.teamBId(),match.effectiveBestOf(),
                pickers.choose(match,catalog.team(match.teamAId()),catalog.team(match.teamBId())));
        if(draft!=null) store.reset(draft,initial,clock.instant());
        else store.create(matches.get(id),initial,clock.instant());
        return matches.get(id);
    }

    private void deleteLegacy(int matchId) {
        jdbc.update("DELETE FROM public.\"DraftAction\" WHERE \"draftId\" IN (SELECT id FROM public.\"DraftTable\" WHERE \"matchId\"=?)",matchId);
        jdbc.update("DELETE FROM public.\"DraftTable\" WHERE \"matchId\"=?",matchId);
    }
}
