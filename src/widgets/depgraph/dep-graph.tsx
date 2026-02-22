import cytoscape, { Core, Css, ElementDefinition, use } from "cytoscape";
import React, { useCallback, useEffect, useRef } from "react";
// @ts-ignore - No TypeScript definitions available
import dagre from "cytoscape-dagre";
// @ts-ignore - No TypeScript definitions available
import fcose from "cytoscape-fcose";
// @ts-ignore - No TypeScript definitions available
import type { FieldInfo, FieldInfoField } from "../../../@types/field-info";
import type { FilterState } from "../../../@types/filter-state";
import { Color, ColorPaletteItem, hexToRgb, rgbToHex } from "./colors";
import { filterIssues } from "./issue-helpers";
import type { IssueInfo, IssueLink } from "./issue-types";

// Register Cytoscape extensions
cytoscape.use(dagre);
cytoscape.use(fcose);

interface DepGraphProps {
  issues: { [id: string]: IssueInfo };
  selectedIssueId: string | null;
  highlightedIssueIds: string[] | null;
  fieldInfo: FieldInfo;
  filterState: FilterState;
  maxNodeWidth: number | undefined;
  useHierarchicalLayout: boolean;
  useDepthRendering: boolean;
  setSelectedNode: (nodeId: string) => void;
  onOpenNode: (nodeId: string) => void;
}

const FONT_FAMILY = "system-ui, Arial, sans-serif";
const FONT_FAMILY_MONOSPACE =
  'Menlo, "Bitstream Vera Sans Mono", "Ubuntu Mono", Consolas, "Courier New", Courier, monospace';

const getColor = (
  state: string | undefined,
  stateFieldInfo: FieldInfoField | undefined,
): ColorPaletteItem | undefined => {
  if (stateFieldInfo && state) {
    const stateKey = Object.keys(stateFieldInfo.values).find(
      (x) => x.toLowerCase() === state.toLowerCase(),
    );
    const colorEntry = stateKey != undefined ? stateFieldInfo.values[stateKey] : undefined;
    if (colorEntry) {
      return {
        bg: colorEntry.background,
        fg: colorEntry.foreground,
      };
    }
  }

  return undefined;
};

const getSelectedColor = (colorEntry: ColorPaletteItem): ColorPaletteItem => {
  // Check if bright or dark color by checking the intensity of the foreground color.
  const fgRgb = hexToRgb(colorEntry.fg);
  const bgRgb = hexToRgb(colorEntry.bg);
  if (fgRgb == undefined || bgRgb == undefined) {
    return colorEntry;
  }
  const fgIntensity = fgRgb.reduce((acc, x) => acc + x, 0) / 3;
  const adjustment = fgIntensity > 128 ? 0.05 : -0.05;
  const background = bgRgb.map((x) => Math.min(255, Math.max(0, Math.round(x + x * adjustment))));
  return {
    bg: rgbToHex(background),
    fg: colorEntry.fg,
  };
};

const getNodeLabel = (issue: IssueInfo): string => {
  let lines = [];
  if (issue?.type) {
    lines.push(`<< ${issue.type} >>`);
  }

  let summary = "" + issue.idReadable;
  if (issue?.summary) {
    summary = `${summary}: ${issue.summary}`;
  }
  lines.push(summary);

  let flags = [];
  if (issue?.state) {
    flags.push(issue.state);
  }
  if (issue.hasOwnProperty("assignee")) {
    flags.push(issue?.assignee ? "Assigned" : "Unassigned");
  }
  if (issue?.sprints) {
    flags.push(issue.sprints.length > 0 ? "Planned" : "Unplanned");
  }
  if (flags.length > 0) {
    lines.push(flags.join(", "));
  }

  return lines.join("\n");
};

