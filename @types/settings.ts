export type Settings = {
  typeField?: string;
  stateField?: string;
  sprintsField?: string;
  assigneeField?: string;
  startDateField?: string;
  dueDateField?: string;
  estimationField?: string;
  extraCustomFields?: string;
  upstreamRelations?: string;
  downstreamRelations?: string;
  autoLoadDeps?: boolean;
  maxRecursionDepth?: number;
};
