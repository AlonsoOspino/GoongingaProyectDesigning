package com.overtimeproductions.goonginga.league;

import static org.junit.jupiter.api.Assertions.*;

import com.overtimeproductions.goonginga.draft.api.DraftHttpException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class TeamSeasonSafetyTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final Teams teams=new Teams();
    private final Seasons seasons=new Seasons();
    private final DivisionService divisions=new DivisionService(null,null,seasons) {
        @Override public boolean configured(int id) { return true; }
        @Override public boolean hasSchedule(int id) { return false; }
        @Override public void validateAssignment(int id,Integer division) {}
    };
    private final TeamService service=new TeamService(teams,divisions,seasons);

    @Test
    void namesAreTrimmedAndDuplicateOrBlankNamesAreRejectedBeforeWriting() {
        service.update(1,Map.of("name","  New Name  "),null);
        assertEquals("New Name",teams.updated.get("name"));
        assertThrows(IllegalArgumentException.class,() -> service.create("  OTHER TEAM  ",9,null,null,null,null,null,10));
        assertThrows(IllegalArgumentException.class,() -> service.update(1,Map.of("name","  "),null));
    }

    @Test
    void assignedPlayersOrMatchesPreventMovingAndDeletingTheTeam() {
        teams.references=true;
        assertThrows(DraftHttpException.class,() -> service.update(1,Map.of("tournamentId",10,"divisionId",20),null));
        assertThrows(DraftHttpException.class,() -> service.remove(1));
        assertFalse(teams.removed);
        assertNull(teams.updated);
    }

    @Test
    void artworkCanBeUpdatedAfterSchedulingWithoutMovingRosterOrDivision() {
        teams.references=true;
        service.update(1,Map.of("logo","/uploads/teams/logo/a.png","bannerLeft","/uploads/teams/bannerLeft/b.png","bannerRight","/uploads/teams/bannerRight/c.png","roster","/uploads/teams/roster/d.png"),null);
        assertEquals(4,teams.updated.size());
        assertThrows(IllegalArgumentException.class,() -> service.update(1,Map.of("logo",5),null));
    }

    @Test
    void finishedSeasonCannotReceiveNewTeams() {
        seasons.state="FINISHED";
        assertThrows(IllegalArgumentException.class,() -> service.create("New Team",9,null,null,null,null,null,10));
        assertThrows(IllegalArgumentException.class,() -> service.createMany(4,9,"Team"));
    }

    private class Teams extends TeamRepository {
        boolean references,removed;
        Map<String,Object> updated;
        Teams() { super(null,null); }
        @Override public JsonNode get(int id) { return mapper.readTree("{\"id\":1,\"name\":\"Original\",\"tournamentId\":9,\"divisionId\":10}"); }
        @Override public List<JsonNode> all(boolean dev) { return List.of(get(1),mapper.readTree("{\"id\":2,\"name\":\"Other Team\"}")); }
        @Override public boolean hasSeasonReferences(int id) { return references; }
        @Override public void update(int id,Map<String,Object> input) { updated=input; }
        @Override public void remove(int id) { removed=true; }
    }
    private class Seasons extends TournamentRepository {
        String state="SCHEDULED";
        Seasons() { super(null,null,null); }
        @Override public void lock(int id) {}
        @Override public JsonNode get(int id) { return mapper.readTree("{\"id\":"+id+",\"state\":\""+state+"\"}"); }
    }
}
