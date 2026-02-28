import type { HostAPI } from "../../../@types/globals";
import type { Settings } from "../../../@types/settings";
import type { FieldInfo, FieldInfoField } from "../../../@types/field-info";
import type {
  IssueInfo,
  IssueLink,
  Relation,
  Relations,
  CustomField,
  IssuePeriod,
} from "./issue-types.ts";

export type FollowDirection = "upstream" | "downstream";
export type FollowDirections = Array<FollowDirection>;

async function fetchIssueInfo(host: HostAPI, issueID: string): Promise<any> {
  const fields = `
    id,idReadable,summary,resolved,isDraft,
    customFields(
      name,
      value(name,fullName,startDate,releaseDate,presentation,minutes,text),
      projectCustomField(
        name,
        field(fieldType(id)),
        bundle(
          values(
            name,
            archived,
            color(id,background,foreground)
          )
        )
      )
    )`.replace(/\s+/g, "");

  const issue = await host.fetchYouTrack(`issues/${issueID}`, {
    query: {
      fields,
    },
  });

  return issue;
}

async function fetchIssueLinks(host: HostAPI, issueID: string): Promise<any> {
  const linkFields = `
    id,direction,
    linkType(name,sourceToTarget,targetToSource,directed,aggregation),
    issues(
      id,idReadable,summary,resolved,isDraft,
      customFields(
        name,
        value(name,fullName,startDate,releaseDate,presentation,minutes,text),
        projectCustomField(
          name,
          field(fieldType(id))
        )
      )
    )`.replace(/\s+/g, "");

  const issue = await host.fetchYouTrack(`issues/${issueID}/links`, {
    query: {
      fields: linkFields,
    },
  });

  return issue;
}

const getCustomField = (
  name: string | undefined,
  fields: Array<{ name: string; value: any }>
): any => {
  if (name === undefined) {
    return null;
  }
  const field = fields.find((field) => field.name === name);
  return field;
};

const getCustomFieldValue = (
  name: string | undefined,
  fields: Array<{ name: string; value: any }>
): any => {
  const field = getCustomField(name, fields);
  if (!field || field.value == null) {
    return null;
  }
  const type = field.$type;
  const value = field.value;
  if (type === "SimpleIssueCustomField") {
    if (field.projectCustomField.field.fieldType.id === "date and time") {
      return new Date(value);
    } else {
      return value;
    }
  }
  if (type === "DateIssueCustomField") {
    return new Date(value);
  }
  if (type === "TextIssueCustomField") {
    return value.text;
  }
  if (type === "PeriodIssueCustomField") {
    return { presentation: value.presentation, minutes: value.minutes } as IssuePeriod;
  }
  if (
    type === "SingleBuildIssueCustomField" ||
    type === "SingleEnumIssueCustomField" ||
    type === "SingleGroupIssueCustomField" ||
    type === "SingleOwnedIssueCustomField" ||
    type === "StateIssueCustomField" ||
    type === "StateMachineIssueCustomField"
  ) {
    return value.name;
  }
  if (type === "SingleUserIssueCustomField") {
    return value.fullName ?? value.name;
  }
  if (type === "MultiUserIssueCustomField") {
    return value.map((item: any) => item.fullName ?? item.name);
  }
  if (
    type === "MultiEnumIssueCustomField" ||
    type === "MultiGroupIssueCustomField" ||
    type === "MultiOwnedIssueCustomField" ||
    type === "MultiBuildIssueCustomField"
  ) {
    return value.map((item: any) => item.name);
  }
  if (type === "SingleVersionIssueCustomField") {
    return [
      {
        name: value.name,
        startDate: value.startDate != null ? new Date(value.startDate) : null,
        endDate: value.releaseDate != null ? new Date(value.releaseDate) : null,
      },
    ];
  }
  if (type === "MultiVersionIssueCustomField") {
    return value.map((item: any) => ({
      name: item.name,
      startDate: item.startDate != null ? new Date(item.startDate) : null,
      endDate: item.releaseDate != null ? new Date(item.releaseDate) : null,
    }));
  }
  console.log("Warning! Unknown custom field type for field", field);
  return null;
};

const getExtraFields = (
  fieldCsv: string | undefined,
  fields: Array<{ name: string; value: any }>
): Array<CustomField> => {
  const fieldNames = fieldCsv ? fieldCsv.split(",").map((x) => x.trim()) : [];
  const customFields = fieldNames.map((name) => {
    return {
      name,
      value: getCustomFieldValue(name, fields),
    };
  });

  return customFields;
};

