import ZoomOutIcon from "@jetbrains/icons/collapse";
import ZoomInIcon from "@jetbrains/icons/expand";
import FullscreenIcon from "@jetbrains/icons/fullscreen";
import LocateIcon from "@jetbrains/icons/locate";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Theme from "@jetbrains/ring-ui-built/components/global/theme";
import Group from "@jetbrains/ring-ui-built/components/group/group";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";
import cytoscape, { Core, Css, ElementDefinition, ZoomOptions } from "cytoscape";
import React, { useCallback, useEffect, useRef } from "react";
// @ts-ignore - No TypeScript definitions available
import dagre from "cytoscape-dagre";
// @ts-ignore - No TypeScript definitions available
import klay from "cytoscape-klay";
// @ts-ignore - No TypeScript definitions available
import fcose from "cytoscape-fcose";
// @ts-ignore - No TypeScript definitions available
import type { FieldInfo, FieldInfoField } from "../../../@types/field-info";
import type { FilterState } from "../../../@types/filter-state";
import type {
  GraphViewSettings,
  LayoutOptions,
  NodeLabelOptions,
} from "../../../@types/graph-view-settings";
import { Color, ColorPaletteItem, hexToRgb, rgbToHex } from "./colors";
import { filterIssues } from "./issue-helpers";
import type { IssueInfo, IssueLink } from "./issue-types";

const GRAPH_PADDING = 20;

const MIN_NODE_WIDTH = 40;
const MAX_NODE_WIDTH = 400;
const MIN_NODE_HEIGHT = 20;
const MAX_NODE_HEIGHT = 200;

const MIN_ZOOM_AFTER_FIT = 0.7;
const MAX_ZOOM_AFTER_FIT = 2.0;

/**
 * Fit the graph into the viewport, clamping zoom to [MIN, MAX].
 * Returns the extra vertical pixels needed, or 0 if the graph fits
 * or vertical growth wouldn't help.
 */
const smartFitGraph = (cy: Core): number => {
  cy.fit(undefined, GRAPH_PADDING);
  const zoom = cy.zoom();
  if (zoom > MAX_ZOOM_AFTER_FIT) {
    cy.zoom(MAX_ZOOM_AFTER_FIT);
    cy.center();
    return 0;
  } else if (zoom < MIN_ZOOM_AFTER_FIT) {
    cy.zoom(MIN_ZOOM_AFTER_FIT);
    cy.center();

    // Check whether vertical growth would actually help by comparing
    // the graph bounding box to the container dimensions.
    // If the graph is much wider than it is tall relative to the
    // container, adding height won't improve the fit.
    const bb = cy.elements().boundingBox();
    const containerWidth = cy.width();
    const containerHeight = cy.height();
    if (bb.w === 0 || bb.h === 0 || containerWidth === 0 || containerHeight === 0) {
      return containerHeight;
    }
    const graphAspect = bb.w / bb.h;
    const containerAspect = containerWidth / containerHeight;
    // Only grow if the graph is at least as tall (proportionally) as the container.
    if (graphAspect > containerAspect * 1.5) {
      return 0;
    }
    // Calculate how much taller the container needs to be.
    const scaleFactor = MIN_ZOOM_AFTER_FIT / zoom;
    const extraHeight = Math.ceil(containerHeight * (scaleFactor - 1));
    return Math.max(0, extraHeight);
  }
  return 0;
};

// Register Cytoscape extensions
cytoscape.use(dagre);
cytoscape.use(klay);
cytoscape.use(fcose);

