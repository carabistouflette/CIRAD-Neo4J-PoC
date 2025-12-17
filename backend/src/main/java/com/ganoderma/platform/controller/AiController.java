package com.ganoderma.platform.controller;

import com.ganoderma.platform.service.GraphRagService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AiController {

    private final GraphRagService graphRagService;

    @PostMapping("/generate-cypher")
    public Map<String, String> generateCypher(@RequestBody Map<String, String> payload) {
        String prompt = payload.get("prompt");
        if (prompt == null || prompt.trim().isEmpty()) {
            throw new IllegalArgumentException("Prompt cannot be empty");
        }
        String cypher = graphRagService.generateCypher(prompt);
        return Map.of("cypher", cypher);
    }
}
