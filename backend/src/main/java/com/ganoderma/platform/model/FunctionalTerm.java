package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import lombok.Data;
import lombok.NoArgsConstructor;

@Node
@Data
@NoArgsConstructor
public class FunctionalTerm {

    @Id
    private String termId; // e.g. GO:0001234 or PF00012

    private String source; // GO, PFAM, KEGG, INTERPRO
    private String name;
    private String definition;
}
