import { GraphContext, GraphLoadSettings } from "../../../@types/graph-context";
import { GraphViewSettings } from "../../../@types/graph-view-settings";
import { host } from "../global/ytApp";

export const storeContext = async (
  issueId: string,
  graphLoadSettings: GraphLoadSettings,
  graphViewSettings: GraphViewSettings,
) => {
  const graphContext: GraphContext = {
    followSettings: graphLoadSettings.followSettings,
    layoutOptions: graphViewSettings.layoutOptions,
    nodeLabelOptions: graphViewSettings.nodeLabelOptions,
  };
  // Update backend context.
  await host.fetchApp<{ issueId: string }>("backend/storeContext", {
    scope: true,
    method: "POST",
    body: { issueId: issueId, graphContext: graphContext },
  });
};

export const storeContextGraphSettings = async (
  graphLoadSettings: GraphLoadSettings,
  graphViewSettings: GraphViewSettings,
) => {
  const graphContext: GraphContext = {
    followSettings: graphLoadSettings.followSettings,
    layoutOptions: graphViewSettings.layoutOptions,
    nodeLabelOptions: graphViewSettings.nodeLabelOptions,
  };
  // Update backend context.
  console.log("Store graph context", graphContext);
  const resp = await host.fetchApp<{ success: boolean }>("global-backend/storeGraphContext", {
    scope: false,
    method: "POST",
    body: { graphContext: graphContext },
  });
  console.log("Stored graph context response", resp);
  return resp?.success || false;
};
