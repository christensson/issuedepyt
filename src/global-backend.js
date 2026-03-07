// To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-reference-http-handlers.html

exports.httpHandler = {
  endpoints: [
    {
      method: "GET",
      path: "context",
      scope: "global",
      permissions: ["READ_ISSUE", "READ_PROJECT"],
      handle: function handle(ctx) {
        // Load stored context from user extension properties.
        const props = ctx.currentUser.extensionProperties;
        const issueId = props.issueId;
        const settings = {
          // Load project settings from stored context.
          typeField: props.typeField,
          stateField: props.stateField,
          sprintsField: props.sprintsField,
          assigneeField: props.assigneeField,
          startDateField: props.startDateField,
          dueDateField: props.dueDateField,
          estimationField: props.estimationField,
          extraCustomFields: props.extraCustomFields,
          upstreamRelations: props.upstreamRelations,
          downstreamRelations: props.downstreamRelations,
          // Global settings are available in ctx.settings.
          autoLoadDeps: ctx.settings.autoLoadDeps,
          useHierarchicalLayout: ctx.settings.useHierarchicalLayout,
          maxRecursionDepth: ctx.settings.maxRecursionDepth,
        };
        const graphContext = props.graphContext ? JSON.parse(props.graphContext) : {};
        ctx.response.json({ issueId: issueId, settings: settings, graphContext: graphContext });
      },
    },
  ],
};
