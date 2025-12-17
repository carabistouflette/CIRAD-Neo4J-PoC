package com.ganoderma.platform.controller;

import com.ganoderma.platform.dto.DashboardStatsDto;
import com.ganoderma.platform.repository.GeneRepository;
import com.ganoderma.platform.repository.IsolateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DashboardController {

    private final GeneRepository geneRepository;
    private final IsolateRepository isolateRepository;

    @GetMapping("/stats")
    public DashboardStatsDto getStats() {
        return DashboardStatsDto.builder()
                .genesCount(geneRepository.count())
                .isolatesCount(isolateRepository.count())
                .samplesCount(0) // Placeholder as we don't have sample repo yet
                .build();
    }
}
