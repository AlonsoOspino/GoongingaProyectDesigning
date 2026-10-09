package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;

@Repository
public class TeamRepository {
    private static final String READ = "SELECT (to_jsonb(team) || jsonb_build_object('divisionName',d.name))::text FROM public.\"Team\" team LEFT JOIN public.\"TournamentDivision\" d ON d.id=team.\"divisionId\" ";
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public TeamRepository(JdbcTemplate jdbc, JsonSql json) { this.jdbc = jdbc; this.json = json; }

    public List<JsonNode> all(boolean includeDev) {
        return json.list(READ + "JOIN public.\"Tournament\" tournament ON tournament.id=team.\"tournamentId\" "
                + (includeDev ? "" : "WHERE tournament.name <> 'GGL Developer Draft App' ") + "ORDER BY team.id");
    }
    public List<JsonNode> forTournament(int tournamentId) {
        return json.list(READ + "WHERE team.\"tournamentId\"=? ORDER BY team.id", tournamentId);
    }
    public JsonNode get(int id) {
        return json.first(READ + "WHERE team.id=?", id)
                .orElseThrow(() -> new DraftHttpException(HttpStatus.NOT_FOUND, "Team not found."));
    }
    public boolean isCaptain(int memberId, int teamId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM public."SeasonPlayer" sp
                JOIN public."Tournament" t ON t.id=sp."tournamentId"
                WHERE sp."memberId"=? AND sp."teamId"=? AND sp.role='CAPTAIN'
                  AND t.state <> 'FINISHED')
                """, Boolean.class, memberId, teamId));
    }
    public int create(String name, int tournamentId, String logo, String roster, String bannerLeft,String bannerRight,String discordRoleId,Integer divisionId) {
        return jdbc.queryForObject("INSERT INTO public.\"Team\" (name,\"tournamentId\",logo,roster,\"bannerLeft\",\"bannerRight\",\"discordRoleId\",\"divisionId\") VALUES (?,?,?,?,?,?,?,?) RETURNING id",
                Integer.class, name, tournamentId, logo, roster,bannerLeft,bannerRight,discordRoleId,divisionId);
    }
    public int create(String name,int tournamentId,String logo,String roster,String bannerLeft,String bannerRight,String discordRoleId) {
        return create(name,tournamentId,logo,roster,bannerLeft,bannerRight,discordRoleId,null);
    }
    private static final Map<String,String> MUTABLE = Map.ofEntries(
            Map.entry("name", "name"), Map.entry("logo", "logo"), Map.entry("roster", "roster"),
            Map.entry("state", "state"), Map.entry("victories", "victories"), Map.entry("defeats", "defeats"),
            Map.entry("mapWins", "\"mapWins\""), Map.entry("mapLoses", "\"mapLoses\""),
            Map.entry("playoffSeed", "\"playoffSeed\""), Map.entry("discordRoleId", "\"discordRoleId\""),
            Map.entry("divisionId", "\"divisionId\""),
            Map.entry("bannerLeft", "\"bannerLeft\""), Map.entry("bannerRight", "\"bannerRight\""),
            Map.entry("tournamentId", "\"tournamentId\""));
    public void update(int id, Map<String,Object> fields) {
        var clauses = new ArrayList<String>();
        var args = new ArrayList<Object>();
        for (var entry : fields.entrySet()) {
            String column = MUTABLE.get(entry.getKey());
            if (column == null) throw new IllegalArgumentException("Unknown team field: " + entry.getKey());
            clauses.add(column + "=?" + (entry.getKey().equals("state") ? "::\"TeamState\"" : ""));
            args.add(entry.getValue());
        }
        if (clauses.isEmpty()) throw new IllegalArgumentException("No team fields supplied.");
        args.add(id);
        jdbc.update("UPDATE public.\"Team\" SET " + String.join(",", clauses) + " WHERE id=?", args.toArray());
    }
    public void remove(int id) { jdbc.update("DELETE FROM public.\"Team\" WHERE id=?", id); }
    public List<JsonNode> roundRobinResults(Integer tournamentId) {
        String where = tournamentId == null ? "JOIN public.\"Tournament\" t ON t.id=m.\"tournamentId\" WHERE t.name <> 'GGL Developer Draft App'" : "WHERE m.\"tournamentId\"=?";
        return json.list("SELECT jsonb_build_object('teamAId',m.\"teamAId\",'teamBId',m.\"teamBId\",'mapWinsTeamA',m.\"mapWinsTeamA\",'mapWinsTeamB',m.\"mapWinsTeamB\")::text "
                + "FROM public.\"Match\" m " + where + " AND m.type='ROUNDROBIN' AND m.status='FINISHED'",
                tournamentId == null ? new Object[] {} : new Object[] { tournamentId });
    }
}
