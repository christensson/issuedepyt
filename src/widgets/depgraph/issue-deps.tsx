import DoubleChevronLeft from "@jetbrains/icons/double-chevron-left";
import DoubleChevronRight from "@jetbrains/icons/double-chevron-right";
import DownloadIcon from "@jetbrains/icons/download";
import ExpandAllIcon from "@jetbrains/icons/expand-all";
import InfoIcon from "@jetbrains/icons/info";
import UpdateIcon from "@jetbrains/icons/update";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import Theme from "@jetbrains/ring-ui-built/components/global/theme";
import Group from "@jetbrains/ring-ui-built/components/group/group";
import Icon from "@jetbrains/ring-ui-built/components/icon/icon";
import LoaderInline from "@jetbrains/ring-ui-built/components/loader-inline/loader-inline";
import type { SelectItem } from "@jetbrains/ring-ui-built/components/select/select";
import Select from "@jetbrains/ring-ui-built/components/select/select";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import Toggle, { Size as ToggleSize } from "@jetbrains/ring-ui-built/components/toggle/toggle";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";
import React, { useCallback, useEffect, useState } from "react";
import type { FieldInfo, FieldInfoKey } from "../../../@types/field-info";
import type { FilterState } from "../../../@types/filter-state";
import type { FollowSettings } from "../../../@types/follow-settings";
import { GraphContext, GraphLoadSettings } from "../../../@types/graph-context";
import type { GraphViewSettings, HierarchicalDirection } from "../../../@types/graph-view-settings";
import { createErrorNote, createSuccessNote, NoteProps } from "../../../@types/note";
import type { Settings } from "../../../@types/settings";
import { host } from "../global/ytApp";
import { openGraphPage } from "../issuedepyt-page/open-page";
import DepGraph from "./dep-graph";
import DepTimeline from "./dep-timeline";
import exportData from "./export";
import type { FollowDirection, FollowDirections } from "./fetch-deps";
import { fetchDeps, fetchDepsAndExtend, fetchIssueAndInfo } from "./fetch-deps";
import FilterDropdownMenu, { createFilterState } from "./filter-dropdown-menu";
import { storeContextGraphSettings } from "./graph-context-ops";
import IssueInfoCard from "./issue-info-card";
import type { DirectionType, IssueInfo, IssueLink, Relation, Relations } from "./issue-types";
import OptionsDropdownMenu from "./options-dropdown-menu";
import SearchDropdownMenu from "./search-dropdown-menu";
import VerticalSizeControl from "./vertical-size-control";

