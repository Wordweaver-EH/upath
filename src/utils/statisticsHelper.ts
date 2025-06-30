/**
 * Statistical helper functions for Inter-Rater Reliability analysis.
 * 
 * This module implements Krippendorff's Alpha coefficient for measuring
 * inter-rater reliability, specifically adapted for nominal data
 * (categorical assignments like GDU IDs).
 * 
 * References:
 * - Krippendorff, K. (2004). Content Analysis: An Introduction to Its Methodology (2nd ed.)
 * - Wikipedia: https://en.wikipedia.org/wiki/Krippendorff's_alpha
 */

/**
 * Represents a data matrix where each row is an utterance and each column is a rater.
 * null values represent missing data (utterance not coded by that rater).
 */
export type ReliabilityMatrix = (string | null)[][];

/**
 * Result of Krippendorff's Alpha calculation with interpretation.
 */
export interface AlphaResult {
    alpha: number;
    interpretation: string;
    observedDisagreement: number;
    expectedDisagreement: number;
    totalPairableValues: number;
    categoryCount: number;
}

/**
 * Result of Cohen's Kappa calculation with interpretation.
 */
export interface KappaResult {
    kappa: number;
    interpretation: string;
    observedAgreement: number;
    expectedAgreement: number;
    totalPairs: number;
    categoryCount: number;
    contingencyTable: Map<string, Map<string, number>>;
}

/**
 * Calculates Krippendorff's Alpha coefficient for nominal data.
 * 
 * Formula: α = 1 - (Do / De)
 * Where:
 * - Do = Observed disagreement 
 * - De = Expected disagreement by chance
 * 
 * For nominal data, disagreement function δ(v, v') = 0 if v = v', 1 if v ≠ v'
 * 
 * @param matrix Reliability matrix where rows = utterances, columns = raters
 * @returns AlphaResult with coefficient and diagnostic information
 */
export function calculateKrippendorffsAlpha(matrix: ReliabilityMatrix): AlphaResult {
    if (matrix.length === 0) {
        return {
            alpha: 0,
            interpretation: "No data",
            observedDisagreement: 0,
            expectedDisagreement: 0,
            totalPairableValues: 0,
            categoryCount: 0
        };
    }

    // Step 1: Build coincidence matrix for pairable values
    const pairableValues = extractPairableValues(matrix);
    
    if (pairableValues.length === 0) {
        return {
            alpha: 0,
            interpretation: "No pairable values",
            observedDisagreement: 0,
            expectedDisagreement: 0,
            totalPairableValues: 0,
            categoryCount: 0
        };
    }

    // Get all unique categories
    const categories = getUniqueCategories(pairableValues);
    
    // Check if all pairs agree (perfect agreement)
    const allPairsAgree = pairableValues.every(([v1, v2]) => v1 === v2);
    
    if (categories.length <= 1 || allPairsAgree) {
        return {
            alpha: 1,
            interpretation: categories.length <= 1 ? "Perfect agreement (single category)" : "Excellent reliability",
            observedDisagreement: 0,
            expectedDisagreement: 0,
            totalPairableValues: pairableValues.length,
            categoryCount: categories.length
        };
    }

    // Step 2: Calculate observed disagreement (Do)
    const observedDisagreement = calculateObservedDisagreement(pairableValues);

    // Step 3: Calculate expected disagreement (De)
    const expectedDisagreement = calculateExpectedDisagreement(pairableValues, categories);

    // Step 4: Calculate alpha
    let alpha: number;
    if (expectedDisagreement === 0) {
        // Perfect agreement case
        alpha = 1;
    } else {
        alpha = 1 - (observedDisagreement / expectedDisagreement);
    }

    // Interpret the result
    const interpretation = interpretAlpha(alpha);

    return {
        alpha,
        interpretation,
        observedDisagreement,
        expectedDisagreement,
        totalPairableValues: pairableValues.length,
        categoryCount: categories.length
    };
}

/**
 * Extracts pairable values from the matrix.
 * For each unit (row), all pairs of non-null values are considered pairable.
 */
function extractPairableValues(matrix: ReliabilityMatrix): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];

    for (const row of matrix) {
        // Get all non-null values in this row
        const nonNullValues = row.filter((value): value is string => value !== null);
        
        // Create all possible pairs from this row (standard Krippendorff's approach)
        for (let i = 0; i < nonNullValues.length; i++) {
            for (let j = i + 1; j < nonNullValues.length; j++) {
                pairs.push([nonNullValues[i], nonNullValues[j]]);
            }
        }
    }

    return pairs;
}

/**
 * Gets all unique categories present in the pairable values.
 */
function getUniqueCategories(pairableValues: Array<[string, string]>): string[] {
    const categories = new Set<string>();
    
    for (const [v1, v2] of pairableValues) {
        categories.add(v1);
        categories.add(v2);
    }
    
    return Array.from(categories).sort();
}

/**
 * Calculates observed disagreement (Do) for nominal data.
 * For nominal data: disagreement = 1 if different, 0 if same.
 */
