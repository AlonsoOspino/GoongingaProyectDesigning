package com.overtimeproductions.goonginga.draft.context;

import com.overtimeproductions.goonginga.draft.domain.HeroRole;
import com.overtimeproductions.goonginga.draft.domain.MapChoice;
import com.overtimeproductions.goonginga.draft.domain.MapType;
import com.overtimeproductions.goonginga.draft.domain.DraftRuleViolation;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DraftCatalog {
    private final JdbcTemplate jdbc;

    public DraftCatalog(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<MapInfo> allMaps() {
        return jdbc.query("SELECT * FROM public.\"Map\" ORDER BY type,id", (r, n) ->
                new MapInfo(r.getInt("id"), MapType.valueOf(r.getString("type")), r.getString("description"), r.getString("imgPath")));
    }

    public List<HeroInfo> heroes() {
        return jdbc.query("SELECT * FROM public.\"Hero\" ORDER BY role,id", (r, n) -> {
            String name = r.getString("name");
            if (name == null || name.isBlank()) name = "Hero " + r.getInt("id");
            return new HeroInfo(r.getInt("id"), name, HeroRole.valueOf(r.getString("role")), r.getString("imgPath"), r.getString("heroGift"));
        });
    }

    public HeroInfo hero(int id) {
        return heroes().stream().filter(h -> h.id() == id).findFirst()
                .orElseThrow(() -> new DraftRuleViolation("Hero not found."));
    }

    public List<TeamInfo> teams() {
        return jdbc.query("SELECT * FROM public.\"Team\" ORDER BY id", (r, n) -> new TeamInfo(r.getInt("id"), r.getString("name"),
                r.getString("logo"), r.getString("bannerLeft"), r.getString("bannerRight"), r.getInt("tournamentId"),
                r.getInt("victories"), r.getInt("defeats"), r.getInt("mapWins"), r.getInt("mapLoses"), MatchRepository.integer(r,"playoffSeed")));
    }

    public TeamInfo team(int id) {
        return teams().stream().filter(t -> t.id() == id).findFirst()
                .orElseThrow(() -> new DraftRuleViolation("Team not found."));
    }

    public List<MapInfo> pool(MatchInfo match) {
        // Prisma's implicit join uses A = Map.id and B = Match.id.
        Set<Integer> explicit = new HashSet<>(jdbc.queryForList("SELECT \"A\" FROM public.\"_AllowedMaps\" WHERE \"B\"=?", Integer.class, match.id()));
        Set<Integer> weekly = new HashSet<>();
        if (!match.isBracket() && match.mapsAllowedByRound() != null && match.mapsAllowedByRound().isObject()) {
            for (var round : match.mapsAllowedByRound()) {
                if (round.isArray()) for (var id : round) if (id.canConvertToInt() && id.asInt() > 0) weekly.add(id.asInt());
            }
        }
        return allMaps().stream()
                .filter(m -> explicit.isEmpty() || explicit.contains(m.id()))
                .filter(m -> weekly.isEmpty() || weekly.contains(m.id())).toList();
    }

    public Set<MapChoice> choices(MatchInfo match) {
        return pool(match).stream().map(MapInfo::choice).collect(Collectors.toSet());
    }

    public Set<MapType> availableTypes(MatchInfo match, Set<Long> used, int number) {
        Set<MapType> allowed = number == 1 ? EnumSet.of(MapType.CONTROL)
                : EnumSet.complementOf(EnumSet.of(MapType.CONTROL));
        return pool(match).stream().filter(m -> !used.contains((long) m.id()) && allowed.contains(m.type()))
                .map(MapInfo::type).collect(Collectors.toCollection(() -> EnumSet.noneOf(MapType.class)));
    }
}
