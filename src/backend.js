// To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-reference-http-handlers.html

exports.httpHandler = {
  endpoints: [
    {
      method: "GET",
      path: "settings",
      scope: "issue",
      handle: function handle(ctx) {
        ctx.response.json({ settings: ctx.settings });
      },
    },
    {
      method: "POST",
      path: "storeContext",
      scope: "issue",
      handle: function handle(ctx) {
        const body = JSON.parse(ctx.request.body);
        const settings = ctx.settings;
        const graphContext = body.graphContext || {};
        // Store context in user extension properties.
        ctx.currentUser.extensionProperties.issueId = body.issueId;
        ctx.currentUser.extensionProperties.graphContext = JSON.stringify(graphContext);
        ctx.currentUser.extensionProperties.typeField = settings.typeField;
        ctx.currentUser.extensionProperties.typeField = settings.typeField;
        ctx.currentUser.extensionProperties.stateField = settings.stateField;
        ctx.currentUser.extensionProperties.sprintsField = settings.sprintsField;
        ctx.currentUser.extensionProperties.assigneeField = settings.assigneeField;
        ctx.currentUser.extensionProperties.startDateField = settings.startDateField;
        ctx.currentUser.extensionProperties.dueDateField = settings.dueDateField;
        ctx.currentUser.extensionProperties.estimationField = settings.estimationField;
        ctx.currentUser.extensionProperties.extraCustomFields = settings.extraCustomFields;
        ctx.currentUser.extensionProperties.upstreamRelations = settings.upstreamRelations;
        ctx.currentUser.extensionProperties.downstreamRelations = settings.downstreamRelations;
        ctx.response.json({ issueId: body.issueId });
      },
    },
  ],
};
