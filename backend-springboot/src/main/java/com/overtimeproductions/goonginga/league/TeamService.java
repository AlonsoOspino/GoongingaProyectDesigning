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
import tools.jackson.databind.node.ObjectNode;

@Service
public class TeamService {
    private final TeamRepository teams;
    private final DivisionService divisions;
    private final TournamentRepository tournaments;
    public TeamService(TeamRepository teams,DivisionService divisions,TournamentRepository tournaments) { this.teams = teams; this.divisions=divisions; this.tournaments=tournaments; }
    public List<JsonNode> all(boolean includeDev) { return teams.all(includeDev); }
    public JsonNode get(int id) { return teams.get(id); }

    public List<JsonNode> leaderboard(Integer tournamentId) {
        List<JsonNode> rows = tournamentId == null ? teams.all(false) : teams.forTournament(tournamentId);
        List<JsonNode> results=teams.roundRobinResults(tournamentId);
        boolean divisionSeason=tournamentId!=null && divisions.configured(tournamentId);
        if (divisionSeason) rows=regularSeasonStandings(rows,results);
        var winners = new HashMap<String,Integer>();
        for (JsonNode match : results) {
            int a = match.get("teamAId").asInt(), b = match.get("teamBId").asInt();
            int winsA = match.get("mapWinsTeamA").asInt(), winsB = match.get("mapWinsTeamB").asInt();
            if (winsA != winsB) winners.put(pair(a,b), winsA > winsB ? a : b);
        }
        return rows.stream().sorted((a,b) -> compare(a,b,winners,!divisionSeason)).toList();
    }
    static List<JsonNode> regularSeasonStandings(List<JsonNode> teams,List<JsonNode> matches) {
        var totals=new HashMap<Integer,int[]>();
        for (JsonNode team:teams) totals.put(team.path("id").asInt(),new int[4]);
        for (JsonNode match:matches) {
            int a=match.path("teamAId").asInt(),b=match.path("teamBId").asInt();
            int winsA=match.path("mapWinsTeamA").asInt(),winsB=match.path("mapWinsTeamB").asInt();
            int[] ta=totals.get(a),tb=totals.get(b);
            if (ta==null || tb==null) continue;
            ta[2]+=winsA;ta[3]+=winsB;tb[2]+=winsB;tb[3]+=winsA;
            if (winsA>winsB) {ta[0]++;tb[1]++;} else if (winsB>winsA) {tb[0]++;ta[1]++;}
        }
        return teams.stream().map(team -> {
            ObjectNode row=((ObjectNode)team).deepCopy();
            int[] record=totals.get(team.path("id").asInt());
            row.put("victories",record[0]);row.put("defeats",record[1]);row.put("mapWins",record[2]);row.put("mapLoses",record[3]);
            return (JsonNode)row;
        }).toList();
    }
    private static int compare(JsonNode a, JsonNode b, Map<String,Integer> winners,boolean respectPlayoffSeeds) {
        Integer sa = nullableInt(a,"playoffSeed"), sb = nullableInt(b,"playoffSeed");
        if (respectPlayoffSeeds && (sa != null || sb != null)) {
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
    public JsonNode create(String name, Integer tournamentId, String logo, String roster,String bannerLeft,String bannerRight,String discordRoleId,Integer divisionId) {
        if (name == null || name.isBlank() || tournamentId == null || tournamentId < 1)
            throw new IllegalArgumentException("name and tournamentId are required.");
        if (teams.all(false).stream().anyMatch(t -> name.equals(t.get("name").asText())))
            throw new IllegalArgumentException("Team already exists.");
        tournaments.lock(tournamentId);tournaments.get(tournamentId);
        if (divisions.configured(tournamentId) && divisions.hasSchedule(tournamentId)) throw new IllegalArgumentException("Create season teams before generating the regular-season schedule.");
        divisions.validateAssignment(tournamentId,divisionId);
        return teams.get(teams.create(name.trim(), tournamentId, logo, roster,bannerLeft,bannerRight,discordRoleId,divisionId));
    }

    @Transactional
    public Map<String,Object> createMany(Integer count, Integer tournamentId, String prefix) {
        if (count == null || count < 1 || count > 128 || tournamentId == null || tournamentId < 1)
            throw new IllegalArgumentException("count and tournamentId must be positive integers.");
        String base = prefix == null || prefix.isBlank() ? "Team" : prefix.trim();
        tournaments.lock(tournamentId);tournaments.get(tournamentId);
        if (divisions.configured(tournamentId) && divisions.hasSchedule(tournamentId)) throw new IllegalArgumentException("Create season teams before generating the regular-season schedule.");
        var names = new ArrayList<String>();
        var existing = new HashSet<String>();
        teams.all(false).forEach(t -> existing.add(t.get("name").asText()));
        for (int index=1; names.size()<count; index++) {
            String name = base + " " + index;
            if (existing.add(name)) { teams.create(name,tournamentId,null,null,null,null,null,null); names.add(name); }
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
        int currentSeason=original.path("tournamentId").asInt();
        int nextSeason=fields.containsKey("tournamentId")?positiveInteger(fields.get("tournamentId"),"tournamentId"):currentSeason;
        Integer currentDivision=nullableInt(original,"divisionId");
        Integer nextDivision=fields.containsKey("divisionId")?(fields.get("divisionId")==null?null:positiveInteger(fields.get("divisionId"),"divisionId")):currentDivision;
        if (fields.containsKey("divisionId") || nextSeason!=currentSeason) {
            for (int season:java.util.stream.IntStream.of(currentSeason,nextSeason).distinct().sorted().toArray()) tournaments.lock(season);
            JsonNode locked=teams.get(id);
            if (locked.path("tournamentId").asInt()!=currentSeason) throw new DraftHttpException(HttpStatus.CONFLICT,"The team season changed. Reload before assigning its division.");
            currentDivision=nullableInt(locked,"divisionId");
            if (!fields.containsKey("divisionId")) nextDivision=currentDivision;
            if ((divisions.hasSchedule(currentSeason) || divisions.hasSchedule(nextSeason)) && (nextSeason!=currentSeason || !java.util.Objects.equals(currentDivision,nextDivision)))
                throw new IllegalArgumentException("Team division assignments are locked after the regular-season schedule is created.");
            divisions.validateAssignment(nextSeason,nextDivision);
        }
        teams.update(id,fields);
        return teams.get(id);
    }

    @Transactional
    public void remove(int id) { JsonNode team=teams.get(id);tournaments.lock(team.path("tournamentId").asInt());teams.remove(id); }
    private static int positiveInteger(Object value,String field) {
        if (!(value instanceof Number n) || n.doubleValue()!=Math.rint(n.doubleValue()) || n.intValue()<1)
            throw new IllegalArgumentException(field+" must be a positive integer.");
        return n.intValue();
    }
}
