import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { resolveHandle } from '../utils/bluskyresolver';
 cytoscape.use(fcose);
 interface Connection {
 USER_A: string;
 USER_B: string;
 USER_C?: string;
 HANDLE_A?: string;
 POST_TEXT?: string;
 HATE_SCORE?: string | number;
}
 interface ApiResponse {
 ok: boolean;
 connections?: Connection[];
 cliques?: Connection[];
 communities?: Record<string, number>; 
}
 interface NetworkStats {
 nodeCount: number;
 edgeCount: number;
 topInfluencers: Array<{ id: string; label: string; score: number }>;
 communities: Array<{ id: string; color: string; percentage: number; count: number }>;
}
 const HarassmentGraph: React.FC = () => {
 const containerRef = useRef<HTMLDivElement>(null);
 const cyRef = useRef<cytoscape.Core | null>(null);
 const isMounted = useRef(true);
 const [isLoading, setIsLoading] = useState<boolean>(true);
 const [error, setError] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState("");
 const [selectedEdge, setSelectedEdge] = useState<{ text: string; handle: string; score: number } | null>(null);
 const [stats, setStats] = useState<NetworkStats | null>(null);
 const getClusterColor = (clusterId: number) => {
 if (clusterId === undefined || clusterId === null) return '#94a3b8'; 
 const colors = [
 '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', 
 '#e879f9', '#22d3ee', '#fb923c', '#a3e635', '#f472b6'
 ];
 return colors[clusterId % colors.length];
 };
 useEffect(() => {
 isMounted.current = true;
 return () => {
 isMounted.current = false;
 if (cyRef.current) cyRef.current.destroy();
 };
 }, []);
 const handleZoomToNode = (nodeId: string) => {
 if (!cyRef.current) return;
 const node = cyRef.current.getElementById(nodeId);
 if (node.length > 0) {
 cyRef.current.animate({
 fit: { eles: node, padding: 50 },
 duration: 500
 });
 node.select();
 }
 };
 const fetchGraphData = async (query: string = "") => {
 setIsLoading(true);
 setError(null);
 setSelectedEdge(null);
 try {
 const envBackendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL;
 const backendUrl = (envBackendUrl || "http://localhost:443").replace(/\/+$/, "");
 const url = query
 ? `${backendUrl}/harassment-network/cliques?q=${encodeURIComponent(query)}`
 : `${backendUrl}/harassment-network/cliques`;
 const response = await fetch(url, { cache: 'no-cache' });
 if (!response.ok) {
 throw new Error(`API Error: ${response.status}`);
 }
 const data: ApiResponse = await response.json();
 const items = Array.isArray(data) ? data : (data.connections || data.cliques || []);
 const communityMap = data.communities || {};
 if (!isMounted.current) return;
 if (items.length === 0) {
 if (cyRef.current) cyRef.current.elements().remove();
 setIsLoading(false);
 return;
 }
 const elements: cytoscape.ElementDefinition[] = [];
 const addedNodes = new Set<string>();
 items.forEach((item: Connection, i: number) => {
 const uA = item.USER_A;
 const uB = item.USER_B;
 if (!uA || !uB || uA === uB) return;
 if (!addedNodes.has(uA)) {
 addedNodes.add(uA);
 const label = item.HANDLE_A ? `@${item.HANDLE_A}` : (uA.startsWith("did:") ? `${uA.substring(0, 12)}...` : uA);
 const clusterId = communityMap[uA]; 
 if (!item.HANDLE_A) {
 resolveHandle(uA).then((prettyName: string) => {
 const node = cyRef.current?.getElementById(uA);
 if (node) node.data('label', prettyName);
 });
 }
 elements.push({
 group: 'nodes',
 data: { 
 id: uA, 
 label, 
 type: 'aggressor',
 cluster: clusterId,
 color: '#ef4444' 
 }
 });
 }
 if (!addedNodes.has(uB)) {
 addedNodes.add(uB);
 const label = uB.startsWith("did:") ? `${uB.substring(0, 12)}...` : uB;
 const clusterId = communityMap[uB];
 resolveHandle(uB).then((prettyName: string) => {
 const node = cyRef.current?.getElementById(uB);
 if (node) node.data('label', prettyName);
 });
 elements.push({
 group: 'nodes',
 data: { 
 id: uB, 
 label, 
 type: 'target',
 cluster: clusterId,
 color: '#22c55e' 
 }
 });
 }
 const hateScore = Number(item.HATE_SCORE) || 0;
 elements.push({
 group: 'edges',
 data: {
 id: `e${i}`,
 source: uA,
 target: uB,
 score: hateScore,
 postText: item.POST_TEXT,
 handle: item.HANDLE_A
 }
 });
 });
 if (containerRef.current) {
 if (cyRef.current) cyRef.current.destroy();
 cyRef.current = cytoscape({
 container: containerRef.current,
 elements: elements,
 style: [
 {
 selector: 'node',
 style: {
 'label': 'data(label)',
 'font-size': '10px',
 'color': '#1e293b',
 'text-valign': 'bottom',
 'text-halign': 'center',
 'text-margin-y': 4,
 'width': 'data(size)',
 'height': 'data(size)', 
 'background-color': 'data(color)',
 'border-width': 1,
 'border-color': '#fff',
 'text-background-color': 'white',
 'text-background-opacity': 0.8,
 'text-background-shape': 'roundrectangle',
 'text-background-padding': 2
 } as any
 },
 {
 selector: 'edge',
 style: {
 'width': 'mapData(score, 0, 1, 1, 6)', 
 'line-color': 'mapData(score, 0.5, 1.0, #cbd5e1, #ef4444)',
 'target-arrow-color': 'mapData(score, 0.5, 1.0, #cbd5e1, #ef4444)',
 'target-arrow-shape': 'triangle',
 'curve-style': 'bezier',
 'opacity': 0.8
 } as any
 },
 {
 selector: 'edge:selected',
 style: {
 'line-color': '#3b82f6',
 'target-arrow-color': '#3b82f6',
 'width': 4,
 'z-index': 999,
 'opacity': 1
 } as any
 },
 {
 selector: 'node:selected',
 style: {
 'border-width': 4,
 'border-color': '#3b82f6',
 } as any
 }
 ],
 layout: { name: 'grid' }
 });
 const cy = cyRef.current;
 const bc = cy.elements().betweennessCentrality({});
 const communityCounts: Record<string, number> = {};
 const influencers: { id: string, score: number, label: string }[] = [];
 cy.nodes().forEach(node => {
 const score = bc.betweenness(node);
 const size = 20 + (Math.log(score + 1) * 15); 
 node.data('size', Math.min(80, size));
 const cluster = node.data('cluster');
 if (cluster !== undefined) {
 communityCounts[cluster] = (communityCounts[cluster] || 0) + 1;
 }
 influencers.push({ 
 id: node.id(), 
 score: score, 
 label: node.data('label') 
 });
 });
 const totalNodes = cy.nodes().length;
 const topCommunities = Object.entries(communityCounts)
 .map(([id, count]) => ({
 id,
 count,
 percentage: Math.round((count / totalNodes) * 100),
 color: getClusterColor(parseInt(id))
 }))
 .sort((a, b) => b.count - a.count)
 .slice(0, 4); 
 const topInfluencers = influencers
 .sort((a, b) => b.score - a.score)
 .slice(0, 5);
 setStats({
 nodeCount: totalNodes,
 edgeCount: cy.edges().length,
 communities: topCommunities,
 topInfluencers
 });
 const layout = cy.layout({
 name: 'fcose',
 quality: 'default',
 randomize: false,
 animate: true,
 animationDuration: 1000,
 nodeRepulsion: 450000,
 idealEdgeLength: 100,
 gravity: 0.25,
 numIter: 2500,
 tilingPaddingVertical: 20,
 tilingPaddingHorizontal: 20,
 } as any);
 layout.run();
 cy.on('tap', 'edge', (evt) => {
 const edge = evt.target;
 if (edge.data('postText')) {
 setSelectedEdge({
 text: edge.data('postText'),
 handle: edge.data('handle'),
 score: edge.data('score')
 });
 }
 });
 cy.on('tap', 'core', () => setSelectedEdge(null));
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
 <div className="relative h-[800px] w-full rounded-xl border border-slate-200 bg-slate-950 shadow-sm overflow-hidden flex">
 <div className="relative flex-grow h-full bg-slate-50 dark:bg-slate-900/50">
 <div className="absolute top-4 left-4 z-20 pointer-events-none">
 <div className="flex gap-3 text-xs font-medium text-slate-600 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-sm dark:bg-black/50 dark:text-slate-300 dark:border-white/10">
 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Aggressor</div>
 <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Victim</div>
 </div>
 </div>
 {isLoading && (
 <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-black/60">
 <div className="flex flex-col items-center gap-2">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
 <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Analyzing network topology...</span>
 </div>
 </div>
 )}
 {error && (
 <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-black/80">
 <div className="text-center max-w-md px-6">
 <p className="text-red-500 text-sm font-medium mb-4">{error}</p>
 <button onClick={() => fetchGraphData(searchTerm)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs rounded font-medium transition-colors">
 Retry Connection
 </button>
 </div>
 </div>
 )}
 <div ref={containerRef} className="h-full w-full cursor-crosshair active:cursor-grabbing" />
 {selectedEdge && (
 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4 duration-200 w-[90%] max-w-lg">
 <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-2xl p-4 relative dark:bg-slate-900/95 dark:border-white/10">
 <button onClick={() => setSelectedEdge(null)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
 </button>
 <div className="flex items-center gap-3 mb-2">
 <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${selectedEdge.score > 0.7 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
 Hate Score: {selectedEdge.score ? selectedEdge.score.toFixed(2) : 'N/A'}
 </div>
 <span className="text-xs text-slate-500 font-mono">@{selectedEdge.handle || 'Unknown'}</span>
 </div>
 <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium line-clamp-3">"{selectedEdge.text}"</p>
 </div>
 </div>
 )}
 </div>
 <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 flex flex-col gap-6 overflow-y-auto text-slate-200 shadow-xl z-30 shrink-0">
 <div className="mb-2">
 <form onSubmit={handleSearch} className="flex gap-2 shadow-sm">
 <input
 type="text"
 placeholder="Search graph..."
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-white placeholder-slate-500"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 <button type="submit" className="bg-violet-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-violet-700 transition-colors">
 Go
 </button>
 </form>
 </div>
 <div>
 <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">Network Controls</h2>
 <div className="flex justify-between text-xs text-slate-400">
 <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded w-[48%]">
 <span className="text-xl font-bold text-white">{stats?.nodeCount || 0}</span>
 <span>Nodes</span>
 </div>
 <div className="flex flex-col items-center bg-slate-800/50 p-2 rounded w-[48%]">
 <span className="text-xl font-bold text-white">{stats?.edgeCount || 0}</span>
 <span>Edges</span>
 </div>
 </div>
 </div>
 <div>
 <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Main Communities</h3>
 <div className="space-y-2">
 {stats?.communities.map((comm) => (
 <div key={comm.id} className="bg-slate-800/50 rounded p-2 border border-slate-700/50">
 <div className="flex justify-between items-center mb-1">
 <span className="text-xs font-bold text-white">Group {comm.id}</span>
 <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{comm.percentage}%</span>
 </div>
 <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
 <div className="h-full" style={{ width: `${comm.percentage}%`, backgroundColor: comm.color }}></div>
 </div>
 </div>
 ))}
 {(!stats || stats.communities.length === 0) && <p className="text-xs text-slate-500 italic">No clusters detected.</p>}
 </div>
 </div>
 <div>
 <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Key Influencers</h3>
 <div className="flex flex-col gap-2">
 {stats?.topInfluencers.map((node, idx) => (
 <button 
 key={idx} 
 onClick={() => handleZoomToNode(node.id)}
 className="bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 rounded px-2 py-2 text-xs flex items-center gap-2 w-full text-left group"
 >
 <span className="text-slate-500 font-mono text-[10px] w-4">#{idx + 1}</span>
 <span className="truncate flex-1 font-medium text-slate-300 group-hover:text-white transition-colors" title={node.label}>{node.label}</span>
 <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>
 </button>
 ))}
 {(!stats || stats.topInfluencers.length === 0) && <p className="text-xs text-slate-500 italic">No data available.</p>}
 </div>
 </div>
 <div className="mt-auto pt-4 border-t border-slate-800">
 <button onClick={() => fetchGraphData(searchTerm)} className="w-full bg-slate-800 hover:bg-slate-700 text-xs text-white py-2 rounded border border-slate-700 transition-colors">
 Refresh Graph Analysis
 </button>
 </div>
 </div>
 </div>
 );
};
 export default HarassmentGraph;