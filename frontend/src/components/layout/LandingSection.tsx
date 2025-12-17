import { ChevronDown } from 'lucide-react';

export function LandingSection() {
    const handleScrollDown = () => {
        window.scrollTo({
            top: window.innerHeight,
            behavior: 'smooth'
        });
    };

    return (
        <div className="h-screen w-full bg-neo-bg flex flex-col items-center justify-center relative overflow-hidden border-b-3 border-neo-black z-40">
            {/* Background Decor */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-neo-secondary rounded-full blur-3xl opacity-50"></div>
            <div className="absolute bottom-10 right-10 w-48 h-48 bg-neo-primary rounded-full blur-3xl opacity-50"></div>

            {/* Main Content */}
            <div className="text-center z-10 p-6 max-w-4xl">
                <div className="mb-6 inline-block bg-neo-black text-neo-white px-4 py-1 text-sm font-black uppercase tracking-widest transform -rotate-2">
                    Plateforme d'Analyse Génomique
                </div>

                <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-4 text-neo-black drop-shadow-neo-white">
                    Ganoderma <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo-primary to-neo-accent">Explorer</span>
                </h1>

                <p className="text-xl md:text-2xl font-bold text-neo-black/80 max-w-2xl mx-auto mb-12 leading-relaxed">
                    Visualisation interactive de graphes multi-omiques, analyse de pathogénicité et assistance IA en temps réel.
                </p>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                    <button
                        onClick={handleScrollDown}
                        className="bg-neo-black text-neo-white border-2 border-neo-black px-8 py-4 text-lg font-black uppercase hover:bg-neo-primary hover:text-neo-black hover:shadow-neo transition-all active:translate-y-1 active:shadow-none flex items-center gap-2"
                    >
                        Explorer le Graphe
                    </button>
                    <div className="text-sm font-bold uppercase tracking-wider text-neo-black/60">
                        v1.0.0-PoC • CIRAD / UMR PHIM
                    </div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 animate-bounce cursor-pointer" onClick={handleScrollDown}>
                <ChevronDown size={48} className="text-neo-black" strokeWidth={3} />
            </div>
        </div>
    );
}
