// To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-reference-http-handlers.html

const splitCsv = (value) =>
  value
    ? value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

const joinCsv = (arr) => (Array.isArray(arr) ? arr.join(",") : arr || "");

function getProjectSettings(ctx) {
  const settingsEncoded = ctx.project.extensionProperties.settings;
  const settings = settingsEncoded ? JSON.parse(settingsEncoded) : {};

  // If no settings are found, use legacy settings from ctx.settings.
  if (Object.keys(settings).length === 0) {
    const legacySettings = ctx.settings;
    Object.assign(settings, legacySettings);
    // Convert legacy comma-separated strings to arrays.
    if (typeof legacySettings.extraCustomFields === "string") {
      settings.extraCustomFields = splitCsv(legacySettings.extraCustomFields);
    }
    if (typeof legacySettings.upstreamRelations === "string") {
      settings.upstreamRelations = splitCsv(legacySettings.upstreamRelations);
    }
    if (typeof legacySettings.downstreamRelations === "string") {
      settings.downstreamRelations = splitCsv(legacySettings.downstreamRelations);
    }
  }

  return settings;
}

exports.httpHandler = {
  endpoints: [
    {
      method: "GET",
      path: "projectConfig",
      scope: "project",
      handle: function handle(ctx) {
        const settings = getProjectSettings(ctx);
        ctx.response.json({ settings: settings });
      },
    },
    {
      method: "POST",
      path: "projectConfig",
      scope: "project",
      handle: function handle(ctx) {
        const body = JSON.parse(ctx.request.body);
        ctx.project.extensionProperties.settings = JSON.stringify(body.settings || {});
        ctx.response.json({ success: true });
      },
    },
    {
      method: "GET",
      path: "settings",
      scope: "issue",
      handle: function handle(ctx) {
        ctx.response.json({ settings: getProjectSettings(ctx) });
      },
    },
    {
      method: "POST",
      path: "storeContext",
      scope: "issue",
      handle: function handle(ctx) {
        const body = JSON.parse(ctx.request.body);
        const resp = {};
        // Store context in user extension properties.

        if (body?.issueId) {
          ctx.currentUser.extensionProperties.issueId = body.issueId;
          resp.issueId = body.issueId;
        }

        if (body?.graphContext) {
          const graphContext = body.graphContext || {};
          ctx.currentUser.extensionProperties.graphContext = JSON.stringify(graphContext);
        }

        // Copy project settings to user extension properties so the global-backend/context
        // endpoint can serve them when there is no project scope available.
        const settings = getProjectSettings(ctx);
        ctx.currentUser.extensionProperties.typeField = settings.typeField || "";
        ctx.currentUser.extensionProperties.stateField = settings.stateField || "";
        ctx.currentUser.extensionProperties.sprintsField = settings.sprintsField || "";
        ctx.currentUser.extensionProperties.assigneeField = settings.assigneeField || "";
        ctx.currentUser.extensionProperties.startDateField = settings.startDateField || "";
        ctx.currentUser.extensionProperties.dueDateField = settings.dueDateField || "";
        ctx.currentUser.extensionProperties.estimationField = settings.estimationField || "";
        ctx.currentUser.extensionProperties.extraCustomFields = JSON.stringify(
          settings.extraCustomFields || [],
        );
        ctx.currentUser.extensionProperties.upstreamRelations = JSON.stringify(
          settings.upstreamRelations || [],
        );
        ctx.currentUser.extensionProperties.downstreamRelations = JSON.stringify(
          settings.downstreamRelations || [],
        );

        resp.success = true;
        ctx.response.json(resp);
      },
    },
  ],
};
