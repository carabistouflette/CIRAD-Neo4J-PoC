package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import lombok.Data;
import lombok.NoArgsConstructor;

@Node
@Data
@NoArgsConstructor
public class Condition {

    @Id
    @GeneratedValue
    private Long id;

    private String name; // e.g. "Arid_Stress_Day3"
    private String description;
    private String factor; // e.g. "Drought"
}
