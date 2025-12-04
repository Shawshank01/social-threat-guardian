export interface Connection {
  USER_A: string;
  USER_B: string;
  HANDLE_A: string;
  POST_TEXT: string;
  POST_ID: string;
  HATE_SCORE: string;
}

export interface HarassmentMetrics {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  assortativity: number;
  clusteringCoefficient: number;
  hubThreshold: number;
  density: number;
}

export class HarassmentAnalyzer {
  private adjacency: Map<string, Set<string>>;
  private degrees: Map<string, number>;
  private nodes: Set<string>;
  private edges: Connection[];
  constructor(data: Connection[]) {
    this.edges = data;
    this.adjacency = new Map();
    this.degrees = new Map();
    this.nodes = new Set();
    this.buildGraph();
  }
  private buildGraph() {
    this.edges.forEach(conn => {
      if (!conn.USER_A || !conn.USER_B) return;
      this.nodes.add(conn.USER_A);
      this.nodes.add(conn.USER_B);
      if (!this.adjacency.has(conn.USER_A)) this.adjacency.set(conn.USER_A, new Set());
      if (!this.adjacency.has(conn.USER_B)) this.adjacency.set(conn.USER_B, new Set());
      this.adjacency.get(conn.USER_A)!.add(conn.USER_B);
      this.adjacency.get(conn.USER_B)!.add(conn.USER_A);
    });
    this.nodes.forEach(node => {
      this.degrees.set(node, this.adjacency.get(node)?.size || 0);
    });
  }
  public calculateMetrics(): HarassmentMetrics {
    const N = this.nodes.size;
    const E = this.edges.length;
    if (N === 0) return this.getEmptyMetrics();
    const avgDegree = (2 * E) / N;
    return {
      nodeCount: N,
      edgeCount: E,
      averageDegree: avgDegree,
      density: (2 * E) / (N * (N - 1)) || 0,
      assortativity: this.calculateAssortativity(),
      clusteringCoefficient: this.calculateClustering(),
      hubThreshold: this.calculateHubThreshold(avgDegree)
    };
  }
  private calculateAssortativity(): number {
    let s1 = 0, s2 = 0, s3 = 0;
    let edgeCount = 0;
    this.edges.forEach(edge => {
      if (!edge.USER_A || !edge.USER_B) return;
      const kA = this.degrees.get(edge.USER_A) || 0;
      const kB = this.degrees.get(edge.USER_B) || 0;
      s1 += kA * kB;
      s2 += kA + kB;
      s3 += kA * kA + kB * kB;
      edgeCount++;
    });
    if (edgeCount === 0) return 0;
    const num = (4 * edgeCount * s1) - (s2 * s2);
    const den = (2 * edgeCount * s3) - (s2 * s2);
    return den === 0 ? 0 : num / den;
  }
  private calculateClustering(): number {
    let totalC = 0;
    let nodesWithNeighbors = 0;
    this.adjacency.forEach((neighbors, node) => {
      const k = neighbors.size;
      if (k < 2) return;
      let links = 0;
      const neighborArr = Array.from(neighbors);
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          if (this.adjacency.get(neighborArr[i])?.has(neighborArr[j])) {
            links++;
          }
        }
      }
      totalC += (2 * links) / (k * (k - 1));
      nodesWithNeighbors++;
    });
    return nodesWithNeighbors === 0 ? 0 : totalC / this.nodes.size;
  }
  private calculateHubThreshold(mean: number): number {
    let varianceSum = 0;
    this.degrees.forEach(k => {
      varianceSum += Math.pow(k - mean, 2);
    });
    const stdDev = Math.sqrt(varianceSum / this.nodes.size);
    return mean + 2 * stdDev;
  }
  private getEmptyMetrics(): HarassmentMetrics {
    return {
      nodeCount: 0,
      edgeCount: 0,
      averageDegree: 0,
      assortativity: 0,
      clusteringCoefficient: 0,
      hubThreshold: 0,
      density: 0
    };
  }
}