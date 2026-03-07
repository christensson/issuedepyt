import ChevronDownIcon from "@jetbrains/icons/chevron-down";
import ChevronUpIcon from "@jetbrains/icons/chevron-up";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Collapse from "@jetbrains/ring-ui-built/components/collapse/collapse";
import CollapseContent from "@jetbrains/ring-ui-built/components/collapse/collapse-content";
import { Col, Grid, Row } from "@jetbrains/ring-ui-built/components/grid/grid";
import Island, { Content, Header } from "@jetbrains/ring-ui-built/components/island/island";
import Link from "@jetbrains/ring-ui-built/components/link/link";
import Tag from "@jetbrains/ring-ui-built/components/tag/tag";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import React, { useState } from "react";
import type { IssueInfo, IssueLink, IssuePeriod } from "./issue-types.ts";

interface IssueInfoCardProps {
  issue: IssueInfo;
}

const IssueInfoCard: React.FunctionComponent<IssueInfoCardProps> = ({ issue }) => {
  const [collapsed, setCollapsed] = useState<boolean>(true);

  const title = issue?.summary ? `${issue.idReadable}: ${issue.summary}` : issue.idReadable;

  console.log(`Showing issue ${issue.id}`);

  const getRelation = (link: IssueLink) =>
    link.direction === "OUTWARD" || link.direction === "BOTH"
      ? link.sourceToTarget
      : link.targetToSource;

  let relationComps = [];
  for (const item of [
    ["Upstream", issue.upstreamLinks],
    ["Downstream", issue.downstreamLinks],
  ]) {
    const direction = item[0] as string;
    const links = item[1] as Array<IssueLink>;
    const relations = links
      .map(getRelation)
      .filter((item, i, ar) => ar.indexOf(item) === i)
      .sort();

    for (let relation of relations) {
      let tags = [];
      for (let link of links) {
        const linkRelation = getRelation(link);
        if (linkRelation === relation) {
          tags.push(
            <Tag readOnly>
              <Link href={`/issue/${link.targetId}`}>{link.targetIdReadable}</Link>
            </Tag>,
          );
        }
      }
      relationComps.push(
        <p>
          <Text size={Text.Size.S} info>{`${relation} (${direction})`}</Text>
          <div children={tags} />
        </p>,
      );
    }
  }
  if (!issue.linksKnown) {
    relationComps.push(
      <p>
        <Text size={Text.Size.S} info>
          Not all relations known.
        </Text>
      </p>,
    );
  }
  const toggleCollapse = () => setCollapsed(!collapsed);

  const collapseControlText = collapsed ? "Expand" : "Collapse";
  const collapseControlIcon = collapsed ? ChevronDownIcon : ChevronUpIcon;

  const fields = [];
  if (issue?.type != undefined) {
    fields.push({ name: "Type", value: issue.type });
  }
  if (issue?.state != undefined) {
    fields.push({ name: "State", value: issue.state });
  }
  if (issue?.assignee != undefined) {
    fields.push({ name: "Assignee", value: issue.assignee });
  }
  if (issue?.sprints && issue.sprints.length > 0) {
    fields.push({ name: "Sprints", value: issue.sprints.map((x) => x.name).join(", ") });
  }
  if (issue?.startDate) {
    fields.push({ name: "Start Date", value: issue.startDate.toDateString() });
  }
  if (issue?.dueDate) {
    fields.push({ name: "Due Date", value: issue.dueDate.toDateString() });
  }
  if (issue?.estimation) {
    fields.push({ name: "Estimation", value: (issue.estimation as IssuePeriod)?.presentation });
  }
  for (const field of issue.extraFields) {
    if (field.value == null) {
      fields.push({ name: field.name, value: <i>No value</i> });
      continue;
    }
    if (Array.isArray(field.value)) {
      if (field.value.length === 0) {
        fields.push({
          name: field.name,
          value: <i>No values</i>,
        });
      } else {
        const formatValue = (x: any) => {
          if (x instanceof Date) {
            return x.toDateString();
          }

          if (x && typeof x === "object" && "name" in x) {
            const name = (x as { name?: unknown }).name;
            if (name != null) {
              return String(name);
            }
          }

          return String(x);
        };
        fields.push({
          name: field.name,
          value: field.value.map((x) => <Tag readOnly>{formatValue(x)}</Tag>),
        });
      }
    } else {
      fields.push({ name: field.name, value: field.value.toString() });
    }
  }

  const fieldComps = fields.map(({ name, value }) => (
    <p>
      <Text size={Text.Size.S} info>
        {name}
      </Text>
      <div>
        <Text size={Text.Size.M}>{value}</Text>
      </div>
    </p>
  ));

  return (
    <Island narrow withoutPaddings>
      <Header wrapWithTitle={false} border>
        <Link href={`/issue/${issue.id}`}>{title}</Link>
        <Button
          aria-label={collapseControlText}
          icon={collapseControlIcon}
          onClick={toggleCollapse}
          style={{ float: "right" }}
        >
          {collapseControlText}
        </Button>
      </Header>
      <Collapse collapsed={collapsed}>
        <CollapseContent>
          <Content>
            <Grid>
              <Row>
                <Col xs={3}>{fieldComps.slice(0, (fieldComps.length + 1) / 2)}</Col>
                <Col xs={3}>{fieldComps.slice((fieldComps.length + 1) / 2)}</Col>
                <Col xs={6}>{relationComps}</Col>
              </Row>
            </Grid>
          </Content>
        </CollapseContent>
      </Collapse>
    </Island>
  );
};

export default IssueInfoCard;
