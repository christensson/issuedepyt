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
  if (depth == maxDepth + 1) {
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
    return followLinks.some(
      (relation) =>
        link.direction === relation.direction &&
        link.linkType.name.toLowerCase() === relation.type.toLowerCase()
    );
  });

  const linksFlat = linksToFollow.flatMap((link: any) =>
    link.issues.map((issue: any) => ({
      id: issue.id,
      idReadable: issue.isDraft ? `Draft ${issue.id}` : issue.idReadable,
      isDraft: issue.isDraft,
      sourceId: issueID,
      summary: issue.summary,
      ...(settings?.typeField && {
        type: getCustomFieldValue(settings.typeField, issue.customFields),
      }),
      ...(settings?.stateField && {
        state: getCustomFieldValue(settings.stateField, issue.customFields),
      }),
      ...(settings?.sprintsField && {
        sprints: getCustomFieldValue(settings.sprintsField, issue.customFields),
      }),
      ...(settings?.assigneeField && {
        assignee: getCustomFieldValue(settings.assigneeField, issue.customFields),
      }),
      startDate: getCustomFieldValue(settings?.startDateField, issue.customFields),
      dueDate: getCustomFieldValue(settings?.dueDateField, issue.customFields),
      estimation: getCustomFieldValue(settings?.estimationField, issue.customFields),
      resolved: issue.resolved,
      direction: link.direction,
      linkType: link.linkType.name,
      aggregation: !!link.linkType.aggregation,
      targetToSource: link.linkType.targetToSource,
      sourceToTarget: link.linkType.sourceToTarget,
      relation:
        link.direction == "INWARD" ? link.linkType.targetToSource : link.linkType.sourceToTarget,
      depth: depth,
      extraFields: getExtraFields(settings?.extraCustomFields, issue.customFields),
    }))
  );
  for (const link of linksFlat) {
    const isUpstream = relations.upstream.some(
      (relation) =>
        link.direction === relation.direction &&
        link.linkType.toLowerCase() === relation.type.toLowerCase()
    );
    const linksList = isUpstream ? issue.upstreamLinks : issue.downstreamLinks;
    const linkExist = linksList.some(
      (x) => link.id === x.targetId && link.direction === x.direction && link.linkType === x.type
    );
    if (linkExist) {
      continue;
    }
    linksList.push({
      targetId: link.id,
      targetIdReadable: link.idReadable,
      type: link.linkType,
      direction: link.direction,
      targetToSource: link.targetToSource,
      sourceToTarget: link.sourceToTarget,
      aggregation: link.aggregation,
    });
  }

  for (const link of linksFlat) {
    const isUpstream = relations.upstream.some(
      (relation) =>
        link.direction === relation.direction &&
        link.linkType.toLowerCase() === relation.type.toLowerCase()
    );

    if (!(link.id in issues)) {
      issues[link.id] = {
        id: link.id,
        idReadable: link.isDraft ? `Draft ${link.id}` : link.idReadable,
        isDraft: link.isDraft,
        summary: link.summary,
        type: link.type,
        state: link.state,
        sprints: link.sprints,
        assignee: link.assignee,
        startDate: link.startDate,
        dueDate: link.dueDate,
        estimation: link.estimation,
        resolved: link.resolved,
        depth: link.depth,
        upstreamLinks: [],
        downstreamLinks: [],
        linksKnown: false,
        showUpstream: true,
        showDownstream: false,
        extraFields: link.extraFields,
      };
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
      aggregation: link.aggregation,
    };

    const targetIssue = issues[link.id];
    const mirroredLinksList = isUpstream ? targetIssue.downstreamLinks : targetIssue.upstreamLinks;
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
    issue.showUpstream = true;
  }
  if (followDirs.includes("downstream")) {
    issue.showDownstream = true;
  }

  const isSameLink = (a: IssueLink, b: IssueLink) =>
    a.targetId === b.targetId && a.direction === b.direction && a.type === b.type;
  const idsToFetch: Array<string> = [];
  if (followDirs.includes("upstream")) {
    const newLinks = issue.upstreamLinks.filter(
      (link: IssueLink) => !prevIssueUpstreamLinks.some((x) => isSameLink(x, link))
    );
    idsToFetch.push(...newLinks.map((link: IssueLink) => link.targetId));
  }
  if (followDirs.includes("downstream")) {
    const newLinks = issue.downstreamLinks.filter(
      (link: IssueLink) => !prevIssueDownstreamLinks.some((x) => isSameLink(x, link))
    );
    idsToFetch.push(...newLinks.map((link: IssueLink) => link.targetId));
  }
  const promises = idsToFetch.map((id: string) =>
    fetchDepsRecursive(host, id, depth + 1, maxDepth, relations, followDirs, settings, issues)
  );
  await Promise.all(promises);
  return;
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

  const issue: IssueInfo = {
    id: issueInfo.id,
    idReadable: issueInfo.isDraft ? `Draft ${issueInfo.id}` : issueInfo.idReadable,
    isDraft: issueInfo.isDraft,
    summary: issueInfo.summary,
    ...(settings?.typeField && {
      type: getCustomFieldValue(settings.typeField, issueInfo.customFields),
    }),
    ...(settings?.stateField && {
      state: getCustomFieldValue(settings.stateField, issueInfo.customFields),
    }),
    ...(settings?.sprintsField && {
      sprints: getCustomFieldValue(settings.sprintsField, issueInfo.customFields),
    }),
    ...(settings?.assigneeField && {
      assignee: getCustomFieldValue(settings.assigneeField, issueInfo.customFields),
    }),
    startDate: getCustomFieldValue(settings?.startDateField, issueInfo.customFields),
    dueDate: getCustomFieldValue(settings?.dueDateField, issueInfo.customFields),
    estimation: getCustomFieldValue(settings?.estimationField, issueInfo.customFields),
    resolved: issueInfo.resolved,
    depth: 0,
    upstreamLinks: [],
    downstreamLinks: [],
    linksKnown: false,
    showDownstream: false,
    showUpstream: true,
    extraFields: getExtraFields(settings?.extraCustomFields, issueInfo.customFields),
  };

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