const buildIssueInfo = (
  rawIssue: any,
  settings: Settings,
  depth: number,
): IssueInfo => {
  return {
    id: rawIssue.id,
    idReadable: rawIssue.isDraft ? `Draft ${rawIssue.id}` : rawIssue.idReadable,
    isDraft: rawIssue.isDraft,
    summary: rawIssue.summary,
    ...(settings?.typeField && {
      type: getCustomFieldValue(settings.typeField, rawIssue.customFields),
    }),
    ...(settings?.stateField && {
      state: getCustomFieldValue(settings.stateField, rawIssue.customFields),
    }),
    ...(settings?.sprintsField && {
      sprints: getCustomFieldValue(settings.sprintsField, rawIssue.customFields),
    }),
    ...(settings?.assigneeField && {
      assignee: getCustomFieldValue(settings.assigneeField, rawIssue.customFields),
    }),
    startDate: getCustomFieldValue(settings?.startDateField, rawIssue.customFields),
    dueDate: getCustomFieldValue(settings?.dueDateField, rawIssue.customFields),
    estimation: getCustomFieldValue(settings?.estimationField, rawIssue.customFields),
    resolved: rawIssue.resolved,
    depth,
    upstreamLinks: [],
    downstreamLinks: [],
    linksKnown: false,
    showUpstreamNodes: true,
    showDownstreamNodes: false,
    extraFields: getExtraFields(settings?.extraCustomFields, rawIssue.customFields),
  };
};

const normalizeDirection = (value: string | undefined): string => {
  return (value || "").trim().toUpperCase();
};

