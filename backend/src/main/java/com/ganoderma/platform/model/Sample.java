package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import lombok.Data;
import lombok.NoArgsConstructor;

@Node
@Data
@NoArgsConstructor
public class Sample {

    @Id
    private String sampleId; // e.g. "SRR123456" or "Sample_A_Rep1"

    private Integer replicate; // 1, 2, 3...

    @Relationship(type = "BELONGS_TO_CONDITION", direction = Relationship.Direction.OUTGOING)
    private Condition condition;

    @Relationship(type = "FROM_ISOLATE", direction = Relationship.Direction.OUTGOING)
    private Isolate isolate;
}
