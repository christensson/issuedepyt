import { FollowSettings } from "./follow-settings";
import { LayoutOptions, NodeLabelOptions } from "./graph-view-settings";

export type GraphContext = {
  followSettings?: FollowSettings;
  layoutOptions?: LayoutOptions;
  nodeLabelOptions?: NodeLabelOptions;
};

export type GraphLoadSettings = {
  followSettings: FollowSettings;
};

export const defaultGraphLoadSettings: GraphLoadSettings = {
  followSettings: {
    followUpstream: true,
    followDownstream: false,
  },
};
