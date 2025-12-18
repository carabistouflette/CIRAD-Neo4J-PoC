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
public class Gene {

    @Id
    private String geneId; // Stable ID, e.g. "Gbon_0001"

    private String symbol;
    private String biotype; // e.g. "protein_coding"
    private String description;

    // Genomic coordinates
    private Long start;
    private Long end;
    private String strand;

    // AI Embedding for Semantic Search
    // Stored as a generic List<Float> to be compatible with Neo4j Vector Index
    private List<Float> embedding;

    // @Relationship(type = "ENCODES", direction = Relationship.Direction.OUTGOING)
    // private Protein protein;

    // @Relationship(type = "HAS_FUNCTION", direction =
    // Relationship.Direction.OUTGOING)
    // private List<FunctionalTerm> functionalTerms = new ArrayList<>();

    @Relationship(type = "BELONGS_TO_OG", direction = Relationship.Direction.OUTGOING)
    private Orthogroup orthogroup;

    // Rich relationship with properties (TPM, Counts)
    // @Relationship(type = "EXPRESSED_IN", direction =
    // Relationship.Direction.OUTGOING)
    // private List<Expression> expressionProfiles = new ArrayList<>();

    // Direct link to Isolate for simpler PoC traversal
    @Relationship(type = "FOUND_IN", direction = Relationship.Direction.OUTGOING)
    private Isolate isolate;
}
