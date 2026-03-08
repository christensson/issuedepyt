import Alert from "@jetbrains/ring-ui-built/components/alert/alert";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Link from "@jetbrains/ring-ui-built/components/link/link";
import Text from "@jetbrains/ring-ui-built/components/text/text";
import React, { memo, useEffect, useMemo, useState } from "react";
import {
  defaultGraphLoadSettings,
  GraphContext,
  type GraphLoadSettings,
} from "../../../@types/graph-context";
import { defaultGraphViewSettings, GraphViewSettings } from "../../../@types/graph-view-settings";
import { NoteProps } from "../../../@types/note";
import type { Settings } from "../../../@types/settings";
import IssueDeps from "../depgraph/issue-deps";
import { host } from "../global/ytApp";
import OpenIssueDialog from "./open-issue-dialog";

const entity = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [issueId, setIssueId] = useState<string | null>(
    entity?.type === "issue" ? entity.id : null,
  );
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [openIssueVisible, setOpenIssueVisible] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings>({});
  const [graphHeight, setGraphHeight] = useState<number>(800);
  const [graphLoadSettings, setGraphLoadSettings] =
    useState<GraphLoadSettings>(defaultGraphLoadSettings);
  const [graphViewSettings, setGraphViewSettings] =
    useState<GraphViewSettings>(defaultGraphViewSettings);
  const [note, setNote] = useState<NoteProps | null>(null);

  useEffect(() => {
    window.onresize = () => {
      const ESTIMATED_WINDOW_OVERHEAD = 320;
      const newHeight = window.outerHeight - ESTIMATED_WINDOW_OVERHEAD;
      setGraphHeight(newHeight);
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
          setGraphLoadSettings((prev) => ({
            ...prev,
            followSettings: {
              ...prev.followSettings,
              ...graphContext.followSettings,
            },
          }));
        }
        if (graphContext?.layoutOptions || graphContext?.nodeLabelOptions) {
          setGraphViewSettings((prev) => ({
            ...prev,
            layoutOptions: {
              ...prev.layoutOptions,
              ...graphContext?.layoutOptions,
            },
            nodeLabelOptions: {
              ...prev.nodeLabelOptions,
              ...graphContext?.nodeLabelOptions,
            },
          }));
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
      {note !== null && (
        <Alert
          className="alert-note"
          type={note.type}
          timeout={note?.timeout}
          onCloseRequest={() => setNote(null)}
        >
          {note.message}
        </Alert>
      )}
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
            graphLoadSettings={graphLoadSettings}
            setGraphLoadSettings={setGraphLoadSettings}
            graphViewSettings={graphViewSettings}
            setGraphViewSettings={setGraphViewSettings}
            setNote={setNote}
            isSinglePageApp={true}
            graphHeight={graphHeight}
            setGraphHeight={setGraphHeight}
          />
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
