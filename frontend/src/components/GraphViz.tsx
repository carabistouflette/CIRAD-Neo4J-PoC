import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Maximize2, RefreshCw, Search, X, Filter, Info, Share2, Database } from 'lucide-react';

// --- Types ---

type NodeType = 'Gene' | 'Isolate' | 'Sample' | 'Pathway';

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
    'Pathway': { color: '#050505', shape: 'diamond', label: 'Voie Métabolique' } // Black
};

// --- Mock Data Removed ---

// --- Component ---

export function GraphViz() {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [, setIsLoading] = useState(true);

    // UI State
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<NodeType[]>(['Gene', 'Isolate', 'Sample', 'Pathway']);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/graph');
                if (!response.ok) throw new Error('Failed to fetch graph data');
                const graphData = await response.json();
                setData(graphData);
            } catch (error) {
                console.error("Error fetching graph data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

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

    // Filtered Data
    const visibleData = useMemo(() => {
        const filteredNodes = data.nodes.filter(n => activeFilters.includes(n.type));
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = data.links.filter(l => {
            const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return filteredNodeIds.has(sourceId as string) && filteredNodeIds.has(targetId as string);
        });
        return { nodes: filteredNodes, links: filteredLinks };
    }, [data, activeFilters]);

    // Handle Search
    useEffect(() => {
        if (searchQuery && fgRef.current) {
            const node = data.nodes.find(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (node && node.x && node.y) {
                fgRef.current.centerAt(node.x, node.y, 1000);
                fgRef.current.zoom(6, 2000);
                setSelectedNode(node);
            }
        }
    }, [searchQuery, data]);

    // Custom Node Rendering
    const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const config = NODE_CONFIG[node.type as NodeType] || { color: '#888', shape: 'circle' };
        const label = node.name;
        const size = node.val / 2;

        ctx.fillStyle = config.color;
        ctx.strokeStyle = '#050505';
        ctx.lineWidth = 2 / globalScale; // Thinner border when zoomed out, but visible

        // Shape Logic
        ctx.beginPath();
        if (config.shape === 'square') {
            ctx.rect(node.x - size, node.y - size, size * 2, size * 2);
        } else if (config.shape === 'triangle') {
            ctx.moveTo(node.x, node.y - size);
            ctx.lineTo(node.x - size, node.y + size);
            ctx.lineTo(node.x + size, node.y + size);
            ctx.closePath();
        } else if (config.shape === 'diamond') {
            ctx.moveTo(node.x, node.y - size);
            ctx.lineTo(node.x + size, node.y);
            ctx.lineTo(node.x, node.y + size);
            ctx.lineTo(node.x - size, node.y);
            ctx.closePath();
        } else {
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
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
            ctx.fillText(label, node.x, node.y + size + 2);
        }
    };

    return (
        <div className="flex h-full w-full relative bg-slate-50 overflow-hidden" ref={containerRef}>

            {/* Top Bar: Title & Filters (Floating) */}
            <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap justify-between items-start pointer-events-none">

                {/* Search & Legend Toggle */}
                <div className="flex flex-col gap-2 pointer-events-auto">
                    <div className="bg-neo-white border-2 border-neo-black shadow-neo-sm p-1 flex items-center">
                        <Search className="ml-2 w-4 h-4 text-neo-black" />
                        <input
                            className="bg-transparent border-none outline-none text-xs font-bold text-neo-black px-2 py-1 w-48"
                            placeholder="Rechercher un nœud..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Legend / Filters */}
                    <div className="bg-neo-white border-2 border-neo-black shadow-neo-sm p-3 space-y-2">
                        <h4 className="text-xs font-black uppercase mb-1 flex items-center gap-2">
                            <Filter size={12} /> Filtres
                        </h4>
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
                    </div>
                </div>

                {/* Controls */}
                <div className="pointer-events-auto flex gap-2">
                    <button className="bg-neo-white p-2 border-2 border-neo-black shadow-neo-sm hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        onClick={() => {
                            fgRef.current?.zoomToFit(500);
                            setSelectedNode(null);
                        }}
                        title="Réinitialiser la vue">
                        <Maximize2 size={18} />
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
                nodePointerAreaPaint={(node: any, color, ctx) => {
                    const size = node.val / 2;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
                    ctx.fill();
                }}
                linkColor={() => '#050505'}
                linkWidth={1.5}
                backgroundColor="#FFFFFE"
                onNodeClick={(node) => {
                    setSelectedNode(node as GraphNode);
                    fgRef.current?.centerAt(node.x, node.y, 1000);
                    fgRef.current?.zoom(5, 1000);
                }}
                onBackgroundClick={() => setSelectedNode(null)}
            />

            {/* Side Panel (Details) */}
            <div className={`absolute top-0 right-0 h-full w-80 bg-neo-white border-l-3 border-neo-black shadow-xl transform transition-transform duration-300 z-20 flex flex-col
                            ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}>

                {selectedNode ? (
                    <>
                        <div className="bg-neo-accent p-4 border-b-2 border-neo-black flex justify-between items-start">
                            <div>
                                <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase bg-neo-black text-neo-white mb-2 tracking-wider">
                                    {NODE_CONFIG[selectedNode.type]?.label || 'NOEUD'}
                                </span>
                                <h2 className="text-xl font-black leading-tight">{selectedNode.name}</h2>
                            </div>
                            <button onClick={() => setSelectedNode(null)} className="hover:bg-neo-black hover:text-white rounded p-1 transition-colors">
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

                            <div className="mt-8 flex gap-2">
                                <button className="flex-1 bg-neo-black text-neo-white py-2 px-3 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-neo-primary hover:text-neo-black transition-colors">
                                    <Database size={14} /> Explorer
                                </button>
                                <button className="flex-1 bg-white border border-neo-black text-neo-black py-2 px-3 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-neo-bg transition-colors">
                                    <Share2 size={14} /> Partager
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-neo-black/30 font-bold uppercase">
                        Aucune sélection
                    </div>
                )}
            </div>

        </div>
    );
}

