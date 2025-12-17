# Ganoderma Multi-Omics Platform 🍄

A Graph-RAG powered platform for exploring Ganoderma pathogenicity through comparative genomics and transcriptomics.

## Architecture
- **Backend**: Java 21, Spring Boot 3.2, Spring AI.
- **Database**: Neo4j 5.x (Graph + Vector Index).
- **Frontend**: React, TypeScript, TailwindCSS, Vite.
- **AI**: OpenRouter integration (DeepSeek/Llama) via Spring AI.

## Prerequisites
- **Java 21+**
- **Maven 3.8+**
- **Node.js 18+**
- **Neo4j Database** (Running locally or remote)

## Getting Started

### 1. Database Setup (Neo4j)
Ensure Neo4j is running.
Configure credentials in `backend/src/main/resources/application.properties`:
```properties
spring.neo4j.uri=bolt://localhost:7687
spring.neo4j.authentication.username=neo4j
spring.neo4j.authentication.password=your_password
```

### 2. Backward Setup
```bash
cd backend
mvn clean install
mvn spring-boot:run
```
The API will start at `http://localhost:8080`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the UI at `http://localhost:5173`.

## Features
- **Data Ingestion**: Import GFF3 files via `POST /api/ingestion/gff/{isolate}`.
- **RAG Chat**: Ask questions about the data using the "Cyber-Glass" Chat UI.
- **Graph Viz**: (Coming soon) Explore gene networks interactively.

## AI Configuration
Export your OpenAI/OpenRouter key before running the backend:
```bash
export SPRING_AI_OPENAI_API_KEY=your_key_here
```
