package com.overtimeproductions.goonginga.familyfeud.questions;

import com.overtimeproductions.goonginga.common.access.ApiPermissions;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/family-feud/questions")
public class FeudQuestionController {
    private final FeudQuestionService questions;
    private final ApiPermissions permissions;
    public FeudQuestionController(FeudQuestionService questions,ApiPermissions permissions) {
        this.questions=questions;this.permissions=permissions;
    }
    @GetMapping public List<JsonNode> list(@AuthenticationPrincipal Jwt jwt) {
        permissions.manager(jwt);return questions.list();
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        return questions.create(input,permissions.manager(jwt).memberId());
    }
    @PostMapping("/import") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> importMany(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> input) {
        return questions.importMany(input,permissions.manager(jwt).memberId());
    }
    @PutMapping("/{id}") public JsonNode update(@AuthenticationPrincipal Jwt jwt,@PathVariable int id,@RequestBody Map<String,Object> input) {
        permissions.manager(jwt);return questions.update(id,input);
    }
    @DeleteMapping("/{id}") public JsonNode remove(@AuthenticationPrincipal Jwt jwt,@PathVariable int id) {
        permissions.manager(jwt);return questions.deactivate(id);
    }
}
