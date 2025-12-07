// I start by importing necessary libraries
import React, { useCallback, useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import * as Tooltip from '@radix-ui/react-tooltip';
import { resolveHandlesBatch, getCachedHandle } from '../utils/bluskyresolver';
import { HarassmentAnalyzer, Connection, HarassmentMetrics } from '../utils/harassmentmetrics';
cytoscape.use(fcose);
// In this section, all configurations and graph metrics are defined here for maintainability
const GRAPH_THEME = {
  light: { bg: '#f8fafc', label: '#334155', outline: '#f8fafc' },
  dark: { bg: '#1e293b', label: '#f1f5f9', outline: '#1e293b' }
};
const GRAPH_STYLE = {
  aggressor: '#ef4444',
  victim: '#8b5cf6',
  defaultNode: '#94a3b8',
  edge: '#cbd5e1',
  edgeSelected: '#3b82f6'
};
const APP_CONFIG = {
  nodeBaseSize: 30,
  nodeMultiplier: 5,
  nodeMaxSize: 100,
  apiFallback: 'https://zerocool0.dpdns.org'
};
const METRIC_DEFINITIONS = {
  assortativity: "Assortativity (r): Tendency of users to connect with similar users. r>0 implies organized gangs and r<0 implies random attacks.",
  clustering: "Clustering Coefficient (C): Measures 'cliqueness'. 0 = random star network; 1 = complete clique (co-ordinated attacks).",
  hubThreshold: "Hub Threshold: Users with connections above this value are considered Ring leaders.",
  avgDegree: "Average Degree (K): The average number of connections per user."
};
// User prefence for either dark or light mode
const useThemeDetector = () => {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const updateTheme = () => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isClassDark = document.documentElement.classList.contains('dark');
      setIsDark(isClassDark || isSystemDark);
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);
  return isDark;
};
const getNodeColor = (role: 'attacker' | 'target', degree: number, maxDegree: number, isDark: boolean) => {
  const ratio = maxDegree <= 1 ? 0 : Math.max(0, Math.min(1, (degree - 1) / (maxDegree - 1)));
  const hue = role === 'attacker' ? 0 : 270;
  const saturation = 50 + (ratio * 40);
  const lightness = isDark
    ? 30 + (ratio * 55)
    : 80 - (ratio * 35);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
const useGraphData = () => {
  const [state, setState] = useState({
    isLoading: false,
    error: null as string | null,
    graphData: null as {
      connections: Connection[],
      nodeDegrees: Map<string, number>,
      aggSet: Set<string>,
      maxDegree: number
    } | null,
    metrics: null as HarassmentMetrics | null,
    topActors: { aggressors: [], victims: [] } as { aggressors: any[], victims: any[] }
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const processGraphData = useCallback((connections: Connection[]) => {
    const analyzer = new HarassmentAnalyzer(connections);
    const metrics = analyzer.calculateMetrics();
    const aggCounts = new Map<string, number>();
    const vicCounts = new Map<string, number>();
    const nodeDegrees = new Map<string, number>();
    let maxDegree = 1;
    connections.forEach(c => {
      if (c.USER_A) {
        aggCounts.set(c.USER_A, (aggCounts.get(c.USER_A) || 0) + 1);
        const d = (nodeDegrees.get(c.USER_A) || 0) + 1;
        nodeDegrees.set(c.USER_A, d);
        if (d > maxDegree) maxDegree = d;
      }
      if (c.USER_B) {
        vicCounts.set(c.USER_B, (vicCounts.get(c.USER_B) || 0) + 1);
        const d = (nodeDegrees.get(c.USER_B) || 0) + 1;
        nodeDegrees.set(c.USER_B, d);
        if (d > maxDegree) maxDegree = d;
      }
    });
    const sortActors = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([did, count]) => ({ did, count, handle: getCachedHandle(did) }));
    setState(prev => ({
      ...prev,
      metrics,
      topActors: {
        aggressors: sortActors(aggCounts),
        victims: sortActors(vicCounts)
      },
      graphData: {
        connections,
        nodeDegrees,
        aggSet: new Set(aggCounts.keys()),
        maxDegree
      }
    }));
  }, []);
  const fetchData = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    try {
      const apiBase = import.meta.env.VITE_BACKEND_URL || APP_CONFIG.apiFallback;
      const url = query
        ? `${apiBase}/harassment-network/cliques?q=${encodeURIComponent(query)}`
        : `${apiBase}/harassment-network/cliques`;
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        cache: 'default'
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const json = await response.json();
      processGraphData(json.connections || []);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setState(prev => ({ ...prev, error: e.message }));
      }
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [processGraphData]);
  return { ...state, fetchData };
};

// Everything tooltip from hovering the mouse on desktop and tapping on small screens such as smart phone.
const InfoTooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
      <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            onFocus={() => setIsOpen(true)}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            className="group relative ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-help transition-all active:scale-95 touch-manipulation"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-20 dark:bg-blue-500 dark:opacity-30 duration-1000" />
            <span className="relative z-10">?</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-[100] w-[280px] max-w-[90vw] select-none rounded-lg bg-slate-900/95 dark:bg-black/95 backdrop-blur-sm border border-slate-700/50 dark:border-slate-800 px-4 py-3 text-xs leading-relaxed text-slate-50 dark:text-slate-200 shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
            sideOffset={6}
            collisionPadding={10}
            style={{ pointerEvents: 'auto' }}
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 dark:text-blue-500 opacity-80">
              Definition
            </div>
            {text}
            <Tooltip.Arrow className="fill-slate-900/95 dark:fill-black/95" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
const MetricCard = React.memo(({ label, value, sub, color, tooltip, colSpan = "" }: { label: string, value: string, sub: string, color: string, tooltip?: string, colSpan?: string }) => (
  <div className={`bg-slate-50 dark:bg-slate-900 p-2 md:p-3 rounded border border-slate-100 dark:border-slate-700 relative group hover:border-slate-300 dark:hover:border-slate-500 transition-colors h-full ${colSpan}`}>
    <div className="flex items-center mb-1">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold truncate">{label}</div>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
    <div className={`text-base md:text-lg font-mono font-bold ${color}`}>{value}</div>
    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors truncate">{sub}</div>
  </div>
));
const InteractionTooltip = ({ edge, onClose }: { edge: { text: string, handle: string, score: number }, onClose: () => void }) => (
  <div className="absolute bottom-4 right-4 left-4 md:left-auto md:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 z-20 animate-in slide-in-from-bottom-4 transition-colors">
    <div className="flex justify-between items-start mb-2">
      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Interaction</span>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2">✕</button>
    </div>
    <div className="text-sm text-slate-800 dark:text-slate-200 font-medium mb-2 leading-relaxed max-h-32 overflow-y-auto">"{edge.text}"</div>
    <div className="flex justify-between items-center">
      <span className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate max-w-[50%]">@{edge.handle}</span>
      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border dark:border-red-900/50 px-2 py-1 rounded font-bold whitespace-nowrap">
        Score: {edge.score.toFixed(2)}
      </span>
    </div>
  </div>
);
const ActorList = ({ title, actors, colorClass, onZoom }: { title: string, actors: any[], colorClass: string, onZoom: (did: string) => void }) => (
  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
    <h3 className={`text-xs font-bold ${colorClass} uppercase tracking-wider mb-3 sticky top-0 bg-white dark:bg-[#1e293b] py-1 border-b border-transparent dark:border-slate-800`}>
      {title}
    </h3>
    <div className="space-y-1">
      {actors.map((a, i) => (
        <div
          key={a.did}
          onClick={() => onZoom(a.did)}
          className={`flex justify-between items-center text-xs p-2 rounded cursor-pointer group transition-colors border border-transparent hover:bg-slate-100 dark:hover:bg-white/5`}
        >
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <span className="text-slate-300 dark:text-slate-600 font-mono w-4 shrink-0">{i + 1}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{a.handle}</span>
          </div>
          <span className="font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 dark:border dark:border-slate-800 px-2 py-0.5 rounded shrink-0">{a.count}</span>
        </div>
      ))}
    </div>
  </div>
);
// The network graph is calculated here, cytoscape nodes and edges are then returned using the appropriate colors
const HarassmentGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const isDark = useThemeDetector();
  const { isLoading, graphData, metrics, topActors, fetchData } = useGraphData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<{ text: string; handle: string; score: number } | null>(null);
  const renderGraph = useCallback(() => {
    if (!containerRef.current || !graphData) return;
    const themeColors = isDark ? GRAPH_THEME.dark : GRAPH_THEME.light;
    const elements: any[] = [];
    const addedNodes = new Set<string>();
    const addNode = (did: string, knownHandle?: string) => {
      if (addedNodes.has(did)) return;
      addedNodes.add(did);
      const degree = graphData.nodeDegrees.get(did) || 1;
      const size = Math.min(APP_CONFIG.nodeMaxSize, APP_CONFIG.nodeBaseSize + (degree * APP_CONFIG.nodeMultiplier));
      const role = graphData.aggSet.has(did) ? 'attacker' : 'target';
      const color = getNodeColor(role, degree, graphData.maxDegree, isDark);
      elements.push({
        group: 'nodes',
        data: {
          id: did,
          label: getCachedHandle(did),
          role,
          size,
          color
        }
      });
    };
    graphData.connections.forEach((c, i) => {
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
    const fetchHandles = () => {
      const dids = Array.from(addedNodes).filter(d => d.startsWith('did:'));
      if (dids.length > 0) {
        resolveHandlesBatch(dids).then(map => {
          if (!cyRef.current) return;
          cyRef.current.batch(() => {
            map.forEach((handle, did) => {
              const n = cyRef.current!.getElementById(did);
              if (n.length) n.data('label', handle);
            });
          });
        });
      }
    };
    if (cyRef.current) {
      cyRef.current.batch(() => {
        cyRef.current!.elements().remove();
        cyRef.current!.add(elements);
        cyRef.current!.style()
          .selector('node').style({
            'color': themeColors.label,
            'text-outline-color': themeColors.outline,
            'background-color': 'data(color)'
          })
          .update();
      });
      cyRef.current.layout({
        name: 'fcose',
        quality: 'default',
        randomize: true,
        animate: false,
        nodeRepulsion: 4500,
        idealEdgeLength: 100
      } as any).run();
      fetchHandles();
      return;
    }
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
            'background-color': 'data(color)',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'color': themeColors.label,
            'text-outline-color': themeColors.outline,
            'text-outline-width': 2
          }
        },
        { selector: 'edge', style: { 'line-color': GRAPH_STYLE.edge, 'width': 1, 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'target-arrow-color': GRAPH_STYLE.edge } },
        { selector: 'edge:selected', style: { 'line-color': GRAPH_STYLE.edgeSelected, 'target-arrow-color': GRAPH_STYLE.edgeSelected, 'width': 3, 'z-index': 999 } }
      ],
      layout: { name: 'fcose', quality: 'default', randomize: true, animate: false, nodeRepulsion: 4500, idealEdgeLength: 100 } as any
    });
    cy.on('tap', 'edge', (evt) => {
      const d = evt.target.data();
      setSelectedEdge({ text: d.postText, handle: d.handle, score: d.score });
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedEdge(null);
    });
    cyRef.current = cy;
    fetchHandles();
  }, [graphData, isDark]);
  useEffect(() => {
    if (graphData) renderGraph();
  }, [graphData, renderGraph]);
  useEffect(() => {
    fetchData("");
  }, [fetchData]);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(searchTerm);
  };
  const handleZoomNode = (did: string) => {
    if (!cyRef.current) return;
    const node = cyRef.current.getElementById(did);
    if (node.length) {
      cyRef.current.animate({ fit: { eles: node, padding: 50 } } as any);
    }
  };
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-[#1e293b] overflow-hidden font-sans transition-colors duration-300">
      <div className="bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-4 shadow-sm z-10 w-full shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 w-full">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Harassment Forensics</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Network Topology Analysis</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              className="flex-1 md:flex-none px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm w-full md:w-64 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              placeholder="Filter by keyword..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="bg-slate-800 dark:bg-slate-700 text-white border border-transparent dark:border-slate-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
              Analyze
            </button>
          </form>
        </div>
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4 w-full">
            <MetricCard
              label="Assortativity (r)"
              value={metrics.assortativity.toFixed(3)}
              sub={metrics.assortativity > 0 ? "Organized" : "Predatory"}
              color={metrics.assortativity > 0 ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}
              tooltip={METRIC_DEFINITIONS.assortativity}
            />
            <MetricCard
              label="Clustering (C)"
              value={metrics.clusteringCoefficient.toFixed(3)}
              sub="Cliqueness"
              color="text-slate-700 dark:text-slate-200"
              tooltip={METRIC_DEFINITIONS.clustering}
            />
            <MetricCard
              label="Hub Threshold"
              value={`k > ${metrics.hubThreshold.toFixed(1)}`}
              sub="Ring leaders"
              color="text-purple-600 dark:text-purple-400"
              tooltip={METRIC_DEFINITIONS.hubThreshold}
            />
            <MetricCard
              label="Avg Degree"
              value={metrics.averageDegree.toFixed(2)}
              sub="Connection per user"
              color="text-slate-700 dark:text-slate-200"
              tooltip={METRIC_DEFINITIONS.avgDegree}
            />
            <MetricCard
              label="Network Size"
              value={metrics.nodeCount.toString()}
              sub={`${metrics.edgeCount} interactions`}
              color="text-slate-700 dark:text-slate-200"
              colSpan="col-span-2 md:col-span-1"
            />
          </div>
        )}
      </div>
      <div className="flex-1 relative bg-slate-50 dark:bg-[#1e293b] h-full min-h-[400px] w-full transition-colors duration-300">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 dark:bg-[#1e293b]/80 backdrop-blur-sm">
            <div className="h-8 w-8 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0 w-full" />
        {selectedEdge && <InteractionTooltip edge={selectedEdge} onClose={() => setSelectedEdge(null)} />}
      </div>
      <div className="bg-white dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-700 p-4 h-48 z-10 overflow-hidden shrink-0 w-full transition-colors duration-300">
        <div className="flex gap-4 md:gap-8 h-full w-full">
          <ActorList
            title="Top Aggressors"
            actors={topActors.aggressors}
            colorClass="text-red-600 dark:text-red-400"
            onZoom={handleZoomNode}
          />
          <div className="w-px bg-slate-100 dark:bg-slate-700" />
          <ActorList
            title="Top Targets"
            actors={topActors.victims}
            colorClass="text-purple-600 dark:text-purple-400"
            onZoom={handleZoomNode}
          />
        </div>
      </div>
    </div>
  );
};
export default HarassmentGraph;