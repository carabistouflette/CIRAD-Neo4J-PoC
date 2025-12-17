package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Node
@Data
@NoArgsConstructor
public class Assembly {
    @Id
    @GeneratedValue
    private Long id;
    private String version;
    private String level; // Scaffold, Chromosome

    @Relationship(type = "COMPOSED_OF", direction = Relationship.Direction.OUTGOING)
    private List<Sequence> sequences;
}
