import type { IssueInfo, IssueLink } from "./issue-types";

const downloadFile = (filename: string, mimeType: string, content: any): void => {
  // Create a blob and download it.
  const blob = new Blob([content], { type: mimeType });
  const fileURL = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = fileURL;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  // Free up resources.
  URL.revokeObjectURL(fileURL);
};

const exportData = (issueIdReadable: string, issues: { [key: string]: IssueInfo }): void => {
  const rootIssue = Object.values(issues).find((x) =>
    x.isDraft ? x.id === issueIdReadable : x.idReadable === issueIdReadable,
  );
  if (!rootIssue) {
    console.log(`Failed to export ${issueIdReadable}: Cannot find fetched data`, issues);
    return;
  }
  const issueId = rootIssue.id;
  const cols = ["id", "type", "state", "summary", "assignee", "startDate", "dueDate"];
  const extraFieldNames = rootIssue.extraFields.map((field) => field.name);
  cols.push(...extraFieldNames);
  cols.push("resolved", "depth", "relTargetId", "relType", "relName", "relDirectionType");
  const toBooleanCol = (value: boolean | undefined): string => {
    if (value == undefined) {
      return "";
    }
    return value.toString();
  };
  const toTextCol = (value: string | undefined): string => {
    if (value == undefined) {
      return "";
    }
    return `"${value}"`;
  };
  const toDateCol = (value: Date | undefined | null): string => {
    if (value == undefined) {
      return "";
    }
    return value.toISOString().split("T")[0];
  };

  const createIssueRows = (issue: IssueInfo): string[] => {
    const rows = [];
    const issueCols = (issue: IssueInfo, link: IssueLink, direction: string): string => {
      const row: Array<string | number> = [
        issue.idReadable,
        toTextCol(issue?.type),
        toTextCol(issue?.state),
        toTextCol(issue?.summary),
        toTextCol(issue?.assignee),
        toDateCol(issue?.startDate),
        toDateCol(issue?.dueDate),
      ];
      row.push(
        ...extraFieldNames.map((fieldName) =>
          toTextCol(issue.extraFields.find((field) => field.name === fieldName)?.value),
        ),
      );
      row.push(
        toBooleanCol(!!issue.resolved),
        issue.depth,
        toTextCol(link.targetIdReadable),
        toTextCol(link.type),
        toTextCol(link.direction === "INWARD" ? link.targetToSource : link.sourceToTarget),
        toTextCol(direction),
      );
      return row.join(",");
    };
    if (issue.linksKnown) {
      rows.push(
        ...issue.upstreamLinks.map((link: IssueLink) => issueCols(issue, link, "upstream")),
      );
      rows.push(
        ...issue.downstreamLinks.map((link: IssueLink) => issueCols(issue, link, "downstream")),
      );
    } else {
      rows.push(
        issueCols(
          issue,
          // Empty link.
          {
            targetId: "",
            targetIdReadable: "",
            type: "",
            direction: "INWARD",
            targetToSource: "",
            sourceToTarget: "",
            aggregation: false,
          },
          "",
        ),
      );
    }
    return rows;
  };
  // Sort in depth order.
  const sortedIssues = Object.values(issues).sort(
    (a: IssueInfo, b: IssueInfo) => a.depth - b.depth,
  );
  const rows = [cols.join(",")];
  rows.push(...sortedIssues.flatMap(createIssueRows));

  downloadFile(
    `${issueIdReadable.toLowerCase().replace("-", "")}_export.csv`,
    "text/csv",
    rows.join("\n"),
  );
};

export default exportData;
