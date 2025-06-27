import { describe, it, expect } from 'vitest';

// Copy the helper functions from constants.tsx for testing
function extractNumericFromRduId(rduId: string): number {
    const match = rduId.match(/(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 0;
}

function compareRduIds(a: string, b: string): number {
    const numA = extractNumericFromRduId(a);
    const numB = extractNumericFromRduId(b);
    
    if (numA !== 0 && numB !== 0) {
        return numA - numB;
    }
    
    return a.localeCompare(b);
}

describe('RDU Sorting', () => {
    it('should extract numeric values correctly', () => {
        expect(extractNumericFromRduId('DU_1')).toBe(1);
        expect(extractNumericFromRduId('DU_01')).toBe(1);
        expect(extractNumericFromRduId('DU_10')).toBe(10);
        expect(extractNumericFromRduId('RDU_5')).toBe(5);
        expect(extractNumericFromRduId('RDU_100')).toBe(100);
        expect(extractNumericFromRduId('NoNumber')).toBe(0);
    });

    it('should sort RDU IDs numerically', () => {
        const ids = ['DU_10', 'DU_2', 'DU_1', 'DU_20', 'DU_3'];
        const sorted = [...ids].sort(compareRduIds);
        expect(sorted).toEqual(['DU_1', 'DU_2', 'DU_3', 'DU_10', 'DU_20']);
    });

    it('should handle mixed formats', () => {
        const ids = ['RDU_10', 'DU_2', 'RDU_1', 'DU_20', 'RDU_3'];
        const sorted = [...ids].sort(compareRduIds);
        expect(sorted).toEqual(['RDU_1', 'DU_2', 'RDU_3', 'RDU_10', 'DU_20']);
    });

    it('should handle zero-padded numbers', () => {
        const ids = ['DU_010', 'DU_002', 'DU_001', 'DU_020', 'DU_003'];
        const sorted = [...ids].sort(compareRduIds);
        expect(sorted).toEqual(['DU_001', 'DU_002', 'DU_003', 'DU_010', 'DU_020']);
    });

    it('should fallback to string comparison for non-numeric IDs', () => {
        const ids = ['DU_B', 'DU_A', 'DU_C'];
        const sorted = [...ids].sort(compareRduIds);
        expect(sorted).toEqual(['DU_A', 'DU_B', 'DU_C']);
    });

    it('should handle the problematic case from the bug', () => {
        // This was the original bug: DU_10 would sort before DU_2
        const ids = ['DU_1', 'DU_2', 'DU_3', 'DU_4', 'DU_5', 'DU_6', 'DU_7', 'DU_8', 'DU_9', 'DU_10'];
        const sorted = [...ids].sort(compareRduIds);
        expect(sorted).toEqual(['DU_1', 'DU_2', 'DU_3', 'DU_4', 'DU_5', 'DU_6', 'DU_7', 'DU_8', 'DU_9', 'DU_10']);
        
        // With alphabetical sort, DU_10 would come before DU_2
        const alphabeticallySorted = [...ids].sort((a, b) => a.localeCompare(b));
        expect(alphabeticallySorted[1]).toBe('DU_10'); // Bug!
        expect(sorted[1]).toBe('DU_2'); // Fixed!
    });
});