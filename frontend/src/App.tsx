import { useState, useEffect, useRef } from 'react';
import { LandingSection } from './components/layout/LandingSection';
import { StatsGrid } from './components/dashboard/StatsGrid';
import { GraphContainer } from './components/dashboard/GraphContainer';
import { GraphViz } from './components/GraphViz';

import { QuerySelector } from './components/dashboard/QuerySelector';

function App() {
  const [showInterface, setShowInterface] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);

  const appSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show interface when app section is more than 30% visible
        setShowInterface(entry.isIntersecting && entry.intersectionRatio > 0.3);
      },
      { threshold: [0, 0.3, 0.5, 0.8, 1] }
    );

    if (appSectionRef.current) {
      observer.observe(appSectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleQuery = async (query: string) => {
    setIsQueryLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/graph/cypher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setGraphData(data);
    } catch (err) {
      console.error("Query failed", err);
      alert("Erreur lors de l'exécution de la requête");
    } finally {
      setIsQueryLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-y-auto snap-y snap-mandatory bg-neo-bg scroll-smooth">
      {/* Landing Page Section */}
      <div className="snap-start relative z-50">
        <LandingSection />
      </div>

      {/* Main Application Section */}
      <div
        ref={appSectionRef}
        id="app-section"
        className="snap-start relative h-screen w-screen overflow-hidden z-10"
      >
        {/* Full Screen Graph */}
        <div className="absolute inset-0 z-0">
          <GraphContainer>
            {!graphData ? (
              <QuerySelector onExecute={handleQuery} isLoading={isQueryLoading} />
            ) : (
              <GraphViz initialData={graphData} onExecuteQuery={handleQuery} />
            )}
          </GraphContainer>
        </div>

        {/* Floating Interface Elements - Only visible when in App Section */}
        <div className={`transition-opacity duration-700 ${showInterface ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Stats (Bottom Left) */}
          <div className="absolute bottom-8 left-8 z-20">
            <StatsGrid />
          </div>



        </div>
      </div>
    </div>
  );
}

export default App;
