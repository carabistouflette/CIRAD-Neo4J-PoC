package com.ganoderma.platform.controller;

import com.ganoderma.platform.dto.ChatDto;
import com.ganoderma.platform.service.GraphRagService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChatController {

    private final GraphRagService graphRagService;

    @PostMapping
    public ChatDto.Response chat(@RequestBody ChatDto.Request request) {
        return graphRagService.ask(request);
    }
}
