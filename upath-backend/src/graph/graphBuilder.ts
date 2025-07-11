import { NodeRegistry } from './nodeRegistry';
import { StepId } from './types';
import { BaseNode } from './nodes/BaseNode';

export interface ConditionalEdge {
  target: string;
  condition: (state: any) => boolean;
}

export interface GraphMetadata {
  nodeCount: number;
  edgeCount: number;
  createdAt: number;
}

export interface Graph {
  nodes: Map<string, BaseNode>;
  edges: Map<string, string[]>;
  conditionalEdges: Map<string, ConditionalEdge[]>;
  entryPoint: string;
  hasCycles: boolean;
  metadata: GraphMetadata;
  topologicalSort(): string[] | null;
  findPaths(start: string, end: string): string[][];
}

export class GraphBuilder {
  private registry: NodeRegistry;
  private edges: Map<string, Set<string>>;
  private conditionalEdges: Map<string, ConditionalEdge[]>;
  private entryPoint: string;

  constructor(registry: NodeRegistry) {
    this.registry = registry;
    this.edges = new Map();
    this.conditionalEdges = new Map();
    this.entryPoint = StepId.P0_1_TRANSCRIPTION_ADHERENCE;
    
    // Initialize default edges
    this.initializeDefaultEdges();
  }

  private initializeDefaultEdges(): void {
    // Default linear flow for initial nodes
    this.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_2_REFINE_DATA_TYPES);
    this.addEdge(StepId.P0_2_REFINE_DATA_TYPES, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
  }

  setEntryPoint(nodeId: string): void {
    this.entryPoint = nodeId;
  }

  addEdge(from: string, to: string): void {
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }
    this.edges.get(from)!.add(to);
  }

  removeEdge(from: string, to: string): void {
    if (this.edges.has(from)) {
      this.edges.get(from)!.delete(to);
    }
  }

  addConditionalEdge(from: string, to: string, condition: (state: any) => boolean): void {
    if (!this.conditionalEdges.has(from)) {
      this.conditionalEdges.set(from, []);
    }
    this.conditionalEdges.get(from)!.push({ target: to, condition });
  }

  build(): Graph {
    // Create nodes map
    const nodes = new Map<string, BaseNode>();
    const registeredNodes = this.registry.listNodes();
    
    for (const nodeId of registeredNodes) {
      nodes.set(nodeId, this.registry.getNode(nodeId));
    }

    // Validate entry point
    if (!nodes.has(this.entryPoint)) {
      throw new Error(`Entry point ${this.entryPoint} not found in graph`);
    }

    // Convert edges to arrays
    const edgeArrays = new Map<string, string[]>();
    for (const [from, toSet] of this.edges) {
      edgeArrays.set(from, Array.from(toSet));
    }

    // Validate all edge targets exist
    for (const [from, targets] of edgeArrays) {
      for (const target of targets) {
        if (!nodes.has(target)) {
          throw new Error(`Target node ${target} not found in edge from ${from}`);
        }
      }
    }

    // Check for cycles
    const hasCycles = this.detectCycles(edgeArrays);

    // Count edges
    let edgeCount = 0;
    for (const targets of edgeArrays.values()) {
      edgeCount += targets.length;
    }

    // Create graph object
    const graph: Graph = {
      nodes,
      edges: edgeArrays,
      conditionalEdges: new Map(this.conditionalEdges),
      entryPoint: this.entryPoint,
      hasCycles,
      metadata: {
        nodeCount: nodes.size,
        edgeCount,
        createdAt: Date.now()
      },
      topologicalSort: () => this.topologicalSort(nodes, edgeArrays),
      findPaths: (start, end) => this.findPaths(start, end, edgeArrays)
    };

    return graph;
  }

  private detectCycles(edges: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycleDFS = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = edges.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    // Check all nodes
    for (const node of edges.keys()) {
      if (!visited.has(node)) {
        if (hasCycleDFS(node)) {
          return true;
        }
      }
    }

    return false;
  }

  private topologicalSort(nodes: Map<string, BaseNode>, edges: Map<string, string[]>): string[] | null {
    // Check for cycles first
    if (this.detectCycles(edges)) {
      return null;
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      
      const neighbors = edges.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      
      stack.push(node);
    };

    // Visit all nodes
    for (const node of nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return stack.reverse();
  }

  private findPaths(start: string, end: string, edges: Map<string, string[]>): string[][] {
    const paths: string[][] = [];
    const currentPath: string[] = [];
    const visited = new Set<string>();

    const dfs = (node: string): void => {
      currentPath.push(node);
      visited.add(node);

      if (node === end) {
        paths.push([...currentPath]);
      } else {
        const neighbors = edges.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor);
          }
        }
      }

      currentPath.pop();
      visited.delete(node);
    };

    dfs(start);
    return paths;
  }
}