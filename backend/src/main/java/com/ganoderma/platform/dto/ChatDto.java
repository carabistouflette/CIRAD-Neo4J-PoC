package com.ganoderma.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public class ChatDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private String message;
        private String model; // Optional model selection
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private String answer;
        private Object contextUsed; // Returns IDs or sub-graph for verification
    }
}
