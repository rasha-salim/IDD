/**
 * Intent: Define output types for the IDD design phase commands.
 * Each type maps to one IDD methodology phase (Decompose, Options, Decide, Diagram).
 * DesignDocument combines all phases for single-shot design.
 *
 * Guarantees: All types are JSON-serializable. All arrays default to non-empty in valid output.
 */

export interface DecomposeComponent {
  name: string;
  description: string;
}

export interface DecomposeResult {
  task: string;
  components: DecomposeComponent[];
  assumptions: string[];
}

export interface OptionPro {
  text: string;
}

export interface OptionCon {
  text: string;
}

export interface Option {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
}

export interface ComponentOptions {
  componentName: string;
  options: Option[];
  recommendation: string;
}

export interface OptionsResult {
  task: string;
  componentOptions: ComponentOptions[];
}

export interface Decision {
  component: string;
  choice: string;
  reason: string;
}

export interface DecideResult {
  task: string;
  decisions: Decision[];
}

export interface DiagramResult {
  task: string;
  mermaidCode: string;
  description: string;
}

export interface DesignDocument {
  task: string;
  decomposition: DecomposeResult;
  options: OptionsResult;
  decisions: DecideResult;
  diagram: DiagramResult;
}
