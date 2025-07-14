// Error types for graph execution

export interface GraphError {
  message: string;
  timestamp: number;
  recoverable: boolean;
  stack?: string;
}

export class NodeExecutionError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly originalError: Error,
    public readonly recoverable: boolean = true
  ) {
    super(`Node ${nodeId} execution failed: ${originalError.message}`);
    this.name = 'NodeExecutionError';
    this.stack = originalError.stack;
  }
}