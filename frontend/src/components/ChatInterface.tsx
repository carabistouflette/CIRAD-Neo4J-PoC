import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Bonjour ! Je suis votre expert en génomique Ganoderma. Interrogez-moi sur les gènes, les isolats ou les niveaux d\'expression.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

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
            // Connect to Backend API
            const response = await fetch('http://localhost:8080/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erreur de connexion à la base de connaissances. Vérifiez que le Backend fonctionne.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full lg:h-[700px] bg-neo-white border-3 border-neo-black shadow-neo overflow-hidden relative">

            {/* Header */}
            <div className="bg-neo-accent p-4 border-b-3 border-neo-black flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-neo-black text-neo-accent border-2 border-neo-black shadow-neo-sm">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-black text-neo-black uppercase tracking-tight">Assistant IA</h2>
                        <p className="text-xs font-bold text-neo-black/70">Propulsé par Neo4j + RAG</p>
                    </div>
                </div>
                <button
                    onClick={clearChat}
                    className="p-2 bg-neo-white border-2 border-neo-black shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-neo-primary active:text-white"
                    title="Effacer la discussion"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-neo-bg">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 border-2 border-neo-black shadow-neo-sm flex items-center justify-center shrink-0 
                            ${msg.role === 'assistant'
                                ? 'bg-neo-secondary text-neo-black'
                                : 'bg-neo-primary text-neo-white'
                            }`}>
                            {msg.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
                        </div>

                        <div className={`max-w-[85%] px-4 py-3 text-sm font-medium border-2 border-neo-black shadow-neo-sm
              ${msg.role === 'assistant'
                                ? 'bg-neo-white text-neo-black'
                                : 'bg-neo-black text-neo-white'}`}>
                            <div className="prose prose-sm max-w-none">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-10 h-10 border-2 border-neo-black shadow-neo-sm bg-neo-secondary text-neo-black flex items-center justify-center shrink-0">
                            <Bot size={20} />
                        </div>
                        <div className="bg-neo-white px-4 py-3 border-2 border-neo-black shadow-neo-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-neo-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-neo-white border-t-3 border-neo-black">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-neo-bg border-2 border-neo-black px-4 py-3 text-sm font-bold text-neo-black 
                        focus:shadow-neo focus:outline-none transition-all placeholder:text-neo-black/40"
                        placeholder="Posez une question sur l'expression des gènes..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isLoading || !input.trim()}
                        className="bg-neo-black text-neo-white border-2 border-neo-black px-4 py-2 hover:bg-neo-primary hover:text-neo-black hover:shadow-neo transition-all disabled:opacity-50 disabled:cursor-not-allowed active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
