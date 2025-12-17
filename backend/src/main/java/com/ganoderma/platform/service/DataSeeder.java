package com.ganoderma.platform.service;

import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.model.Isolate;
import com.ganoderma.platform.model.Orthogroup;
import com.ganoderma.platform.repository.GeneRepository;
import com.ganoderma.platform.repository.IsolateRepository;
import com.ganoderma.platform.repository.OrthogroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final GeneRepository geneRepository;
    private final IsolateRepository isolateRepository;
    private final OrthogroupRepository orthogroupRepository;

    @Override
    public void run(String... args) throws Exception {
        if (geneRepository.count() > 0) {
            log.info("Database already populated. Skipping seeding.");
            return;
        }

        log.info("Starting database seeding...");

        // 1. Create Isolates
        Isolate cmr = createIsolate("G. boninense CMR", "Cameroon", "Elaeis guineensis", "2023-01-15");
        Isolate idn = createIsolate("G. boninense IDN", "Indonesia", "Elaeis guineensis", "2019-06-20");
        Isolate mys = createIsolate("G. boninense MYS", "Malaysia", "Elaeis guineensis", "2021-03-10");

        isolateRepository.saveAll(new ArrayList<>(List.of(cmr, idn, mys)));

        // 2. Create Orthogroups
        Orthogroup ogTox = createOrthogroup("OG0001", 3);
        Orthogroup ogEff = createOrthogroup("OG0002", 3);
        Orthogroup ogReg = createOrthogroup("OG0003", 2);

        orthogroupRepository.saveAll(new ArrayList<>(List.of(ogTox, ogEff, ogReg)));

        // 3. Create Genes
        List<Gene> genes = new ArrayList<>();

        // Toxin Genes (Present in all)
        genes.add(createGene("Gbon_CMR_Tox1", "ToxA", "Toxin Synthase A", "Critical secondary metabolite toxin", cmr,
                ogTox));
        genes.add(createGene("Gbon_IDN_Tox1", "ToxA", "Toxin Synthase A", "Toxin synthase variant", idn, ogTox));
        genes.add(createGene("Gbon_MYS_Tox1", "ToxA", "Toxin Synthase A", "Toxin synthase variant MYS", mys, ogTox));

        // Effector Genes (High virulence in CMR)
        genes.add(createGene("Gbon_CMR_Eff1", "EffX", "Effector X", "Secreted effector protein causing necrosis", cmr,
                ogEff));
        genes.add(createGene("Gbon_IDN_Eff1", "EffX", "Effector X", "Effector homolog", idn, ogEff));
        genes.add(createGene("Gbon_MYS_Eff1", "EffX", "Effector X", "Effector variant", mys, ogEff));

        // Regulator (Missing in IDN)
        genes.add(createGene("Gbon_CMR_Reg1", "MReg", "Master Regulator", "Transcriptional regulator of virulence", cmr,
                ogReg));
        genes.add(createGene("Gbon_MYS_Reg1", "MReg", "Master Regulator", "Transcriptional regulator", mys, ogReg));

        geneRepository.saveAll(genes);

        log.info("Seeding completed. Added {} isolates, {} orthogroups, {} genes.", 3, 3, genes.size());
    }

    private Isolate createIsolate(String name, String country, String host, String date) {
        Isolate i = new Isolate();
        i.setName(name);
        i.setOriginCountry(country);
        i.setHost(host);
        i.setCollectionDate(date);
        return i;
    }

    private Orthogroup createOrthogroup(String id, int count) {
        Orthogroup og = new Orthogroup();
        og.setGroupId(id);
        og.setGeneCount(count);
        return og;
    }

    private Gene createGene(String id, String symbol, String biotype, String desc, Isolate isolate, Orthogroup og) {
        Gene g = new Gene();
        g.setGeneId(id);
        g.setSymbol(symbol);
        g.setBiotype("protein_coding"); // simplified
        g.setDescription(desc + " (" + biotype + ")");
        g.setIsolate(isolate);
        g.setOrthogroup(og);
        return g;
    }
}
