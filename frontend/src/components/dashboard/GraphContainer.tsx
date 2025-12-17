import type { ReactNode } from 'react';

interface GraphContainerProps {
    children: ReactNode;
}

export function GraphContainer({ children }: GraphContainerProps) {
    return (
        <div className="bg-neo-white flex flex-col relative overflow-hidden h-full w-full border-3 border-neo-black">
            <div className="absolute top-0 left-0 bg-neo-black text-neo-white px-3 py-1 font-bold text-sm z-10">
                VISUALISATION DU GRAPHE
            </div>
            {children}
        </div>
    );
}
