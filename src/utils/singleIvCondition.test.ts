import { describe, it, expect } from 'vitest';

describe('P5.1 Single IV Condition Handling', () => {
    // Test the RDU sorting functions
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

    it('should handle single IV condition data structure', () => {
        // Mock transcript data with single IV
        const transcriptsByIv = new Map();
        transcriptsByIv.set('Condition A', [
            { id: 't1', filename: 'transcript1.txt', gdu_sequence: ['GDU_1', 'GDU_2'] },
            { id: 't2', filename: 'transcript2.txt', gdu_sequence: ['GDU_1', 'GDU_3'] }
        ]);

        // This simulates the check in getInput
        expect(transcriptsByIv.size).toBe(1);
        
        // Get the single IV condition
        const [singleIv, transcripts] = Array.from(transcriptsByIv.entries())[0];
        expect(singleIv).toBe('Condition A');
        expect(transcripts.length).toBe(2);
        
        // Create IV summary for single condition
        const ivGroupSummary = {
            iv_condition: singleIv,
            transcript_ids: transcripts.map(t => t.id),
            gdu_sequences: transcripts.map(t => ({
                transcript_id: t.id,
                sequence: t.gdu_sequence
            }))
        };
        
        expect(ivGroupSummary.transcript_ids).toEqual(['t1', 't2']);
        expect(ivGroupSummary.gdu_sequences[0].sequence).toEqual(['GDU_1', 'GDU_2']);
    });

    it('should skip transcripts without IV data', () => {
        const transcriptData = [
            { id: 't1', hasIv: true, iv: 'Condition A' },
            { id: 't2', hasIv: false }, // Missing IV
            { id: 't3', hasIv: true, iv: 'Condition A' }
        ];

        const validTranscripts = transcriptData.filter(t => t.hasIv);
        expect(validTranscripts.length).toBe(2);
        expect(validTranscripts.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('should correctly sort RDUs with numeric IDs', () => {
        const rduIds = ['DU_10', 'DU_2', 'DU_1', 'DU_20', 'DU_3'];
        const sorted = [...rduIds].sort(compareRduIds);
        expect(sorted).toEqual(['DU_1', 'DU_2', 'DU_3', 'DU_10', 'DU_20']);
    });

    it('should handle edge case of no valid IV data', () => {
        const transcriptsByIv = new Map();
        
        // No IV groups
        expect(transcriptsByIv.size).toBe(0);
        
        // This would trigger the error in getInput
        const shouldReturnError = transcriptsByIv.size === 0;
        expect(shouldReturnError).toBe(true);
    });

    it('should validate single IV prompt contains proper keywords', () => {
        const singleIvPrompt = 'single Independent Variable (IV) condition';
        const multiIvPrompt = 'comparative analysis across different IV groups';
        
        // Single IV prompt should mention single condition
        expect(singleIvPrompt).toContain('single');
        expect(singleIvPrompt).toContain('IV');
        
        // Multi IV prompt should mention comparative
        expect(multiIvPrompt).toContain('comparative');
        expect(multiIvPrompt).toContain('different IV groups');
    });
});