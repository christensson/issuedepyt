import { IssueInfo, IssueLink, IssuePeriod } from "./issue-types.ts";
import { FilterState } from "../../../@types/filter-state";
import { calcBusinessDays } from "./time-utils.ts";


export const filterIssues = (filter: FilterState, issues: Record<string, IssueInfo>) => {
  const filteredIssues = Object.fromEntries(
    Object.entries(issues).filter(([key, issue]) => {
      const state = filter?.state || {};
      const type = filter?.type || {};
      const stateValue = issue?.state;
      const typeValue = issue?.type;
      return (
        (stateValue == undefined || state[stateValue]) &&
        (typeValue == undefined || type[typeValue]) &&
        (filter.showWhenLinksUnknown || issue.linksKnown)
      );
    })
  );

  // If we're showing orphans, we're done.
  if (filter.showOrphans) {
    return filteredIssues;
  }

  // Remove orphan issues by first finding all relations and then only keeping
  // issues that have both ends of the relations visible.
  const relations = Object.entries(filteredIssues)
    .map(([key, issue]) => issue)
    .flatMap((issue: IssueInfo) =>
      [
        ...(issue.showDownstream
          ? issue.upstreamLinks
          : issue.upstreamLinks.filter((link: IssueLink) => link.direction === "BOTH")),
        ...(issue.showUpstream
          ? issue.downstreamLinks
          : issue.downstreamLinks.filter((link: IssueLink) => link.direction === "BOTH")),
      ].map((link: IssueLink) => ({
        from: issue.id,
        to: link.targetId,
      }))
    )
    // Make sure that the target is visible.
    .filter((x) => x.to in filteredIssues);

  return Object.fromEntries(
    // Only show issues that's shown in the dependency graph,
    // i.e. that they have a visible relation.
    Object.entries(filteredIssues).filter(
      ([key, issue]) =>
        issue.depth === 0 || relations.some((x) => x.from === issue.id || x.to === issue.id)
    )
  );
};

export const estimationToDays = (estimation: IssuePeriod): number => {
  const WORK_HOURS_PER_DAY = 8;
  if (estimation?.minutes) {
    const days = estimation.minutes / (60 * WORK_HOURS_PER_DAY);
    return days;
  }
  return 0;
};

export const getIssueStartEnd = (issue: IssueInfo): { start: Date | null; end: Date | null } => {
  const period: {
    start: Date | null;
    end: Date | null;
  } = { start: null, end: null };

  if (issue?.sprints && issue.sprints.length > 0) {
    const startDates = issue.sprints.map((x) => x.startDate).filter((x) => x != null);
    const endDates = issue.sprints.map((x) => x.endDate).filter((x) => x != null);
    if (startDates.length > 0) {
      period.start = startDates.reduce((a, b) => (a < b ? a : b)) as Date;
    }
    if (endDates.length > 0) {
      period.end = endDates.reduce((a, b) => (a > b ? a : b)) as Date;
    }
  }
  if (issue?.startDate) {
    period.start = issue.startDate;
  }
  if (issue?.dueDate) {
    period.end = issue.dueDate;
  }
  return period;
};

export const getIssueWork = (
  issue: IssueInfo
): { estimatedDays?: number; scheduledDays?: number; workFactor?: number } => {
  let workInfo = {};
  const estimatedDays = estimationToDays(issue.estimation as IssuePeriod);
  if (estimatedDays !== 0) {
    workInfo = { estimatedDays, ...workInfo };
  }
  const { start, end } = getIssueStartEnd(issue);
  const scheduledDays = start && end ? calcBusinessDays(start, end) : null;
  if (scheduledDays) {
    workInfo = { scheduledDays, ...workInfo };
  } else {
    // Done, since workFactor can't be calculated if we don't know the scheduled days.
    return workInfo;
  }
  const workFactor = estimatedDays / scheduledDays;
  return { workFactor, ...workInfo };
};
