import Alert from "@jetbrains/ring-ui-built/components/alert/alert";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Col, Grid, Row } from "@jetbrains/ring-ui-built/components/grid/grid";
import Toggle, { Size as ToggleSize } from "@jetbrains/ring-ui-built/components/toggle/toggle";
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
import { openGraphPage } from "../issuedepyt-page/open-page";

const issue = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [graphLoadSettings, setGraphLoadSettings] =
    useState<GraphLoadSettings>(defaultGraphLoadSettings);
  const [graphViewSettings, setGraphViewSettings] =
    useState<GraphViewSettings>(defaultGraphViewSettings);
  const [note, setNote] = useState<NoteProps | null>(null);

  useMemo(() => {
    if (!graphVisible && settings?.autoLoadDeps) {
      console.log("Auto loading deps: Showing graph.");
      setGraphVisible(true);
    }
  }, [graphVisible, settings]);

  useEffect(() => {
    host.fetchApp<{ settings: Settings }>("backend/settings", { scope: true }).then((resp) => {
      const newSettings = resp.settings;
      console.log("Got settings", newSettings);
      setSettings(newSettings);
    });
    host
      .fetchApp<{
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
      });
  }, [host]);

  return (
    <div className="widget">
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
      {!graphVisible && settings && (
        <div>
          <Grid>
            <Row start={"xs"} middle={"xs"}>
              <Col>
                <Button onClick={() => setGraphVisible((value) => !value)}>Load graph...</Button>
              </Col>
              <Col>
                <Grid>
                  <Row start={"xs"} middle={"xs"}>
                    <Toggle
                      size={ToggleSize.Size14}
                      checked={graphLoadSettings.followSettings?.followUpstream}
                      onChange={(e: any) =>
                        setGraphLoadSettings((prev) => ({
                          ...prev,
                          followSettings: {
                            ...prev.followSettings,
                            followUpstream: e.target.checked,
                          },
                        }))
                      }
                    >
                      Follow upstream (find issues that this issue depends on).
                    </Toggle>
                  </Row>
                  <Row start={"xs"} middle={"xs"}>
                    <Toggle
                      size={ToggleSize.Size14}
                      checked={graphLoadSettings.followSettings?.followDownstream}
                      onChange={(e: any) =>
                        setGraphLoadSettings((prev) => ({
                          ...prev,
                          followSettings: {
                            ...prev.followSettings,
                            followDownstream: e.target.checked,
                          },
                        }))
                      }
                    >
                      Follow downstream (find issues that depends on this issue).
                    </Toggle>
                  </Row>
                </Grid>
              </Col>
            </Row>
            <Row start={"xs"} middle={"xs"}>
              <Col>
                <Button
                  inline
                  onClick={() => openGraphPage(issue.id, graphLoadSettings, graphViewSettings)}
                >
                  Open graph in full-screen page...
                </Button>
              </Col>
            </Row>
          </Grid>
        </div>
      )}
      {graphVisible && (
        <IssueDeps
          issueId={issue.id}
          settings={settings}
          graphLoadSettings={graphLoadSettings}
          setGraphLoadSettings={setGraphLoadSettings}
          graphViewSettings={graphViewSettings}
          setGraphViewSettings={setGraphViewSettings}
          setNote={setNote}
          useDynamicGraphHeight={true}
        />
      )}
    </div>
  );
};

export const App = memo(AppComponent);
