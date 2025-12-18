import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, Minus, Maximize2, Network, Play, X, ExternalLink, Search, Dna, Microscope, TestTube, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Levenshtein from 'fast-levenshtein';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Minimal Node type for fuzzy matching
export interface ReferenceNode {
    id: string;
    name: string;
    type: string;
}

interface ChatInterfaceProps {
    defaultScope?: 'GLOBAL' | 'ENTITY' | 'GRAPH';
    entityId?: string; // ID for backend retrieval (e.g. "ISOLATE_X")
    entityName?: string; // Display name
    visibleNodes?: ReferenceNode[]; // Nodes currently in the graph for fuzzy matching
    contextGraphIds?: string[]; // IDs for backend context
    embedded?: boolean; // If true, fills parent container, no floating window
    onClose?: () => void;
    onRunCypher?: (query: string) => void;
    onSelectNode?: (nodeId: string) => void;
    onRequestLoadGraph?: (searchTerm: string) => void;
}

export function ChatInterface({
    defaultScope = 'GLOBAL',
    entityId,
    entityName,
    visibleNodes = [],
    contextGraphIds = [],
    embedded = false,
    onClose,
    onRunCypher,
    onSelectNode,
    onRequestLoadGraph
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: entityName
                ? `Bonjour ! Je suis prêt à discuter de **${entityName}**.`
                : 'Bonjour ! Je suis votre expert en génomique Ganoderma. Interrogez-moi sur les gènes, les isolats ou les niveaux d\'expression.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [scope, setScope] = useState<'GLOBAL' | 'ENTITY' | 'GRAPH'>(defaultScope);

    // Window State (Only for floating mode)
    const [isOpen, setIsOpen] = useState(true);
    const [isMinimized, setIsMinimized] = useState(true);
    const [size, setSize] = useState({ width: 400, height: 600 });
    const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 100 });

    // Cypher Review State
    const [pendingCypher, setPendingCypher] = useState<string | null>(null);
    const [refinementText, setRefinementText] = useState('');

    // Node Not Found Modal State
    const [missingNode, setMissingNode] = useState<{ name: string } | null>(null);
    const [loadDepth, setLoadDepth] = useState(4);

    // Drag/Resize State
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, lx: 0, ly: 0 });
    const resizeDir = useRef<string>('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Sync state with props when switching contexts (e.g. Node selection)
    useEffect(() => {
        if (defaultScope) setScope(defaultScope);
    }, [defaultScope, entityId]);

    useEffect(() => {
        if ((embedded || (isOpen && !isMinimized))) {
            scrollToBottom();
        }
    }, [messages, isLoading, isOpen, isMinimized, size, embedded]);

    // Drag Logic (Header) - Only if not embedded
    const handleMouseDown = (e: React.MouseEvent) => {
        if (embedded || isMinimized) return;
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    // Resize Logic
    const handleResizeMouseDown = (e: React.MouseEvent, dir: string) => {
        if (embedded) return;
        e.stopPropagation();
        setIsResizing(true);
        resizeDir.current = dir;
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: size.width,
            h: size.height,
            lx: position.x,
            ly: position.y
        };
    };

    useEffect(() => {
        if (embedded) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.current.x;
                const deltaY = e.clientY - resizeStart.current.y;
                const dir = resizeDir.current;

                let newWidth = resizeStart.current.w;
                let newHeight = resizeStart.current.h;
                let newX = resizeStart.current.lx;
                let newY = resizeStart.current.ly;

                // Horizontal Resize
                if (dir.includes('e')) {
                    newWidth = Math.max(300, resizeStart.current.w + deltaX);
                } else if (dir.includes('w')) {
                    const proposedWidth = resizeStart.current.w - deltaX;
                    if (proposedWidth >= 300) {
                        newWidth = proposedWidth;
                        newX = resizeStart.current.lx + deltaX;
                    }
                }

                // Vertical Resize
                if (dir.includes('s')) {
                    newHeight = Math.max(400, resizeStart.current.h + deltaY);
                } else if (dir.includes('n')) {
                    const proposedHeight = resizeStart.current.h - deltaY;
                    if (proposedHeight >= 400) {
                        newHeight = proposedHeight;
                        newY = resizeStart.current.ly + deltaY;
                    }
                }

                setSize({ width: newWidth, height: newHeight });
                setPosition({ x: newX, y: newY });
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDragging, isResizing, embedded]);

    const clearChat = () => {
        setMessages([
            { role: 'assistant', content: 'Historique effacé. De quoi voulez-vous discuter ?' }
        ]);
    };

    const sendMessage = async (overrideContent?: string, overrideHistory?: Message[]) => {
        const contentToSend = overrideContent || input;
        if (!contentToSend.trim()) return;

        if (!overrideContent) {
            setMessages(prev => [...prev, { role: 'user', content: contentToSend }]);
            setInput('');
        }

        setIsLoading(true);

        try {
            const historyToSend = overrideHistory || messages.map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('http://localhost:8080/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: contentToSend,
                    scope: 'GLOBAL', // Always use GLOBAL/Unified scope
                    entityId: entityId, // Always pass available context
                    contextIds: contextGraphIds,
                    history: historyToSend
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            // Check for Graph Update Command
            if (data.cypherQuery && onRunCypher) {
                console.log("AI intercepted graph update:", data.cypherQuery);
                // Instead of auto-running, set it for review
                setPendingCypher(data.cypherQuery);
                setRefinementText(''); // Reset refinement input
            } else if (pendingCypher && !data.cypherQuery) {
                // If we were refining and got no new cypher, maybe the AI just answered simple text?
                // Or maybe it cleared the cypher?
                // Usually we expect a new cypher if we are in refinement loop, unless AI says "Okay I cancelled".
                // But let's keep the panel open if we still have one, or simple logic:
                // If no cypher returned, keep the old one? Or assume refinement failed/finished?
                // Let's assume if we are refining, we want a new cypher.
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erreur de connexion à la base de connaissances. Vérifiez que le Backend fonctionne.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRunCypher = () => {
        if (pendingCypher && onRunCypher) {
            onRunCypher(pendingCypher);
            setPendingCypher(null);
            setMessages(prev => [...prev, { role: 'assistant', content: '✅ Requête validée et exécutée.' }]);
        }
    };

    const handleRefineCypher = () => {
        if (!refinementText.trim() || !pendingCypher) return;

        // Construct history with the pending cypher injected so AI knows what to refine
        const historyWithContext: Message[] = [
            ...messages,
            { role: 'assistant', content: `[SYSTEM: Proposed Cypher for Review]\n${pendingCypher}` } // Inject as context
        ];

        // Add user refinement message visually too? 
        // Yes, showing the refinement flow is good.
        setMessages(prev => [...prev, { role: 'user', content: `Modification: ${refinementText}` }]);

        // Send Refinement
        sendMessage(refinementText, historyWithContext);
    };

    const handleCancelCypher = () => {
        setPendingCypher(null);
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Requête annulée.' }]);
    };

    // --- Reference Link Handling ---

    const handleReferenceClick = (refName: string) => {
        // 1. Fuzzy Search in visibleNodes
        if (!visibleNodes || visibleNodes.length === 0) {
            // No graph data? Just propose load
            setMissingNode({ name: refName });
            return;
        }

        let bestMatch: ReferenceNode | null = null;
        let bestDistance = Infinity;

        // Threshold: Allow up to 2-3 edits for longer words, less for short
        // Or simpler: Normalize and check contains
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const target = normalize(refName);

        // Exact substring match check first (often faster and better for "G. boninense")
        const exactMatch = visibleNodes.find(n => normalize(n.name) === target);
        if (exactMatch) {
            onSelectNode?.(exactMatch.id);
            return;
        }

        // Levenshtein Fallback
        for (const node of visibleNodes) {
            const dist = Levenshtein.get(refName.toLowerCase(), node.name.toLowerCase());
            if (dist < bestDistance) {
                bestDistance = dist;
                bestMatch = node;
            }
        }

        const maxDist = Math.max(2, Math.floor(refName.length * 0.3));

        if (bestMatch && bestDistance <= maxDist) {
            // Found!
            console.log(`Fuzzy Match: '${refName}' -> '${bestMatch.name}' (dist: ${bestDistance})`);
            onSelectNode?.(bestMatch.id);
        } else {
            // Not Found
            console.log(`No match for '${refName}'. Best was '${bestMatch?.name}' (dist: ${bestDistance})`);
            setMissingNode({ name: refName });
        }
    };

    const getIconForEntity = (name: string) => {
        // 1. Try to find in visible nodes to get strict type
        const normalizedName = name.toLowerCase();
        const node = visibleNodes?.find(n => n.name.toLowerCase() === normalizedName);
        if (node) {
            switch (node.type) {
                case 'Gene': return <Dna size={10} className="inline text-neo-primary" />;
                case 'Isolate': return <Microscope size={10} className="inline text-neo-primary" />;
                case 'Sample': return <TestTube size={10} className="inline text-neo-primary" />;
                case 'Orthogroup': return <Network size={10} className="inline text-neo-primary" />;
                default: return <Tag size={10} className="inline text-neo-primary" />;
            }
        }

        // 2. Fallback: Name Heuristics
        if (name.startsWith('G.') || name.includes('boninense')) return <Microscope size={10} className="inline text-neo-primary" />;
        if (name.startsWith('OG')) return <Network size={10} className="inline text-neo-primary" />;
        if (name.startsWith('Gbon') || name.startsWith('Tox') || name.startsWith('Eff')) return <Dna size={10} className="inline text-neo-primary" />;

        // 3. Default
        return <Tag size={10} className="inline text-neo-primary" />;
    };

    const renderMessageContent = (content: string) => {
        const parts = [];
        let lastIndex = 0;
        let match;

        // Re-create regex for each render to avoid state issues
        const regex = /<<([^>]+)>>/g;

        while ((match = regex.exec(content)) !== null) {
            // Text before match
            if (match.index > lastIndex) {
                parts.push(
                    <ReactMarkdown key={`text-${lastIndex}`} components={{ p: 'span' }}>
                        {content.substring(lastIndex, match.index)}
                    </ReactMarkdown>
                );
            }

            // The Reference
            const refName = match[1];
            parts.push(
                <button
                    key={`ref-${match.index}`}
                    onClick={() => handleReferenceClick(refName)}
                    className="inline-flex items-center gap-1 px-1 py-0.5 mx-0.5 bg-neo-accent/30 text-neo-black border border-neo-black/20 rounded hover:bg-neo-accent hover:border-neo-black transition-all text-xs font-bold cursor-pointer align-baseline"
                    title="Cliquez pour voir dans le graphe"
                >
                    {getIconForEntity(refName)}
                    {refName}
                </button>
            );

            lastIndex = regex.lastIndex;
        }

        // Remaining text
        if (lastIndex < content.length) {
            parts.push(
                <ReactMarkdown key={`text-${lastIndex}`} components={{ p: 'span' }}>
                    {content.substring(lastIndex)}
                </ReactMarkdown>
            );
        }

        return <div className="leading-relaxed">{parts}</div>;
    };

    // Inner Content Component
    const chatContent = (
        <>
            {/* Header */}
            <div
                onMouseDown={handleMouseDown}
                className={`bg-neo-accent p-3 border-b-3 border-neo-black flex items-center justify-between ${!embedded ? 'cursor-grab active:cursor-grabbing' : ''} select-none`}
            >
                <div className="flex items-center gap-2 pointer-events-none">
                    <div className="p-1.5 bg-neo-black text-neo-accent border-2 border-neo-black shadow-neo-sm">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="font-black text-xs text-neo-black uppercase tracking-tight flex items-center gap-2">
                            {entityName ? `Contexte: ${entityName}` : 'Assistant Unifié'}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
                    {/* Scope Switcher Removed - Context is now Automatic */}

                    {!embedded && (
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-1 hover:bg-neo-black hover:text-white transition-colors border-2 border-transparent hover:border-neo-black"
                            title="Réduire"
                        >
                            <Minus size={16} />
                        </button>
                    )}

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-neo-black hover:text-white transition-colors border-2 border-transparent hover:border-neo-black"
                            title="Fermer"
                        >
                            <Minus size={16} className="rotate-45" />
                        </button>
                    )}

                    {!onClose && (
                        <button
                            onClick={clearChat}
                            className="p-1 hover:bg-neo-black hover:text-white transition-colors border-2 border-transparent hover:border-neo-black"
                            title="Effacer"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-neo-bg">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 border-2 border-neo-black shadow-neo-sm flex items-center justify-center shrink-0 
                            ${msg.role === 'assistant'
                                ? 'bg-neo-secondary text-neo-black'
                                : 'bg-neo-primary text-neo-white'
                            }`}>
                            {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                        </div>

                        <div className={`max-w-[85%] px-3 py-2 text-sm font-medium border-2 border-neo-black shadow-neo-sm
                            ${msg.role === 'assistant'
                                ? 'bg-neo-white text-neo-black'
                                : 'bg-neo-black text-neo-white'}`}>
                            {msg.role === 'assistant' ? (
                                renderMessageContent(msg.content)
                            ) : (
                                <div className="prose prose-xs max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-2">
                        <div className="w-8 h-8 border-2 border-neo-black shadow-neo-sm bg-neo-secondary text-neo-black flex items-center justify-center shrink-0">
                            <Bot size={16} />
                        </div>
                        <div className="bg-neo-white px-3 py-2 border-2 border-neo-black shadow-neo-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Cypher Review Panel */}
            {pendingCypher && (
                <div className="bg-neo-accent/20 p-3 border-t-3 border-neo-black space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-neo-black flex items-center gap-1">
                            <Sparkles size={12} /> Review Cypher Query
                        </span>
                        <div className="flex gap-1">
                            {/* Run Button is now primary action at bottom or beside text? 
                                Let's keep it in header or separate? 
                                User wants to *Refine* easily. */}
                            <button onClick={handleCancelCypher} className="p-1 bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-bg text-xs font-bold" title="Annuler">
                                <X size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Editable Cypher */}
                    <textarea
                        className="w-full h-24 bg-neo-white border-2 border-neo-black p-2 text-xs font-mono resize-none focus:outline-none focus:shadow-neo"
                        value={pendingCypher}
                        onChange={(e) => setPendingCypher(e.target.value)}
                    />

                    {/* Refinement Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-neo-white border-2 border-neo-black px-2 py-1 text-xs font-bold focus:shadow-neo focus:outline-none"
                            placeholder="Affiner la requête (ex: 'Ajoute les gènes', 'Seulement Malaisie')..."
                            value={refinementText}
                            onChange={(e) => setRefinementText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefineCypher()}
                        />
                        <button
                            onClick={handleRefineCypher}
                            disabled={!refinementText.trim() || isLoading}
                            className="bg-neo-white text-neo-black border-2 border-neo-black px-2 py-1 text-xs font-bold hover:bg-neo-accent transition-colors disabled:opacity-50"
                        >
                            <Sparkles size={12} className="inline mr-1" /> Modifier
                        </button>
                    </div>

                    {/* Execute Button - Moved to bottom for clear flow */}
                    <button
                        onClick={handleRunCypher}
                        className="w-full py-1.5 bg-neo-black text-neo-accent hover:bg-neo-primary hover:text-neo-black text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors"
                    >
                        <Play size={14} /> Valider & Exécuter
                    </button>
                </div>
            )}

            {/* Missing Node Modal (Inside Chat) */}
            {
                missingNode && (
                    <div className="absolute bottom-16 left-4 right-4 bg-neo-white border-2 border-neo-black shadow-neo p-3 z-50 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-black uppercase text-red-500 flex items-center gap-1">
                                <Search size={12} /> Élement non trouvé
                            </h3>
                            <button onClick={() => setMissingNode(null)} className="hover:bg-neo-bg p-0.5 rounded">
                                <X size={14} />
                            </button>
                        </div>
                        <p className="text-sm font-bold mb-3">
                            "{missingNode.name}" n'est pas visible dans le graphe actuel.
                        </p>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase block mb-1">Profondeur</label>
                                <input
                                    type="number"
                                    min={1} max={10}
                                    value={loadDepth}
                                    onChange={(e) => setLoadDepth(parseInt(e.target.value))}
                                    className="w-full border-2 border-neo-black px-2 py-1 text-sm font-bold bg-neo-bg"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    onRequestLoadGraph?.(`${missingNode.name} depth=${loadDepth}`);
                                    setMessages(prev => [...prev, { role: 'assistant', content: `🔍 Chargement du graphe pour **${missingNode.name}** (Profondeur: ${loadDepth})...` }]);
                                    setMissingNode(null);
                                }}
                                className="bg-neo-black text-neo-accent px-3 py-1.5 border-2 border-neo-black text-xs font-black uppercase hover:bg-neo-primary hover:text-neo-black transition-colors"
                            >
                                <ExternalLink size={14} className="inline mr-1" /> Charger
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Input Area */}
            <div className="p-3 bg-neo-white border-t-3 border-neo-black">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-neo-bg border-2 border-neo-black px-3 py-2 text-sm font-bold text-neo-black 
                        focus:shadow-neo focus:outline-none transition-all placeholder:text-neo-black/40"
                        placeholder={scope === 'ENTITY' ? "Question sur cet élément..." : "Posez une question..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={isLoading || !input.trim()}
                        className="bg-neo-black text-neo-white border-2 border-neo-black px-3 py-2 hover:bg-neo-primary hover:text-neo-black hover:shadow-neo transition-all disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </>
    );

    // Render: Embedded Mode
    if (embedded) {
        return (
            <div className="flex flex-col h-full w-full bg-neo-white border-t-3 border-neo-black relative"> {/* Added relative for modal positioning */}
                {chatContent}
            </div>
        );
    }

    // Render: Minimized Floating Icon
    if (isMinimized || !isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto">
                {!isOpen && (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-14 h-14 bg-neo-accent border-3 border-neo-black shadow-neo rounded-full flex items-center justify-center hover:scale-110 hover:rotate-3 transition-transform animate-bounce-slow"
                    >
                        <Sparkles size={24} className="text-neo-black" />
                    </button>
                )}

                {isOpen && isMinimized && (
                    <div
                        className="bg-neo-white border-3 border-neo-black shadow-neo p-2 flex items-center gap-3 cursor-pointer hover:bg-neo-bg transition-colors"
                        onClick={() => setIsMinimized(false)}
                    >
                        <div className="p-1 bg-neo-black text-neo-accent">
                            <Bot size={18} />
                        </div>
                        <span className="font-bold text-sm uppercase">Assistant IA</span>
                        <Maximize2 size={16} />
                    </div>
                )}
            </div>
        );
    }

    // Render: Full Floating Window
    return (
        <div
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                position: 'fixed'
            }}
            className={`flex flex-col bg-neo-white border-3 border-neo-black shadow-neo-xl z-50 transition-shadow duration-75 ${isDragging || isResizing ? 'shadow-none' : ''}`}
        >
            {chatContent}

            {/* Resize Handles */}
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'n')} className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 's')} className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'w')} className="absolute left-0 top-2 bottom-2 w-1 cursor-ew-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'e')} className="absolute right-0 top-2 bottom-2 w-1 cursor-ew-resize z-50"></div>

            <div onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-50"></div>
            <div onMouseDown={(e) => handleResizeMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-50">
            </div>
        </div>
    );
}

