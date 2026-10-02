package com.overtimeproductions.goonginga.league;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class TeamService {
    private final TeamRepository teams;
    public TeamService(TeamRepository teams) { this.teams = teams; }
    public List<JsonNode> all(boolean includeDev) { return teams.all(includeDev); }
    public JsonNode get(int id) { return teams.get(id); }

    public List<JsonNode> leaderboard(Integer tournamentId) {
        List<JsonNode> rows = tournamentId == null ? teams.all(false) : teams.forTournament(tournamentId);
        var winners = new HashMap<String,Integer>();
        for (JsonNode match : teams.roundRobinResults(tournamentId)) {
            int a = match.get("teamAId").asInt(), b = match.get("teamBId").asInt();
            int winsA = match.get("mapWinsTeamA").asInt(), winsB = match.get("mapWinsTeamB").asInt();
            if (winsA != winsB) winners.put(pair(a,b), winsA > winsB ? a : b);
        }
        return rows.stream().sorted((a,b) -> compare(a,b,winners)).toList();
    }
    private static int compare(JsonNode a, JsonNode b, Map<String,Integer> winners) {
        Integer sa = nullableInt(a,"playoffSeed"), sb = nullableInt(b,"playoffSeed");
        if (sa != null || sb != null) {
            if (sa == null) return 1;
            if (sb == null) return -1;
            return sa.compareTo(sb);
        }
        int result = Integer.compare(b.get("victories").asInt(), a.get("victories").asInt());
        if (result != 0) return result;
        result = Integer.compare(a.get("defeats").asInt(), b.get("defeats").asInt());
        if (result != 0) return result;
        result = Integer.compare(b.get("mapWins").asInt()-b.get("mapLoses").asInt(), a.get("mapWins").asInt()-a.get("mapLoses").asInt());
        if (result != 0) return result;
        int aid=a.get("id").asInt(), bid=b.get("id").asInt();
        Integer winner=winners.get(pair(aid,bid));
        if (winner != null) return winner == aid ? -1 : 1;
        return Integer.compare(aid,bid);
    }
    static Integer nullableInt(JsonNode row, String field) {
        JsonNode value = row.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }
    private static String pair(int a,int b) { return Math.min(a,b)+"-"+Math.max(a,b); }

    @Transactional
    public JsonNode create(String name, Integer tournamentId, String logo, String roster,String bannerLeft,String bannerRight,String discordRoleId) {
        if (name == null || name.isBlank() || tournamentId == null || tournamentId < 1)
            throw new IllegalArgumentException("name and tournamentId are required.");
        if (teams.all(false).stream().anyMatch(t -> name.equals(t.get("name").asText())))
            throw new IllegalArgumentException("Team already exists.");
        return teams.get(teams.create(name.trim(), tournamentId, logo, roster,bannerLeft,bannerRight,discordRoleId));
    }

    @Transactional
    public Map<String,Object> createMany(Integer count, Integer tournamentId, String prefix) {
        if (count == null || count < 1 || count > 128 || tournamentId == null || tournamentId < 1)
            throw new IllegalArgumentException("count and tournamentId must be positive integers.");
        String base = prefix == null || prefix.isBlank() ? "Team" : prefix.trim();
        var names = new ArrayList<String>();
        var existing = new HashSet<String>();
        teams.all(false).forEach(t -> existing.add(t.get("name").asText()));
        for (int index=1; names.size()<count; index++) {
            String name = base + " " + index;
            if (existing.add(name)) { teams.create(name,tournamentId,null,null,null,null,null); names.add(name); }
        }
        return Map.of("created", names.size(), "names", names);
    }

    @Transactional
    public JsonNode update(int id, Map<String,Object> fields, Integer captainMemberId) {
        JsonNode original = teams.get(id);
        if (captainMemberId != null) {
            if (!teams.isCaptain(captainMemberId,id)) throw new DraftHttpException(HttpStatus.FORBIDDEN,"You are not this team's captain.");
            if (fields.keySet().stream().anyMatch(k -> !List.of("name","logo","roster").contains(k)))
                throw new IllegalArgumentException("Only name, logo and roster can be updated by a captain.");
        }
        teams.update(id,fields);
        return teams.get(id);
    }

    @Transactional
    public void remove(int id) { teams.get(id); teams.remove(id); }
}
