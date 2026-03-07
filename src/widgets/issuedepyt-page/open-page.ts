import { GraphLoadSettings } from "../../../@types/graph-context";
import { GraphViewSettings } from "../../../@types/graph-view-settings";
import { storeContext } from "../depgraph/graph-context-ops";

export const openGraphPage = async (
  issueId: string,
  graphLoadSettings: GraphLoadSettings,
  graphViewSettings: GraphViewSettings,
) => {
  // Update backend context and transfer to app page which will fetch context.
  await storeContext(issueId, graphLoadSettings, graphViewSettings);

  // Transfer to app page.
  open("/app/issuedepyt/page");
};
