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

export type GraphViewSettings = {
  layoutOptions: LayoutOptions;
  nodeLabelOptions: NodeLabelOptions;
};

export const defaultGraphViewSettings: GraphViewSettings = {
  layoutOptions: {
    hierarchical: true,
    hierarchicalDirection: "TB",
    alternateTreeLayout: false,
    horizontalEdgeLabels: true,
  },
  nodeLabelOptions: {
    showSummary: true,
    showFlags: true,
    showType: true,
  },
};
