package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class DivisionStandingsTest {
    private final ObjectMapper json=new ObjectMapper();
    @Test
    void regularSeasonTableUsesFinishedLeagueMatchesInsteadOfAggregatePlayoffCounters() {
        List<JsonNode> teams=List.of(team(1,1),team(2,2),team(3,3));
        List<JsonNode> results=List.of(match(1,2,3,1),match(3,1,2,3));
        var table=TeamService.regularSeasonStandings(teams,results);
        assertEquals(2,table.get(0).path("victories").asInt());
        assertEquals(0,table.get(0).path("defeats").asInt());
        assertEquals(6,table.get(0).path("mapWins").asInt());
        assertEquals(3,table.get(0).path("mapLoses").asInt());
        assertEquals(1,table.get(1).path("defeats").asInt());
        assertEquals(1,table.get(2).path("defeats").asInt());
        assertEquals(99,teams.get(0).path("victories").asInt(),"Raw team totals are preserved");
        assertEquals(10,table.get(0).path("divisionId").asInt());
    }
    private JsonNode team(int id,int seed) { return json.readTree("{\"id\":"+id+",\"divisionId\":10,\"playoffSeed\":"+seed+",\"victories\":99,\"defeats\":99,\"mapWins\":99,\"mapLoses\":99}"); }
    private JsonNode match(int a,int b,int winsA,int winsB) { return json.readTree("{\"teamAId\":"+a+",\"teamBId\":"+b+",\"mapWinsTeamA\":"+winsA+",\"mapWinsTeamB\":"+winsB+"}"); }
}
