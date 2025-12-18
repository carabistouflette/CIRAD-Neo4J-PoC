package com.ganoderma.platform.repository;

import com.ganoderma.platform.model.Gene;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface GeneRepository extends Neo4jRepository<Gene, String> {

    Optional<Gene> findByGeneId(String geneId);

    List<Gene> findBySymbolLike(String symbol);

    List<Gene> findBySymbolContainingIgnoreCase(String symbol);

    List<Gene> findByDescriptionContainingIgnoreCase(String description);

    // Custom Query: Find genes in a specific orthogroup
    @Query("MATCH (g:Gene)-[:BELONGS_TO_OG]->(og:Orthogroup {groupId: $groupId}) RETURN g")
    List<Gene> findByOrthogroupId(String groupId);

    // Custom Query: Find genes with high expression in a specific condition
    @Query("MATCH (g:Gene)-[e:EXPRESSED_IN]->(s:Sample)-[:BELONGS_TO_CONDITION]->(c:Condition {name: $conditionName}) "
            +
            "WHERE e.tpm > $minTpm " +
            "RETURN g, e, s")
    List<Gene> findHighlyExpressedInCondition(String conditionName, Double minTpm);
}
