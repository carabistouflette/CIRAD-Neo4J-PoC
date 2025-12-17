package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import lombok.Data;
import lombok.NoArgsConstructor;

@Node
@Data
@NoArgsConstructor
public class Protein {

    @Id
    @GeneratedValue
    private Long id;

    private String proteinId; // e.g. "Gbon_0001.p1"
    private Integer length;
    private String sequence; // Amino acid sequence
    private Double molecularWeight;
}
