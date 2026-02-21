import React, { memo, useMemo, useState, useEffect } from "react";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Grid, Row, Col } from "@jetbrains/ring-ui-built/components/grid/grid";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import { host } from "../global/ytApp";
import type { Settings } from "../../../@types/settings";
import IssueDeps from "../depgraph/issue-deps";
import Link from "@jetbrains/ring-ui-built/components/link/link";
import OpenIssueDialog from "./open-issue-dialog";

const entity = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [issueId, setIssueId] = useState<string | null>(
    entity?.type === "issue" ? entity.id : null,
  );
  const [settings, setSettings] = useState<Settings>({});
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [followUpstream, setFollowUpstream] = useState<boolean>(true);
  const [followDownstream, setFollowDownstream] = useState<boolean>(false);
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
      .fetchApp<{ issueId: string; settings: Settings }>("global-backend/context", { scope: false })
      .then((resp) => {
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
            followUpstream={followUpstream}
            followDownstream={followDownstream}
            setFollowUpstream={setFollowUpstream}
            setFollowDownstream={setFollowDownstream}
            isSinglePageApp={true}
          />
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
