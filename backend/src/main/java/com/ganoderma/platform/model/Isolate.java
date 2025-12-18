package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.ArrayList;

@Node
@Data
@NoArgsConstructor
public class Isolate {

    @Id
    @GeneratedValue
    private Long id;

    private String name; // e.g. "G. boninense G3"
    private String originCountry; // e.g. "Cameroon"
    private String host; // e.g. "Oil Palm"
    private String collectionDate;

    // Relations
    // @Relationship(type = "HAS_ASSEMBLY", direction =
    // Relationship.Direction.OUTGOING)
    // private Assembly assembly;

    // Shortcuts for quick stats (optional, depends on depth)
    // @Relationship(type = "HAS_GENE", direction = Relationship.Direction.OUTGOING)
    // private List<Gene> genes;
}
