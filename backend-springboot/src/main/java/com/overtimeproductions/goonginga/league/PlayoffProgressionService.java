package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.draft.context.MatchInfo;
import com.overtimeproductions.goonginga.draft.preparation.DraftProvisioningService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayoffProgressionService {
    private final JdbcTemplate jdbc;
    private final DraftProvisioningService drafts;
    public PlayoffProgressionService(JdbcTemplate jdbc, DraftProvisioningService drafts) { this.jdbc=jdbc; this.drafts=drafts; }
    private record Series(int teamA,int teamB,int winsA,int winsB,String status) {
        int winner() { return winsA>winsB?teamA:teamB; }
    }
    private record Pair(int a,int b) {}
    @Transactional
    public void finish(MatchInfo match,int winnerTeamId) {
        if (!match.isBracket()) return;
        int loser=winnerTeamId==match.teamAId()?match.teamBId():match.teamAId();
        jdbc.update("UPDATE public.\"Team\" SET state='ELIMINATED' WHERE id=?",loser);
        boolean finalRound=Integer.valueOf(3).equals(match.playoffRound()) || "FINALS".equals(match.type()) ||
                (match.title()!=null && match.title().toLowerCase().matches(".*grand\\s*final.*"));
        if (finalRound) {
            jdbc.update("UPDATE public.\"Team\" SET state='ACTIVE' WHERE id=?",winnerTeamId);
            jdbc.update("UPDATE public.\"Tournament\" SET state='FINISHED' WHERE id=?",match.tournamentId());
            return;
        }
        if (match.playoffRound()==null || match.playoffRound()>2) return;
        int round=match.playoffRound();
        List<Series> series=jdbc.query("""
                SELECT "teamAId","teamBId","mapWinsTeamA","mapWinsTeamB",status
                FROM public."Match" WHERE "tournamentId"=? AND "playoffRound"=? ORDER BY "playoffSlot"
                """,(r,n)->new Series(r.getInt(1),r.getInt(2),r.getInt(3),r.getInt(4),r.getString(5)),match.tournamentId(),round);
        if (series.size()!=(round==1?4:2)) return;
        var options=new ArrayList<List<Integer>>();var allIds=new HashSet<Integer>();
        for (Series item:series) {
            List<Integer> choices=item.status.equals("FINISHED")?List.of(item.winner()):List.of(item.teamA(),item.teamB());
            options.add(choices);allIds.addAll(choices);
        }
        Map<Integer,Integer> seeds=new HashMap<>();
        for (Map<String,Object> row:jdbc.queryForList("SELECT id,\"playoffSeed\" FROM public.\"Team\" WHERE id=ANY(?::integer[])",
                "{"+allIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","))+"}")) {
            if (row.get("playoffSeed")==null) throw new IllegalStateException("Every playoff team must have a seed.");
            seeds.put(((Number)row.get("id")).intValue(),((Number)row.get("playoffSeed")).intValue());
        }
        var outcomes=new ArrayList<Set<Pair>>();
        enumerate(options,0,new ArrayList<>(),outcomes,seeds);
        if (outcomes.isEmpty()) return;
        var guaranteed=new HashSet<>(outcomes.getFirst());
        for (Set<Pair> possibility:outcomes) guaranteed.retainAll(possibility);
        int nextRound=round+1;
        for (Pair pair:guaranteed) {
            int a=seeds.get(pair.a())<seeds.get(pair.b())?pair.a():pair.b();
            int b=a==pair.a()?pair.b():pair.a();
            boolean exists=Boolean.TRUE.equals(jdbc.queryForObject("""
                    SELECT EXISTS(SELECT 1 FROM public."Match" WHERE "tournamentId"=? AND "playoffRound"=?
                    AND (("teamAId"=? AND "teamBId"=?) OR ("teamAId"=? AND "teamBId"=?)))
                    """,Boolean.class,match.tournamentId(),nextRound,a,b,b,a));
            if (exists) continue;
            boolean grandFinal=nextRound==3;
            int id=jdbc.queryForObject("""
                    INSERT INTO public."Match" (type,title,"playoffRound","playoffSlot","bestOf",status,"tournamentId","teamAId","teamBId")
                    VALUES (?::"MatchType",?,?,?,?, 'SCHEDULED',?,?,?) RETURNING id
                    """,Integer.class,grandFinal?"FINALS":"PLAYOFFS",grandFinal?"Grand Final":"Semifinal",nextRound,seeds.get(a),grandFinal?7:5,match.tournamentId(),a,b);
            jdbc.update("INSERT INTO public.\"_AllowedMaps\" (\"A\",\"B\") SELECT id,? FROM public.\"Map\"",id);
            drafts.ensure(id);
        }
    }
    private static void enumerate(List<List<Integer>> options,int index,List<Integer> current,List<Set<Pair>> outcomes,Map<Integer,Integer> seeds) {
        if (index==options.size()) {
            var ordered=new ArrayList<>(current);ordered.sort(Comparator.comparingInt(seeds::get));
            var pairs=new HashSet<Pair>();
            for (int i=0;i<ordered.size()/2;i++) {
                int a=ordered.get(i),b=ordered.get(ordered.size()-1-i);
                pairs.add(new Pair(Math.min(a,b),Math.max(a,b)));
            }
            outcomes.add(pairs);return;
        }
        for (int choice:options.get(index)) {current.add(choice);enumerate(options,index+1,current,outcomes,seeds);current.removeLast();}
    }
}
