package com.overtimeproductions.goonginga.familyfeud.game;

import java.util.List;
import tools.jackson.databind.JsonNode;

public record FeudSnapshot(JsonNode game,JsonNode manager,List<JsonNode> teams,List<JsonNode> participants,
                           JsonNode round,JsonNode question,List<JsonNode> answers,List<JsonNode> responses,JsonNode faceOff) {
    public JsonNode state() { return game.get("state"); }
    public int id() { return game.get("id").asInt(); }
    public int version() { return game.get("version").asInt(); }
    public String code() { return game.path("code").isNull()?game.get("roomId").asText():game.get("code").asText(); }
    public String phase() { return game.get("status").asText(); }
    public JsonNode team(String side) { return teams.stream().filter(t -> side.equals(t.get("side").asText())).findFirst().orElse(null); }
    public JsonNode participant(int memberId) { return participants.stream().filter(p -> p.get("memberId").asInt()==memberId).findFirst().orElse(null); }
    public JsonNode member(JsonNode participant) { return participant==null?null:participant.get("member"); }
    public String participantSide(JsonNode participant) {
        if (participant==null || participant.path("teamId").isNull()) return null;
        return teams.stream().filter(t -> t.get("id").asInt()==participant.get("teamId").asInt())
                .map(t -> t.get("side").asText()).findFirst().orElse(null);
    }
}
