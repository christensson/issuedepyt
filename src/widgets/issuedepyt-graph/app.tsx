import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Col, Grid, Row } from "@jetbrains/ring-ui-built/components/grid/grid";
import Toggle, { Size as ToggleSize } from "@jetbrains/ring-ui-built/components/toggle/toggle";
import React, { memo, useEffect, useMemo, useState } from "react";
import type { FollowSettings } from "../../../@types/follow-settings";
import type { Settings } from "../../../@types/settings";
import IssueDeps from "../depgraph/issue-deps";
import { host } from "../global/ytApp";
import { openGraphPage } from "../issuedepyt-page/open-page";

const issue = YTApp.entity;

const AppComponent: React.FunctionComponent = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [graphVisible, setGraphVisible] = useState<boolean>(false);
  const [followSettings, setFollowSettings] = useState<FollowSettings>({
    followUpstream: true,
    followDownstream: false,
  });

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
                      checked={followSettings.followUpstream}
                      onChange={(e: any) =>
                        setFollowSettings({ ...followSettings, followUpstream: e.target.checked })
                      }
                    >
                      Follow upstream (find issues that this issue depends on).
                    </Toggle>
                  </Row>
                  <Row start={"xs"} middle={"xs"}>
                    <Toggle
                      size={ToggleSize.Size14}
                      checked={followSettings.followDownstream}
                      onChange={(e: any) =>
                        setFollowSettings({ ...followSettings, followDownstream: e.target.checked })
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
          followSettings={followSettings}
          setFollowSettings={setFollowSettings}
          useDynamicGraphHeight={true}
        />
      )}
    </div>
  );
};

export const App = memo(AppComponent);
