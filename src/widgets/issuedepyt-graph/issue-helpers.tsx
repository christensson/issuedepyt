import { IssueInfo, IssueLink, IssuePeriod } from "./issue-types";
import { FilterState } from "../../../@types/filter-state";
import { calcBusinessDays } from "./time-utils";

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

  // Remove orhan issues by first finding all relations and then only keeping
  // issues that has both ends of the relations visible.
  const relations = Object.entries(filteredIssues)
    .map(([key, issue]) => issue)
    .flatMap((issue: IssueInfo) =>
      [
        ...(issue.showUpstream ? issue.upstreamLinks : []),
        ...(issue.showDownstream ? issue.downstreamLinks : []),
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

export const getIssueWork = (
  issue: IssueInfo
): { estimatedDays: number; scheduledDays: number; workFactor: number } | null => {
  const estimatedDays = estimationToDays(issue.estimation as IssuePeriod);
  if (estimatedDays === 0) {
    return null;
  }
  const startDate = issue.startDate as Date;
  const dueDate = issue.dueDate as Date;
  const scheduledDays = calcBusinessDays(startDate, dueDate);
  if (scheduledDays === 0) {
    return null;
  }
  const workFactor = estimatedDays / scheduledDays;
  return { estimatedDays, scheduledDays, workFactor };
};
