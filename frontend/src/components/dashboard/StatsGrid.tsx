import { useEffect, useState } from 'react';

export function StatsGrid() {
    const [stats, setStats] = useState({ isolates: 0, genes: 0, samples: 0 });

    useEffect(() => {
        fetch('http://localhost:8080/api/dashboard/stats')
            .then(res => res.json())
            .then(data => setStats({
                isolates: data.isolatesCount,
                genes: data.genesCount,
                samples: data.samplesCount
            }))
            .catch(err => console.error("Failed to fetch stats:", err));
    }, []);

    const items = [
        { label: 'Isolats', value: stats.isolates, color: 'bg-neo-secondary' },
        { label: 'Gènes', value: stats.genes, color: 'bg-neo-accent' },
        { label: 'Échantillons', value: stats.samples, color: 'bg-neo-primary' }
    ];

    return (
        <div className="flex flex-row flex-wrap gap-4 pointer-events-auto">
            {items.map((item) => (
                <div key={item.label} className="bg-neo-white px-4 py-2 border-3 border-neo-black shadow-neo-sm flex items-center gap-3 hover:-translate-y-1 hover:shadow-neo transition-all">
                    <div className={`w-3 h-3 ${item.color} border-2 border-neo-black`}></div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xl font-black text-neo-black">{item.value}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neo-black/60">{item.label}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
