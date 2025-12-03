import React, { useCallback, useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { resolveHandlesBatch, getCachedHandle } from '../utils/bluskyresolver';
import { HarassmentAnalyzer, Connection, HarassmentMetrics } from '../utils/harassmentmetrics';
cytoscape.use(fcose);
const CONFIG = {
  NODE_BASE_SIZE: 30,
  NODE_SIZE_MULTIPLIER: 5,
  NODE_MAX_SIZE: 100,
  AGGRESSOR_COLOR: '#ef4444',
  VICTIM_COLOR: '#8b5cf6',
  DEFAULT_COLOR: '#94a3b8',
  API_BASE_FALLBACK: 'https://zerocool0.dpdns.org'
};
const HarassmentGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ text: string; handle: string; score: number } | null>(null);
  const [metrics, setMetrics] = useState<HarassmentMetrics | null>(null);
  const [topActors, setTopActors] = useState<{ aggressors: any[], victims: any[] }>({ aggressors: [], victims: [] });
  const fetchData = useCallback(async (query: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const apiBase = import.meta.env.VITE_BACKEND_URL || CONFIG.API_BASE_FALLBACK;
    const url = query 
      ? `${apiBase}/harassment-network/cliques?q=${encodeURIComponent(query)}`
      : `${apiBase}/harassment-network/cliques`;
    const response = await fetch(url, {
      signal: abortControllerRef.current.signal,
      cache: 'default'
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const json = await response.json();
    return json.connections || [];
  }, []);
  const processGraphData = useCallback((connections: Connection[]) => {
    const analyzer = new HarassmentAnalyzer(connections);
    const computedMetrics = analyzer.calculateMetrics();
    setMetrics(computedMetrics);
    const aggCounts = new Map<string, number>();
    const vicCounts = new Map<string, number>();
    const nodeDegrees = new Map<string, number>();
    connections.forEach(c => {
      if (c.USER_A) {
        aggCounts.set(c.USER_A, (aggCounts.get(c.USER_A) || 0) + 1);
        nodeDegrees.set(c.USER_A, (nodeDegrees.get(c.USER_A) || 0) + 1);
      }
      if (c.USER_B) {
        vicCounts.set(c.USER_B, (vicCounts.get(c.USER_B) || 0) + 1);
        nodeDegrees.set(c.USER_B, (nodeDegrees.get(c.USER_B) || 0) + 1);
      }
    });
    const sortActors = (map: Map<string, number>) => 
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([did, count]) => ({ did, count, handle: getCachedHandle(did) }));
    setTopActors({
      aggressors: sortActors(aggCounts),
      victims: sortActors(vicCounts)
    });
    return { nodeDegrees, aggSet: new Set(aggCounts.keys()) };
  }, []);
  const initCytoscape = useCallback((connections: Connection[], nodeDegrees: Map<string, number>, aggSet: Set<string>) => {
    if (!containerRef.current) return;
    if (cyRef.current) cyRef.current.destroy();
    const elements: any[] = [];
    const addedNodes = new Set<string>();
    const addNode = (did: string, knownHandle?: string) => {
      if (addedNodes.has(did)) return;
      addedNodes.add(did);
      const degree = nodeDegrees.get(did) || 1;
      const size = Math.min(CONFIG.NODE_MAX_SIZE, CONFIG.NODE_BASE_SIZE + (degree * CONFIG.NODE_SIZE_MULTIPLIER));
      const isAggressor = aggSet.has(did);
      elements.push({
        group: 'nodes',
        data: {
          id: did,
          label: getCachedHandle(did),
          role: isAggressor ? 'attacker' : 'target',
          size
        }
      });
    };
    connections.forEach((c, i) => {
      if (!c.USER_A || !c.USER_B) return;
      addNode(c.USER_A, c.HANDLE_A);
      addNode(c.USER_B);
      elements.push({
        group: 'edges',
        data: {
          id: `e${i}`,
          source: c.USER_A,
          target: c.USER_B,
          postText: c.POST_TEXT,
          handle: c.HANDLE_A,
          score: parseFloat(c.HATE_SCORE) || 0
        }
      });
    });
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            width: 'data(size)',
            height: 'data(size)',
            'background-color': CONFIG.DEFAULT_COLOR,
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'color': '#475569'
          }
        },
        {
          selector: 'node[role="attacker"]',
          style: { 'background-color': CONFIG.AGGRESSOR_COLOR }
        },
        {
          selector: 'node[role="target"]',
          style: { 'background-color': CONFIG.VICTIM_COLOR }
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#cbd5e1',
            'width': 1,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#cbd5e1'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'width': 3,
            'z-index': 999
          }
        }
      ],
      layout: {
        name: 'fcose',
        quality: 'default',
        randomize: true,
        animate: false,
        nodeRepulsion: 4500,
        idealEdgeLength: 100
      } as any
    });
    cy.on('tap', 'edge', (evt) => {
      const d = evt.target.data();
      setSelectedEdge({ text: d.postText, handle: d.handle, score: d.score });
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedEdge(null);
    });
    cyRef.current = cy;
    const dids = Array.from(addedNodes).filter(d => d.startsWith('did:'));
    if (dids.length > 0) {
      resolveHandlesBatch(dids).then(map => {
        cy.batch(() => {
          map.forEach((handle, did) => {
            const n = cy.getElementById(did);
            if (n.length) n.data('label', handle);
          });
        });
      });
    }
  }, []);
  useEffect(() => {
    setIsLoading(true);
    fetchData(currentQuery)
      .then(data => {
        const { nodeDegrees, aggSet } = processGraphData(data);
        initCytoscape(data, nodeDegrees, aggSet);
        setIsLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setIsLoading(false);
      });
  }, [currentQuery, fetchData, processGraphData, initCytoscape]);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchTerm);
  };
  const handleZoomNode = (did: string) => {
    if (!cyRef.current) return;
    const node = cyRef.current.getElementById(did);
    if (node.length) {
      cyRef.current.animate({ fit: { eles: node, padding: 50 } } as any);
    }
  };
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 w-full">
        <div className="flex justify-between items-start mb-4 w-full">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Harassment Forensics</h1>
            <p className="text-xs text-slate-500">Network Topology Analysis</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Filter by keyword..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
              Analyze
            </button>
          </form>
        </div>
        {metrics && (
          <div className="grid grid-cols-5 gap-4 w-full">
            <MetricCard 
              label="Assortativity (r)" 
              value={metrics.assortativity.toFixed(3)} 
              sub={metrics.assortativity > 0 ? "Organized (Gangs)" : "Predatory (One-on-Many)"}
              color={metrics.assortativity > 0 ? "text-red-600" : "text-blue-600"}
            />
            <MetricCard 
              label="Clustering (C)" 
              value={metrics.clusteringCoefficient.toFixed(3)} 
              sub="Local Density"
              color="text-slate-700"
            />
            <MetricCard 
              label="Hub Threshold" 
              value={`k > ${metrics.hubThreshold.toFixed(1)}`} 
              sub="Ring Leader Cutoff"
              color="text-purple-600"
            />
            <MetricCard 
              label="Avg Degree" 
              value={metrics.averageDegree.toFixed(2)} 
              sub="Connections/User"
              color="text-slate-700"
            />
            <MetricCard 
              label="Network Size" 
              value={metrics.nodeCount.toString()} 
              sub={`${metrics.edgeCount} interactions`}
              color="text-slate-700"
            />
          </div>
        )}
      </div>
      {}
      <div className="flex-1 relative bg-slate-50 h-full min-h-[500px] w-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0 w-full" />
        {selectedEdge && (
          <div className="absolute bottom-4 right-4 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-20 animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Interaction Details</span>
              <button onClick={() => setSelectedEdge(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="text-sm text-slate-800 font-medium mb-2">"{selectedEdge.text}"</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-600 font-mono">@{selectedEdge.handle}</span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">
                Hate Score: {selectedEdge.score.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white border-t border-slate-200 p-4 h-48 z-10 overflow-hidden shrink-0 w-full">
        <div className="flex gap-8 h-full w-full">
          <div className="flex-1 overflow-y-auto pr-2">
            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 sticky top-0 bg-white py-1">Top Aggressors (Ring Leaders)</h3>
            <div className="space-y-1">
              {topActors.aggressors.map((a, i) => (
                <div 
                  key={a.did} 
                  onClick={() => handleZoomNode(a.did)}
                  className="flex justify-between items-center text-xs p-2 hover:bg-red-50 rounded cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 font-mono w-4">{i + 1}</span>
                    <span className="font-medium text-slate-700 group-hover:text-red-700">{a.handle}</span>
                  </div>
                  <span className="font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{a.count} attacks</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="flex-1 overflow-y-auto pr-2">
            <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3 sticky top-0 bg-white py-1">Top Targets (Victims)</h3>
            <div className="space-y-1">
              {topActors.victims.map((a, i) => (
                <div 
                  key={a.did}
                  onClick={() => handleZoomNode(a.did)}
                  className="flex justify-between items-center text-xs p-2 hover:bg-purple-50 rounded cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 font-mono w-4">{i + 1}</span>
                    <span className="font-medium text-slate-700 group-hover:text-purple-700">{a.handle}</span>
                  </div>
                  <span className="font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{a.count} incidents</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const MetricCard = ({ label, value, sub, color }: { label: string, value: string, sub: string, color: string }) => (
  <div className="bg-slate-50 p-3 rounded border border-slate-100">
    <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
    <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
    <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
  </div>
);
export default HarassmentGraph;