function calculateObservedDisagreement(pairableValues: Array<[string, string]>): number {
    if (pairableValues.length === 0) return 0;

    let disagreements = 0;
    
    for (const [v1, v2] of pairableValues) {
        if (v1 !== v2) {
            disagreements += 1;
        }
    }

    return disagreements / pairableValues.length;
}

/**
 * Calculates expected disagreement (De) by chance for nominal data.
 * This represents the disagreement we would expect if assignments were random
 * but with the same marginal distribution of categories.
 */
function calculateExpectedDisagreement(
    pairableValues: Array<[string, string]>, 
    categories: string[]
): number {
    if (pairableValues.length === 0 || categories.length <= 1) return 0;

    // Count frequency of each category
    const categoryFreq = new Map<string, number>();
    
    for (const category of categories) {
        categoryFreq.set(category, 0);
    }
    
    // Count each value in pairs (each appears once per pair it's in)
    for (const [v1, v2] of pairableValues) {
        categoryFreq.set(v1, (categoryFreq.get(v1) || 0) + 1);
        categoryFreq.set(v2, (categoryFreq.get(v2) || 0) + 1);
    }

    const totalValues = pairableValues.length * 2;
    
    // Calculate expected disagreement
    // For nominal data: P(disagreement) = 1 - sum(P(category_i)^2)
    let expectedAgreement = 0;
    
    for (const freq of categoryFreq.values()) {
        const proportion = freq / totalValues;
        expectedAgreement += proportion * proportion;
    }
    
    return 1 - expectedAgreement;
}

/**
 * Provides qualitative interpretation of Krippendorff's Alpha values.
 * Based on common benchmarks in the literature.
 */
function interpretAlpha(alpha: number): string {
    if (alpha >= 0.8) {
        return "Excellent reliability";
    } else if (alpha >= 0.667) {
        return "Good reliability";
    } else if (alpha >= 0.4) {
        return "Moderate reliability";
    } else if (alpha > 0) {
        return "Poor reliability";
    } else if (alpha === 0) {
        return "No reliability";
    } else {
        return "Systematic disagreement";
    }
}

/**
 * Builds a reliability matrix from two runs of analysis.
 * Each row represents an utterance, columns represent the two runs.
 * 
 * @param runAMappings Map of utterance IDs to GDU assignments for Run A
 * @param runBMappings Map of utterance IDs to GDU assignments for Run B
 * @param gduMapping Optional mapping from Run A GDUs to Run B GDUs (for different GDU sets)
 * @returns Reliability matrix ready for alpha calculation
 */
export function buildReliabilityMatrix(
    runAMappings: Map<string, string[]>,
    runBMappings: Map<string, string[]>,
    gduMapping?: Map<string, string | null>
): ReliabilityMatrix {
    // Get all unique utterance IDs from both runs
    const allUtteranceIds = new Set<string>();
    runAMappings.forEach((_, id) => allUtteranceIds.add(id));
    runBMappings.forEach((_, id) => allUtteranceIds.add(id));

    const matrix: ReliabilityMatrix = [];

    for (const utteranceId of allUtteranceIds) {
        const runAGdus = runAMappings.get(utteranceId) || [];
        const runBGdus = runBMappings.get(utteranceId) || [];

        // Handle multiple GDU assignments by creating separate rows
        const maxAssignments = Math.max(runAGdus.length, runBGdus.length, 1);

        for (let i = 0; i < maxAssignments; i++) {
            let runAValue: string | null = runAGdus[i] || null;
            let runBValue: string | null = runBGdus[i] || null;

            // Apply GDU mapping if provided
            if (runAValue && gduMapping) {
                const mappedValue = gduMapping.get(runAValue);
                runAValue = mappedValue !== undefined ? mappedValue : null;
            }

            // Only add row if at least one value is non-null
            if (runAValue !== null || runBValue !== null) {
                matrix.push([runAValue, runBValue]);
            }
        }
    }

    return matrix;
}

/**
 * Validates a reliability matrix for common issues.
 */
export function validateReliabilityMatrix(matrix: ReliabilityMatrix): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
} {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    if (matrix.length === 0) {
        errors.push("Matrix is empty");
        isValid = false;
        return { isValid, warnings, errors };
    }

    // Check for consistent column count
    const expectedColumns = matrix[0].length;
    for (let i = 1; i < matrix.length; i++) {
        if (matrix[i].length !== expectedColumns) {
            errors.push(`Row ${i} has ${matrix[i].length} columns, expected ${expectedColumns}`);
            isValid = false;
        }
    }

    // Count missing data
    let totalCells = 0;
    let missingCells = 0;
    
    for (const row of matrix) {
        for (const cell of row) {
            totalCells++;
            if (cell === null) {
                missingCells++;
            }
        }
    }

    const missingPercentage = (missingCells / totalCells) * 100;
    
    if (missingPercentage > 50) {
        warnings.push(`High percentage of missing data: ${missingPercentage.toFixed(1)}%`);
    }

    if (missingCells === totalCells) {
        errors.push("All data is missing");
        isValid = false;
    }

    return { isValid, warnings, errors };
}

