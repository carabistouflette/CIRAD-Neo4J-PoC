import { MainLayout } from './components/layout/MainLayout';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { StatsGrid } from './components/dashboard/StatsGrid';
import { GraphContainer } from './components/dashboard/GraphContainer';
import { GraphViz } from './components/GraphViz';
import { ChatInterface } from './components/ChatInterface';

function App() {
  return (
    <MainLayout>
      <Header />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Stats & Graph */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <StatsGrid />
          <GraphContainer>
            <GraphViz />
          </GraphContainer>
        </div>

        {/* Right Column: Chat */}
        <div className="lg:col-span-1 min-h-[500px]">
          <ChatInterface />
        </div>

      </div>

      <Footer />
    </MainLayout>
  );
}

export default App;
