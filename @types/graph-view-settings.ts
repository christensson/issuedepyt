export type NodeLabelOptions = {
  showSummary: boolean;
  showFlags: boolean;
  showType: boolean;
};

export type HierarchicalDirection = "TB" | "LR" | "BT" | "RL";

export type LayoutOptions = {
  hierarchical: boolean;
  alternateTreeLayout: boolean;
  hierarchicalDirection: HierarchicalDirection;
  horizontalEdgeLabels: boolean;
};
