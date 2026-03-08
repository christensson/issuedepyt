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
  maxNodeWidth: number;
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
    maxNodeWidth: 200,
  },
  nodeLabelOptions: {
    showSummary: true,
    showFlags: true,
    showType: true,
  },
};
