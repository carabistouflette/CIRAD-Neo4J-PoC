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
                    .type("Pathway") // Using Pathway as a proxy for OG visual style (Black Diamond)
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
