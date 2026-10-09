package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class RoundRobinPlannerTest {
    @Test
    void twoFourTeamDivisionsProduceTwelveMatchesAcrossThreeConcurrentWeeks() {
        var teams = IntStream.rangeClosed(1,8).mapToObj(id -> new RoundRobinPlanner.Participant(id,id <= 4 ? 10 : 20)).toList();
        var schedule = RoundRobinPlanner.plan(teams,List.of(10,20));
        assertEquals(12,schedule.size());
        assertEquals(Map.of(1,4L,2,4L,3,4L),schedule.stream().collect(Collectors.groupingBy(RoundRobinPlanner.Pairing::week,Collectors.counting())));
        assertEquals(12,schedule.stream().map(p -> Math.min(p.teamAId(),p.teamBId()) + ":" + Math.max(p.teamAId(),p.teamBId())).distinct().count());
        var weeklyTeams = new HashSet<String>();
        for (var match:schedule) {
            assertEquals(match.teamAId() <= 4,match.teamBId() <= 4,"No cross-division regular-season matches");
            assertEquals(match.teamAId() <= 4 ? 10 : 20,match.divisionId());
            assertTrue(weeklyTeams.add(match.week() + ":" + match.teamAId()));
            assertTrue(weeklyTeams.add(match.week() + ":" + match.teamBId()));
        }
        for (int team=1;team<=8;team++) {
            int id=team;
            assertEquals(3,schedule.stream().filter(p -> p.teamAId()==id || p.teamBId()==id).count());
        }
    }

    @Test
    void historicalEightTeamSinglePoolKeepsItsTwentyEightPairings() {
        var teams=IntStream.rangeClosed(1,8).mapToObj(id -> new RoundRobinPlanner.Participant(id,null)).toList();
        var schedule=RoundRobinPlanner.plan(teams,List.of());
        assertEquals(28,schedule.size());
        assertEquals(7,schedule.stream().mapToInt(RoundRobinPlanner.Pairing::week).max().orElseThrow());
        assertTrue(schedule.stream().allMatch(p -> p.divisionId()==null));
    }

    @Test
    void oddDivisionsHaveByesWithoutDuplicateWeeklyAppearances() {
        var teams=IntStream.rangeClosed(1,7).mapToObj(id -> new RoundRobinPlanner.Participant(id,id<=3?10:20)).toList();
        var schedule=RoundRobinPlanner.plan(teams,List.of(10,20));
        assertEquals(9,schedule.size());
        var weeklyTeams=new HashSet<String>();
        for (var match:schedule) {
            assertTrue(weeklyTeams.add(match.week() + ":" + match.teamAId()));
            assertTrue(weeklyTeams.add(match.week() + ":" + match.teamBId()));
        }
        assertEquals(3,schedule.stream().filter(p -> p.divisionId()==10).count());
        assertEquals(6,schedule.stream().filter(p -> p.divisionId()==20).count());
    }

    @Test
    void unassignedOrForeignDivisionTeamsCannotSilentlyEnterTheSchedule() {
        var teams=new ArrayList<>(List.of(new RoundRobinPlanner.Participant(1,10),new RoundRobinPlanner.Participant(2,10),
                new RoundRobinPlanner.Participant(3,20),new RoundRobinPlanner.Participant(4,20)));
        teams.add(new RoundRobinPlanner.Participant(5,null));
        assertThrows(IllegalArgumentException.class,() -> RoundRobinPlanner.plan(teams,List.of(10,20)));
        teams.set(4,new RoundRobinPlanner.Participant(5,30));
        assertThrows(IllegalArgumentException.class,() -> RoundRobinPlanner.plan(teams,List.of(10,20)));
        teams.set(4,new RoundRobinPlanner.Participant(1,20));
        assertThrows(IllegalArgumentException.class,() -> RoundRobinPlanner.plan(teams,List.of(10,20)));
    }

    @Test
    void everyConfiguredDivisionNeedsTwoParticipants() {
        var teams=List.of(new RoundRobinPlanner.Participant(1,10),new RoundRobinPlanner.Participant(2,10));
        assertThrows(IllegalArgumentException.class,() -> RoundRobinPlanner.plan(teams,List.of(10,20)));
    }
}
