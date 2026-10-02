package com.overtimeproductions.goonginga.practice;

import com.overtimeproductions.goonginga.common.data.JsonSql;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PracticeDisplayRepository {
    public record Display(Integer scoreA,Integer scoreB,List<Integer> bansA,List<Integer> bansB) {}
    private final JdbcTemplate jdbc;
    private final JsonSql json;
    public PracticeDisplayRepository(JdbcTemplate jdbc,JsonSql json) { this.jdbc=jdbc;this.json=json; }
    public Optional<Display> get(int matchId) {
        return jdbc.query("SELECT * FROM spring_draft.practice_display_controls WHERE match_id=?",(rs,n) -> {
            Integer[] a=rs.getArray("team_a_bans")==null?null:(Integer[])rs.getArray("team_a_bans").getArray();
            Integer[] b=rs.getArray("team_b_bans")==null?null:(Integer[])rs.getArray("team_b_bans").getArray();
            return new Display(rs.getObject("score_a",Integer.class),rs.getObject("score_b",Integer.class),
                    a==null?null:List.of(a),b==null?null:List.of(b));
        },matchId).stream().findFirst();
    }
    public void create(int matchId) { jdbc.update("INSERT INTO spring_draft.practice_display_controls (match_id) VALUES (?) ON CONFLICT DO NOTHING",matchId); }
    public void scores(int matchId,int a,int b) {
        create(matchId);jdbc.update("UPDATE spring_draft.practice_display_controls SET score_a=?,score_b=?,updated_at=now() WHERE match_id=?",a,b,matchId);
    }
    public void bans(int matchId,List<Integer> a,List<Integer> b) {
        create(matchId);jdbc.update("""
                UPDATE spring_draft.practice_display_controls SET
                team_a_bans=ARRAY(SELECT jsonb_array_elements_text(?::jsonb)::integer),
                team_b_bans=ARRAY(SELECT jsonb_array_elements_text(?::jsonb)::integer),updated_at=now() WHERE match_id=?
                """,json.stringify(a),json.stringify(b),matchId);
    }
}
