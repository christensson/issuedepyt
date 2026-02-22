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
import type { Settings } from "../../../@types/settings";
import { host } from "../global/ytApp";
import { openGraphPage } from "../issuedepyt-page/open-page";
import DepGraph, {
  type HierarchicalDirection,
  type LayoutOptions,
  type NodeLabelOptions,
} from "./dep-graph";
import DepTimeline from "./dep-timeline";
import exportData from "./export";
import type { FollowDirection, FollowDirections } from "./fetch-deps";
import { fetchDeps, fetchDepsAndExtend, fetchIssueAndInfo } from "./fetch-deps";
import FilterDropdownMenu, { createFilterState } from "./filter-dropdown-menu";
import IssueInfoCard from "./issue-info-card";
import type { DirectionType, IssueInfo, IssueLink, Relation, Relations } from "./issue-types";
import OptionsDropdownMenu from "./options-dropdown-menu";
import SearchDropdownMenu from "./search-dropdown-menu";
import VerticalSizeControl from "./vertical-size-control";

interface IssueDepsProps {
  issueId: string;
  settings: Settings;
  followUpstream: boolean;
  followDownstream: boolean;
  setFollowUpstream: (value: boolean) => void;
  setFollowDownstream: (value: boolean) => void;
  isSinglePageApp?: boolean;
  useDynamicGraphHeight?: boolean;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_NODE_WIDTH = 200;
const DEFAULT_USE_HIERARCHICAL_LAYOUT = false;
const DEFAULT_USE_ALTERNATE_TREE_LAYOUT = false;

type GRAPH_SIZE_ITEM = {
  height: number;
  limits?: {
    maxDepth: number;
    maxCount: number;
  };
};
const GRAPH_SIZE: Array<GRAPH_SIZE_ITEM> = [
  {
    height: 100,
    limits: {
      maxDepth: 0,
      maxCount: 2,
    },
  },
  {
    height: 200,
    limits: {
      maxDepth: 1,
      maxCount: 10,
    },
  },
  {
    height: 400,
    limits: {
      maxDepth: 3,
      maxCount: 20,
    },
  },
  {
    height: 700,
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
  followUpstream,
  followDownstream,
  setFollowUpstream,
  setFollowDownstream,
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
  const [nodeLabelOptions, setNodeLabelOptions] = useState<NodeLabelOptions>({
    showSummary: true,
    showFlags: true,
    showType: true,
  });
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>({
    hierarchical: DEFAULT_USE_HIERARCHICAL_LAYOUT,
    hierarchicalDirection: "TB",
    alternateTreeLayout: DEFAULT_USE_ALTERNATE_TREE_LAYOUT,
  });
  const [fieldInfo, setFieldInfo] = useState<FieldInfo>({});
  const [issueData, setIssueData] = useState<{ [key: string]: IssueInfo }>({});
  const [filterState, setFilterState] = useState<FilterState>({
    showOrphans: false,
    showWhenLinksUnknown: true,
  });

  const selectNode = (nodeId: string) => {
    setHighlightedNodes(null);
    setSelectedNode(nodeId);
  };

  const activateGraphHeight = (height: number) => {
    setGraphHeight(height);
    const actualHeight = height + 280;
    document.documentElement.style.setProperty("--window-height", `${actualHeight}px`);
  };

  const getFollowDirections = (
    followUpstream: boolean,
    followDownstream: boolean,
  ): FollowDirections => {
    const followDirs: FollowDirections = [];
    if (followUpstream) {
      followDirs.push("upstream");
    }
    if (followDownstream) {
      followDirs.push("downstream");
    }
    return followDirs;
  };

  const refreshData = useCallback(async () => {
    const followDirs: FollowDirections = getFollowDirections(followUpstream, followDownstream);
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
  }, [
    host,
    issueId,
    maxDepth,
    relations,
    settings,
    followUpstream,
    followDownstream,
    useDynamicGraphHeight,
  ]);

  const loadIssueDeps = useCallback(
    async (issueId: string, direction: FollowDirection | null = null) => {
      console.log(`Fetching deps for ${issueId}...`);
      setLoading(true);
      const followDirs: FollowDirections = getFollowDirections(followUpstream, followDownstream);
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
    [host, issueData, maxDepth, relations, settings, followUpstream, followDownstream],
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

    if (settings?.useHierarchicalLayout != undefined) {
      setLayoutOptions((prev) => ({
        ...prev,
        hierarchical: settings.useHierarchicalLayout || false,
      }));
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
            />
            <FilterDropdownMenu
              fieldInfo={fieldInfo}
              filterState={filterState}
              setFilterState={setFilterState}
            />
            {!isSinglePageApp && (
              <Tooltip title="Open graph in full-screen page..." theme={Theme.LIGHT}>
                <Button onClick={() => openGraphPage(issueId, settings)} icon={ExpandAllIcon} />
              </Tooltip>
            )}
            <OptionsDropdownMenu
              maxDepth={maxDepth}
              maxNodeWidth={maxNodeWidth}
              useHierarchicalLayout={layoutOptions.hierarchical}
              useAlternateTreeLayout={layoutOptions.alternateTreeLayout}
              followUpstream={followUpstream}
              followDownstream={followDownstream}
              showNodeLabelFlags={nodeLabelOptions.showFlags}
              showNodeLabelSummary={nodeLabelOptions.showSummary}
              showNodeLabelType={nodeLabelOptions.showType}
              setMaxDepth={setMaxDepth}
              setMaxNodeWidth={setMaxNodeWidth}
              setUseHierarchicalLayout={(hierarchical: boolean) =>
                setLayoutOptions((prev) => ({ ...prev, hierarchical }))
              }
              setUseAlternateTreeLayout={(alternateTreeLayout: boolean) =>
                setLayoutOptions((prev) => ({ ...prev, alternateTreeLayout }))
              }
              setFollowUpstream={setFollowUpstream}
              setFollowDownstream={setFollowDownstream}
              setShowNodeLabelFlags={(show: boolean) =>
                setNodeLabelOptions((prev) => ({ ...prev, showFlags: show }))
              }
              setShowNodeLabelSummary={(show: boolean) =>
                setNodeLabelOptions((prev) => ({ ...prev, showSummary: show }))
              }
              setShowNodeLabelType={(show: boolean) =>
                setNodeLabelOptions((prev) => ({ ...prev, showType: show }))
              }
              onExportData={() => exportData(issueId, issueData)}
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
          maxNodeWidth={maxNodeWidth}
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
          nodeLabelOptions={nodeLabelOptions}
          layoutOptions={layoutOptions}
          setSelectedNode={selectNode}
          onOpenNode={openNode}
        >
          <div className={"dep-graph-node-controls"}>
            <Toggle
              size={ToggleSize.Size14}
              checked={layoutOptions.hierarchical}
              onChange={(e: any) =>
                setLayoutOptions((prev) => ({ ...prev, hierarchical: e.target.checked }))
              }
            >
              Tree layout
            </Toggle>
            {layoutOptions.hierarchical && (
              <Toggle
                size={ToggleSize.Size14}
                checked={layoutOptions.alternateTreeLayout}
                onChange={(e: any) =>
                  setLayoutOptions((prev) => ({ ...prev, alternateTreeLayout: e.target.checked }))
                }
              >
                Alternate tree layout
              </Toggle>
            )}
            {layoutOptions.hierarchical && (
              <Select
                data={treeDirectionSelectItems}
                selected={treeDirectionSelectItems.find(
                  (item) => item.key === layoutOptions.hierarchicalDirection,
                )}
                onSelect={(selected: SelectItem<{ key: HierarchicalDirection }> | null) => {
                  if (!selected) return;
                  setLayoutOptions((prev) => ({ ...prev, hierarchicalDirection: selected.key }));
                }}
                type={Select.Type.INLINE}
              />
            )}
            <Toggle
              size={ToggleSize.Size14}
              checked={
                !nodeLabelOptions.showType &&
                !nodeLabelOptions.showSummary &&
                !nodeLabelOptions.showFlags
              }
              onChange={(e: any) =>
                setNodeLabelOptions((prev) => ({
                  ...prev,
                  showType: !e.target.checked,
                  showSummary: !e.target.checked,
                  showFlags: !e.target.checked,
                }))
              }
            >
              Only ticket ID
            </Toggle>
            <Toggle
              size={ToggleSize.Size14}
              checked={nodeLabelOptions.showType}
              onChange={(e: any) =>
                setNodeLabelOptions((prev) => ({ ...prev, showType: e.target.checked }))
              }
            >
              Ticket types
            </Toggle>
            <Toggle
              size={ToggleSize.Size14}
              checked={nodeLabelOptions.showSummary}
              onChange={(e: any) =>
                setNodeLabelOptions((prev) => ({ ...prev, showSummary: e.target.checked }))
              }
            >
              Ticket summary
            </Toggle>
            <Toggle
              size={ToggleSize.Size14}
              checked={nodeLabelOptions.showFlags}
              onChange={(e: any) =>
                setNodeLabelOptions((prev) => ({ ...prev, showFlags: e.target.checked }))
              }
            >
              Ticket attributes
            </Toggle>
          </div>
        </DepGraph>
      )}
      {selectedNode !== null && isSelectedNodeAnIssue(selectedNode, issueData) && (
        <IssueInfoCard issue={issueData[selectedNode]} />
      )}
      {!isSinglePageApp && (
        <VerticalSizeControl
          minValue={100}
          maxValue={1400}
          value={graphHeight}
          increment={100}
          onChange={activateGraphHeight}
        />
      )}
    </div>
  );
};

export default IssueDeps;
