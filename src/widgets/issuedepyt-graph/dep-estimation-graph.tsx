import React, { useEffect, useRef } from "react";
import { DataSet } from "vis-data/peer/esm/vis-data";
import { Graph2d } from "vis-timeline";
import type {
  DateType,
  IdType,
  Graph2d as VisGraph2d,
  TimelineItem,
  TimelineItemType,
  Graph2dOptions,
} from "vis-timeline/types";
import type { IssueInfo, IssueLink, IssuePeriod } from "./issue-types";
import type { FieldInfo, FieldInfoField } from "../../../@types/field-info";
import { durationToDays, isPastDate, getDuration } from "./time-utils";
import { getIssueWork } from "./issue-helpers";
import { ColorPaletteItem } from "./colors";

const useBarChart = true;

interface Graph2dItemLabel {
  content: string;
  xOffset?: number;
  yOffset?: number;
  className?: string;
}

interface Graph2dItem {
  id: IdType;
  x: Date;
  y: number | string;
  group?: IdType;
  end?: Date;
  label?: Graph2dItemLabel;
}

interface Graph2dGroup {
  id: IdType;
  content: string;
  className?: string;
  style?: any;
  visible?: boolean;
  options?: any;
}

interface DepEstimationGraphProps {
  issues: { [id: string]: IssueInfo };
  selectedIssueId: string | null;
  fieldInfo: FieldInfo;
  maxNodeWidth: number | undefined;
  setSelectedNode: (nodeId: string) => void;
  onOpenNode: (nodeId: string) => void;
}

const FONT_FAMILY = "system-ui, Arial, sans-serif";
const FONT_FAMILY_MONOSPACE =
  'Menlo, "Bitstream Vera Sans Mono", "Ubuntu Mono", Consolas, "Courier New", Courier, monospace';