interface DepGraphProps extends React.PropsWithChildren {
  issues: { [id: string]: IssueInfo };
  selectedIssueId: string | null;
  highlightedIssueIds: string[] | null;
  fieldInfo: FieldInfo;
  filterState: FilterState;
  graphViewSettings: GraphViewSettings;
  height: number;
  setSelectedNode: (nodeId: string) => void;
  onOpenNode: (nodeId: string) => void;
  onRequestGrow?: (neededHeight: number) => void;
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

const getNodeLabel = (issue: IssueInfo, options: NodeLabelOptions): string => {
  let lines = [];
  let thinSpace = "\u2006";
  if (options.showType && issue?.type) {
    lines.push(`≪${thinSpace}${issue.type}${thinSpace}≫`);
  }

  let summary = "" + issue.idReadable;
  if (options.showSummary && issue?.summary) {
    summary = `${summary}: ${issue.summary}`;
  }
  lines.push(summary);

  if (options.showFlags) {
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
      const flagsHeader = `[${thinSpace}`;
      const flagsTrailer = `${thinSpace}]`;
      const flagsDelimiter = `${thinSpace}⋮${thinSpace}`; // "￨"; // " ‧ "; // " • ";
      lines.push(`${flagsHeader}${flags.join(flagsDelimiter)}${flagsTrailer}`);
    }
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
  nodeLabelOptions: NodeLabelOptions,
): ElementDefinition[] => {
  // Deduplicate edges from the perspective of the root node(s) using BFS.
  // For each node pair + link type, only keep the edge emitted by the node
  // closer to the root. E.g. if root B has "parent for" → A, the reverse
  // "subtask of" edge from A → B is suppressed because B is closer to root.

  // Find root nodes (depth 0) and build an adjacency list for BFS ordering.
  const rootIds = Object.values(issues)
    .filter((issue) => issue.depth === 0)
    .map((issue) => issue.id);

  // BFS to determine visitation order from root(s).
  const visitOrder: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [...rootIds];
  for (const id of queue) {
    visited.add(id);
  }
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    visitOrder.push(currentId);
    const current = issues[currentId];
    if (!current) continue;

    // Gather all neighbor IDs from visible links.
    const neighborIds = new Set<string>();
    if (current.showUpstream) {
      for (const link of current.upstreamLinks) {
        if (link.targetId in issues) neighborIds.add(link.targetId);
      }
    }
    if (current.showDownstream) {
      for (const link of current.downstreamLinks) {
        if (link.targetId in issues) neighborIds.add(link.targetId);
      }
    }
    for (const neighborId of neighborIds) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  // Walk nodes in BFS order and collect edges.
  // Nodes not reachable from root(s) are excluded from the graph entirely.
  // For each (node-pair, link-type) combo, keep only the first edge encountered.
  // This ensures the edge emitted by the node closer to root wins.
  const edges: ElementDefinition[] = [];
  const edgePairTypeAdded = new Set<string>();

  for (const issueId of visitOrder) {
    const issue = issues[issueId];
    if (!issue) continue;

    const links = [
      ...(issue.showUpstream ? issue.upstreamLinks : []),
      ...(issue.showDownstream ? issue.downstreamLinks : []),
    ].filter((link: IssueLink) => link.targetId in issues);

    for (const link of links) {
      // Normalize pair key so A-B and B-A with same type map to one slot.
      const pairKey =
        issueId < link.targetId
          ? `${issueId}|${link.targetId}|${link.type}`
          : `${link.targetId}|${issueId}|${link.type}`;

      if (edgePairTypeAdded.has(pairKey)) {
        continue;
      }
      edgePairTypeAdded.add(pairKey);

      const label =
        link.direction === "OUTWARD" || link.direction === "BOTH"
          ? link.sourceToTarget
          : link.targetToSource;

      edges.push({
        data: {
          id: `${issueId}-${link.targetId}-${link.type}`,
          source: issueId,
          target: link.targetId,
          label,
          title: label,
          arrowFrom: link.direction == "OUTWARD" && link.aggregation,
          arrowTo: link.direction !== "BOTH",
        },
      });
    }
  }

  const nodes: ElementDefinition[] = Object.values(issues)
    // Only include nodes reachable from root.
    .filter((issue: IssueInfo) => visited.has(issue.id))
    // Transform issues to graph nodes.
    .map((issue: IssueInfo) => {
      const colorEntry = getColor(issue.state, fieldInfo?.stateField);
      const node: ElementDefinition = {
        data: {
          id: issue.id,
          label: getNodeLabel(issue, nodeLabelOptions),
          // htmlLabel: getNodeHtmlLabel(issue),
          title: getNodeTooltip(issue),
          linksKnown: issue.linksKnown ? true : false,
          backgroundColor: colorEntry?.bg,
          fontColor: colorEntry?.fg,
        },
      };
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
  graphViewSettings,
  height,
  setSelectedNode,
  onOpenNode,
  onRequestGrow,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const pendingFit = useRef(false);

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

  const calcLabelDimensions = (label: string, node: any): { "width": number; "height": number } => {
    if (label.length === 0) {
      return { "width": 10, "height": 10 }; // Minimum width for nodes without labels.
    }
    // Reference implementation is calculateLabelDimensions.
    // See https://github.com/cytoscape/cytoscape.js/blob/unstable/src/extensions/renderer/base/coord-ele-math/labels.mjs
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx == null) {
      return { "width": 20, "height": 20 }; // Minimum width for nodes without labels.
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
    return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, dimensions.width));
  };

  const calcNodeHeight = (node: any) => {
    const label = node.data("label") || "";
    const dimensions = calcLabelDimensions(label, node);
    return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, dimensions.height));
  };

  // Initialize Cytoscape.
  useEffect(() => {
    if (containerRef.current && !cyRef.current) {
      const nodeLabelOpts = graphViewSettings.nodeLabelOptions;
      const layoutOpts = graphViewSettings.layoutOptions;
      const shortLabel = !nodeLabelOpts.showSummary && !nodeLabelOpts.showFlags;
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
              "text-opacity": 1,
              "background-color": (ele: any) => ele.data("backgroundColor") || Color.SecondaryColor,
              color: (ele: any) => ele.data("fontColor") || Color.TextColor,
              "border-width": 2,
              "border-color": Color.SecondaryColor,
              padding: shortLabel ? "5px" : "10px",
              "width": calcNodeWidth,
              "height": calcNodeHeight,
              "text-max-width": layoutOpts.maxNodeWidth ? `${layoutOpts.maxNodeWidth}px` : "200px",
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
              "font-size": "11px",
              "text-rotation": layoutOpts.horizontalEdgeLabels ? 0 : "autorotate",
              "text-margin-y": 0,
              "text-background-color": "#ffffff",
              "text-background-opacity": 0.8,
              "text-background-padding": "2px",
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
        boxSelectionEnabled: true,
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

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (pendingFit.current && cyRef.current) {
        pendingFit.current = false;
        cyRef.current.resize();
        smartFitGraph(cyRef.current);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const getLayoutOptions = (layoutOptions: LayoutOptions) => {
    if (layoutOptions.hierarchical) {
      if (layoutOptions.alternateTreeLayout) {
        const toDirection = {
          TB: "DOWN",
          BT: "UP",
          LR: "RIGHT",
          RL: "LEFT",
        };
        return {
          name: "klay",
          klay: {
            direction: toDirection[layoutOptions.hierarchicalDirection as keyof typeof toDirection],
          },
          nodeDimensionsIncludeLabels: true,
          animate: false,
          fit: true,
          padding: GRAPH_PADDING,
        };
      }
      return {
        name: "dagre",
        rankDir: layoutOptions.hierarchicalDirection,
        nodeDimensionsIncludeLabels: true,
        ranker: "network-simplex",
        animate: false,
        fit: true,
        padding: GRAPH_PADDING,
      };
    }
    return {
      name: "fcose",
      animate: false,
      nodeDimensionsIncludeLabels: true,
      uniformNodeDimensions: false,
      idealEdgeLength: 80,
      fit: true,
      padding: GRAPH_PADDING,
    };
  };

  // Update layout and node width when settings change
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;

      const nodeStyle: Css.Node = {};
      const nodeLabelOpts = graphViewSettings.nodeLabelOptions;
      const layoutOpts = graphViewSettings.layoutOptions;
      // Update max width.
      if (layoutOpts.maxNodeWidth) {
        Object.assign(nodeStyle, {
          "text-max-width": `${layoutOpts.maxNodeWidth}px`,
          "width": calcNodeWidth,
          "height": calcNodeHeight,
        });
      }
      const shortLabel = !nodeLabelOpts.showSummary && !nodeLabelOpts.showFlags;
      Object.assign(nodeStyle, {
        padding: shortLabel ? "5px" : "10px",
      });
      cy.style().selector("node").style(nodeStyle).update();

      // Update edge label rotation.
      cy.style()
        .selector("edge")
        .style({
          "text-rotation": layoutOpts.horizontalEdgeLabels ? 0 : "autorotate",
        })
        .update();

      // Run layout.
      const cyLayoutOpts = getLayoutOptions(layoutOpts);
      const layout = cy.layout(cyLayoutOpts);
      layout.removeListener("layoutstop");
      layout.on("layoutstop", () => {
        const neededHeight = smartFitGraph(cy);
        if (neededHeight > 0 && onRequestGrow) {
          pendingFit.current = true;
          onRequestGrow(neededHeight);
        }
      });
      layout.run();
    }
  }, [graphViewSettings, onRequestGrow]);

  // Update event handlers when callbacks change.
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;

      cy.removeListener("onetap", "node");
      cy.on("onetap", "node", (evt) => {
        const node = evt.target;
        console.log(`Selecting node: ${node.id()}`);
        setSelectedNode(node.id());
      });

      cy.removeListener("dbltap", "node");
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
      const nodeLabelOpts = graphViewSettings.nodeLabelOptions;
      const layoutOpts = graphViewSettings.layoutOptions;
      const elements = getGraphObjects(visibleIssues, fieldInfo, nodeLabelOpts);

      // Replace all elements.
      cy.elements().remove();
      cy.add(elements);

      // Run layout
      const cyLayoutOpts = getLayoutOptions(layoutOpts);
      const layout = cy.layout(cyLayoutOpts);
      layout.on("layoutstop", () => {
        const neededHeight = smartFitGraph(cy);
        if (neededHeight > 0 && onRequestGrow) {
          pendingFit.current = true;
          onRequestGrow(neededHeight);
        }
      });
      layout.run();

      updateSelectedNodes(selectedIssueId, highlightedIssueIds);
    }
  }, [issues, fieldInfo, filterState, graphViewSettings, onRequestGrow]);

  // Update selection when selectedIssueId or highlightedIssueIds change
  useEffect(() => {
    updateSelectedNodes(selectedIssueId, highlightedIssueIds);
  }, [selectedIssueId, highlightedIssueIds]);

  const zoomGraph = useCallback(
    (factor: number) => {
      if (cyRef.current) {
        const cy = cyRef.current;
        const selectedNode = selectedIssueId ? cy.getElementById(selectedIssueId) : null;
        const zoomOptions: ZoomOptions = {
          level: factor * cy.zoom(),
          position: selectedNode
            ? selectedNode.position()
            : { x: cy.width() / 2, y: cy.height() / 2 },
        };
        cy.zoom(zoomOptions);
      }
    },
    [selectedIssueId],
  );

  const focusGraph = useCallback(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      const selectedNode = selectedIssueId ? cy.getElementById(selectedIssueId) : null;
      if (selectedNode) {
        cy.center(selectedNode);
      } else {
        cy.center();
      }
    }
  }, [selectedIssueId]);

  const fitGraph = () => {
    if (cyRef.current) {
      const cy = cyRef.current;
      smartFitGraph(cy);
    }
  };

  return (
    <div className="dep-graph-container" style={{ height: `${height}px` }}>
      <div ref={containerRef} className="dep-graph" />
      {children}
      <div className="dep-graph-controls">
        <Group>
          <Tooltip title={"Zoom in"} theme={Theme.LIGHT}>
            <Button icon={ZoomInIcon} onClick={() => zoomGraph(1.1)} />
          </Tooltip>
          <Tooltip title={"Zoom out"} theme={Theme.LIGHT}>
            <Button icon={ZoomOutIcon} onClick={() => zoomGraph(0.9)} />
          </Tooltip>
          <Tooltip title={"Center selected"} theme={Theme.LIGHT}>
            <Button icon={LocateIcon} onClick={() => focusGraph()} />
          </Tooltip>
          <Tooltip title={"Zoom to fit"} theme={Theme.LIGHT}>
            <Button icon={FullscreenIcon} onClick={() => fitGraph()} />
          </Tooltip>
        </Group>
      </div>
    </div>
  );
};

export default DepGraph;
