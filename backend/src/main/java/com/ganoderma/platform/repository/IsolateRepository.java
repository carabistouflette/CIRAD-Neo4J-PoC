package com.ganoderma.platform.repository;

import com.ganoderma.platform.model.Isolate;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IsolateRepository extends Neo4jRepository<Isolate, Long> {

    Isolate findByName(String name);

    java.util.List<Isolate> findByNameContainingIgnoreCase(String name);

    java.util.List<Isolate> findByHostContainingIgnoreCase(String host);

    java.util.List<Isolate> findByOriginCountryContainingIgnoreCase(String country);
}