const DepEstimationGraph: React.FunctionComponent<DepEstimationGraphProps> = ({
  issues,
  selectedIssueId,
  fieldInfo,
  maxNodeWidth,
  setSelectedNode,
  onOpenNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<VisGraph2d>(null);
  const items = useRef<DataSet<Graph2dItem>>(new DataSet());
  const groups = useRef<DataSet<Graph2dGroup>>(new DataSet());

  useEffect(() => {
    if (containerRef.current && items.current && groups.current) {
      const options: Graph2dOptions = {
        width: "100%",
        style: useBarChart ? "bar" : "line",
        barChart: { sideBySide: true, align: "center" },
        stack: useBarChart,
        drawPoints: {
          // @ts-ignore
          onRender: (item, group, graph2d) => {
            return item?.label != null;
          },
          style: "circle",
        },
        orientation: "bottom",
        autoResize: true,
        legend: {
          enabled: true,
        },
        dataAxis: {
          left: {
            title: {
              text: "Work factor",
              style: `font-family: ${FONT_FAMILY};`,
            },
            // @ts-ignore
            range: { min: 0 },
          },
        },
      };
      // @ts-ignore
      timeline.current = new Graph2d(containerRef.current, items.current, groups.current, options);
      timeline.current.on("select", (props) => {
        console.log("Selected", props);
        const selectedItems = props.items;
        if (selectedItems != undefined && selectedItems.length > 0) {
          setSelectedNode(selectedItems[0]);
        }
      });
      timeline.current.on("click", (props) => {
        console.log("Click", props);
      });
      timeline.current.on("doubleClick", (props) => {
        const clickedItem = props?.item;
        if (clickedItem != undefined) {
          onOpenNode(clickedItem);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (timeline.current && items.current && groups.current) {
      console.log(`Rendering estimation graph with ${Object.keys(issues).length} nodes`);
      const relations = Object.values(issues).flatMap((issue: IssueInfo) =>
        [
          ...(issue.showUpstream ? issue.upstreamLinks : []),
          ...(issue.showDownstream ? issue.downstreamLinks : []),
        ].map((link: IssueLink) => ({
          from: issue.id,
          to: link.targetId,
        }))
      );

      const datedIssues = Object.values(issues).filter((x) => x?.startDate || x?.dueDate);
      const firstStartDate = datedIssues.reduce(
        (acc, x) => (x.startDate && x.startDate < acc ? x.startDate : acc),
        new Date()
      );
      const firstDueDate = datedIssues.reduce(
        (acc, x) => (x.dueDate && x.dueDate < acc ? x.dueDate : acc),
        new Date()
      );
      const lastStartDate = datedIssues.reduce(
        (acc, x) => (x.startDate && x.startDate > acc ? x.startDate : acc),
        new Date()
      );
      const lastDueDate = datedIssues.reduce(
        (acc, x) => (x.dueDate && x.dueDate > acc ? x.dueDate : acc),
        new Date()
      );
      timeline.current.setOptions({
        start: firstStartDate < firstDueDate ? firstStartDate : firstDueDate,
        end: lastDueDate > lastStartDate ? lastDueDate : lastStartDate,
      });

      const visibleIssues = Object.values(issues)
        // Only show issues with an estimation, a start and an end where start is before end.
        .filter(
          (x) =>
            x?.estimation &&
            x?.startDate &&
            x?.dueDate &&
            x.startDate.getTime() <= x.dueDate.getTime()
        )
        // Only show issues that's shown in the dependency graph, i.e. that they have a visible relation.
        .filter(
          (issue: IssueInfo) =>
            issue.depth === 0 || relations.some((x) => x.from === issue.id || x.to === issue.id)
        );
      const stateColors = fieldInfo?.stateField ? fieldInfo.stateField.values : {};
      const stateStyles = Object.fromEntries(
        Object.entries(stateColors).map(([k, v]) => [
          k,
          `color: ${v.foreground}; background-color: ${v.background}`,
        ])
      );
      console.log(`${visibleIssues.length} issues visible in estimation graph`);
      const timelineItems: Array<Graph2dItem> = visibleIssues.flatMap((issue) => {
        const { workFactor } = getIssueWork(issue) || {
          workFactor: null,
        };
        if (workFactor == null) {
          return [];
        }
        const startDate = issue.startDate as Date;
        const dueDate = issue.dueDate as Date;
        // Since start and end dates are inclusive, we need to add one day.
        const numDaysInPeriod = durationToDays(getDuration(startDate, dueDate)) + 1;

        const dates: Array<Date> = [];
        for (let i = 0; i < numDaysInPeriod; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          dates.push(date);
        }
        const labelObj = {
          content: `${issue.idReadable} (${workFactor.toFixed(2)})`,
          yOffset: 16,
          className: "dep-est-graph-group-label",
        };
        const items: Array<Graph2dItem> = dates.map((date, idx) => ({
          id: `${issue.id}-${idx}`,
          group: issue.id,
          label: idx === 0 ? labelObj : undefined,
          x: date,
          y: workFactor,
        }));
        return items;
      });
      const totals = timelineItems.reduce((acc: { [key: string]: number }, x: Graph2dItem) => {
        const key = x.x.toISOString();
        if (acc[key] == undefined) {
          acc[key] = 0;
        }
        acc[key] += x.y as number;
        return acc;
      }, {});
      const totalsItemsAsc = Object.entries(totals)
        .map(([dateKey, work]) => ({
          date: new Date(dateKey),
          work,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      timelineItems.push(
        ...totalsItemsAsc.map(({ date, work }, idx) => ({
          id: `total-${idx}`,
          group: "totals",
          label:
            idx > 0 && totalsItemsAsc[idx - 1].work < totalsItemsAsc[idx].work
              ? { content: `${work.toFixed(2)}`, className: "dep-est-graph-group-label" }
              : undefined,
          x: date,
          y: work,
        }))
      );
      {
        const currentIds = items.current.getIds();
        const idsToRemove = currentIds.filter((id) => !timelineItems.some((x) => x.id === id));
        const itemsToAdd = timelineItems.filter((x) => !currentIds.includes(x.id));
        const itemsToUpdate = timelineItems
          .filter((x) => currentIds.includes(x.id))
          .filter((x) => {
            const currentItem = items.current.get(x.id);
            return (
              currentItem != undefined &&
              (currentItem.x !== x.x || currentItem.y !== x.y || currentItem.end !== x.end)
            );
          });
        items.current.remove(idsToRemove);
        items.current.add(itemsToAdd);
        items.current.updateOnly(itemsToUpdate);
        // @ts-ignore
        timeline.current.setItems(items.current);
      }

      const numGroupStyles = 8;
      const timelineGroups: Array<Graph2dGroup> = visibleIssues.map((issue, idx) => {
        const { workFactor } = getIssueWork(issue) || {
          workFactor: 0,
        };
        return {
          id: issue.id,
          content: `${issue.idReadable}: ${issue.summary} (${workFactor.toFixed(2)})`,
          className: `dep-est-graph-group-${idx % numGroupStyles}`,
        };
      });
      timelineGroups.push({
        id: "totals",
        content: "Totals",
        className: "dep-est-graph-group-totals",
        options: {
          style: "line",
          excludeFromStacking: true,
        },
      });
      {
        const currentIds = groups.current.getIds();
        const idsToRemove = currentIds.filter((id) => !timelineGroups.some((x) => x.id === id));
        const itemsToAdd = timelineGroups.filter((x) => !currentIds.includes(x.id));
        const itemsToUpdate = timelineGroups
          .filter((x) => currentIds.includes(x.id))
          .filter((x) => {
            const currentItem = groups.current.get(x.id);
            return (
              currentItem != undefined &&
              (currentItem.id !== x.id || currentItem.content !== x.content)
            );
          });
        groups.current.remove(idsToRemove);
        groups.current.add(itemsToAdd);
        groups.current.updateOnly(itemsToUpdate);
        // @ts-ignore
        timeline.current.setGroups(groups.current);
      }
      //timeline.current.fit();
    }
  }, [issues]);

  useEffect(() => {
    if (timeline.current) {
      if (selectedIssueId) {
        console.log(`Estimation graph: Selecting issue ${selectedIssueId}`);
        // timeline.current.setSelection(selectedIssueId);
      } else {
        // timeline.current.setSelection([]);
      }
    }
  }, [selectedIssueId]);

  return <div ref={containerRef} className="dep-estimation-graph" />;
};

export default DepEstimationGraph;
