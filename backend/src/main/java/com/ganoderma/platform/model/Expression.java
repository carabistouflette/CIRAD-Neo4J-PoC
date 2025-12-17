package com.ganoderma.platform.model;

import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import lombok.Data;
import lombok.NoArgsConstructor;

@RelationshipProperties
@Data
@NoArgsConstructor
public class Expression {

    @Id
    @GeneratedValue
    private Long id;

    private Double tpm; // Transcripts Per Million
    private Double counts; // Raw or normalized counts

    @TargetNode
    private Sample sample;
}
