export function Header() {
    return (
        <div className="bg-neo-white border-3 border-neo-black shadow-neo p-6 mb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-none">
                        Plateforme <span className="bg-neo-primary text-neo-white px-2 inline-block transform -rotate-1">Ganoderma</span>
                    </h1>
                    <p className="text-lg font-bold mt-2 text-neo-black/80">
                        Génomique Comparative & Analyse de Pathogénicité
                    </p>
                </div>
                <div className="hidden md:block text-right">
                    <div className="text-xs font-black uppercase bg-neo-black text-neo-white px-2 py-1 inline-block">v1.0.0-PoC</div>
                    <div className="text-xs font-bold mt-1">CIRAD / UMR PHIM</div>
                </div>
            </div>
        </div>
    );
}
