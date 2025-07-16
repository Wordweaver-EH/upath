/**
 * P_NEG1_1 Variable Identification Step Types
 * Exactly matches the working prototype interfaces
 */

/**
 * Input data structure for P_NEG1_1 step
 * Prepared by getInput function
 */
export interface P_NEG1_1_Input {
  filename_or_id: string;
  raw_transcript_text_from_file: string;
  dependent_variable_focus_list: string[];
}

/**
 * Discovered variable from transcript header
 */
export interface DiscoveredVariable {
  name: string;        // e.g., "Participant", "Score", "Suggestion"
  value: string;       // e.g., "1", "4", "A"
  confidence?: number; // 0-1, LLM's confidence in extraction
}

/**
 * Output data structure for P_NEG1_1 step
 * Exactly matches the working prototype's P_neg1_1_Output interface
 * Enhanced with dynamic variable discovery for flexible bucketing
 */
export interface P_NEG1_1_Output {
  transcript_id: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
  
  // Legacy header parsing (maintained for backward compatibility)
  parsed_header?: {
    iv_value: string;    // e.g., "4" from "Scored 4/5"
    event_value: string; // e.g., "1" from "Suggestion 1"  
    raw_header: string;  // Full first line for reference
  };

  // New dynamic variable discovery
  discovered_variables?: DiscoveredVariable[];
}