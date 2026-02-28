import React, { memo, useMemo, useState, useEffect } from "react";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Grid, Row, Col } from "@jetbrains/ring-ui-built/components/grid/grid";
import Toggle from "@jetbrains/ring-ui-built/components/toggle/toggle";
import { Size as ToggleSize } from "@jetbrains/ring-ui-built/components/toggle/toggle";
import { host } from "../global/ytApp";
import type { Settings } from "../../../@types/settings";
import IssueDeps from "../depgraph/issue-deps";
import { openGraphPage } from "../issuedepyt-page/open-page";

const issue = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [followUpstream, setFollowUpstream] = useState<boolean>(true);
  const [followDownstream, setFollowDownstream] = useState<boolean>(true);

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
  }, [host]);

  return (
    <div className="widget">
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
                      checked={followUpstream}
                      onChange={(e: any) => setFollowUpstream(e.target.checked)}
                    >
                      Follow upstream (find issues that this issue depends on).
                    </Toggle>
                  </Row>
                  <Row start={"xs"} middle={"xs"}>
                    <Toggle
                      size={ToggleSize.Size14}
                      checked={followDownstream}
                      onChange={(e: any) => setFollowDownstream(e.target.checked)}
                    >
                      Follow downstream (find issues that depends on this issue).
                    </Toggle>
                  </Row>
                </Grid>
              </Col>
            </Row>
            <Row start={"xs"} middle={"xs"}>
              <Col>
                <Button inline onClick={() => openGraphPage(issue.id, settings)}>
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
          followUpstream={followUpstream}
          followDownstream={followDownstream}
          setFollowUpstream={setFollowUpstream}
          setFollowDownstream={setFollowDownstream}
          useDynamicGraphHeight={true}
        />
      )}
    </div>
  );
};

export const App = memo(AppComponent);
