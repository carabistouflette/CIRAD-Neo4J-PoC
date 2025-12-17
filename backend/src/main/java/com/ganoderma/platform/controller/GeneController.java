package com.ganoderma.platform.controller;

import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.service.GeneService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;

@RestController
@RequestMapping("/api/genes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // For development convenience
public class GeneController {

    private final GeneService geneService;

    @GetMapping
    public List<Gene> getAllGenes() {
        return geneService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Gene> getGeneById(@PathVariable String id) {
        return geneService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public List<Gene> searchGenes(@RequestParam String symbol) {
        return geneService.searchBySymbol(symbol);
    }
}
