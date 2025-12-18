import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, Minus, Maximize2, Database, Network, Play, X, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatInterfaceProps {
    defaultScope?: 'GLOBAL' | 'ENTITY' | 'GRAPH';
    entityId?: string; // ID for backend retrieval (e.g. "ISOLATE_X")
    entityName?: string; // Display name
    contextGraphIds?: string[]; // IDs of visible nodes for GRAPH scope
    embedded?: boolean; // If true, fills parent container, no floating window
    onClose?: () => void;
    onRunCypher?: (query: string) => void;
}

export function ChatInterface({
    defaultScope = 'GLOBAL',
    entityId,
    entityName,
    contextGraphIds = [],
    embedded = false,
    onClose,
    onRunCypher
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

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8080/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    scope: scope,
                    entityId: scope === 'ENTITY' ? entityId : undefined,
                    contextIds: scope === 'GRAPH' ? contextGraphIds : undefined,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
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

    const handleCancelCypher = () => {
        setPendingCypher(null);
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Requête annulée.' }]);
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
                            {scope === 'ENTITY' ? `Cible: ${entityName || '...'}` : (scope === 'GRAPH' ? 'Analyse Graphe' : 'Assistant Global')}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
                    {/* Scope Switcher (Only if not fixed to entity or want to allow switching back) */}
                    <>
                        <button
                            onClick={() => setScope(scope === 'GLOBAL' ? 'ENTITY' : 'GLOBAL')}
                            disabled={!entityId}
                            className={`p-1 border-2 border-transparent hover:border-neo-black transition-colors ${scope === 'ENTITY' ? 'text-neo-primary' : 'text-neo-black'}`}
                            title="Contexte Spécifique (Noeuds Sélectionné)"
                        >
                            <Database size={16} />
                        </button>
                        <button
                            onClick={() => setScope(scope === 'GRAPH' ? 'GLOBAL' : 'GRAPH')}
                            disabled={!contextGraphIds || contextGraphIds.length === 0}
                            className={`p-1 border-2 border-transparent hover:border-neo-black transition-colors ${scope === 'GRAPH' ? 'text-neo-primary' : 'text-neo-black'}`}
                            title="Contexte Graphe (Noeuds Visibles)"
                        >
                            <Network size={16} />
                        </button>
                    </>

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
                            <Minus size={16} className="rotate-45" /> {/* Close Icon */}
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
                            <div className="prose prose-xs max-w-none">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
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
                            <button onClick={handleRunCypher} className="p-1 bg-neo-black text-neo-accent hover:bg-neo-primary text-xs font-bold flex items-center gap-1">
                                <Play size={12} /> Run
                            </button>
                            <button onClick={handleCancelCypher} className="p-1 bg-neo-white text-neo-black border-2 border-neo-black hover:bg-neo-bg text-xs font-bold">
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                    <textarea
                        className="w-full h-24 bg-neo-white border-2 border-neo-black p-2 text-xs font-mono resize-none focus:outline-none focus:shadow-neo"
                        value={pendingCypher}
                        onChange={(e) => setPendingCypher(e.target.value)}
                    />
                </div>
            )}

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
                        onClick={sendMessage}
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
            <div className="flex flex-col h-full w-full bg-neo-white border-t-3 border-neo-black"> {/* Added border-t for visual separation in panel */}
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
