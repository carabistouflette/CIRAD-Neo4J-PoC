package com.ganoderma.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class ChatDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private String message;
        private String model;
        private String scope; // "GLOBAL", "GRAPH", "ENTITY"
        private String entityId;
        private List<String> contextIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private String answer;
        private Object contextUsed; // Returns IDs or sub-graph for verification
        private String cypherQuery; // Optional: Cypher query to update the graph view
    }

}
