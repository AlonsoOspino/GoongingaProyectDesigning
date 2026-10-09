package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class DivisionService {
    public record DivisionInput(Integer id, String name, List<Integer> teamIds) {}
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    private final TournamentRepository tournaments;

    public DivisionService(JdbcTemplate jdbc, JsonSql json, TournamentRepository tournaments) {
        this.jdbc = jdbc; this.json = json; this.tournaments = tournaments;
    }

    public List<JsonNode> all(int tournamentId) {
        tournaments.get(tournamentId);
        return json.list("SELECT to_jsonb(d)::text FROM public.\"TournamentDivision\" d WHERE \"tournamentId\"=? ORDER BY \"sortOrder\",id", tournamentId);
    }

    public List<Integer> ids(int tournamentId) {
        return jdbc.queryForList("SELECT id FROM public.\"TournamentDivision\" WHERE \"tournamentId\"=? ORDER BY \"sortOrder\",id", Integer.class, tournamentId);
    }

    public boolean configured(int tournamentId) { return !ids(tournamentId).isEmpty(); }

    public boolean hasSchedule(int tournamentId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.\"Match\" WHERE \"tournamentId\"=? AND type='ROUNDROBIN')", Boolean.class, tournamentId));
    }

    /** Called inside the same tournament lock used by schedule generation. */
    public void validateAssignment(int tournamentId, Integer divisionId) {
        if (divisionId != null && (divisionId < 1 || !Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM public.\"TournamentDivision\" WHERE id=? AND \"tournamentId\"=?)", Boolean.class, divisionId, tournamentId))))
            throw new IllegalArgumentException("The selected division does not belong to this season.");
    }

    public void validateMatch(int tournamentId, String type, int a, int b) {
        if (!"ROUNDROBIN".equals(type) || !configured(tournamentId)) return;
        List<Integer> assignments = jdbc.query("SELECT \"divisionId\" FROM public.\"Team\" WHERE \"tournamentId\"=? AND id IN (?,?)",
                (row, index) -> row.getObject(1, Integer.class), tournamentId, a, b);
        requireSameDivision(assignments);
    }

    static void requireSameDivision(List<Integer> assignments) {
        if (assignments.size() != 2 || assignments.get(0) == null || assignments.get(1) == null)
            throw new IllegalArgumentException("Assign both teams to a season division before scheduling a regular-season match.");
        if (!assignments.get(0).equals(assignments.get(1)))
            throw new IllegalArgumentException("Regular-season teams can only play teams in their own division.");
    }

    @Transactional
    public JsonNode replace(int tournamentId, List<DivisionInput> input) {
        tournaments.lock(tournamentId);
        JsonNode tournament = tournaments.get(tournamentId);
        if (!Set.of("SCHEDULED", "ROUNDROBIN").contains(tournament.path("state").asText()) || hasSchedule(tournamentId))
            throw new IllegalArgumentException("Configure divisions before creating the regular-season schedule.");
        Set<Integer> existing = new HashSet<>(ids(tournamentId));
        Set<Integer> teams = new HashSet<>(jdbc.queryForList("SELECT id FROM public.\"Team\" WHERE \"tournamentId\"=?", Integer.class, tournamentId));
        validateInputs(input, existing, teams);
        jdbc.update("UPDATE public.\"Team\" SET \"divisionId\"=NULL WHERE \"tournamentId\"=?", tournamentId);
        // Temporary distinct names allow administrators to swap division names safely.
        jdbc.update("UPDATE public.\"TournamentDivision\" SET name='__division_' || id WHERE \"tournamentId\"=?", tournamentId);
        var retained = new HashSet<Integer>();
        for (int order = 0; order < input.size(); order++) {
            DivisionInput division = input.get(order);
            Integer id = division.id();
            if (id == null) id = jdbc.queryForObject("INSERT INTO public.\"TournamentDivision\" (\"tournamentId\",name,\"sortOrder\") VALUES (?,?,?) RETURNING id",
                    Integer.class, tournamentId, division.name().trim(), order);
            else jdbc.update("UPDATE public.\"TournamentDivision\" SET name=?,\"sortOrder\"=? WHERE id=? AND \"tournamentId\"=?", division.name().trim(), order, id, tournamentId);
            retained.add(id);
            for (int teamId : division.teamIds()) jdbc.update("UPDATE public.\"Team\" SET \"divisionId\"=? WHERE id=? AND \"tournamentId\"=?", id, teamId, tournamentId);
        }
        for (int id : existing) if (!retained.contains(id)) jdbc.update("DELETE FROM public.\"TournamentDivision\" WHERE id=? AND \"tournamentId\"=?", id, tournamentId);
        return tournaments.get(tournamentId);
    }

    static void validateInputs(List<DivisionInput> input, Set<Integer> existing, Set<Integer> seasonTeams) {
        if (input == null || input.size() == 1 || input.size() > 16)
            throw new IllegalArgumentException("Configure at least 2 divisions, or an empty list for a single pool.");
        var names = new HashSet<String>(); var ids = new HashSet<Integer>(); var assigned = new HashSet<Integer>();
        for (DivisionInput division : input) {
            if (division == null || division.name() == null || division.name().isBlank() || division.name().trim().length() > 80
                    || division.name().trim().startsWith("__division_") || !names.add(division.name().trim().toLowerCase(java.util.Locale.ROOT)))
                throw new IllegalArgumentException("Division names must be distinct and contain 1 to 80 characters.");
            if (division.id() != null && (!existing.contains(division.id()) || !ids.add(division.id())))
                throw new IllegalArgumentException("Every division must belong to this season and appear once.");
            if (division.teamIds() == null) throw new IllegalArgumentException("teamIds are required for every division.");
            for (Integer team : division.teamIds()) if (team == null || !seasonTeams.contains(team) || !assigned.add(team))
                throw new IllegalArgumentException("Each assigned team must belong to this season and appear in only one division.");
        }
    }
}
