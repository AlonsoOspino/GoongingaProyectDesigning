package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class TournamentService {
    private final TournamentRepository tournaments;
    private final TeamService teams;
    public TournamentService(TournamentRepository tournaments,TeamService teams) { this.tournaments=tournaments; this.teams=teams; }
    public List<JsonNode> all() { return tournaments.all(); }
    public JsonNode current() { return tournaments.active().or(tournaments::recent)
            .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND,"No tournament found.")); }

    @Transactional
    public JsonNode create(String name,String startDate) {
        return create(name,startDate,null,null,null);
    }

    @Transactional
    public JsonNode create(String name,String startDate,List<String> divisionNames,String teamFormation,Integer targetTeamCount) {
        if (name==null || name.isBlank()) throw new IllegalArgumentException("name is required.");
        tournaments.active().ifPresent(t -> { throw new IllegalArgumentException("Finish " + t.get("name").asText() + " before creating another season."); });
        if (tournaments.nameExists(name)) throw new IllegalArgumentException("Tournament already exists.");
        String formation=teamFormation==null?"DRAFT":teamFormation.trim().toUpperCase(java.util.Locale.ROOT);
        if (!List.of("DRAFT","COMMITTEE").contains(formation)) throw new IllegalArgumentException("teamFormation must be DRAFT or COMMITTEE.");
        if (targetTeamCount!=null && (targetTeamCount<2 || targetTeamCount>128)) throw new IllegalArgumentException("targetTeamCount must be between 2 and 128.");
        List<String> names=divisionNames==null?List.of():divisionNames;
        DivisionService.validateInputs(names.stream().map(n -> new DivisionService.DivisionInput(null,n,List.of())).toList(),java.util.Set.of(),java.util.Set.of());
        int id=tournaments.create(name.trim(),startDate==null || startDate.isBlank()?null:parseDate(startDate));
        tournaments.format(id,formation,targetTeamCount);
        for (int i=0;i<names.size();i++) tournaments.createDivision(id,names.get(i).trim(),i);
        return tournaments.get(id);
    }

    @Transactional
    public JsonNode update(int id,String name,String startDate,String state) {
        JsonNode existing=tournaments.get(id);
        if ("PLAYOFFS".equalsIgnoreCase(state) && !"PLAYOFFS".equals(existing.get("state").asText()))
            throw new IllegalArgumentException("Use the playoff team selection flow to start playoffs.");
        tournaments.update(id,name,startDate==null?null:parseDate(startDate),state);
        return tournaments.get(id);
    }

    @Transactional
    public void remove(int id) { tournaments.get(id); tournaments.remove(id); }

    @Transactional
    public JsonNode startPlayoffs(int id,List<Integer> teamIds) {
        if (id<1 || teamIds==null || teamIds.size()!=8 || new HashSet<>(teamIds).size()!=8 || teamIds.stream().anyMatch(n -> n==null || n<1))
            throw new IllegalArgumentException("Select exactly 8 valid teams for playoffs.");
        tournaments.lock(id);
        JsonNode tournament=tournaments.get(id);
        if (!"ROUNDROBIN".equals(tournament.get("state").asText()))
            throw new IllegalArgumentException("Playoffs can only start from the ROUNDROBIN state.");
        if (tournaments.unfinishedRoundRobin(id)>0)
            throw new IllegalArgumentException("Finish every round robin match before starting playoffs.");
        if (tournaments.hasPlayoffs(id)) throw new IllegalArgumentException("This tournament already has a playoff bracket.");
        List<Integer> seeded=teams.leaderboard(id).stream().map(t -> t.get("id").asInt()).filter(teamIds::contains).toList();
        if (seeded.size()!=8) throw new IllegalArgumentException("Every selected team must belong to this tournament.");
        tournaments.seedTeams(id,seeded);
        for (int slot=0;slot<4;slot++) tournaments.createQuarterfinal(id,seeded.get(slot),seeded.get(7-slot),slot+1);
        tournaments.update(id,null,null,"PLAYOFFS");
        return tournaments.bracket(id);
    }
    public static Instant parseDate(String value) {
        try { return Instant.parse(value); }
        catch (RuntimeException error) {
            try { return LocalDate.parse(value).atStartOfDay().toInstant(ZoneOffset.UTC); }
            catch (RuntimeException ignored) { throw new IllegalArgumentException("startDate must be a valid ISO date."); }
        }
    }
}
