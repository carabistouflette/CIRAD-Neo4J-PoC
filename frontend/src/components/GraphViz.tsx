import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { Scan, RefreshCw, Search, X, Filter, Info, Share2, Database, ChevronDown, ChevronUp, MessageSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import { ChatInterface, type ReferenceNode } from './ChatInterface';

// --- Types ---

type NodeType = 'Gene' | 'Isolate' | 'Sample' | 'Orthogroup';

interface GraphNode {
    id: string;
    group: number;
    val: number; // size
    name: string;
    type: NodeType;
    description?: string;
    details?: Record<string, string>;
    color?: string;
    x?: number;
    y?: number;
}

interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    label?: string;
    value?: number; // Added for synthetic links
}


interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

// --- Configuration ---

const NODE_CONFIG: Record<NodeType, { color: string; shape: 'circle' | 'square' | 'triangle' | 'diamond', label: string }> = {
    'Gene': { color: '#FFE66D', shape: 'circle', label: 'Gène' },       // Yellow
    'Isolate': { color: '#FF6B6B', shape: 'square', label: 'Isolat' },   // Red
    'Sample': { color: '#4ECDC4', shape: 'triangle', label: 'Échantillon' }, // Teal
    // 'Pathway' removed as it was an alias for Orthogroup
    'Orthogroup': { color: '#8E44AD', shape: 'diamond', label: 'Orthogroupe' } // Purple
};

// --- Component ---

interface GraphVizProps {
    initialData?: GraphData;
    onExecuteQuery?: (query: string) => void;
}