interface IssueDepsProps {
  issueId: string;
  settings: Settings;
  graphLoadSettings: GraphLoadSettings;
  setGraphLoadSettings: React.Dispatch<React.SetStateAction<GraphLoadSettings>>;
  graphViewSettings: GraphViewSettings;
  setGraphViewSettings: React.Dispatch<React.SetStateAction<GraphViewSettings>>;
  setNote: React.Dispatch<React.SetStateAction<NoteProps | null>>;
  isSinglePageApp?: boolean;
  useDynamicGraphHeight?: boolean;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_NODE_WIDTH = 200;

const GRAPH_HEIGHT_MARGIN = 40;
const GRAPH_CONTROLS_HEIGHT_MIN_VALUE = 200;

type GRAPH_SIZE_ITEM = {
  height: number;
  limits?: {
    maxDepth: number;
    maxCount: number;
  };
};
const GRAPH_SIZE: Array<GRAPH_SIZE_ITEM> = [
  {
    height: 130,
    limits: {
      maxDepth: 0,
      maxCount: 2,
    },
  },
  {
    height: 260,
    limits: {
      maxDepth: 1,
      maxCount: 10,
    },
  },
  {
    height: 390,
    limits: {
      maxDepth: 3,
      maxCount: 20,
    },
  },
  {
    height: 520,
  },
];

const getNumIssues = (issueData: { [key: string]: IssueInfo }): number => {
  return Object.keys(issueData).length;
};

const getMaxDepth = (issueData: { [key: string]: IssueInfo }): number => {
  return Object.values(issueData)
    .map((x) => x.depth)
    .reduce((acc, val) => Math.max(acc, val), 0);
};

const calcGraphSizeFromIssues = (issueData: { [key: string]: IssueInfo }): number => {
  const count = getNumIssues(issueData);
  const maxDepth = getMaxDepth(issueData);
  const sizeEntry = GRAPH_SIZE.find((value) => {
    const limits = value?.limits;
    return limits === undefined || (maxDepth <= limits.maxDepth && count <= limits.maxCount);
  });
  return sizeEntry ? sizeEntry.height : 400;
};

const parseRelationList = (relations: string | undefined): Array<Relation> => {
  if (relations === undefined) {
    return [];
  }
  return relations.split(",").map((relation: string) => {
    const [direction, type] = relation.split(":");
    return {
      direction: direction.trim().toUpperCase() as DirectionType,
      type: type.trim(),
    };
  });
};

const getRelations = (settings: Settings): Relations | null => {
  const upstream = parseRelationList(settings?.upstreamRelations);
  const downstream = parseRelationList(settings?.downstreamRelations);
  return { upstream, downstream };
};

const IssueDeps: React.FunctionComponent<IssueDepsProps> = ({
  issueId,
  settings,
  graphLoadSettings,
  setGraphLoadSettings,
  graphViewSettings,
  setGraphViewSettings,
  setNote,
  isSinglePageApp = false,
  useDynamicGraphHeight = false,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [relations, setRelations] = useState<Relations>({
    upstream: [],
    downstream: [],
  });
  const [timelineVisible, setTimelineVisible] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [graphHeight, setGraphHeight] = useState<number>(400);
  const [highlightedNodes, setHighlightedNodes] = useState<Array<string> | null>(null);
  const [maxNodeWidth, setMaxNodeWidth] = useState<number>(DEFAULT_MAX_NODE_WIDTH);
  const [maxDepth, setMaxDepth] = useState<number>(DEFAULT_MAX_DEPTH);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo>({});
  const [issueData, setIssueData] = useState<{ [key: string]: IssueInfo }>({});
  const [filterState, setFilterState] = useState<FilterState>({
    showOrphans: false,
    showWhenLinksUnknown: true,
  });
  const [graphNodeControlsOpen, setGraphNodeControlsOpen] = useState<boolean>(true);

  // Auto-collapse the floating menu when the graph is shrunk to its smallest size.
  useEffect(() => {
    if (graphHeight <= GRAPH_CONTROLS_HEIGHT_MIN_VALUE) {
      setGraphNodeControlsOpen(false);
    }
  }, [graphHeight]);

  const selectNode = (nodeId: string) => {
    setHighlightedNodes(null);
    setSelectedNode(nodeId);
  };

  const activateGraphHeight = (height: number) => {
    setGraphHeight(height);
    const actualHeight = height + 280;
    document.documentElement.style.setProperty("--window-height", `${actualHeight}px`);
  };

  const getFollowDirections = (followSettings: FollowSettings): FollowDirections => {
    const followDirs: FollowDirections = [];
    if (followSettings.followUpstream) {
      followDirs.push("upstream");
    }
    if (followSettings.followDownstream) {
      followDirs.push("downstream");
    }
    return followDirs;
  };

  const refreshData = useCallback(async () => {
    const followDirs: FollowDirections = getFollowDirections(graphLoadSettings.followSettings);
    if (
      followDirs.length === 0 ||
      (relations.upstream.length === 0 && relations.downstream.length === 0)
    ) {
      console.log(`Not fetching deps for root ${issueId}, no directions or relations yet...`);
      return;
    }
    setLoading(true);
    console.log(`Fetching deps for root ${issueId}...`);

    const { issue: issueInfo, fieldInfo: fieldInfoData } = await fetchIssueAndInfo(
      host,
      issueId,
      settings,
    );
    const issues = await fetchDeps(host, issueInfo, maxDepth, relations, followDirs, settings);
    setFilterState(createFilterState(fieldInfoData));
    setFieldInfo(fieldInfoData);
    if (useDynamicGraphHeight) {
      const height = calcGraphSizeFromIssues(issues);
      activateGraphHeight(height);
    }
    console.log("Fetched issues from root:", issues);
    setIssueData(issues);
    // Remove highlight.
    setHighlightedNodes(null);
    // Set selected node to the root issue if none selected already.
    setSelectedNode((oldId) => (oldId === null ? issueInfo.id : oldId));

    setLoading(false);
  }, [host, issueId, maxDepth, relations, settings, graphLoadSettings, useDynamicGraphHeight]);

  const loadIssueDeps = useCallback(
    async (issueId: string, direction: FollowDirection | null = null) => {
      console.log(`Fetching deps for ${issueId}...`);
      setLoading(true);
      const followDirs: FollowDirections = getFollowDirections(graphLoadSettings.followSettings);
      const issues = await fetchDepsAndExtend(
        host,
        issueId,
        issueData,
        maxDepth,
        relations,
        followDirs,
        settings,
      );
      setIssueData(issues);
      setLoading(false);
    },
    [host, issueData, maxDepth, relations, settings, graphLoadSettings],
  );

  const isSelectedNodeAnIssue = (
    nodeId: string | null,
    issueData: { [key: string]: IssueInfo },
  ): boolean => {
    if (nodeId === null) {
      return false;
    }
    return nodeId in issueData;
  };

  const openNode = useCallback(
    (nodeId: string) => {
      if (isSelectedNodeAnIssue(nodeId, issueData)) {
        console.log(`Opening issue ${nodeId}...`);
        open(`/issue/${nodeId}`);
      }
    },
    [issueData],
  );

  useEffect(() => {
    if (settings?.maxRecursionDepth != undefined) {
      setMaxDepth(settings.maxRecursionDepth);
    }

    const newRelations = getRelations(settings);
    if (newRelations) {
      setRelations(newRelations);
    }
  }, [settings]);

  useEffect(() => {
    refreshData();
  }, [host, issueId, maxDepth, relations]);

  const treeDirectionSelectItems: Array<SelectItem<{ key: HierarchicalDirection }>> = [
    {
      key: "TB",
      label: "Top down direction",
    },
    {
      key: "BT",
      label: "Bottom up direction",
    },
    {
      key: "LR",
      label: "Left to right direction",
    },
    {
      key: "RL",
      label: "Right to left direction",
    },
  ];

  return (
    <div>
      <div className="dep-toolbar">
        {loading && (
          <LoaderInline>
            <Text size={Text.Size.S} info>
              Loading...
            </Text>
          </LoaderInline>
        )}
        {selectedNode !== null && selectedNode in issueData && (
          <Group>
            <Button href={`/issue/${selectedNode}`}>
              Open {issueData[selectedNode].idReadable}
            </Button>
            <span className="extra-margin-left">
              <Group>
                <Checkbox
                  label="Show upstream"
                  checked={issueData[selectedNode].showUpstream}
                  onChange={(e: any) =>
                    setIssueData((issues) => {
                      if (selectedNode in issues) {
                        const updatedIssues = { ...issues };
                        updatedIssues[selectedNode] = {
                          ...updatedIssues[selectedNode],
                          showUpstream: e.target.checked,
                        };
                        return updatedIssues;
                      }
                      return issues;
                    })
                  }
                />
                <Checkbox
                  label="Show downstream"
                  checked={issueData[selectedNode].showDownstream}
                  onChange={(e: any) =>
                    setIssueData((issues) => {
                      if (selectedNode in issues) {
                        const updatedIssues = { ...issues };
                        updatedIssues[selectedNode] = {
                          ...updatedIssues[selectedNode],
                          showDownstream: e.target.checked,
                        };
                        return updatedIssues;
                      }
                      return issues;
                    })
                  }
                />
              </Group>
            </span>
            {!issueData[selectedNode].linksKnown && (
              <span className="extra-margin-left">
                <Group>
                  <Button onClick={() => loadIssueDeps(selectedNode)} icon={DownloadIcon}>
                    Load relations
                  </Button>
                </Group>
              </span>
            )}
          </Group>
        )}
        <span className="dep-toolbar-right">
          <Group>
            <Tooltip
              title={
                !(settings?.dueDateField || settings?.sprintsField)
                  ? "No due date or sprints field configured for project!"
                  : undefined
              }
              theme={Theme.LIGHT}
            >
              <Toggle
                size={ToggleSize.Size14}
                checked={timelineVisible}
                onChange={(e: any) => setTimelineVisible(e.target.checked)}
                disabled={!(settings?.dueDateField || settings?.sprintsField)}
              >
                Show timeline
              </Toggle>
            </Tooltip>
            <span className="extra-margin-left">
              <Tooltip
                title={
                  loading
                    ? "Loading..."
                    : `Graph with ${getNumIssues(issueData)} nodes and a depth of ${getMaxDepth(
                        issueData,
                      )}.`
                }
                theme={Theme.LIGHT}
              >
                <Icon glyph={InfoIcon} />
              </Tooltip>
            </span>
            <Tooltip title="Reload data" theme={Theme.LIGHT}>
              <Button onClick={refreshData} icon={UpdateIcon} />
            </Tooltip>
            <SearchDropdownMenu
              fieldInfo={fieldInfo}
              issueData={issueData}
              settings={settings}
              setHighlightedNodes={setHighlightedNodes}
              maxHeight={graphHeight - GRAPH_HEIGHT_MARGIN}
            />
            <FilterDropdownMenu
              fieldInfo={fieldInfo}
              filterState={filterState}
              setFilterState={setFilterState}
              maxHeight={graphHeight - GRAPH_HEIGHT_MARGIN}
            />
            {!isSinglePageApp && (
              <Tooltip title="Open graph in full-screen page..." theme={Theme.LIGHT}>
                <Button
                  onClick={() => openGraphPage(issueId, graphLoadSettings, graphViewSettings)}
                  icon={ExpandAllIcon}
                />
              </Tooltip>
            )}
            <OptionsDropdownMenu
              maxDepth={maxDepth}
              maxNodeWidth={maxNodeWidth}
              useHierarchicalLayout={graphViewSettings.layoutOptions.hierarchical}
              useAlternateTreeLayout={graphViewSettings.layoutOptions.alternateTreeLayout}
              horizontalEdgeLabels={graphViewSettings.layoutOptions.horizontalEdgeLabels}
              followUpstream={graphLoadSettings.followSettings.followUpstream}
              followDownstream={graphLoadSettings.followSettings.followDownstream}
              showNodeLabelFlags={graphViewSettings.nodeLabelOptions.showFlags}
              showNodeLabelSummary={graphViewSettings.nodeLabelOptions.showSummary}
              showNodeLabelType={graphViewSettings.nodeLabelOptions.showType}
              setMaxDepth={setMaxDepth}
              setMaxNodeWidth={setMaxNodeWidth}
              maxHeight={graphHeight - GRAPH_HEIGHT_MARGIN}
              setUseHierarchicalLayout={(hierarchical: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  layoutOptions: { ...prev.layoutOptions, hierarchical },
                }))
              }
              setUseAlternateTreeLayout={(alternateTreeLayout: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  layoutOptions: { ...prev.layoutOptions, alternateTreeLayout },
                }))
              }
              setHorizontalEdgeLabels={(horizontalEdgeLabels: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  layoutOptions: { ...prev.layoutOptions, horizontalEdgeLabels },
                }))
              }
              setFollowUpstream={(followUpstream: boolean) =>
                setGraphLoadSettings((prev) => ({
                  ...prev,
                  followSettings: { ...prev.followSettings, followUpstream },
                }))
              }
              setFollowDownstream={(followDownstream: boolean) =>
                setGraphLoadSettings((prev) => ({
                  ...prev,
                  followSettings: { ...prev.followSettings, followDownstream },
                }))
              }
              setShowNodeLabelFlags={(show: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  nodeLabelOptions: { ...prev.nodeLabelOptions, showFlags: show },
                }))
              }
              setShowNodeLabelSummary={(show: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  nodeLabelOptions: { ...prev.nodeLabelOptions, showSummary: show },
                }))
              }
              setShowNodeLabelType={(show: boolean) =>
                setGraphViewSettings((prev) => ({
                  ...prev,
                  nodeLabelOptions: { ...prev.nodeLabelOptions, showType: show },
                }))
              }
              onExportData={() => exportData(issueId, issueData)}
              onSaveContext={async () => {
                const success = await storeContextGraphSettings(
                  graphLoadSettings,
                  graphViewSettings,
                );
                if (success) {
                  setNote(createSuccessNote("Settings saved!", 5000));
                } else {
                  setNote(createErrorNote("Failed to save settings."));
                }
              }}
            />
          </Group>
        </span>
      </div>
      {timelineVisible && Object.keys(issueData).length > 0 && (
        <DepTimeline
          issues={issueData}
          selectedIssueId={selectedNode}
          fieldInfo={fieldInfo}
          filterState={filterState}
          setSelectedNode={selectNode}
          onOpenNode={openNode}
        />
      )}
      {Object.keys(issueData).length > 0 && (
        <DepGraph
          issues={issueData}
          selectedIssueId={selectedNode}
          highlightedIssueIds={highlightedNodes}
          fieldInfo={fieldInfo}
          filterState={filterState}
          maxNodeWidth={maxNodeWidth}
          graphViewSettings={graphViewSettings}
          setSelectedNode={selectNode}
          onOpenNode={openNode}
        >
          <div className={"dep-graph-node-controls"}>
            {graphNodeControlsOpen && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Toggle
                  size={ToggleSize.Size14}
                  checked={graphViewSettings.layoutOptions.hierarchical}
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      layoutOptions: { ...prev.layoutOptions, hierarchical: e.target.checked },
                    }))
                  }
                >
                  Tree layout
                </Toggle>
                {graphViewSettings.layoutOptions.hierarchical && (
                  <Toggle
                    size={ToggleSize.Size14}
                    checked={graphViewSettings.layoutOptions.alternateTreeLayout}
                    onChange={(e: any) =>
                      setGraphViewSettings((prev) => ({
                        ...prev,
                        layoutOptions: {
                          ...prev.layoutOptions,
                          alternateTreeLayout: e.target.checked,
                        },
                      }))
                    }
                  >
                    Alternate tree layout
                  </Toggle>
                )}
                <Toggle
                  size={ToggleSize.Size14}
                  checked={graphViewSettings.layoutOptions.horizontalEdgeLabels}
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      layoutOptions: {
                        ...prev.layoutOptions,
                        horizontalEdgeLabels: e.target.checked,
                      },
                    }))
                  }
                >
                  Horizontal edge labels
                </Toggle>
                {graphViewSettings.layoutOptions.hierarchical && (
                  <Select
                    data={treeDirectionSelectItems}
                    selected={treeDirectionSelectItems.find(
                      (item) => item.key === graphViewSettings.layoutOptions.hierarchicalDirection,
                    )}
                    onSelect={(selected: SelectItem<{ key: HierarchicalDirection }> | null) => {
                      if (!selected) return;
                      setGraphViewSettings((prev) => ({
                        ...prev,
                        layoutOptions: {
                          ...prev.layoutOptions,
                          hierarchicalDirection: selected.key,
                        },
                      }));
                    }}
                    type={Select.Type.INLINE}
                  />
                )}
                <Toggle
                  size={ToggleSize.Size14}
                  checked={
                    !graphViewSettings.nodeLabelOptions.showType &&
                    !graphViewSettings.nodeLabelOptions.showSummary &&
                    !graphViewSettings.nodeLabelOptions.showFlags
                  }
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      nodeLabelOptions: {
                        ...prev.nodeLabelOptions,
                        showType: !e.target.checked,
                        showSummary: !e.target.checked,
                        showFlags: !e.target.checked,
                      },
                    }))
                  }
                >
                  Only ticket ID
                </Toggle>
                <Toggle
                  size={ToggleSize.Size14}
                  checked={graphViewSettings.nodeLabelOptions.showType}
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      nodeLabelOptions: { ...prev.nodeLabelOptions, showType: e.target.checked },
                    }))
                  }
                >
                  Ticket types
                </Toggle>
                <Toggle
                  size={ToggleSize.Size14}
                  checked={graphViewSettings.nodeLabelOptions.showSummary}
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      nodeLabelOptions: { ...prev.nodeLabelOptions, showSummary: e.target.checked },
                    }))
                  }
                >
                  Ticket summary
                </Toggle>
                <Toggle
                  size={ToggleSize.Size14}
                  checked={graphViewSettings.nodeLabelOptions.showFlags}
                  onChange={(e: any) =>
                    setGraphViewSettings((prev) => ({
                      ...prev,
                      nodeLabelOptions: { ...prev.nodeLabelOptions, showFlags: e.target.checked },
                    }))
                  }
                >
                  Ticket attributes
                </Toggle>
              </div>
            )}
            <div style={{ marginLeft: "auto" }}>
              <Tooltip
                title={
                  graphNodeControlsOpen
                    ? undefined
                    : !graphNodeControlsOpen &&
                        graphHeight < GRAPH_CONTROLS_HEIGHT_MIN_VALUE + GRAPH_HEIGHT_MARGIN
                      ? "Increase graph height to expand controls"
                      : "Expand graph controls"
                }
                theme={Theme.LIGHT}
              >
                <Button
                  inline
                  disabled={
                    !graphNodeControlsOpen &&
                    graphHeight < GRAPH_CONTROLS_HEIGHT_MIN_VALUE + GRAPH_HEIGHT_MARGIN
                  }
                  onClick={() => setGraphNodeControlsOpen((prev) => !prev)}
                  iconRight={graphNodeControlsOpen ? DoubleChevronRight : DoubleChevronLeft}
                  ghost
                >
                  {graphNodeControlsOpen && "Collapse"}
                </Button>
              </Tooltip>
            </div>
          </div>
        </DepGraph>
      )}
      {selectedNode !== null && isSelectedNodeAnIssue(selectedNode, issueData) && (
        <IssueInfoCard issue={issueData[selectedNode]} />
      )}
      {!isSinglePageApp && (
        <VerticalSizeControl
          minValue={GRAPH_CONTROLS_HEIGHT_MIN_VALUE}
          maxValue={1400}
          value={graphHeight}
          increment={130}
          onChange={activateGraphHeight}
        />
      )}
    </div>
  );
};

export default IssueDeps;
