package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import lombok.Data;
import lombok.NoArgsConstructor;

@Node
@Data
@NoArgsConstructor
public class Sequence {
    @Id
    private String seqId; // Unique ID (e.g. "Chr1_Gbon")
    private Long length;
    private Boolean circular;
}
