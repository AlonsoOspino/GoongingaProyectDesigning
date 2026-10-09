package com.overtimeproductions.goonginga.league;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Plans each division independently; their first rounds share the same week. */
public final class RoundRobinPlanner {
    public record Participant(int teamId, Integer divisionId) {}
    public record Pairing(int teamAId, int teamBId, int week, Integer divisionId) {}

    private RoundRobinPlanner() {}

    public static List<Pairing> plan(List<Participant> teams, List<Integer> divisionIds) {
        if (teams.size() < 2) throw new IllegalArgumentException("At least 2 teams are required for round robin generation.");
        var ids = new HashSet<Integer>();
        for (Participant team : teams) {
            if (team.teamId() < 1 || !ids.add(team.teamId()))
                throw new IllegalArgumentException("Every round robin participant must be a distinct valid team.");
        }
        var groups = new LinkedHashMap<Integer,List<Integer>>();
        if (divisionIds.isEmpty()) {
            groups.put(null, teams.stream().map(Participant::teamId).toList());
        } else {
            for (Integer divisionId : divisionIds) {
                if (divisionId == null || divisionId < 1 || groups.put(divisionId, new ArrayList<>()) != null)
                    throw new IllegalArgumentException("Invalid tournament division.");
            }
            for (Participant team : teams) {
                List<Integer> group = groups.get(team.divisionId());
                if (group == null) throw new IllegalArgumentException("Assign every team to a season division before generating the schedule.");
                group.add(team.teamId());
            }
        }
        var result = new ArrayList<Pairing>();
        for (var group : groups.entrySet()) {
            if (group.getValue().size() < 2)
                throw new IllegalArgumentException("Each division needs at least 2 teams before generating the schedule.");
            result.addAll(pool(group.getValue(), group.getKey()));
        }
        result.sort(java.util.Comparator.comparingInt(Pairing::week));
        return List.copyOf(result);
    }

    private static List<Pairing> pool(List<Integer> teams, Integer divisionId) {
        var rotation = new ArrayList<>(teams);
        if (rotation.size() % 2 != 0) rotation.add(null);
        var result = new ArrayList<Pairing>();
        var pairs = new HashSet<String>();
        for (int round = 0; round < rotation.size() - 1; round++) {
            for (int slot = 0; slot < rotation.size() / 2; slot++) {
                Integer a = rotation.get(slot), b = rotation.get(rotation.size() - 1 - slot);
                if (a == null || b == null) continue;
                if (slot == 0 && round % 2 == 1) { int swap = a; a = b; b = swap; }
                if (!pairs.add(Math.min(a,b) + "-" + Math.max(a,b)))
                    throw new IllegalStateException("Duplicate round robin pairing.");
                result.add(new Pairing(a,b,round + 1,divisionId));
            }
            rotation.add(1, rotation.removeLast());
        }
        if (pairs.size() != teams.size() * (teams.size() - 1) / 2)
            throw new IllegalStateException("Incomplete round robin schedule.");
        return result;
    }
}
