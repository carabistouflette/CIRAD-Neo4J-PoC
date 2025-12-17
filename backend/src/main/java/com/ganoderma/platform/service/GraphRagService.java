package com.ganoderma.platform.service;

import com.ganoderma.platform.dto.ChatDto;
import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.repository.GeneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GraphRagService {

    private final ChatClient.Builder chatClientBuilder;
    private final GeneRepository geneRepository;

    private static final String SYSTEM_PROMPT = """
            You are a strict bioinformatics assistant specializing in Ganoderma genomics.

            RULES:
            1. You must answer ONLY based on the provided Context Data below.
            2. If the answer is not in the context, state "I do not have this information in my database."
            3. Do not hallucinate genes, expression values, or biological facts not present in the content.
            4. Always cite the Gene IDs used in your reasoning.

            CONTEXT DATA:
            {context}
            """;

    public ChatDto.Response ask(String userQuestion) {
        // 1. Retrieval Strategy (MVP: Keyword Search)
        // In a real scenario, this would be Vector Search or Text-to-Cypher.
        // Here we do a simple "naive" retrieval: check if question contains gene
        // symbols or keywords.
        // For the PoC, we default to fetching a small subset or searching by keywords
        // extracted from query.

        // Simulating retrieval: Find genes whose symbol is in the query (naive)
        // Or just fetch top 10 genes if generic (for demo purposes)
        List<Gene> contextGenes = retrieveContext(userQuestion);

        // 2. Format Context
        String contextJson = formatContext(contextGenes);

        // 3. Construct Prompt (Legacy PromptTemplate usage, adapting to Fluent API)
        // The new Fluent API supports System specs directly, but we can still prep
        // messages if we want more control
        // Or cleaner: use .system(text) with params.

        // Let's use the clean Fluent API pattern:
        ChatClient chatClient = chatClientBuilder.build();

        String aiResponse = chatClient.prompt()
                .system(sp -> sp.text(SYSTEM_PROMPT).param("context", contextJson))
                .user(userQuestion)
                .call()
                .content();

        return new ChatDto.Response(aiResponse, contextGenes.stream().map(Gene::getGeneId).toList());
    }

    private List<Gene> retrieveContext(String question) {
        // MVP Implementation:
        // 1. Extract potential gene symbols (e.g., words starting with Gbon)
        // 2. Perform fuzzy search on description

        // Fallback: if 'Gbon' is mentioned, search by symbol
        if (question.contains("Gbon")) {
            // simplified logic: extract first token that looks like a gene ID?
            // or just search common keywords
            return geneRepository.findBySymbolLike("Gbon"); // Very broad, retrieving all starting with Gbon
        }

        // Default: If no specific gene identified, retrieve a generic sample (limit 5)
        // to prove RAG pipeline works
        // This is a placeholder. Real implementation needs Vector Store.
        return geneRepository.findAll().stream().limit(5).collect(Collectors.toList());
    }

    private static final String CYPHER_GEN_SYSTEM_PROMPT = """
            You are a Neo4j Cypher expert assisting a researcher.
            Translate the user's natural language request into a valid Cypher query.

            DATABASE SCHEMA:
            Nodes:
            - :Isolate {name, originCountry, host, collectionDate}
            - :Gene {geneId, symbol, description, biotype}
            - :Orthogroup {groupId, geneCount}

            Relationships:
            - (:Gene)-[:FOUND_IN]->(:Isolate)
            - (:Gene)-[:BELONGS_TO_OG]->(:Orthogroup)

            DATA CONTEXT:
            - Gene symbols usually start with prefixes like 'Tox' (Toxins), 'Eff' (Effectors), 'Reg' (Regulators).
            - Example Symbols: 'Tox42', 'Eff10'.
            - Isolate names: 'G. boninense IND1', 'G. boninense MYS2'.
            - Valid Countries (ALWAYS use these specific English names): 'Indonesia', 'Malaysia', 'Cameroon', 'Thailand', 'Papua New Guinea', 'Brazil', 'Columbia'.

            RULES:
            1. Output ONLY the Cypher query. No markdown explanation. No code blocks.
            2. ALWAYS use a LIMIT clause (max 500) to prevent crashing the UI.
            3. USE PATHS: To ensure links are visible, ALWAYS bind the pattern to a path variable and return the path.
               - BAD: `MATCH (a)-[:FOUND_IN]->(b) RETURN a, b` (Missing relationship)
               - BAD: `MATCH (a)-[r:FOUND_IN]->(b) RETURN a, r, b` (Better, but error-prone)
               - BEST: `MATCH p = (a)-[:FOUND_IN]->(b) RETURN p` (Perfect, includes everything)
               - COMPLEX: `MATCH p1=(a)-[:FOUND_IN]->(b), p2=(b)-[:BELONGS_TO_OG]->(c) RETURN p1, p2`
            4. If the user asks for "Toxins", use `WHERE g.symbol STARTS WITH 'Tox'`. DO NOT use 'CONTAINS "Toxin"' as the symbol is just 'Tox...'.
            5. Translate French country names to the English values in DATA CONTEXT (e.g. 'Cameroun' -> 'Cameroon', 'Brésil' -> 'Brazil').
            6. CONTEXT IS KING: Use Paths to include context. Example: `MATCH p = (i:Isolate)-[:FOUND_IN]-(g:Gene)-[:BELONGS_TO_OG]-(og:Orthogroup) RETURN p`.
            7. If the request is vague, return a general sampling (LIMIT 50).
            """;

    /***
     * Generates a Cypher query from natural language.
     */
    public String generateCypher(String userRequest) {
        ChatClient chatClient = chatClientBuilder.build();

        String cypher = chatClient.prompt()
                .system(CYPHER_GEN_SYSTEM_PROMPT)
                .user(userRequest)
                .call()
                .content();

        // Clean up markdown if the LLM adds it despite instructions
        if (cypher.startsWith("```cypher")) {
            cypher = cypher.replace("```cypher", "").replace("```", "");
        } else if (cypher.startsWith("```")) {
            cypher = cypher.replace("```", "");
        }

        cypher = cypher.trim();
        System.out.println("AI Generated Cypher: " + cypher);
        return cypher;
    }

    private String formatContext(List<Gene> genes) {
        // Convert list of objects to simplified JSON string
        return genes.stream()
                .map(g -> String.format("{ID: %s, Symbol: %s, Desc: %s}",
                        g.getGeneId(), g.getSymbol(), g.getDescription()))
                .collect(Collectors.joining(", ", "[", "]"));
    }
}
