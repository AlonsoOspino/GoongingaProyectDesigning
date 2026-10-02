package com.overtimeproductions.goonginga.draft.preparation;

import com.overtimeproductions.goonginga.draft.context.*;
import java.util.Comparator;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

@Component
public class FirstPickerPolicy {
    private final RandomGenerator random;
    public FirstPickerPolicy(RandomGenerator random) { this.random = random; }

    public long choose(MatchInfo match, TeamInfo a, TeamInfo b) {
        if (match.isBracket()) {
            if (a.playoffSeed() != null && b.playoffSeed() != null && !a.playoffSeed().equals(b.playoffSeed())) {
                return a.playoffSeed() < b.playoffSeed() ? a.id() : b.id();
            }
            var ranking = Comparator.comparingInt(TeamInfo::victories)
                    .thenComparingInt(t -> t.mapWins() - t.mapLoses()).thenComparingInt(TeamInfo::mapWins);
            int difference = ranking.compare(a, b);
            if (difference != 0) return difference > 0 ? a.id() : b.id();
        }
        return random.nextBoolean() ? a.id() : b.id();
    }
}
