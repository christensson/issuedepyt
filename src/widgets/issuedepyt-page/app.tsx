import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Col, Grid, Row } from "@jetbrains/ring-ui-built/components/grid/grid";
import Link from "@jetbrains/ring-ui-built/components/link/link";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import React, { memo, useEffect, useMemo, useState } from "react";
import type { FollowSettings } from "../../../@types/follow-settings";
import { GraphContext } from "../../../@types/graph-context";
import type { Settings } from "../../../@types/settings";
import IssueDeps from "../depgraph/issue-deps";
import { host } from "../global/ytApp";
import OpenIssueDialog from "./open-issue-dialog";

const entity = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [issueId, setIssueId] = useState<string | null>(
    entity?.type === "issue" ? entity.id : null,
  );
  const [settings, setSettings] = useState<Settings>({});
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [followSettings, setFollowSettings] = useState<FollowSettings>({
    followUpstream: true,
    followDownstream: false,
  });
  const [openIssueVisible, setOpenIssueVisible] = useState<boolean>(false);

  useEffect(() => {
    window.onresize = () => {
      document.documentElement.style.setProperty(
        "--window-height",
        window.outerHeight.toString() + "px",
      );
    };
  }, []);

  useEffect(() => {
    console.log("Fetching context...");
    if (entity?.type === "issue") {
      host.fetchApp<{ settings: Settings }>("backend/settings", { scope: true }).then((resp) => {
        const newSettings = resp.settings;
        console.log("Got settings", newSettings);
        setSettings(newSettings);
        setIssueId(entity.id);
        setGraphVisible(true);
      });
      return;
    }

    // Not opened on an issue, fetch context to find the issue ID.
    host
      .fetchApp<{
        issueId: string;
        settings: Settings;
        graphContext: GraphContext;
      }>("global-backend/context", { scope: false })
      .then((resp) => {
        const graphContext = resp.graphContext;
        console.log("Got graph context", graphContext);
        if (graphContext?.followSettings) {
          setFollowSettings(graphContext.followSettings);
        }
        const newSettings = resp.settings;
        console.log("Got settings", newSettings);
        setSettings(newSettings);
        console.log("Context issue ID: ", resp.issueId);
        if (resp.issueId) {
          setIssueId(resp.issueId);
          setGraphVisible(true);
        }
      });
  }, [host]);

  return (
    <div className="full-page-widget">
      {openIssueVisible && (
        <OpenIssueDialog
          onClose={() => setOpenIssueVisible(false)}
          onSelect={(selectedIssueId) => {
            setIssueId(selectedIssueId);
            setOpenIssueVisible(false);
            setGraphVisible(true);
          }}
        />
      )}
      {(!graphVisible || !issueId) && (
        <div>
          <Text size={Text.Size.M}>
            No issue in context, open issue dependencies from an issue to get the context.
          </Text>
        </div>
      )}
      {graphVisible && issueId && (
        <div>
          <div className="dep-page-header">
            <Text size={Text.Size.M}>
              <Link href={`/issue/${issueId}`}>{issueId}</Link> dependencies
            </Text>
            <span className="dep-page-header-right">
              <Button onClick={() => setOpenIssueVisible(true)}>Open other issue</Button>
            </span>
          </div>
          <IssueDeps
            issueId={issueId}
            settings={settings}
            followSettings={followSettings}
            setFollowSettings={setFollowSettings}
            isSinglePageApp={true}
          />
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
