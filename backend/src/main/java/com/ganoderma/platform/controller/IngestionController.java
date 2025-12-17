package com.ganoderma.platform.controller;

import com.ganoderma.platform.service.GffLoaderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ingestion")
@RequiredArgsConstructor
public class IngestionController {

    private final GffLoaderService gffLoaderService;

    @PostMapping("/gff/{isolateName}")
    public ResponseEntity<String> uploadGff(@PathVariable String isolateName,
            @RequestParam("file") MultipartFile file) {
        try {
            gffLoaderService.loadGff(isolateName, file.getInputStream());
            return ResponseEntity.ok("GFF ingestion successful for isolate: " + isolateName);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error parsing GFF: " + e.getMessage());
        }
    }
}
