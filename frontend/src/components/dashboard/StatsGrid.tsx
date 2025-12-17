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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {items.map((item) => (
                <div key={item.label} className={`${item.color} p-4 border-3 border-neo-black shadow-neo-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-crosshair`}>
                    <div className="text-3xl font-black text-neo-black">{item.value}</div>
                    <div className="text-sm font-bold uppercase tracking-widest mt-1 border-t-2 border-neo-black pt-1">{item.label}</div>
                </div>
            ))}
        </div>
    );
}