const normalizeRelationType = (value: string | undefined): string => {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const relationMatches = (
  relationDirection: string,
  relationType: string,
  linkDirection: string,
  linkType: string,
): boolean => {
  return (
    normalizeDirection(relationDirection) === normalizeDirection(linkDirection) &&
    normalizeRelationType(relationType) === normalizeRelationType(linkType)
  );
};

const getRelationKind = (
  relations: Relations,
  linkDirection: string,
  linkType: string,
): FollowDirection | null => {
  const isUpstream = relations.upstream.some((relation) =>
    relationMatches(relation.direction, relation.type, linkDirection, linkType),
  );
  const isDownstream = relations.downstream.some((relation) =>
    relationMatches(relation.direction, relation.type, linkDirection, linkType),
  );

  if (isUpstream && !isDownstream) {
    return "upstream";
  }
  if (isDownstream && !isUpstream) {
    return "downstream";
  }
  return null;
};

async function fetchDepsRecursive(
  host: HostAPI,
  issueID: string,
  depth: number,
  maxDepth: number,
  relations: Relations,
  followDirs: FollowDirections,
  settings: Settings,
  issues: { [key: string]: IssueInfo }
): Promise<any> {
  if (depth > maxDepth) {
    return;
  }

  const links = await fetchIssueLinks(host, issueID);
  const issue = issues[issueID];
  const prevIssueUpstreamLinks = [...issue.upstreamLinks];
  const prevIssueDownstreamLinks = [...issue.downstreamLinks];

  /*
  For a directed relation:

    +--------+                       +--------+
    | source |---------------------->| target |
    +--------+                       +--------+
         <inward name>       <outward name>

  The source ticket relates to the target as: source --"inward name"---> target.
  The target ticket relates to the source as: target --"outward name"--> source.

  Examples:
  Source ---subtask-of--> Target
  Target ---parent-for--> Source

  Source ---depends-on-------> Target
  Target ---is-required-for--> Source

  */
  const followLinks = [...relations.upstream, ...relations.downstream];
  const linksToFollow = links.filter((link: any) => {
    return followLinks.some((relation) =>
      relationMatches(relation.direction, relation.type, link.direction, link.linkType.name),
    );
  });

  const linksFlat = linksToFollow.flatMap((link: any) =>
    link.issues.map((issue: any) => ({
      issue,
      sourceId: issueID,
      direction: link.direction,
      linkType: link.linkType.name,
      targetToSource: link.linkType.targetToSource,
      sourceToTarget: link.linkType.sourceToTarget,
      relation:
        link.direction == "INWARD" ? link.linkType.targetToSource : link.linkType.sourceToTarget,
      depth: depth,
    }))
  );
  for (const link of linksFlat) {
    const relationKind = getRelationKind(relations, link.direction, link.linkType);
    const linksList = relationKind === "upstream" ? issue.upstreamLinks : issue.downstreamLinks;
    const linkExist = linksList.some(
      (x) => link.issue.id === x.targetId && link.direction === x.direction && link.linkType === x.type
    );
    if (linkExist) {
      continue;
    }
    linksList.push({
      targetId: link.issue.id,
      targetIdReadable: link.issue.isDraft ? `Draft ${link.issue.id}` : link.issue.idReadable,
      type: link.linkType,
      direction: link.direction,
      targetToSource: link.targetToSource,
      sourceToTarget: link.sourceToTarget,
    });
  }

  for (const link of linksFlat) {
    const relationKind = getRelationKind(relations, link.direction, link.linkType);

    if (!(link.issue.id in issues)) {
      issues[link.issue.id] = buildIssueInfo(link.issue, settings, link.depth);
    }

    // Invert link and inject that in target issue if not already present.
    const mirroredLink: IssueLink = {
      targetId: issue.id,
      targetIdReadable: issue.idReadable,
      type: link.linkType,
      direction:
        link.direction === "BOTH" ? "BOTH" : link.direction === "INWARD" ? "OUTWARD" : "INWARD",
      targetToSource: link.targetToSource,
      sourceToTarget: link.sourceToTarget,
    };

    const targetIssue = issues[link.issue.id];
    const mirroredLinksList =
      relationKind === "upstream" ? targetIssue.downstreamLinks : targetIssue.upstreamLinks;
    const mirroredLinkExist = mirroredLinksList.some(
      (x) =>
        mirroredLink.targetId === x.targetId &&
        mirroredLink.direction === x.direction &&
        mirroredLink.type === x.type
    );
    if (!mirroredLinkExist) {
      mirroredLinksList.push(mirroredLink);
    }
  }

  issue.linksKnown = true;
  if (followDirs.includes("upstream")) {
    issue.showUpstreamNodes = true;
  }
  if (followDirs.includes("downstream")) {
    issue.showDownstreamNodes = true;
  }

  const isSameLink = (a: IssueLink, b: IssueLink) =>
    a.targetId === b.targetId && a.direction === b.direction && a.type === b.type;
  const idsToFetch: Array<string> = [];
  // downstreamLinks targets are upstream nodes — follow them when going upstream.
  if (followDirs.includes("upstream")) {
    const newLinks = issue.downstreamLinks.filter(
      (link: IssueLink) => !prevIssueDownstreamLinks.some((x) => isSameLink(x, link))
    );
    idsToFetch.push(...newLinks.map((link: IssueLink) => link.targetId));
  }
  // upstreamLinks targets are downstream nodes — follow them when going downstream.
  if (followDirs.includes("downstream")) {
    const newLinks = issue.upstreamLinks.filter(
      (link: IssueLink) => !prevIssueUpstreamLinks.some((x) => isSameLink(x, link))
    );
    idsToFetch.push(...newLinks.map((link: IssueLink) => link.targetId));
  }
  const promises = idsToFetch.map((id: string) =>
    fetchDepsRecursive(host, id, depth + 1, maxDepth, relations, followDirs, settings, issues)
  );
  await Promise.all(promises);
}

export async function fetchIssueAndInfo(
  host: HostAPI,
  issueId: string,
  settings: Settings
): Promise<{ issue: IssueInfo; fieldInfo: FieldInfo }> {
  const issueInfo = await fetchIssueInfo(host, issueId);

  let fieldInfo: FieldInfo = {};
  const stateField = getCustomField(settings?.stateField, issueInfo.customFields);
  const typeField = getCustomField(settings?.typeField, issueInfo.customFields);
  if (stateField != undefined) {
    Object.assign(fieldInfo, {
      stateField: {
        name: stateField.name,
        values: Object.fromEntries(
          stateField.projectCustomField.bundle.values.map((value: any) => [
            value.name,
            {
              archived: value.archived,
              colorId: value.color.id,
              background: value.color.background,
              foreground: value.color.foreground,
            },
          ])
        ),
      },
    });
  }
  if (typeField != undefined) {
    Object.assign(fieldInfo, {
      typeField: {
        name: typeField.name,
        values: Object.fromEntries(
          typeField.projectCustomField.bundle.values.map((value: any) => [
            value.name,
            {
              archived: value.archived,
              colorId: value.color.id,
              background: value.color.background,
              foreground: value.color.foreground,
            },
          ])
        ),
      },
    });
  }

  const issue: IssueInfo = buildIssueInfo(issueInfo, settings, 0);

  return { issue, fieldInfo };
}

export async function fetchDeps(
  host: HostAPI,
  issue: IssueInfo,
  maxDepth: number,
  relations: Relations,
  followDirs: FollowDirections,
  settings: Settings
): Promise<{ [key: string]: IssueInfo }> {
  let issues = {
    [issue.id]: issue,
  };
  await fetchDepsRecursive(host, issue.id, 1, maxDepth, relations, followDirs, settings, issues);

  return issues;
}

export async function fetchDepsAndExtend(
  host: HostAPI,
  issueId: string,
  issues: { [key: string]: IssueInfo },
  maxDepth: number,
  relations: Relations,
  followDirs: FollowDirections,
  settings: Settings
): Promise<{ [key: string]: IssueInfo }> {
  if (!(issueId in issues)) {
    console.log(`Failed to fetch issues for ${issueId}: issue unknown`);
    return issues;
  }

  const issue = issues[issueId];

  const newIssues = Object.assign({}, issues);
  const depsDepth = issue.depth + 1;
  const newMaxDepth = Math.max(maxDepth, depsDepth);
  await fetchDepsRecursive(
    host,
    issueId,
    issue.depth + 1,
    newMaxDepth,
    relations,
    followDirs,
    settings,
    newIssues
  );

  return newIssues;
}
