package com.ganoderma.platform.service;

import com.ganoderma.platform.dto.ChatDto;
import com.ganoderma.platform.model.Gene;
import com.ganoderma.platform.repository.GeneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
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

    private String formatContext(List<Gene> genes) {
        // Convert list of objects to simplified JSON string
        return genes.stream()
                .map(g -> String.format("{ID: %s, Symbol: %s, Desc: %s}",
                        g.getGeneId(), g.getSymbol(), g.getDescription()))
                .collect(Collectors.joining(", ", "[", "]"));
    }
}
