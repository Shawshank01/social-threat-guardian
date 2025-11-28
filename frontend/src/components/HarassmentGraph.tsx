import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
cytoscape.use(fcose);
interface Connection {
  USER_A: string;
  USER_B: string;
  USER_C?: string;
  HANDLE_A?: string; 
  POST_TEXT?: string;
  HATE_SCORE?: number;
}
interface ApiResponse {
  ok: boolean;
  connections?: Connection[];
  cliques?: Connection[];
}
const HarassmentGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<{ text: string; handle: string; score: number } | null>(null);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (cyRef.current) cyRef.current.destroy();
    };
  }, []);
  const fetchGraphData = async (query: string = "") => {
    setIsLoading(true);
    setError(null);
    setSelectedEdge(null);
    try {
      // Use /api proxy pattern to connect to backend (works in both dev and production)
      const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");
      const buildApiUrl = (path: string) => {
        const normalizedPath = path.replace(/^\/+/, "");
        return `${API_BASE}/${normalizedPath}`;
      };
      
      const url = query 
        ? buildApiUrl(`harassment-network/cliques?q=${encodeURIComponent(query)}`)
        : buildApiUrl("harassment-network/cliques");
      
      const response = await fetch(url, {
        cache: 'no-cache',
      });
      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
          const errorText = await response.text();
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              const backendError = String(errorJson.error);
              // Check if it's a circular structure error from Oracle database
              if (backendError.includes('circular structure') || 
                  backendError.includes('ConnectDescription') ||
                  backendError.includes('ConnOption')) {
                errorMessage = 'Database connection error. Please check backend server logs for details.';
              } else {
                errorMessage = backendError;
              }
            }
          } catch (parseError) {
            // If not JSON, check the text directly
            if (errorText && (errorText.includes('circular structure') || 
                errorText.includes('ConnectDescription') ||
                errorText.includes('ConnOption'))) {
              errorMessage = 'Database connection error. Please check backend server logs for details.';
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
        throw new Error(errorMessage);
      }
      const data: ApiResponse = await response.json();
      const items = Array.isArray(data) ? data : (data.connections || data.cliques || []);
      if (!Array.isArray(items)) {
        throw new Error("Invalid data format");
      }
      if (!isMounted.current) return;
      if (items.length === 0) {
         if (cyRef.current) cyRef.current.elements().remove();
         setIsLoading(false);
         return; 
      }
      const elements: cytoscape.ElementDefinition[] = [];
      const addedNodes = new Set<string>();
      const aggressorSet = new Set<string>();
      const nodeDegrees: Record<string, number> = {};
      items.forEach(item => {
        if (item.USER_A) {
            aggressorSet.add(item.USER_A);
            nodeDegrees[item.USER_A] = (nodeDegrees[item.USER_A] || 0) + 1;
        }
        if (item.USER_B) {
            nodeDegrees[item.USER_B] = (nodeDegrees[item.USER_B] || 0) + 1;
        }
      });
      const addNode = (did: string, handle?: string) => {
        if (!did || addedNodes.has(did)) return;
        addedNodes.add(did);
        let label = handle;
        if (!label) {
             label = did.split(':')[2]?.substring(0, 8) || did.substring(0, 8);
        } else {
             if (!label.startsWith('@')) label = `@${label}`;
        }
        const isAggressor = aggressorSet.has(did);
        const role = isAggressor ? 'attacker' : 'target';
        const degree = nodeDegrees[did] || 1;
        const size = Math.min(100, 30 + (degree * 5));
        elements.push({
          group: 'nodes',
          data: { 
            id: did, 
            label: label, 
            role: role,
            size: size
          },
        });
      };
      items.forEach((item, i) => {
        const uA = item.USER_A;
        const uB = item.USER_B;
        const uC = item.USER_C;
        if (!uA || !uB) return;
        if (uA === uB) return;
        addNode(uA, item.HANDLE_A);
        addNode(uB); 
        elements.push({ 
            group: 'edges', 
            data: { 
                id: `e${i}_ab`, 
                source: uA, 
                target: uB,
                postText: item.POST_TEXT || "No content available",
                handle: item.HANDLE_A || "Unknown",
                score: item.HATE_SCORE || 0
            } 
        });
        if (uC && uC !== 'N/A' && uC !== uA && uC !== uB) {
           addNode(uC);
           elements.push({ group: 'edges', data: { id: `e${i}_bc`, source: uB, target: uC } });
           elements.push({ group: 'edges', data: { id: `e${i}_ca`, source: uC, target: uA } });
        }
      });
      if (containerRef.current) {
        if (cyRef.current) cyRef.current.destroy();
        cyRef.current = cytoscape({
          container: containerRef.current,
          elements: elements,
          zoomingEnabled: true,
          userZoomingEnabled: true,
          panningEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          style: [
            {
              selector: 'node',
              style: {
                'label': 'data(label)',
                'color': '#334155',
                'font-size': '11px',
                'font-weight': 'bold',
                'text-valign': 'bottom',
                'text-margin-y': 6,
                'text-background-color': '#ffffff',
                'text-background-opacity': 0.7,
                'text-background-padding': 2,
                'text-background-shape': 'roundrectangle',
                'width': 'data(size)',
                'height': 'data(size)',
                'min-zoomed-font-size': 4,
                'border-width': 2,
                'border-color': '#fff',
                'background-color': '#94a3b8'
              } as any 
            },
            {
              selector: 'node[role="attacker"]',
              style: {
                'background-color': '#ef4444',
                'z-index': 10
              } as any
            },
            {
              selector: 'node[role="target"]',
              style: {
                'background-color': '#8b5cf6',
              } as any
            },
            {
              selector: 'edge',
              style: {
                'width': 2,
                'curve-style': 'bezier', 
                'line-color': '#cbd5e1',
                'target-arrow-color': '#cbd5e1',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 1,
                'opacity': 0.6
              } as any
            },
            {
              selector: 'edge:selected',
              style: {
                'line-color': '#0ea5e9', 
                'target-arrow-color': '#0ea5e9',
                'width': 4,
                'z-index': 999,
                'opacity': 1
              } as any
            }
          ],
          layout: { name: 'grid' } 
        });
        const layout = cyRef.current.layout({
            name: 'fcose',
            quality: 'default',
            randomize: true, 
            animate: true,
            animationDuration: 1000,
            fit: true,
            padding: 50,
            nodeRepulsion: 2000000,
            idealEdgeLength: 120,
            edgeElasticity: 0.1,
            nestingFactor: 0.1,
            gravity: 0.25,
            numIter: 2500,
            initialTemp: 1000,
            coolingFactor: 0.99,
            minTemp: 1.0,
            tile: true,
            tilingPaddingVertical: 20,
            tilingPaddingHorizontal: 20,
            packComponents: true
        } as any);
        layout.run();
        cyRef.current.on('tap', 'edge', (evt) => {
          const edge = evt.target;
          if (edge.data('postText')) {
              setSelectedEdge({
                text: edge.data('postText'),
                handle: edge.data('handle'),
                score: edge.data('score')
              });
          }
        });
        cyRef.current.on('tap', 'core', () => {
          setSelectedEdge(null);
        });
      }
    } catch (err: any) {
      if (isMounted.current) setError(err.message);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchGraphData();
  }, []);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGraphData(searchTerm);
  };
  return (
    <div className="relative h-[700px] w-full rounded-xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
            <input 
            type="text" 
            placeholder="Search keyword..."
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-48"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-800 shadow-sm">Search</button>
        </form>
      </div>
      <div className="absolute top-4 right-4 z-20 flex gap-4 text-xs font-medium text-slate-600 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-sm pointer-events-none">
          <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Aggressor
          </div>
          <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-violet-500 inline-block"></span> Victim
          </div>
      </div>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <p className="text-red-500 text-sm font-medium mb-2">{error}</p>
            <button onClick={() => fetchGraphData(searchTerm)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs rounded">Retry</button>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      {selectedEdge && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4 duration-200 w-full max-w-xl px-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-5 relative">
            <button 
                onClick={() => setSelectedEdge(null)} 
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                    Hate Score: {selectedEdge.score ? selectedEdge.score.toFixed(2) : 'N/A'}
                </div>
                <span className="text-xs text-slate-400 font-mono">@{selectedEdge.handle || 'Unknown'}</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
                "{selectedEdge.text}"
            </p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none select-none hidden sm:block">
          Scroll to Zoom • Click Lines to Inspect
      </div>
    </div>
  );
};
export default HarassmentGraph;