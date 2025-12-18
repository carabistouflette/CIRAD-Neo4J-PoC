package com.ganoderma.platform.service;

import com.ganoderma.platform.dto.ChatDto;
import com.ganoderma.platform.model.Isolate;
import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.repository.GeneRepository;
import com.ganoderma.platform.repository.IsolateRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.ArrayList;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GraphRagService {

    private final ChatClient.Builder chatClientBuilder;
    private final GeneRepository geneRepository;
    private final IsolateRepository isolateRepository;

    private static final String SYSTEM_PROMPT = """
            You are a strict bioinformatics assistant specializing in Ganoderma genomics.

            CONTEXT SCOPE: {scope}

            RULES:
            1. You must answer ONLY based on the provided Context Data below.
            2. If the answer is not in the context, state "I do not have this information in my database."
            3. Do not hallucinate genes, expression values, or biological facts not present in the content.
            4. If the Scope is specific (e.g. Isolate), focus your answer on that entity.

            CONTEXT DATA:
            {context}
            """;

    public ChatDto.Response ask(ChatDto.Request request) {
        String userQuestion = request.getMessage();
        String scope = request.getScope() != null ? request.getScope() : "GLOBAL";
        String contextJson = "";

        // 1. Context Retrieval Strategy
        if ("ENTITY".equals(scope) && request.getEntityId() != null) {
            contextJson = retrieveEntityContext(request.getEntityId());
        } else if ("GRAPH".equals(scope) && request.getContextIds() != null) {
            contextJson = retrieveGraphContext(request.getContextIds());
        } else {
            // Default Global/Search strategy
            contextJson = retrieveContext(userQuestion);
        }

        // 2. Construct Prompt
        final String finalContextJson = contextJson != null ? contextJson : "";
        ChatClient chatClient = chatClientBuilder.build();

        // 3. Intent Detection for Visualization (Only for GLOBAL/GRAPH scope)
        String cypherQuery = null;
        String updatedContext = finalContextJson;

        if (!"ENTITY".equals(scope)) {
            String intent = detectIntent(userQuestion);
            if ("VISUALIZATION".equals(intent)) {
                cypherQuery = generateCypher(userQuestion);

                // CRITICAL: Inject context so the AI knows it succeeded, even if RAG found
                // nothing textually.
                String vizContext = " [SYSTEM EVENT]: The graph visualization has been successfully filtered/updated to show: '"
                        + userQuestion + "'.";

                if (updatedContext.contains("No specific entities found") || updatedContext.isEmpty()) {
                    updatedContext = vizContext + " You should confirm this action to the user.";
                } else {
                    updatedContext += "\n" + vizContext;
                }
            }
        }

        final String activeContext = updatedContext;

        String aiResponse = chatClient.prompt()
                .system(sp -> sp.text(SYSTEM_PROMPT)
                        .param("context", activeContext)
                        .param("scope", scope != null ? scope : "GLOBAL"))
                .user(userQuestion)
                .call()
                .content();

        if (cypherQuery != null) {
            aiResponse += "\n\n(I am updating the graph view to focus on this.)";
        }

        return new ChatDto.Response(aiResponse, request.getEntityId(), cypherQuery);
    }

    private String retrieveGraphContext(List<String> contextIds) {
        StringBuilder sb = new StringBuilder("Visible Graph Context:\n");
        int count = 0;
        int maxItems = 15; // Limit to prevent Context Window overflow

        for (String id : contextIds) {
            if (count >= maxItems) {
                sb.append(String.format("... and %d more items.", contextIds.size() - count));
                break;
            }

            if (id.startsWith("ISOLATE_")) {
                String name = id.substring("ISOLATE_".length());
                Isolate iso = isolateRepository.findByName(name);
                if (iso != null) {
                    sb.append(String.format("- Isolate: %s (Country: %s, Host: %s)\n", iso.getName(),
                            iso.getOriginCountry(), iso.getHost()));
                    count++;
                }
            } else if (id.startsWith("GENE_")) {
                String geneId = id.substring("GENE_".length());
                Optional<Gene> geneOpt = geneRepository.findByGeneId(geneId);
                if (geneOpt.isPresent()) {
                    Gene g = geneOpt.get();
                    sb.append(String.format("- Gene: %s (Desc: %s)\n", g.getSymbol(), g.getDescription()));
                    count++;
                }
            } else if (id.startsWith("OG_")) {
                sb.append(String.format("- Orthogroup: %s\n", id.substring("OG_".length())));
                count++;
            } else {
                // FALLBACK: If ID doesn't have a prefix, it might be a raw internal ID or a
                // name.
                // Since we can't easily query by internal ID without Neo4jClient (which we can
                // inject),
                // we will append it as a generic node identifier for now.
                // Ideally, we should inject Neo4jClient to fetch properties.
                sb.append(String.format("- Unknown/Generic Entity ID: %s\n", id));
                count++;
            }
        }
        return sb.toString();
    }

    private String retrieveEntityContext(String entityId) {
        if (entityId.startsWith("ISOLATE_")) {
            String name = entityId.substring("ISOLATE_".length());
            Isolate iso = isolateRepository.findByName(name);
            if (iso != null) {
                return String.format(
                        "Isolate Details: ID=%s, Name=%s, Country=%s, Host=%s. (Note: Only metadata available for now).",
                        iso.getId(), iso.getName(), iso.getOriginCountry(), iso.getHost());
            }
        } else if (entityId.startsWith("OG_")) {
            // Mock or implement OG retrieval if repo supports it
            String groupId = entityId.substring("OG_".length());
            // Assuming we might need to add findByGroupId to OrthogroupRepo or just use
            // what we have
            return "Orthogroup context for " + groupId;
        } else if (entityId.startsWith("GENE_")) {
            String geneId = entityId.substring("GENE_".length());
            Optional<Gene> geneOpt = geneRepository.findByGeneId(geneId);
            if (geneOpt.isPresent()) {
                Gene gene = geneOpt.get();
                return String.format("Gene Details: Symbol=%s, Desc=%s", gene.getSymbol(), gene.getDescription());
            }
        }
        return "Entity not found or unknown type.";
    }

    private static final String KEYWORD_EXTRACTION_PROMPT = """
            You are a keyword extraction engine. Your single task is to identify the core subject
            from the user's question that should be searched in a biological database (which is in English).

            Rules:
            1. Output ONLY the key term(s) to search for. Nothing else.
            2. Remove question words (what, how, where, why, "c'est quoi", etc.).
            3. Correct any obvious spelling mistakes if present.
            4. If the question is about a scientific name (e.g., species, genus), output that name.
            5. If the question is vague, output the most relevant noun phrase.
            6. TRANSLATE the term to English if needed (e.g., "Cameroun" -> "Cameroon", "palmier" -> "palm").

            Examples:
            - "c'est quoi Elaeis guineensis?" -> "Elaeis guineensis"
            - "what is ganoderma?" -> "Ganoderma"
            - "tell me about toxin genes" -> "toxin"
            - "parle moi des isolats du cameroun" -> "Cameroon"
            - "Elais guinensis" (typo) -> "Elaeis guineensis"
            - "les champignons de malaisie" -> "Malaysia"
            """;

    private String extractSearchTerm(String question) {
        ChatClient chatClient = chatClientBuilder.build();
        String term = chatClient.prompt()
                .system(KEYWORD_EXTRACTION_PROMPT)
                .user(question)
                .call()
                .content();
        return term != null ? term.trim() : question; // Fallback to original if LLM fails
    }

    private String retrieveContext(String question) {
        // Use AI to intelligently extract the search term
        String searchTerm = extractSearchTerm(question);

        StringBuilder sb = new StringBuilder("Search Results for '" + searchTerm + "':\n");
        int count = 0;
        int maxItems = 20;

        // 1. Search Isolates (Host, Country, Name)
        List<Isolate> isolates = new ArrayList<>();
        isolates.addAll(isolateRepository.findByNameContainingIgnoreCase(searchTerm));
        isolates.addAll(isolateRepository.findByHostContainingIgnoreCase(searchTerm));
        isolates.addAll(isolateRepository.findByOriginCountryContainingIgnoreCase(searchTerm));

        for (Isolate iso : isolates) {
            if (count >= maxItems)
                break;
            sb.append(String.format("- Isolate: %s (Host: %s, Country: %s)\n", iso.getName(), iso.getHost(),
                    iso.getOriginCountry()));
            count++;
        }

        // 2. Search Genes (Symbol, Description)
        if (count < maxItems) {
            List<Gene> genes = new ArrayList<>();
            genes.addAll(geneRepository.findBySymbolContainingIgnoreCase(searchTerm));
            genes.addAll(geneRepository.findByDescriptionContainingIgnoreCase(searchTerm));

            for (Gene g : genes) {
                if (count >= maxItems)
                    break;
                sb.append(String.format("- Gene: %s (Desc: %s)\n", g.getSymbol(), g.getDescription()));
                count++;
            }
        }

        if (count == 0) {
            return "No specific entities found in database matching: " + searchTerm;
        }

        return sb.toString();
    }

    private static final String CYPHER_GEN_SYSTEM_PROMPT = """
            You are a Neo4j Cypher expert assisting a researcher.
            Translate the user's natural language request into a valid Cypher query.

            DATABASE SCHEMA:
            Nodes:
            - :Isolate {name, originCountry, host, collectionDate}
            - :Gene {geneId, symbol, description, biotype}
            224:             - :Orthogroup {groupId, geneCount} (Note: Users often call this "Pathway" or "Voie Métabolique")
            225:
            226:             Relationships:
            227:             - (:Gene)-[:FOUND_IN]->(:Isolate)
            228:             - (:Gene)-[:BELONGS_TO_OG]->(:Orthogroup)
            229:
            230:             DATA CONTEXT:
            231:             - Gene symbols usually start with prefixes like 'Tox' (Toxins), 'Eff' (Effectors), 'Reg' (Regulators).
            232:             - Example Symbols: 'Tox42', 'Eff10'.
            233:             - Isolate names: 'G. boninense IND1', 'G. boninense MYS2'.
            234:             - Valid Countries (ALWAYS use these specific English names): 'Indonesia', 'Malaysia', 'Cameroon', 'Thailand', 'Papua New Guinea', 'Brazil', 'Columbia'.
            235:
            236:             RULES:
            237:             1. Output ONLY the Cypher query. No markdown explanation. No code blocks.
            238:             2. ALWAYS use a LIMIT clause (max 500) to prevent crashing the UI.
            239:             3. USE PATHS: To ensure links are visible, ALWAYS bind the pattern to a path variable and return the path.
            240:                - BAD: `MATCH (a)-[:FOUND_IN]->(b) RETURN a, b` (Missing relationship)
            241:                - BEST: `MATCH p = (a)-[:FOUND_IN]->(b) RETURN p` (Perfect, includes everything)
            242:             4. GENERAL/OVERVIEW QUERIES:
            243:                - If the user asks for a "general view", "overview", "aperçu", or just a category (e.g. "Show me toxins"), you MUST return the FULL subgraph: Isolate + Gene + Orthogroup.
            244:                - PATTERN: `MATCH p = (i:Isolate)<-[:FOUND_IN]-(g:Gene)-[:BELONGS_TO_OG]->(og:Orthogroup)`
            245:                - Apply filters to the Gene `g`.
            246:             5. If the user asks for "Toxins", use `WHERE g.symbol STARTS WITH 'Tox'`. DO NOT use 'CONTAINS "Toxin"'.
            247:             6. Translate French country names to the English values in DATA CONTEXT.
            248:             7. If the request is vague, return a general sampling (LIMIT 50) using the full context pattern.
            """;

    private static final String INTENT_DETECTION_PROMPT = """
            You are an intent classifier. Determine if the user wants to VISUALIZE/SEE/FOCUS ON a specific sub-graph or entity set.

            Options:
            - VISUALIZATION: The user explicitly asks to "show", "plot", "focus on", "visualize", "display" a specific group (e.g., "Show me toxins", "Focus on Malaysian isolates").
            - QA: The user is asking a general question (e.g., "What is a toxin?", "How many genes are there?", "Tell me about...").

            Rules:
            1. Output ONLY "VISUALIZATION" or "QA".
            2. If uncertain, default to "QA".
            """;

    private String detectIntent(String userRequest) {
        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .system(INTENT_DETECTION_PROMPT)
                .user(userRequest)
                .call()
                .content()
                .trim();
    }

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

}
