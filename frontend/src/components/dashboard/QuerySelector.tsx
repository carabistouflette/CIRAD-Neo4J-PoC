import { useState } from "react";
import { Terminal, Database, Play, Sparkles, Bot } from "lucide-react";

interface QuerySelectorProps {
    onExecute: (cypher: string) => void;
    isLoading: boolean;
}

export function QuerySelector({ onExecute, isLoading }: QuerySelectorProps) {
    const [mode, setMode] = useState<'presets' | 'cypher' | 'assistant'>('presets');
    const [customQuery, setCustomQuery] = useState("MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100");
    const [aiPrompt, setAiPrompt] = useState("");
    const [isAiThinking, setIsAiThinking] = useState(false);

    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiThinking(true);

        try {
            const response = await fetch('http://localhost:8080/api/ai/generate-cypher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
            });

            if (!response.ok) throw new Error("AI Generation failed");

            const data = await response.json();

            setCustomQuery(data.cypher);
            setMode('cypher'); // Switch to Expert view to show result
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la génération IA. Vérifiez que le backend est configuré avec une clé API.");
        } finally {
            setIsAiThinking(false);
        }
    };

    const presets = [
        {
            title: "Vue d'ensemble (Isolats & Orthogroupes)",
            description: "Graphe agrégé montrant les relations entre isolats via leurs groupes de gènes.",
            query: "MATCH (i:Isolate) OPTIONAL MATCH (i)<-[:FOUND_IN]-(g:Gene)-[:BELONGS_TO_OG]->(og:Orthogroup) RETURN i, og, count(g) as weight LIMIT 1000",
            icon: <Database size={24} />
        },
        {
            title: "Focus Toxines",
            description: "Affiche uniquement les gènes identifiés comme toxines et leurs porteurs.",
            query: "MATCH (g:Gene) WHERE g.symbol STARTS WITH 'Tox' MATCH (g)-[r]-(related) RETURN g, r, related",
            icon: <Sparkles size={24} />
        },
        {
            title: "Tout le Graphe (Attention)",
            description: "Charge toutes les données brute (peut être lent).",
            query: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 2000",
            icon: <Terminal size={24} />
        }
    ];

    /**
     * NOTE: The "Aggregation View" in Frontend (Step 254) relied on loading ALL nodes and filtering client-side.
     * With Query-Driven loading, we can just load the Nodes we want.
     * However, the 'Implicit Link' logic in GraphViz.tsx relies on having the detailed links hidden.
     * If we run a Cypher query that returns implicit links directly, that's even better!
     * 
     * Preset 1 (Aggregation) is tricky:
     * If we return `i, og`, the frontend needs to know how to link them.
     * If we return `count(g)`, we need a way to pass that edge.
     * 
     * Strategy: For now, let's load the data required for the client-side aggregation to work.
     * That means loading Isolates, Orthogroups, AND Genes (but hidden).
     * 
     * REVISED PRESET 1: "MATCH (n) RETURN n LIMIT 5000" (Loads everything so client logic works).
     * Or better: "MATCH (i:Isolate) RETURN i UNION MATCH (og:Orthogroup) RETURN og UNION MATCH (g:Gene) RETURN g UNION MATCH ()-[r]->() RETURN r"
     * 
     * Let's stick to "MATCH (n)-[r]->(m) RETURN n,r,m" for the overview for now, so client-side filtering works.
     */

    // Override Preset 1 for compatibility with current GraphViz logic
    // presets[0].query = "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 5000"; // This line is now integrated into the presets array directly

    return (
        <div className="absolute inset-0 z-50 bg-neo-bg/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neo-white border-4 border-neo-black shadow-neo-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[80vh]">

                {/* Header */}
                <div className="bg-neo-black text-neo-white p-4 flex justify-between items-center">
                    <h2 className="text-xl font-black uppercase flex items-center gap-2">
                        <Database /> Sélecteur de Données
                    </h2>
                </div>

                {/* Tabs */}
                <div className="flex border-b-4 border-neo-black">
                    <button
                        onClick={() => setMode('presets')}
                        className={`flex-1 p-3 font-bold uppercase hover:bg-neo-primary transition-colors ${mode === 'presets' ? 'bg-neo-primary text-neo-black' : 'bg-neo-white'}`}
                    >
                        Presets
                    </button>
                    <button
                        onClick={() => setMode('assistant')}
                        className={`flex-1 p-3 font-bold uppercase hover:bg-neo-primary transition-colors ${mode === 'assistant' ? 'bg-neo-primary text-neo-black' : 'bg-neo-white'}`}
                    >
                        <span className="flex items-center justify-center gap-2"><Bot size={18} /> Assistant IA</span>
                    </button>
                    <button
                        onClick={() => setMode('cypher')}
                        className={`flex-1 p-3 font-bold uppercase hover:bg-neo-primary transition-colors ${mode === 'cypher' ? 'bg-neo-primary text-neo-black' : 'bg-neo-white'}`}
                    >
                        Expert
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    {mode === 'presets' && (
                        <div className="grid grid-cols-1 gap-4">
                            {presets.map((preset, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onExecute(preset.query)}
                                    disabled={isLoading}
                                    className="text-left bg-neo-white p-4 border-3 border-neo-black shadow-neo-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-neo-bg border-2 border-neo-black group-hover:bg-neo-accent transition-colors">
                                            {preset.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg uppercase">{preset.title}</h3>
                                            <p className="text-sm font-medium text-neo-black/70">{preset.description}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {mode === 'assistant' && (
                        <div className="flex flex-col gap-4 h-full justify-center">
                            <div className="text-center space-y-2 mb-4">
                                <div className="inline-block p-4 bg-neo-accent rounded-full border-2 border-neo-black mb-2">
                                    <Sparkles size={32} />
                                </div>
                                <h3 className="text-xl font-black uppercase">Décrivez votre besoin</h3>
                                <p className="text-sm text-neo-black/70 max-w-md mx-auto">
                                    L'IA va traduire votre demande en requête Cypher optimisée pour le graphe.
                                </p>
                            </div>

                            <textarea
                                className="w-full bg-white p-4 font-bold border-2 border-neo-black resize-none focus:outline-none focus:ring-2 focus:ring-neo-primary h-32"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Ex: Montre-moi tous les isolats qui contiennent le gène ToxA..."
                            />

                            <button
                                onClick={handleAiGenerate}
                                disabled={isAiThinking || !aiPrompt.trim()}
                                className="bg-neo-black text-neo-white border-2 border-neo-black py-4 px-6 font-black uppercase hover:bg-neo-primary hover:text-neo-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isAiThinking ? (
                                    <>Génération en cours...</>
                                ) : (
                                    <><Bot size={18} /> Générer la Requête</>
                                )}
                            </button>
                        </div>
                    )}

                    {mode === 'cypher' && (
                        <div className="flex flex-col gap-4 h-full">
                            <textarea
                                className="flex-1 w-full bg-neo-black text-neo-white p-4 font-mono text-sm border-2 border-neo-black resize-none focus:outline-none focus:ring-2 focus:ring-neo-primary"
                                value={customQuery}
                                onChange={(e) => setCustomQuery(e.target.value)}
                                placeholder="MATCH (n) RETURN n LIMIT 25"
                            />
                            <button
                                onClick={() => onExecute(customQuery)}
                                disabled={isLoading}
                                className="bg-neo-primary text-neo-black border-2 border-neo-black py-3 px-6 font-black uppercase hover:shadow-neo transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Play size={18} /> Exécuter
                            </button>
                        </div>
                    )}
                </div>

                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                        <div className="animate-spin w-12 h-12 border-4 border-neo-black border-t-neo-primary rounded-full"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