/**
 * Calculates Cohen's Kappa coefficient for nominal data.
 * 
 * Formula: κ = (Po - Pe) / (1 - Pe)
 * Where:
 * - Po = Observed agreement (proportion of cases where raters agree)
 * - Pe = Expected agreement by chance
 * 
 * This implementation handles cases where raters use different sets of categories
 * by creating a union of all categories and treating missing categories as having 0 assignments.
 * 
 * @param matrix Reliability matrix where rows = utterances, columns = raters (exactly 2 columns)
 * @returns KappaResult with coefficient and diagnostic information
 */
export function calculateCohensKappa(matrix: ReliabilityMatrix): KappaResult {
    if (matrix.length === 0) {
        return {
            kappa: 0,
            interpretation: "No data",
            observedAgreement: 0,
            expectedAgreement: 0,
            totalPairs: 0,
            categoryCount: 0,
            contingencyTable: new Map()
        };
    }

    // Filter to only rows where both raters made assignments (complete pairs)
    const completePairs = matrix.filter(row => row[0] !== null && row[1] !== null);
    
    if (completePairs.length === 0) {
        return {
            kappa: 0,
            interpretation: "No complete pairs",
            observedAgreement: 0,
            expectedAgreement: 0,
            totalPairs: 0,
            categoryCount: 0,
            contingencyTable: new Map()
        };
    }

    // Get all unique categories from both raters
    const allCategories = new Set<string>();
    completePairs.forEach(([rater1, rater2]) => {
        if (rater1) allCategories.add(rater1);
        if (rater2) allCategories.add(rater2);
    });
    
    const categories = Array.from(allCategories).sort();
    
    // Build contingency table
    const contingencyTable = new Map<string, Map<string, number>>();
    categories.forEach(cat1 => {
        const row = new Map<string, number>();
        categories.forEach(cat2 => row.set(cat2, 0));
        contingencyTable.set(cat1, row);
    });
    
    // Populate contingency table
    completePairs.forEach(([rater1, rater2]) => {
        if (rater1 && rater2) {
            const row = contingencyTable.get(rater1)!;
            row.set(rater2, (row.get(rater2) || 0) + 1);
        }
    });
    
    const totalPairs = completePairs.length;
    
    // Calculate observed agreement (sum of diagonal)
    let agreedPairs = 0;
    categories.forEach(category => {
        agreedPairs += contingencyTable.get(category)!.get(category) || 0;
    });
    const observedAgreement = agreedPairs / totalPairs;
    
    // Calculate expected agreement
    // For each category, calculate marginal probabilities
    const rater1Marginals = new Map<string, number>();
    const rater2Marginals = new Map<string, number>();
    
    categories.forEach(category => {
        // Rater 1 marginal (sum of row)
        let rater1Sum = 0;
        contingencyTable.get(category)!.forEach(count => rater1Sum += count);
        rater1Marginals.set(category, rater1Sum / totalPairs);
        
        // Rater 2 marginal (sum of column)
        let rater2Sum = 0;
        contingencyTable.forEach(row => {
            rater2Sum += row.get(category) || 0;
        });
        rater2Marginals.set(category, rater2Sum / totalPairs);
    });
    
    // Expected agreement is sum of products of marginal probabilities
    let expectedAgreement = 0;
    categories.forEach(category => {
        const p1 = rater1Marginals.get(category) || 0;
        const p2 = rater2Marginals.get(category) || 0;
        expectedAgreement += p1 * p2;
    });
    
    // Calculate kappa
    let kappa: number;
    if (expectedAgreement === 1) {
        // Perfect expected agreement (shouldn't happen in practice)
        kappa = observedAgreement === 1 ? 1 : 0;
    } else {
        kappa = (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
    }
    
    // Handle edge cases
    if (isNaN(kappa)) kappa = 0;
    
    // Interpret the result
    const interpretation = interpretKappa(kappa);
    
    return {
        kappa,
        interpretation,
        observedAgreement,
        expectedAgreement,
        totalPairs,
        categoryCount: categories.length,
        contingencyTable
    };
}

/**
 * Provides qualitative interpretation of Cohen's Kappa values.
 * Based on Landis & Koch (1977) benchmarks.
 */
function interpretKappa(kappa: number): string {
    if (kappa < 0) {
        return "Less than chance agreement";
    } else if (kappa >= 0 && kappa <= 0.20) {
        return "Slight agreement";
    } else if (kappa > 0.20 && kappa <= 0.40) {
        return "Fair agreement";
    } else if (kappa > 0.40 && kappa <= 0.60) {
        return "Moderate agreement";
    } else if (kappa > 0.60 && kappa <= 0.80) {
        return "Substantial agreement";
    } else if (kappa > 0.80 && kappa < 1) {
        return "Almost perfect agreement";
    } else { // kappa === 1
        return "Perfect agreement";
    }
}