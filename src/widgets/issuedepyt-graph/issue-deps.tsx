import React, { useState, useEffect } from "react";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Icon from "@jetbrains/ring-ui-built/components/icon/icon";
import Group from "@jetbrains/ring-ui-built/components/group/group";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import Toggle from "@jetbrains/ring-ui-built/components/toggle/toggle";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";
import Theme from "@jetbrains/ring-ui-built/components/global/theme";
import { Size as ToggleSize } from "@jetbrains/ring-ui-built/components/toggle/toggle";
import LoaderInline from "@jetbrains/ring-ui-built/components/loader-inline/loader-inline";
import InfoIcon from "@jetbrains/icons/info";
import UpdateIcon from "@jetbrains/icons/update";
import DownloadIcon from "@jetbrains/icons/download";
import { host } from "../global/ytApp";
import type { Settings } from "../../../@types/settings";
import type { FieldInfo, FieldInfoKey } from "../../../@types/field-info";
import { fetchDeps, fetchDepsAndExtend, fetchIssueAndInfo } from "./fetch-deps";
import type { FollowDirection, FollowDirections } from "./fetch-deps";
import type { IssueInfo, IssueLink, Relation, Relations, DirectionType } from "./issue-types";
import exportData from "./export";
import DepGraph from "./dep-graph";
import DepTimeline from "./dep-timeline";
import IssueInfoCard from "./issue-info-card";
import OptionsDropdownMenu from "./options-dropdown-menu";
import FilterDropdownMenu, { createFilterState } from "./filter-dropdown-menu";
import SearchDropdownMenu from "./search-dropdown-menu";
import type { FilterState } from "../../../@types/filter-state";
import VerticalSizeControl from "./vertical-size-control";

interface IssueDepsProps {
  issueId: string;
  settings: Settings;
  followUpstream: boolean;
  followDownstream: boolean;
  setFollowUpstream: (value: boolean) => void;
  setFollowDownstream: (value: boolean) => void;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_NODE_WIDTH = 200;
const DEFAULT_USE_HIERARCHICAL_LAYOUT = false;
const DEFAULT_USE_DEPTH_RENDERING = true;

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
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [relations, setRelations] = useState<Relations>({
    upstream: [],
    downstream: [],
  });
  const [timelineVisible, setTimelineVisible] = useState<boolean>(false);
  const [graphHeight, setGraphHeight] = useState<number>(400);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Array<string> | null>(null);
  const [maxNodeWidth, setMaxNodeWidth] = useState<number>(DEFAULT_MAX_NODE_WIDTH);
  const [maxDepth, setMaxDepth] = useState<number>(DEFAULT_MAX_DEPTH);
  const [useHierarchicalLayout, setUseHierarchicalLayout] = useState<boolean>(
    DEFAULT_USE_HIERARCHICAL_LAYOUT
  );
  const [useDepthRendering, setUseDepthRendering] = useState<boolean>(DEFAULT_USE_DEPTH_RENDERING);
  const [fieldInfo, setFieldInfo] = useState<FieldInfo>({});
  const [issueData, setIssueData] = useState<{ [key: string]: IssueInfo }>({});
  const [filterState, setFilterState] = useState<FilterState>({
    showOrphans: false,
    showWhenLinksUnknown: true,
  });

  const filterRelations = (
    relations: Relations,
    followUp: boolean,
    followDown: boolean
  ): Relations => ({
    upstream: followUp ? relations.upstream : [],
    downstream: followDown ? relations.downstream : [],
  });

  const selectNode = (nodeId: string) => {
    setHighlightedNodes(null);
    setSelectedNode(nodeId);
  };

  const refreshData = async () => {
    setLoading(true);
    console.log(`Fetching deps for ${issueId}...`);
    const { issue: issueInfo, fieldInfo: fieldInfoData } = await fetchIssueAndInfo(
      host,
      issueId,
      settings
    );
    const followDirs: FollowDirections = [];
    if (followUpstream) {
      followDirs.push("upstream");
    }
    if (followDownstream) {
      followDirs.push("downstream");
    }
    const issues = await fetchDeps(host, issueInfo, maxDepth, relations, followDirs, settings);
    setFilterState(createFilterState(fieldInfoData));
    setFieldInfo(fieldInfoData);
    setGraphHeight(calcGraphSizeFromIssues(issues));
    setIssueData(issues);
    // Remove highlight.
    setHighlightedNodes(null);
    // Set selected node to the root issue if none selected already.
    setSelectedNode((oldId) => (oldId === null ? issueInfo.id : oldId));

    setLoading(false);
  };

  const loadIssueDeps = async (issueId: string, direction: FollowDirection | null = null) => {
    console.log(`Fetching deps for ${issueId}...`);
    setLoading(true);
    const followDirs: FollowDirections = [];
    if (direction === "upstream" || followUpstream) {
      followDirs.push("upstream");
    }
    if (direction === "downstream" || followDownstream) {
      followDirs.push("downstream");
    }
    const issues = await fetchDepsAndExtend(
      host,
      issueId,
      issueData,
      maxDepth,
      relations,
      followDirs,
      settings
    );
    setIssueData(issues);
    setLoading(false);
  };

  const isSelectedNodeAnIssue = (nodeId: string | null): boolean => {
    if (nodeId === null) {
      return false;
    }
    return nodeId in issueData;
  };

  const openNode = (nodeId: string) => {
    if (isSelectedNodeAnIssue(nodeId)) {
      open(`/issue/${nodeId}`);
    }
  };

  useEffect(() => {
    if (settings?.maxRecursionDepth != undefined) {
      setMaxDepth(settings.maxRecursionDepth);
    }

    const newRelations = getRelations(settings);
    if (newRelations) {
      setRelations(newRelations);
    }

    if (settings?.useHierarchicalLayout != undefined) {
      setUseHierarchicalLayout(settings.useHierarchicalLayout);
    }
  }, [settings]);

  useEffect(() => {
    refreshData();
  }, [host, issueId, maxDepth, relations]);

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
                        issueData
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
            <OptionsDropdownMenu
              maxDepth={maxDepth}
              maxNodeWidth={maxNodeWidth}
              useHierarchicalLayout={useHierarchicalLayout}
              useDepthRendering={useDepthRendering}
              followUpstream={followUpstream}
              followDownstream={followDownstream}
              setMaxDepth={setMaxDepth}
              setMaxNodeWidth={setMaxNodeWidth}
              setUseHierarchicalLayout={setUseHierarchicalLayout}
              setUseDepthRendering={setUseDepthRendering}
              setFollowUpstream={setFollowUpstream}
              setFollowDownstream={setFollowDownstream}
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
          height={`${graphHeight}px`}
          issues={issueData}
          selectedIssueId={selectedNode}
          highlightedIssueIds={highlightedNodes}
          fieldInfo={fieldInfo}
          filterState={filterState}
          maxNodeWidth={maxNodeWidth}
          useHierarchicalLayout={useHierarchicalLayout}
          useDepthRendering={useDepthRendering}
          setSelectedNode={selectNode}
          onOpenNode={openNode}
        />
      )}
      {selectedNode !== null && isSelectedNodeAnIssue(selectedNode) && (
        <IssueInfoCard issue={issueData[selectedNode]} />
      )}
      <VerticalSizeControl
        minValue={100}
        maxValue={1000}
        value={graphHeight}
        increment={100}
        onChange={setGraphHeight}
      />
    </div>
  );
};

export default IssueDeps;
