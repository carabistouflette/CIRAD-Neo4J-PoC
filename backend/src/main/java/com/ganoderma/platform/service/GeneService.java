package com.ganoderma.platform.service;

import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.repository.GeneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class GeneService {

    private final GeneRepository geneRepository;

    @Transactional(readOnly = true)
    public List<Gene> findAll() {
        return geneRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Gene> findById(String geneId) {
        return geneRepository.findByGeneId(geneId);
    }

    @Transactional(readOnly = true)
    public List<Gene> searchBySymbol(String symbol) {
        return geneRepository.findBySymbolLike("*" + symbol + "*");
    }

    @Transactional(readOnly = true)
    public List<Gene> findByOrthogroup(String ogId) {
        return geneRepository.findByOrthogroupId(ogId);
    }
}
