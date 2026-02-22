type AppAPI = {
  onRefresh?: () => void;
  onConfigure?: () => void;
};

import type AlertService from "@jetbrains/ring-ui-built/components/alert-service/alert-service";
import type { RequestParams } from "@jetbrains/ring-ui-built/components/http/http";

export interface HubService {
  id: string;
  applicationName: string;
  homeUrl: string;
}

interface BaseAPILayer {
  alert: (...args: Parameters<(typeof AlertService)["addAlert"]>) => void;
  enterModalMode: Promise<() => void>;
  exitModalMode: Promise<() => void>;
  collapse: () => void;
}

/*
 * This layer should allow plugin to call YT endpoints while being sure there is just ONE YouTrack instance
 */
export interface InstanceAwareAPILayer extends BaseAPILayer {
  fetchYouTrack: <T = unknown>(relativeURL: string, requestParams?: RequestParams) => Promise<T>;
}

/*
 * This layer allows plugin to communicate with own backend
 */
export interface PluginEndpointAPILayer extends InstanceAwareAPILayer {
  fetchApp: <T = unknown>(
    relativeURL: string,
    requestParams?: RequestParams & { scope?: boolean },
  ) => Promise<T>;
}

export type HostAPI = PluginEndpointAPILayer;

type YTAppInterface = {
  locale: string;
  entity: {
    id: string;
    type: string;
  };
  register: (appApi?: AppAPI) => Promise<HostAPI>;
};

declare global {
  const YTApp: YTAppInterface;
}