export function GraphViz({ initialData, onExecuteQuery }: GraphVizProps) {
    const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(undefined);



    const containerRef = useRef<HTMLDivElement>(null);
    const data = useMemo(() => initialData || { nodes: [], links: [] }, [initialData]);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });


    // UI State
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [showChat, setShowChat] = useState(false);

    // Helper to select node and reset chat
    const selectNode = (node: GraphNode | null) => {
        setSelectedNode(node);
        setShowChat(false);
    };

    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<NodeType[]>(['Isolate', 'Sample', 'Orthogroup']); // 'Gene' hidden by default
    const [isFilterCollapsed, setIsFilterCollapsed] = useState(false); // Collapsible filters



    // Responsive Sizing
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };
        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Filtered Data with Aggregation Logic
    const visibleData = useMemo(() => {
        if (!data || !data.nodes) return { nodes: [], links: [] };

        const showGenes = activeFilters.includes('Gene');

        // 1. Filter Nodes based on active types
        // If Genes are hidden, we still keep them in mind for aggregation, 
        // but we don't return them as "nodes".
        // Actually, simpler: Filter nodes normally for display.
        const visibleNodes = (data.nodes || []).filter(n => activeFilters.includes(n.type));
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

        // 2. Links Logic
        let visibleLinks: GraphLink[] = [];
        const allLinks = data.links || [];


        if (showGenes) {

            // Standard View: Show all links connecting visible nodes
            visibleLinks = allLinks.filter(l => {
                const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
                const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
                return visibleNodeIds.has(sourceId as string) && visibleNodeIds.has(targetId as string);
            });
        } else {
            // Aggregated View: Hide Genes, Connect Isolate <-> Orthogroup directly
            // We need to traverse the implicit paths: Isolate <- Gene -> Orthogroup
            // Since links are Gene->Isolate and Gene->Orthogroup (based on seed.py)

            // Map GeneID -> IsolateID and GeneID -> OrthogroupID
            const geneToIsolate = new Map<string, string>();
            const geneToOG = new Map<string, string>();

            // Pre-process all links to build maps
            allLinks.forEach(l => {
                const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source as string;
                const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target as string;

                // Find gene being the source
                const sourceNode = data.nodes.find(n => n.id === sourceId);
                if (sourceNode?.type === 'Gene') {
                    const targetNode = data.nodes.find(n => n.id === targetId);
                    if (targetNode?.type === 'Isolate') geneToIsolate.set(sourceId, targetId);
                    if (targetNode?.type === 'Orthogroup') geneToOG.set(sourceId, targetId);
                }
            });

            // Find intersections
            const connections = new Map<string, number>(); // Key: "IsolateID-| -OrthogroupID" -> Count

            (data.nodes || []).filter(n => n.type === 'Gene').forEach(gene => {
                const isoId = geneToIsolate.get(gene.id);
                const ogId = geneToOG.get(gene.id);

                if (isoId && ogId && visibleNodeIds.has(isoId) && visibleNodeIds.has(ogId)) {
                    const key = `${isoId}|${ogId}`;
                    connections.set(key, (connections.get(key) || 0) + 1);
                }
            });

            // Create Synthetic Links
            connections.forEach((count, key) => {
                const [source, target] = key.split('|');
                visibleLinks.push({
                    source,
                    target,
                    label: `${count} shared genes`,
                    value: count // Use this for styling width
                });
            });
        }

        return { nodes: visibleNodes, links: visibleLinks };
    }, [data, activeFilters]);

    // Handle Search via Event (To avoid setState in useEffect)
    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (query && fgRef.current) {
            const node = data.nodes.find(n => n.name.toLowerCase().includes(query.toLowerCase()));
            if (node && node.x !== undefined && node.y !== undefined) {
                fgRef.current.centerAt(node.x, node.y, 1000);
                fgRef.current.zoom(6, 2000);
                selectNode(node);
            }
        }
    };




    // Data for Chat Context: Use logicalId if available (for Backend lookup)
    const contextGraphIds = useMemo(() => {
        // visibleData.nodes is already filtered by activeFilters
        return visibleData.nodes.map(node => {
            // Use injected logicalId (from GraphController) if present, else fallback to ID
            return node?.details?.logicalId || (node.id as string);
        });
    }, [visibleData.nodes]);

    // Prepare Visible Nodes for Fuzzy Matching in Chat
    const chatVisibleNodes: ReferenceNode[] = useMemo(() => {
        return visibleData.nodes.map(node => ({
            id: node.id,
            name: node.name,
            type: node.type
        }));
    }, [visibleData.nodes]);

    // Handle Node Selection from Chat
    const handleSelectNode = (nodeId: string) => {
        const node = data.nodes.find(n => n.id === nodeId);
        if (node && fgRef.current) {
            // Ensure filters allow seeing this node
            if (!activeFilters.includes(node.type)) {
                setActiveFilters(prev => [...prev, node.type]);
            }

            fgRef.current.centerAt(node.x ?? 0, node.y ?? 0, 1000);
            fgRef.current.zoom(5, 1000); // Zoom in
            selectNode(node);

            // Optionally open panel if closed
            if (!isPanelOpen) setIsPanelOpen(true);
        }
    };

    // Handle Graph Load Request from Chat
    const handleRequestLoadGraph = (request: string) => {
        if (!onExecuteQuery) return;

        // Parse Request: "Name depth=X"
        // Heuristic parsing
        const depthMatch = request.match(/depth=(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 2;
        const namePart = request.replace(/depth=\d+/, '').trim();

        console.log(`Loading Graph for: ${namePart} (depth: ${depth})`);

        // Generate Cypher
        // Case insensitive partial match for Name or Symbol
        // We use optional relationships to catch Isolate-Gene-OG chains
        const cypher = `
            MATCH (n)
            WHERE n.name CONTAINS '${namePart}' OR n.symbol CONTAINS '${namePart}'
            WITH n LIMIT 1
            MATCH p = (n)-[*1..${depth}]-(m)
            RETURN p LIMIT 300
        `;

        onExecuteQuery(cypher);
    };

    // Custom Node Rendering
    const drawNode = (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const config = NODE_CONFIG[node.type as NodeType] || { color: '#888', shape: 'circle' };
        const label = node.name;
        const size = node.val / 2;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = '#050505';
        ctx.lineWidth = 2 / globalScale; // Thinner border when zoomed out, but visible

        const nx = node.x ?? 0;
        const ny = node.y ?? 0;

        // Shape Logic
        ctx.beginPath();
        if (config.shape === 'square') {
            ctx.rect(nx - size, ny - size, size * 2, size * 2);
        } else if (config.shape === 'triangle') {
            ctx.moveTo(nx, ny - size);
            ctx.lineTo(nx - size, ny + size);
            ctx.lineTo(nx + size, ny + size);
            ctx.closePath();
        } else if (config.shape === 'diamond') {
            ctx.moveTo(nx, ny - size);
            ctx.lineTo(nx + size, ny);
            ctx.lineTo(nx, ny + size);
            ctx.lineTo(nx - size, ny);
            ctx.closePath();
        } else {
            ctx.arc(nx, ny, size, 0, 2 * Math.PI, false);
        }

        ctx.fill();
        ctx.stroke();

        // Highlight if selected
        if (selectedNode?.id === node.id) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4 / globalScale;
            ctx.stroke();
            ctx.strokeStyle = '#050505'; // restore
        }

        // Label
        if (globalScale > 1.5 || selectedNode?.id === node.id) {
            ctx.font = `bold ${4}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#050505';
            ctx.fillText(label, nx, ny + size + 2);
        }

    };

    return (
        <div className="flex h-full w-full relative bg-slate-50 overflow-hidden" ref={containerRef}>

            {/* Top Bar: Title & Filters (Floating) */}
            <div className="absolute top-12 left-6 right-6 z-10 flex flex-wrap justify-between items-start pointer-events-none">

                {/* Search & Legend Toggle */}
                <div className="flex flex-col gap-2 pointer-events-auto">
                    <div className="bg-neo-white border-2 border-neo-black shadow-neo-sm p-1 flex items-center">
                        <Search className="ml-2 w-4 h-4 text-neo-black" />
                        <input
                            className="bg-transparent border-none outline-none text-xs font-bold text-neo-black px-2 py-1 w-48"
                            placeholder="Rechercher un nœud..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>

                    {/* Legend / Filters */}
                    <div className="bg-neo-white border-2 border-neo-black shadow-neo-sm p-3 space-y-2 transition-all">
                        <button
                            className="w-full text-xs font-black uppercase mb-1 flex items-center justify-between gap-2 hover:text-neo-primary transition-colors"
                            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                        >
                            <span className="flex items-center gap-2"><Filter size={12} /> Filtres</span>
                            {isFilterCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>

                        {!isFilterCollapsed && (
                            <div className="flex flex-col gap-1">
                                {(Object.keys(NODE_CONFIG) as NodeType[]).map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-neo-bg px-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={activeFilters.includes(type)}
                                            onChange={(e) => {
                                                if (e.target.checked) setActiveFilters([...activeFilters, type]);
                                                else setActiveFilters(activeFilters.filter(t => t !== type));
                                            }}
                                            className="accent-neo-black"
                                        />
                                        <span
                                            className="w-3 h-3 border border-neo-black inline-block"
                                            style={{ backgroundColor: NODE_CONFIG[type].color }}
                                        ></span>
                                        <span className="text-xs font-bold uppercase">{NODE_CONFIG[type].label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="pointer-events-auto flex gap-2">
                    <button className="bg-neo-white p-2 border-2 border-neo-black shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        onClick={() => {
                            fgRef.current?.zoomToFit(500);
                            selectNode(null);
                        }}
                        title="Réinitialiser la vue">
                        <Scan size={18} />
                    </button>
                    <button className="bg-neo-white p-2 border-2 border-neo-black shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        onClick={() => window.location.reload()} // Quick mock refresh
                        title="Recharger les données">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Graph Canvas */}
            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={visibleData}
                nodeCanvasObject={drawNode} // Use custom drawing
                nodePointerAreaPaint={(node: GraphNode, color, ctx) => {
                    const size = node.val / 2;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, size + 2, 0, 2 * Math.PI, false);
                    ctx.fill();
                }}
                linkColor={() => '#050505'}
                linkWidth={(link: GraphLink & { value?: number }) => link.value ? Math.sqrt(link.value) + 1 : 1.5}
                backgroundColor="#FFFFFE"
                onNodeClick={(node) => {
                    const gNode = node as GraphNode;
                    selectNode(gNode);
                    if (gNode.x !== undefined && gNode.y !== undefined) {
                        fgRef.current?.centerAt(gNode.x, gNode.y, 1000);
                        fgRef.current?.zoom(5, 1000);
                    }
                }}
                onBackgroundClick={() => selectNode(null)}
            />

            {/* Side Panel (Details & Chat) */}
            <div className={`absolute top-0 right-0 h-full w-80 bg-neo-white border-l-3 border-neo-black shadow-xl z-20 flex flex-col transition-transform duration-300 ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Toggle Button */}
                <button
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    className="absolute left-0 top-6 -translate-x-full bg-neo-white border-3 border-r-0 border-neo-black p-2 shadow-neo-sm flex items-center justify-center hover:bg-neo-accent transition-colors"
                    title={isPanelOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
                >
                    {isPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>

                {/* 1. Global / Entity Chat (Persistent) */}
                <div className="flex-1 flex flex-col relative min-h-0" style={{ display: (!selectedNode || showChat) ? 'flex' : 'none' }}>
                    <ChatInterface
                        embedded={true}
                        defaultScope={selectedNode ? 'ENTITY' : 'GLOBAL'}
                        entityId={selectedNode?.id}
                        entityName={selectedNode?.name}
                        contextGraphIds={contextGraphIds}
                        visibleNodes={chatVisibleNodes} // Pass visible nodes for fuzzy finding
                        onSelectNode={handleSelectNode} // Handle click on reference
                        onRequestLoadGraph={handleRequestLoadGraph} // Handle "Load Graph" request
                        // If we are in "Explicit Connect" mode (showChat=true), show close button to go back to details
                        // If we are in "Global Mode" (!selectedNode), no close button
                        onClose={selectedNode ? () => setShowChat(false) : undefined}
                        onRunCypher={onExecuteQuery}
                    />
                </div>

                {/* 2. Node Details (Visible only if Node Selected AND Chat NOT explicitly requested) */}
                {selectedNode && (
                    <div className="flex flex-col h-full bg-neo-white" style={{ display: showChat ? 'none' : 'flex' }}>
                        <div className="bg-neo-accent p-4 border-b-2 border-neo-black flex justify-between items-start shrink-0">
                            <div>
                                <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase bg-neo-black text-neo-white mb-2 tracking-wider">
                                    {NODE_CONFIG[selectedNode.type]?.label || 'NOEUD'}
                                </span>
                                <h2 className="text-xl font-black leading-tight">{selectedNode.name}</h2>
                            </div>
                            <button onClick={() => selectNode(null)} className="hover:bg-neo-black hover:text-white rounded p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto font-mono">
                            <p className="text-sm font-medium mb-6 leading-relaxed">
                                {selectedNode.description || "Aucune description disponible."}
                            </p>

                            {selectedNode.details && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase border-b-2 border-neo-black pb-1 flex items-center gap-2">
                                        <Info size={14} /> Caractéristiques
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {Object.entries(selectedNode.details).map(([key, value]) => (
                                            <div key={key} className="bg-neo-bg p-2 border border-neo-black">
                                                <div className="text-[10px] uppercase text-neo-black/60 font-bold">{key}</div>
                                                <div className="text-sm font-bold">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex flex-col gap-2">
                                <button
                                    onClick={() => setShowChat(true)}
                                    className="w-full bg-neo-black text-neo-white py-3 px-3 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-neo-primary hover:text-neo-black transition-colors shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                                >
                                    <MessageSquare size={16} /> En discuter avec l'IA
                                </button>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-white border border-neo-black text-neo-black py-2 px-3 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-neo-bg transition-colors">
                                        <Database size={14} /> Explorer
                                    </button>
                                    <button className="flex-1 bg-white border border-neo-black text-neo-black py-2 px-3 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-neo-bg transition-colors">
                                        <Share2 size={14} /> Partager
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}


