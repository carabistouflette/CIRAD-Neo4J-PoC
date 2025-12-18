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

import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.SystemMessage;

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
    private final com.ganoderma.platform.repository.OrthogroupRepository orthogroupRepository;

    private static final String SYSTEM_PROMPT = """
            You are a strict bioinformatics assistant specializing in Ganoderma genomics.

            CONTEXT SCOPE: {scope}

            RULES:
            1. You must answer ONLY based on the provided Context Data below.
            2. If the answer is not in the context, state "I do not have this information in my database."
            3. Do not hallucinate genes, expression values, or biological facts not present in the content.
            4. If the Scope is specific (e.g. Isolate), focus your answer on that entity.
            5. INTERACTIVE REFERENCES: When you mention a specific graph element (Isolate, Gene, Orthogroup) that is likely to be in the graph, YOU MUST WRAP ITS NAME in double angle brackets, like <<G. boninense>> or <<ToxA>>. This allows the user to click and see it in the graph. Do this for every significant entity occurrence.
            6. NO META-COMMENTARY: Do not mention "context data", "provided snippets", or "internal limits". Do not say "The context contains X items". Just answer the question directly.
            7. NO UI INSTRUCTIONS: Do not tell the user to "click on the names". The interface handles this. Just provide the information naturally.

            CONTEXT DATA:
            {context}
            """;

    public ChatDto.Response ask(ChatDto.Request request) {
        String userQuestion = request.getMessage();
        String scope = request.getScope() != null ? request.getScope() : "GLOBAL";
        String contextJson = "";

        // 1. Context Retrieval Strategy (Unified)
        // Always start with global search/knowledge
        contextJson = retrieveContext(userQuestion);

        // Append Explicit Graph Context if available (What the user sees)
        if (request.getContextIds() != null && !request.getContextIds().isEmpty()) {
            String graphContext = retrieveGraphContext(request.getContextIds());
            if (contextJson.length() + graphContext.length() < 12000) { // Simple token safety check (approx)
                contextJson += "\n\n=== USER VISIBLE GRAPH CONTEXT ===\n(The user is currently looking at these nodes)\n"
                        + graphContext;
            } else {
                contextJson += "\n\n=== USER VISIBLE GRAPH CONTEXT ===\n(Context too large, using partial)\n"
                        + graphContext.substring(0, 2000) + "...";
            }
        }

        // Special specific Entity focus override if needed, but usually GraphContext
        // covers it if the node is visible.
        if (request.getEntityId() != null && (request.getContextIds() == null || request.getContextIds().isEmpty())) {
            String entityCtx = retrieveEntityContext(request.getEntityId());
            contextJson += "\n\n=== FOCUSED ENTITY ===\n" + entityCtx;
        }

        // 2. Build Message History EARLY (Used for both Cypher Gen and Final Answer)
        List<Message> history = new ArrayList<>();

        if (request.getHistory() != null) {
            for (ChatDto.MessageDto msg : request.getHistory()) {
                if ("user".equalsIgnoreCase(msg.getRole())) {
                    // Prevent consecutive user messages
                    if (!history.isEmpty() && history.get(history.size() - 1) instanceof UserMessage) {
                        continue;
                    }
                    history.add(new UserMessage(msg.getContent()));
                } else if ("assistant".equalsIgnoreCase(msg.getRole())) {
                    // Prevent consecutive assistant messages
                    if (!history.isEmpty() && history.get(history.size() - 1) instanceof AssistantMessage) {
                        continue;
                    }
                    if (history.isEmpty() || !(history.get(history.size() - 1) instanceof UserMessage)) {
                        continue;
                    }
                    history.add(new AssistantMessage(msg.getContent()));
                }
            }
        }

        // Ensure the last message in history is NOT a UserMessage
        if (!history.isEmpty() && history.get(history.size() - 1) instanceof UserMessage) {
            history.remove(history.size() - 1);
        }

        // 3. Intent Detection & Cypher Generation (Only for GLOBAL scope)
        String cypherQuery = null;
        String finalContextJson = contextJson != null ? contextJson : "";
        String updatedContext = finalContextJson;

        if ("GLOBAL".equals(scope)) {
            String intent = detectIntent(userQuestion);
            if ("VISUALIZATION".equals(intent)) {
                // Pass history to allow refinement
                cypherQuery = generateCypher(userQuestion, history);
                if (cypherQuery != null) {
                    updatedContext += "\n[SYSTEM: A Cypher query has been generated to update the graph. Briefly explain to the user what data is being visualized based on their request. Do not mention technical Cypher details, just the biological data.]";
                }
            }
        }

        final String activeContext = updatedContext;

        // 4. Build Final Messages for Chat Response (Combine System + History + User)
        List<Message> chatMessages = new ArrayList<>();
        chatMessages
                .add(new SystemMessage(SYSTEM_PROMPT.replace("{context}", activeContext).replace("{scope}", scope)));
        chatMessages.addAll(history);
        chatMessages.add(new UserMessage(userQuestion));

        ChatClient chatClient = chatClientBuilder.build();
        String aiResponse = chatClient.prompt()
                .messages(chatMessages)
                .call()
                .content();

        if (cypherQuery != null) {
            // System instruction handles the explanation now
        }

        return new ChatDto.Response(aiResponse, request.getEntityId(), cypherQuery);
    }

    private String retrieveGraphContext(List<String> contextIds) {
        log.info("Retrieving Graph Context for {} IDs", contextIds != null ? contextIds.size() : 0);
        if (contextIds == null || contextIds.isEmpty())
            return "<GraphContext empty='true' />";

        StringBuilder sb = new StringBuilder("<GraphContext item_count='" + contextIds.size() + "'>\n");
        int count = 0;
        int maxItems = 100;

        for (String id : contextIds) {
            if (count >= maxItems) {
                sb.append("  <!-- Truncated " + (contextIds.size() - count) + " more items -->\n");
                break;
            }

            if (id.startsWith("ISOLATE_")) {
                String name = id.substring("ISOLATE_".length());
                Isolate iso = isolateRepository.findByName(name);
                if (iso != null) {
                    sb.append(String.format("  <Node id='%s' type='Isolate'>\n", id));
                    sb.append(String.format("    <Name>%s</Name>\n", iso.getName()));
                    sb.append(String.format("    <Country>%s</Country>\n", iso.getOriginCountry()));
                    sb.append(String.format("    <Host>%s</Host>\n", iso.getHost()));
                    sb.append("  </Node>\n");
                }
                count++;
            } else if (id.startsWith("GENE_") || id.contains("Gbon")) {
                String geneId = id.startsWith("GENE_") ? id.substring("GENE_".length()) : id;
                Optional<Gene> geneOpt = geneRepository.findByGeneId(geneId);
                if (geneOpt.isPresent()) {
                    Gene g = geneOpt.get();
                    String fullId = "GENE_" + g.getGeneId();
                    sb.append(String.format("  <Node id='%s' type='Gene'>\n", fullId));
                    sb.append(String.format("    <Symbol>%s</Symbol>\n", g.getSymbol()));
                    sb.append(String.format("    <Description>%s</Description>\n",
                            g.getDescription() != null ? g.getDescription().replace("<", "&lt;").replace(">", "&gt;")
                                    : ""));

                    // Topology / Relationships
                    if (g.getIsolate() != null) {
                        sb.append(String.format("    <Relation type='FOUND_IN' target='ISOLATE_%s'/>\n",
                                g.getIsolate().getName()));
                    }
                    if (g.getOrthogroup() != null) {
                        sb.append(String.format("    <Relation type='BELONGS_TO' target='OG_%s'/>\n",
                                g.getOrthogroup().getGroupId()));
                    }
                    sb.append("  </Node>\n");
                }
                count++;
            } else if (id.startsWith("OG_") || id.startsWith("OG")) {
                String ogId = id.startsWith("OG_") ? id.substring("OG_".length()) : id;
                Optional<com.ganoderma.platform.model.Orthogroup> ogOpt = orthogroupRepository.findById(ogId);
                if (ogOpt.isPresent()) {
                    String fullId = "OG_" + ogOpt.get().getGroupId();
                    sb.append(String.format("  <Node id='%s' type='Orthogroup'>\n", fullId));
                    sb.append(String.format("    <GeneCount>%d</GeneCount>\n", ogOpt.get().getGeneCount()));
                    sb.append("  </Node>\n");
                }
                count++;
            } else {
                sb.append(String.format("  <Node id='%s' type='Unknown'/>\n", id));
                count++;
            }
        }
        sb.append("</GraphContext>");
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
            7. SPECIAL CASE: If the user asks about the database content, the amount of data, or general statistics (e.g. "what is in the db", "qu'y a-t-il dedans"), output EXACTLY: 'DATABASE_STATS'.

            Examples:
            - "c'est quoi Elaeis guineensis?" -> "Elaeis guineensis"
            - "what is ganoderma?" -> "Ganoderma"
            - "tell me about toxin genes" -> "toxin"
            - "parle moi des isolats du cameroun" -> "Cameroon"
            - "Elais guinensis" (typo) -> "Elaeis guineensis"
            - "les champignons de malaisie" -> "Malaysia"
            - "qu'est ce qu'il y a dans la base?" -> "DATABASE_STATS"
            - "combien de données ?" -> "DATABASE_STATS"
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

    private String getDatabaseSummary() {
        long isolateCount = isolateRepository.count();
        long geneCount = geneRepository.count();
        long ogCount = orthogroupRepository.count();
        // Potential improvement: fetch distinct countries using a custom query if
        // needed,
        // but for now simple counts are sufficient for "What is in the DB".
        return String.format(
                """

                        === GENERAL DATABASE STATISTICS & CONTENT ===
                        The database contains genomic data for the fungus Ganoderma boninense.
                        - Total Isolates: %d (Pathogens from Indonesia, Malaysia, Cameroon, etc.)
                        - Total Genes: %d (Functional annotations available)
                        - Total Orthogroups: %d (Gene families)

                        [INSTRUCTION TO AI: Use these statistics to answer general questions about what is in the database.]
                        """,
                isolateCount, geneCount, ogCount);
    }

    private String retrieveContext(String question) {
        // Use AI to intelligently extract the search term
        String searchTerm = extractSearchTerm(question).trim();

        // 0. Special Case: General Database Stats
        if ("DATABASE_STATS".equalsIgnoreCase(searchTerm) || searchTerm.toLowerCase().contains("database")) {
            return getDatabaseSummary();
        }

        StringBuilder sb = new StringBuilder("Search Results for '" + searchTerm + "':\n");
        int count = 0;
        int maxItems = 20;

        // 1. Search Isolates (Host, Country, Name)
        if (searchTerm.length() > 2) { // Avoid searching for 1-2 char terms which might match too many things
            List<Isolate> isolates = new ArrayList<>();
            isolates.addAll(isolateRepository.findByNameContainingIgnoreCase(searchTerm));
            isolates.addAll(isolateRepository.findByHostContainingIgnoreCase(searchTerm));
            isolates.addAll(isolateRepository.findByOriginCountryContainingIgnoreCase(searchTerm));

            for (Isolate iso : isolates) {
                if (count >= maxItems)
                    break;
                sb.append(String.format("- Isolate: %s (Host: %s, Country: %s)\n",
                        iso.getName(), iso.getHost(), iso.getOriginCountry()));
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

                    // Enrich with Relationships
                    if (g.getIsolate() != null) {
                        sb.append(String.format("    -> Found In Isolate: <<%s>> (Country: %s)\n",
                                g.getIsolate().getName(), g.getIsolate().getOriginCountry()));
                    }
                    if (g.getOrthogroup() != null) {
                        sb.append(String.format("    -> Part of Orthogroup: <<OG_%s>>\n",
                                g.getOrthogroup().getGroupId()));
                    }

                    count++;
                }
            }
        }

        // 3. Fallback: Append Database Summary if search yielded poor results OR just
        // as context
        if (count == 0) {
            sb.append("\n(No specific entities found matching '" + searchTerm
                    + "'. However, here is the general database context below:)\n");
            sb.append(getDatabaseSummary());
        } else {
            // Even if found, maybe useful?
            // sb.append(getDatabaseSummary()); // Optional, might be noise
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
            249:             8. HISTORY/REFINEMENT: If the user message is a refinement of a previous query (e.g. "Only from Malaysia", "Add genes"), MODIFY the previous query or logic implied by the conversation history.
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
        String result = chatClient.prompt()
                .system(INTENT_DETECTION_PROMPT)
                .user(userRequest)
                .call()
                .content();
        return result != null ? result.trim() : "QA";
    }

    /***
     * Generates a Cypher query from natural language.
     */
    public String generateCypher(String userRequest, List<Message> history) {
        ChatClient chatClient = chatClientBuilder.build();

        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(CYPHER_GEN_SYSTEM_PROMPT));
        if (history != null) {
            messages.addAll(history);
        }
        messages.add(new UserMessage(userRequest));

        String cypher = chatClient.prompt()
                .messages(messages)
                .call()
                .content();

        if (cypher == null)
            return null;

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
