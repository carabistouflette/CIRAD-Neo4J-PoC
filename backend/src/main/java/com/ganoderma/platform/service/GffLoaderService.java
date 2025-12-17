package com.ganoderma.platform.service;

import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.model.Isolate;
import com.ganoderma.platform.repository.GeneRepository;
import com.ganoderma.platform.repository.IsolateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GffLoaderService {

    private final GeneRepository geneRepository;
    private final IsolateRepository isolateRepository;

    @Transactional
    public void loadGff(String isolateName, InputStream gffStream) throws Exception {
        log.info("Starting GFF loading for isolate: {}", isolateName);

        // Find or Create Isolate
        Isolate isolate = isolateRepository.findByName(isolateName);
        if (isolate == null) {
            isolate = new Isolate();
            isolate.setName(isolateName);
            isolateRepository.save(isolate);
        }

        // Parse GFF
        List<Gene> genesToSave = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(gffStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("#") || line.trim().isEmpty())
                    continue;

                String[] parts = line.split("\t");
                if (parts.length < 9)
                    continue;

                String type = parts[2];
                if ("gene".equalsIgnoreCase(type)) {
                    Gene gene = parseGeneLine(parts);
                    if (gene != null) {
                        genesToSave.add(gene);
                    }
                }
                // TODO: Handle 'mRNA', 'CDS' to link to Gene parents if needed
            }
        }

        geneRepository.saveAll(genesToSave);
        log.info("Loaded {} genes for isolate {}", genesToSave.size(), isolateName);
    }

    private Gene parseGeneLine(String[] parts) {
        // GFF3 columns: seqid, source, type, start, end, score, strand, phase,
        // attributes
        try {
            Gene gene = new Gene();
            gene.setStart(Long.parseLong(parts[3]));
            gene.setEnd(Long.parseLong(parts[4]));
            gene.setStrand(parts[6]);

            // Parse Attributes (ID=...,Name=...,Description=...)
            Map<String, String> attributes = parseAttributes(parts[8]);

            gene.setGeneId(attributes.getOrDefault("ID", "UNKNOWN_" + System.currentTimeMillis()));
            gene.setSymbol(attributes.get("Name"));
            gene.setDescription(prepareDescription(attributes));
            gene.setBiotype("protein_coding"); // Default assumption for MVP, can be refined

            return gene;
        } catch (Exception e) {
            log.warn("Failed to parse gene line: {}", String.join("\t", parts), e);
            return null;
        }
    }

    private Map<String, String> parseAttributes(String attributeString) {
        Map<String, String> map = new HashMap<>();
        String[] pairs = attributeString.split(";");
        for (String pair : pairs) {
            String[] kv = pair.split("=");
            if (kv.length == 2) {
                map.put(kv[0].trim(), kv[1].trim());
            }
        }
        return map;
    }

    private String prepareDescription(Map<String, String> attrs) {
        if (attrs.containsKey("Note"))
            return attrs.get("Note");
        if (attrs.containsKey("description"))
            return attrs.get("description");
        if (attrs.containsKey("product"))
            return attrs.get("product");
        return "";
    }
}
