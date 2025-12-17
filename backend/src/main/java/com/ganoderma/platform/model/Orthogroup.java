package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Node
@Data
@NoArgsConstructor
public class Orthogroup {

    @Id
    private String groupId; // e.g. "OG000001"

    private Integer geneCount;

    // In strict SDN 6+, we usually control relationships from one side, often the
    // "Many" side or the Aggregate root.
    // Genes point to Orthogroup via BELONGS_TO_OG.
    // We can list them here if we want bi-directional traversal in Java object
    // graph.
    @Relationship(type = "BELONGS_TO_OG", direction = Relationship.Direction.INCOMING)
    private List<Gene> genes;
}