const getNodeHtmlLabel = (issue: IssueInfo): string => {
  let lines = [];
  if (issue?.type) {
    lines.push(
      `<div style="font-style: italic; font-size: 12px; text-align: center;">&lt;&lt; ${issue.type} &gt;&gt;</div>`,
    );
  }

  let summary = "" + issue.idReadable;
  if (issue?.summary) {
    summary = `${summary}: ${issue.summary}`;
  }
  lines.push(
    `<div style="font-weight: bold; font-size: 12px; text-align: center; max-width: 200px; word-wrap: break-word; white-space: normal;">${summary}</div>`,
  );

  let flags = [];
  if (issue?.state) {
    flags.push(issue.state);
  }
  if (issue.hasOwnProperty("assignee")) {
    flags.push(issue?.assignee ? "Assigned" : "Unassigned");
  }
  if (issue?.sprints) {
    flags.push(issue.sprints.length > 0 ? "Planned" : "Unplanned");
  }
  if (flags.length > 0) {
    lines.push(`<div style="font-size: 12px; text-align: center;">${flags.join(", ")}</div>`);
  }

  return lines.join("<br/>");
};

const getNodeTooltip = (issue: IssueInfo): string => {
  let lines = [];
  lines.push(issue.idReadable);
  if (issue?.type) {
    lines.push(`Type: ${issue.type}`);
  }
  if (issue?.state) {
    lines.push(`State: ${issue.state}`);
  }
  if (issue?.assignee != undefined && issue.assignee.length > 0) {
    lines.push(`Assignee: ${issue.assignee}`);
  }
  if (issue?.sprints) {
    lines.push(
      "Sprints: " +
        (issue.sprints.length > 0 ? issue.sprints.map((x) => x.name).join(", ") : "Unplanned"),
    );
  }
  if (issue?.startDate) {
    lines.push(`Start date: ${issue.startDate.toDateString()}`);
  }
  if (issue?.dueDate) {
    lines.push(`Due date: ${issue.dueDate.toDateString()}`);
  }
  if (issue?.estimation) {
    lines.push(`Estimation: ${issue.estimation.presentation}`);
  }
  lines.push("Click to select and double-click to open.");

  if (!issue.linksKnown) {
    lines.push("");
    lines.push("Relations not known.");
  }

  return lines.join("\n");
};

const getGraphObjects = (
  issues: { [key: string]: IssueInfo },
  fieldInfo: FieldInfo,
  useDepthRendering: boolean,
): ElementDefinition[] => {
  const linkInfo = {};
  const linksAndEdges = Object.values(issues).flatMap((issue: IssueInfo) =>
    [
      ...(issue.showUpstream ? issue.upstreamLinks : []),
      ...(issue.showDownstream ? issue.downstreamLinks : []),
    ]
      // Only include links where the target issue exists.
      .filter((link: IssueLink) => link.targetId in issues)
      .map((link: IssueLink) => {
        const label =
          link.direction === "OUTWARD" || link.direction === "BOTH"
            ? link.sourceToTarget
            : link.targetToSource;
        return {
          direction: link.direction,
          type: link.type,
          edge: {
            data: {
              id: `${issue.id}-${link.targetId}-${link.type}`,
              source: issue.id,
              target: link.targetId,
              label,
              title: label,
              arrowFrom: link.direction == "OUTWARD" && link.type == "Subtask",
              arrowTo: link.direction !== "BOTH",
            },
          },
        };
      }),
  );

  // Filter out duplicate edges.
  let edges: ElementDefinition[] = [];
  const unDirectedEdgesAdded: { [key: string]: boolean } = {};
  for (const { direction, type, edge } of linksAndEdges) {
    // Include all directed edges.
    if (direction !== "BOTH") {
      edges.push(edge);
      continue;
    }

    // If non-directed, check if already added.
    const reverseEdgeKey = `${type}-${edge.data.target}-${edge.data.source}`;

    if (reverseEdgeKey in unDirectedEdgesAdded) {
      continue;
    }

    // Add and mark as added.
    edges.push(edge);
    const edgeKey = `${type}-${edge.data.source}-${edge.data.target}`;
    unDirectedEdgesAdded[edgeKey] = true;
  }

  const nodes: ElementDefinition[] = Object.values(issues)
    // Transform issues to graph nodes.
    .map((issue: IssueInfo) => {
      const colorEntry = getColor(issue.state, fieldInfo?.stateField);
      const node: ElementDefinition = {
        data: {
          id: issue.id,
          label: getNodeLabel(issue),
          htmlLabel: getNodeHtmlLabel(issue),
          title: getNodeTooltip(issue),
          linksKnown: issue.linksKnown ? true : false,
          backgroundColor: colorEntry?.bg,
          fontColor: colorEntry?.fg,
        },
      };
      if (useDepthRendering) {
        node.data.level = issue.depth;
      }
      return node;
    });

  return [...nodes, ...edges];
};

