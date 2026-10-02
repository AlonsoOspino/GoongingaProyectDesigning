package com.overtimeproductions.goonginga.common.data;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

/** Reads PostgreSQL's JSON representation without changing the Prisma-era column names. */
@Repository
public class JsonSql {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JsonSql(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<JsonNode> list(String sql, Object... args) {
        return jdbc.query(sql, (row, number) -> normalizeDates(json.readTree(row.getString(1))), args);
    }

    public Optional<JsonNode> first(String sql, Object... args) {
        return list(sql, args).stream().findFirst();
    }

    public JsonNode parse(String value) { return json.readTree(value); }
    public String stringify(Object value) { return json.writeValueAsString(value); }

    // PostgreSQL JSON output omits the UTC suffix from Prisma's timestamp columns.
    private JsonNode normalizeDates(JsonNode node) {
        if (node instanceof ObjectNode object) {
            var fields = object.properties().stream().map(java.util.Map.Entry::getKey).toList();
            for (String field : fields) {
                JsonNode value=object.get(field);
                if ((field.endsWith("At") || field.endsWith("Date")) && value != null && value.isTextual()
                        && value.asText().matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?"))
                    object.set(field,StringNode.valueOf(value.asText()+"Z"));
                else if (value != null) normalizeDates(value);
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) normalizeDates(item);
        }
        return node;
    }
}
