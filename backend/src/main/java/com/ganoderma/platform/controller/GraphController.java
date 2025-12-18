package com.ganoderma.platform.controller;

import com.ganoderma.platform.dto.GraphDto;
import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.model.Isolate;
import com.ganoderma.platform.model.Orthogroup;
import com.ganoderma.platform.repository.GeneRepository;
import com.ganoderma.platform.repository.IsolateRepository;
import com.ganoderma.platform.repository.OrthogroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GraphController {

    private final GeneRepository geneRepository;
    private final IsolateRepository isolateRepository;
    private final OrthogroupRepository orthogroupRepository;
    private final org.springframework.data.neo4j.core.Neo4jClient neo4jClient;

    @org.springframework.web.bind.annotation.PostMapping("/cypher")
    public GraphDto executeCypher(@org.springframework.web.bind.annotation.RequestBody Map<String, String> payload) {
        String query = payload.get("query");
        if (query == null || query.trim().isEmpty()) {
            return GraphDto.builder().nodes(new ArrayList<>()).links(new ArrayList<>()).build();
        }

        java.util.Collection<Map<String, Object>> results = neo4jClient.query(query).fetch().all();

        // Use Sets to avoid duplicates when multiple rows return same node/rel
        java.util.Map<String, GraphDto.NodeDto> nodeMap = new HashMap<>(); // Key: ID
        java.util.Map<String, GraphDto.LinkDto> linkMap = new HashMap<>(); // Key: ID (if available) or complex key

        for (Map<String, Object> row : results) {
            for (Object val : row.values()) {
                processResultItem(val, nodeMap, linkMap);
            }
        }

        return GraphDto.builder()
                .nodes(new ArrayList<>(nodeMap.values()))
                .links(new ArrayList<>(linkMap.values()))
                .build();
    }

    private void processResultItem(Object val, Map<String, GraphDto.NodeDto> nodes,
            Map<String, GraphDto.LinkDto> links) {
        if (val instanceof org.neo4j.driver.types.Node) {
            org.neo4j.driver.types.Node n = (org.neo4j.driver.types.Node) val;

            // Determine Type (First label)
            String rawType = n.labels().iterator().hasNext() ? n.labels().iterator().next() : "Unknown";
            String type = rawType;
            // if ("Orthogroup".equals(rawType)) {
            // type = "Pathway"; // Visual proxy for Orthogroup
            // }

            // ID Strategy: Use elementId (Internal Neo4j ID) to ensure consistency with
            // Relationships
            // D3/Vis requires source/target to match node ID exactly.
            String id = n.elementId();
            String name = id; // Default name

            // Determine Name based on properties (but keep ID as technical ID)
            if (n.hasLabel("Isolate") && n.containsKey("name")) {
                name = n.get("name").asString();
            } else if (n.hasLabel("Gene")) {
                name = n.containsKey("symbol") ? n.get("symbol").asString()
                        : (n.containsKey("geneId") ? n.get("geneId").asString() : id);
            } else if (n.hasLabel("Orthogroup") && n.containsKey("groupId")) {
                name = n.get("groupId").asString();
            } else {
                name = n.containsKey("name") ? n.get("name").asString() : id;
            }

            // Details
            Map<String, String> details = new HashMap<>();
            n.keys().forEach(k -> details.put(k, String.valueOf(n.get(k))));

            // CRITICAL: Inject Logical ID for GraphRagService context Retrieval
            String logicalId = id;
            if (n.hasLabel("Isolate") && n.containsKey("name")) {
                logicalId = "ISOLATE_" + n.get("name").asString();
            } else if (n.hasLabel("Gene") && n.containsKey("geneId")) {
                logicalId = "GENE_" + n.get("geneId").asString();
            } else if (n.hasLabel("Orthogroup") && n.containsKey("groupId")) {
                logicalId = "OG_" + n.get("groupId").asString();
            }
            details.put("logicalId", logicalId);

            // Visual Tweaks
            int valSize = type.equals("Isolate") ? 25 : type.equals("Gene") ? 15 : 20;

            GraphDto.NodeDto nodeDto = GraphDto.NodeDto.builder()
                    .id(id) // MUST be elementId to match Relationship source/target
                    .name(name)
                    .type(type)
                    .val(valSize)
                    .description(details.get("description"))
                    .details(details)
                    .build();

            nodes.put(id, nodeDto);

        } else if (val instanceof org.neo4j.driver.types.Relationship) {
            org.neo4j.driver.types.Relationship r = (org.neo4j.driver.types.Relationship) val;
            String sourceId = r.startNodeElementId();
            String targetId = r.endNodeElementId();
            String id = r.elementId();

            GraphDto.LinkDto linkDto = GraphDto.LinkDto.builder()
                    .source(sourceId)
                    .target(targetId)
                    .label(r.type())
                    .build();

            links.put(id, linkDto);

        } else if (val instanceof List) {
            ((List<?>) val).forEach(item -> processResultItem(item, nodes, links));
        } else if (val instanceof org.neo4j.driver.types.Path) {
            org.neo4j.driver.types.Path p = (org.neo4j.driver.types.Path) val;
            p.nodes().forEach(n -> processResultItem(n, nodes, links));
            p.relationships().forEach(r -> processResultItem(r, nodes, links));
        }
    }

    @GetMapping
    public GraphDto getGraph() {
        List<GraphDto.NodeDto> nodes = new ArrayList<>();
        List<GraphDto.LinkDto> links = new ArrayList<>();

        // 1. Fetch all Isolates
        List<Isolate> isolates = isolateRepository.findAll();
        for (Isolate iso : isolates) {
            String isoId = "ISOLATE_" + iso.getName();
            Map<String, String> details = new HashMap<>();
            details.put("Host", iso.getHost());
            details.put("Country", iso.getOriginCountry());
            details.put("Date", iso.getCollectionDate());

            nodes.add(GraphDto.NodeDto.builder()
                    .id(isoId)
                    .name(iso.getName())
                    .type("Isolate")
                    .val(25)
                    .description("Isolate from " + iso.getOriginCountry())
                    .details(details)
                    .build());
        }

        // 2. Fetch all Orthogroups
        List<Orthogroup> orthogroups = orthogroupRepository.findAll();
        for (Orthogroup og : orthogroups) {
            String ogId = "OG_" + og.getGroupId();
            Map<String, String> details = new HashMap<>();
            details.put("Gene Count", String.valueOf(og.getGeneCount()));

            nodes.add(GraphDto.NodeDto.builder()
                    .id(ogId)
                    .name(og.getGroupId())
                    .type("Orthogroup") // Visual proxy for Orthogroup
                    .val(20)
                    .description("Orthologous Group with " + og.getGeneCount() + " genes")
                    .details(details)
                    .build());
        }

        // 3. Fetch all Genes
        List<Gene> genes = geneRepository.findAll();
        for (Gene gene : genes) {
            String geneId = "GENE_" + gene.getGeneId();
            Map<String, String> details = new HashMap<>();
            details.put("Symbol", gene.getSymbol());
            // details.put("Biotype", gene.getBiotype());

            nodes.add(GraphDto.NodeDto.builder()
                    .id(geneId)
                    .name(gene.getSymbol() != null ? gene.getSymbol() : gene.getGeneId())
                    .type("Gene")
                    .val(15)
                    .description(gene.getDescription())
                    .details(details)
                    .build());

            // Link to Isolate
            if (gene.getIsolate() != null) {
                links.add(GraphDto.LinkDto.builder()
                        .source(geneId)
                        .target("ISOLATE_" + gene.getIsolate().getName())
                        .label("FOUND_IN")
                        .build());
            }

            // Link to Orthogroup
            if (gene.getOrthogroup() != null) {
                links.add(GraphDto.LinkDto.builder()
                        .source(geneId)
                        .target("OG_" + gene.getOrthogroup().getGroupId())
                        .label("BELONGS_TO")
                        .build());
            }
        }

        return GraphDto.builder().nodes(nodes).links(links).build();
    }
}