const DepGraph: React.FunctionComponent<DepGraphProps> = ({
  issues,
  selectedIssueId,
  highlightedIssueIds,
  fieldInfo,
  filterState,
  maxNodeWidth,
  useHierarchicalLayout,
  useDepthRendering,
  setSelectedNode,
  onOpenNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const updateSelectedNodes = (selectedId: string | null, highlightedIds: Array<string> | null) => {
    if (!cyRef.current) {
      return;
    }

    const cy = cyRef.current;
    cy.nodes().unselect();

    const selectedIds = [];
    if (highlightedIds !== null) {
      selectedIds.push(...highlightedIds);
    } else if (selectedId != null) {
      selectedIds.push(selectedId);
    }

    const availableSelectedIds = selectedIds.filter((id) => cy.getElementById(id).length > 0);
    if (availableSelectedIds.length > 0) {
      console.log(`Graph: Selecting issues ${availableSelectedIds.join(", ")}`);
      availableSelectedIds.forEach((id) => cy.getElementById(id).select());
    }
  };

  const calcLabelDimensions = (label: string, node: any): { width: number; height: number } => {
    if (label.length === 0) {
      return { width: 20, height: 20 }; // Minimum width for nodes without labels.
    }
    // Reference implementation is calculateLabelDimensions.
    // See https://github.com/cytoscape/cytoscape.js/blob/unstable/src/extensions/renderer/base/coord-ele-math/labels.mjs
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx == null) {
      return { width: 20, height: 20 }; // Minimum width for nodes without labels.
    }
    const fStyle = node.pstyle("font-style").strValue;
    const fontSize = node.pstyle("font-size").pfValue;
    const size = fontSize + "px";
    const family = node.pstyle("font-family").strValue;
    const weight = node.pstyle("font-weight").strValue;
    const textMaxWidth = node.pstyle("text-max-width").pfValue;

    ctx.font = fStyle + " " + weight + " " + size + " " + family;
    const lines = label.split("\n");
    const longestLine = lines.reduce(
      (longest: string, line: string) => (line.length > longest.length ? line : longest),
      "",
    );
    const maxWidth = Math.ceil(ctx.measureText(longestLine).width);
    const width = Math.min(maxWidth, textMaxWidth || maxWidth);
    const realLines =
      lines.length +
      (textMaxWidth && maxWidth > textMaxWidth ? Math.ceil(maxWidth / textMaxWidth) - 1 : 0);
    const height = realLines * fontSize * 1.05;
    return { width, height };
  };

  const calcNodeWidth = (node: any) => {
    const label = node.data("label") || "";
    const dimensions = calcLabelDimensions(label, node);
    return dimensions.width;
  };

  const calcNodeHeight = (node: any) => {
    const label = node.data("label") || "";
    const dimensions = calcLabelDimensions(label, node);
    return dimensions.height;
  };

  // Initialize Cytoscape.
  useEffect(() => {
    if (containerRef.current && !cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements: [],
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "text-wrap": "wrap",
              "text-valign": "center",
              "text-halign": "center",
              "font-size": "12px",
              "font-family": FONT_FAMILY,
              "text-opacity": 1, // Hide the regular label, only show HTML label
              "background-color": (ele: any) => ele.data("backgroundColor") || Color.SecondaryColor,
              color: (ele: any) => ele.data("fontColor") || Color.TextColor,
              "border-width": 2,
              "border-color": Color.SecondaryColor,
              padding: "10px",
              width: calcNodeWidth,
              height: calcNodeHeight,
              "text-max-width": maxNodeWidth ? `${maxNodeWidth}px` : "200px",
              shape: "round-rectangle",
            } as Css.Node,
          },
          {
            selector: "node[!linksKnown]",
            style: {
              "border-style": "dashed",
              "border-dash-pattern": [5, 5],
            } as Css.Node,
          },
          {
            selector: "node:selected",
            style: {
              "outline-width": 4,
              "outline-offset": 4,
              "outline-color": Color.TextColor,
              "outline-style": "solid",
              "outline-opacity": 0.8,
            } as Css.Node,
          },
          {
            selector: "edge",
            style: {
              width: 0.5,
              "line-color": Color.LinkColor,
              "target-arrow-color": Color.LinkColor,
              "source-arrow-color": Color.LinkColor,
              "curve-style": "bezier",
              label: "data(label)",
              "font-size": "10px",
              "text-rotation": "autorotate",
              "text-margin-y": -10,
            },
          },
          {
            selector: "edge[?arrowTo]",
            style: {
              "target-arrow-shape": "triangle",
            },
          },
          {
            selector: "edge[?arrowFrom]",
            style: {
              "source-arrow-shape": "diamond",
            },
          },
          {
            selector: "edge:selected",
            style: {
              "line-color": Color.LinkHoverColor,
              "target-arrow-color": Color.LinkHoverColor,
              "source-arrow-color": Color.LinkHoverColor,
            },
          },
        ],
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
      });

      // Add tooltip support
      cy.on("mouseover", "node", (evt) => {
        const node = evt.target;
        const title = node.data("title");
        if (title && containerRef.current) {
          containerRef.current.title = title;
        }
      });

      cy.on("mouseout", "node", () => {
        if (containerRef.current) {
          containerRef.current.title = "";
        }
      });

      cyRef.current = cy;
    }
  }, []);

  const getLayoutOptions = (useHierarchicalLayout: boolean) =>
    useHierarchicalLayout
      ? {
          name: "dagre",
          rankDir: "TB",
          nodeDimensionsIncludeLabels: true,
          ranker: "network-simplex",
          animate: false,
          fit: true,
          padding: 30,
        }
      : {
          name: "fcose",
          animate: false,
          nodeDimensionsIncludeLabels: true,
          uniformNodeDimensions: false,
          idealEdgeLength: 80,
          fit: true,
          padding: 30,
        };

  // Update layout and node width when settings change
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;

      // Update max width.
      if (maxNodeWidth) {
        cy.style()
          .selector("node")
          .style({
            "text-max-width": `${maxNodeWidth}px`,
            width: calcNodeWidth,
            height: calcNodeHeight,
          })
          .update();
      }

      // Run layout.
      const layoutOptions = getLayoutOptions(useHierarchicalLayout);
      const layout = cy.layout(layoutOptions);
      layout.on("layoutstop", () => {
        cy.fit(undefined, 30);
      });
      layout.run();
    }
  }, [maxNodeWidth, useHierarchicalLayout]);

  // Update event handlers when callbacks change.
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;

      cy.on("onetap", "node", (evt) => {
        const node = evt.target;
        console.log(`Selecting node: ${node.id()}`);
        setSelectedNode(node.id());
      });

      cy.on("dbltap", "node", (evt) => {
        const node = evt.target;
        console.log(`Opening node: ${node.id()}`);
        onOpenNode(node.id());
      });
    }
  }, [onOpenNode, setSelectedNode]);

  // Update graph data when issues or filters change.
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      const visibleIssues = filterIssues(filterState, issues);
      console.log(`Rendering graph with ${Object.keys(visibleIssues).length} nodes`);
      const elements = getGraphObjects(visibleIssues, fieldInfo, useDepthRendering);

      // Replace all elements.
      cy.elements().remove();
      cy.add(elements);

      // Run layout
      const layoutOptions = getLayoutOptions(useHierarchicalLayout);
      const layout = cy.layout(layoutOptions);
      layout.on("layoutstop", () => {
        cy.fit(undefined, 30);
      });
      layout.run();

      updateSelectedNodes(selectedIssueId, highlightedIssueIds);
    }
  }, [issues, fieldInfo, filterState, useDepthRendering]);

  // Update selection when selectedIssueId or highlightedIssueIds change
  useEffect(() => {
    updateSelectedNodes(selectedIssueId, highlightedIssueIds);
  }, [selectedIssueId, highlightedIssueIds]);

  return <div ref={containerRef} className="dep-graph" />;
};

export default DepGraph;
