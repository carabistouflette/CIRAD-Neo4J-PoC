package com.ganoderma.platform.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class GraphDto {
    private List<NodeDto> nodes;
    private List<LinkDto> links;

    @Data
    @Builder
    public static class NodeDto {
        private String id;
        private String name;
        private String type; // Gene, Isolate, Orthogroup
        private int val; // size
        private String description;
        private Map<String, String> details;
    }

    @Data
    @Builder
    public static class LinkDto {
        private String source;
        private String target;
        private String label;
    }
}
