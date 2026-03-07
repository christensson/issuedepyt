import { FollowSettings } from "../../../@types/follow-settings";
import { GraphContext } from "../../../@types/graph-context";
import { Settings } from "../../../@types/settings";
import { host } from "../global/ytApp";

export const storeContext = async (
  issueId: string,
  settings: Settings,
  followSettings: FollowSettings,
) => {
  const graphContext: GraphContext = {
    followSettings,
  };
  // Update backend context.
  await host.fetchApp<{ issueId: string }>("backend/storeContext", {
    scope: true,
    method: "POST",
    body: { issueId: issueId, settings: settings, graphContext: graphContext },
  });
};

export const openGraphPage = async (
  issueId: string,
  settings: Settings,
  followSettings: FollowSettings,
) => {
  // Update backend context and transfer to app page which will fetch context.
  await storeContext(issueId, settings, followSettings);

  // Transfer to app page.
  open("/app/issuedepyt/page");
};
