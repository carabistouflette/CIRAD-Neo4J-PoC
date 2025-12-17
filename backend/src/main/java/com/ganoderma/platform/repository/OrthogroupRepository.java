package com.ganoderma.platform.repository;

import com.ganoderma.platform.model.Orthogroup;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrthogroupRepository extends Neo4jRepository<Orthogroup, String> {
}
