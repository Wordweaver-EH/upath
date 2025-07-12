# Progress Calculation Refactoring Plan

## Current State:
- BaseNode has a hardcoded `stepOrder` array in `calculateProgress` method
- This makes it unmaintainable when steps change

## Goal:
- Create a ProgressCalculator service that uses graph topology
- Remove hardcoded array from BaseNode
- Use topological sort for dynamic progress calculation

## Key Components:
1. Graph interface already has `topologicalSort()` method
2. ExecutionContext needs to be modified to include progress info
3. GraphExecutor needs to calculate progress during execution

## TDD Approach:
1. Write tests for ProgressCalculator service first
2. Implement the service
3. Modify ExecutionContext to include progress
4. Update GraphExecutor to use ProgressCalculator
5. Update BaseNode to use progress from context