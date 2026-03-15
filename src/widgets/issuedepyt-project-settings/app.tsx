import AlertService from "@jetbrains/ring-ui-built/components/alert-service/alert-service";
import Alert from "@jetbrains/ring-ui-built/components/alert/alert";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Input from "@jetbrains/ring-ui-built/components/input/input";
import Loader from "@jetbrains/ring-ui-built/components/loader/loader";
import Panel from "@jetbrains/ring-ui-built/components/panel/panel";
import Select, { type SelectItem } from "@jetbrains/ring-ui-built/components/select/select";
import Toggle from "@jetbrains/ring-ui-built/components/toggle/toggle";
import React, { memo, useEffect, useState } from "react";
import type { Settings } from "../../../@types/settings";

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

type ProjectField = { name: string; typeName: string };
type IssueLinkType = {
  id: string;
  name: string;
  sourceToTarget: string;
  targetToSource: string;
  directed: boolean;
};
type FieldOption = SelectItem<{ value: string }>;
type RelationOption = SelectItem<{ value: string }>;

const NOT_SET_OPTION: FieldOption = { key: "", label: "— Not set —", value: "" };

const buildFieldOptions = (fields: ProjectField[]): FieldOption[] => {
  return [NOT_SET_OPTION, ...fields.map((f) => ({ key: f.name, label: f.name, value: f.name }))];
};

const buildExtraFieldOptions = (fields: ProjectField[]): FieldOption[] => {
  return fields.map((f) => ({ key: f.name, label: f.name, value: f.name }));
};

const buildRelationOptions = (linkTypes: IssueLinkType[]): RelationOption[] => {
  const options: RelationOption[] = [];
  for (const lt of linkTypes) {
    if (lt.directed) {
      if (lt.sourceToTarget) {
        const value = `outward:${lt.name.toLowerCase()}`;
        options.push({ key: value, label: `${lt.sourceToTarget} (outward)`, value: value });
      }
      if (lt.targetToSource) {
        const value = `inward:${lt.name.toLowerCase()}`;
        options.push({ key: value, label: `${lt.targetToSource} (inward)`, value: value });
      }
    } else {
      const value = `both:${lt.name.toLowerCase()}`;
      options.push({ key: value, label: `${lt.sourceToTarget || lt.name} (both)`, value: value });
    }
  }
  return options;
};

const resolveFieldOption = (value: string | undefined, options: FieldOption[]): FieldOption => {
  if (!value) return NOT_SET_OPTION;
  return options.find((o) => o.key === value) ?? { key: value, label: value, value };
};

const resolveMultiOptions = <T extends FieldOption | RelationOption>(
  values: string[] | undefined,
  options: T[],
): T[] => {
  if (!values?.length) return [];
  return values.map(
    (k) => (options.find((o) => o.key === k) ?? { key: k, label: k, value: k }) as T,
  );
};

const getFieldsOfType = (fields: ProjectField[], typeNames: string[]): ProjectField[] => {
  return fields.filter((f) => typeNames.includes(f.typeName));
};

interface SettingRowProps {
  label: string;
  children: React.ReactNode;
}

const SettingRow: React.FunctionComponent<SettingRowProps> = ({ label, children }) => (
  <tr>
    <td
      style={{ paddingRight: 16, paddingBottom: 10, whiteSpace: "nowrap", verticalAlign: "middle" }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
    </td>
    <td style={{ paddingBottom: 10, verticalAlign: "middle" }}>{children}</td>
  </tr>
);

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FunctionComponent<SectionHeaderProps> = ({ title }) => (
  <tr>
    <td
      colSpan={2}
      style={{
        paddingTop: 16,
        paddingBottom: 4,
        fontWeight: 700,
        fontSize: "0.85em",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        opacity: 0.6,
      }}
    >
      {title}
    </td>
  </tr>
);

const AppComponent: React.FunctionComponent = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ProjectField[]>([]);
  const [linkTypes, setLinkTypes] = useState<IssueLinkType[]>([]);
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    const projectId = YTApp.entity.id;
    Promise.all([
      host.fetchApp<{ settings: Settings }>("backend/projectConfig", {
        scope: true,
      }),
      host.fetchYouTrack<{ field: { name: string; fieldType: { id: string } } }[]>(
        `admin/projects/${projectId}/customFields`,
        { query: { fields: "field(name,fieldType(id))", $top: 100 } },
      ),
      host.fetchYouTrack<
        {
          id: string;
          name: string;
          sourceToTarget: string;
          targetToSource: string;
          directed: boolean;
        }[]
      >("issueLinkTypes", {
        query: { fields: "id,name,sourceToTarget,targetToSource,directed", $top: 100 },
      }),
    ])
      .then(([config, projectFields, lts]) => {
        console.log("Loaded config:", config);
        console.log("Loaded project fields:", projectFields);
        console.log("Loaded link types:", lts);
        const fields = (projectFields ?? []).map((pf) => ({
          name: pf.field.name,
          typeName: pf.field.fieldType?.id ?? "",
        }));
        setFields(fields);
        setSettings(config.settings ?? {});
        setLinkTypes(lts ?? []);
      })
      .catch((err) => {
        console.error("Failed to load project config:", err);
        AlertService.addAlert("Failed to load project configuration.", Alert.Type.ERROR);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (settings: Settings) => {
    setSaving(true);
    console.log("Saving settings:", settings);
    try {
      await host.fetchApp("backend/projectConfig", {
        scope: true,
        method: "POST",
        body: { settings },
      });
      AlertService.addAlert("Settings saved.", Alert.Type.SUCCESS, 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      AlertService.addAlert("Failed to save settings.", Alert.Type.ERROR);
    } finally {
      setSaving(false);
    }
  };

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Loader message="Loading configuration…" />
      </div>
    );
  }

  const typeFieldOptions = buildFieldOptions(getFieldsOfType(fields, ["enum[1]"]));
  const stateFieldOptions = buildFieldOptions(getFieldsOfType(fields, ["state[1]"]));
  const sprintsFieldOptions = buildFieldOptions(
    getFieldsOfType(fields, ["version[1]", "version[*]"]),
  );
  const assigneeFieldOptions = buildFieldOptions(getFieldsOfType(fields, ["user[1]"]));
  const dateFieldOptions = buildFieldOptions(getFieldsOfType(fields, ["date", "date and time"]));
  const estimationFieldOptions = buildFieldOptions(getFieldsOfType(fields, ["period"]));
  const extraFieldOptions = buildExtraFieldOptions(fields);
  const relationOptions = buildRelationOptions(linkTypes);

  const selectedExtraFields = resolveMultiOptions(settings.extraCustomFields, extraFieldOptions);
  const selectedUpstream = resolveMultiOptions(settings.upstreamRelations, relationOptions);
  const selectedDownstream = resolveMultiOptions(settings.downstreamRelations, relationOptions);

  return (
    <div className="widget" style={{ padding: "8px 16px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640 }}>
        <tbody>
          <SectionHeader title="Field Mappings" />
          <SettingRow label="Type field">
            <Select
              data={typeFieldOptions}
              selected={resolveFieldOption(settings.typeField, typeFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("typeField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="State field">
            <Select
              data={stateFieldOptions}
              selected={resolveFieldOption(settings.stateField, stateFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("stateField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="Sprints field">
            <Select
              data={sprintsFieldOptions}
              selected={resolveFieldOption(settings.sprintsField, sprintsFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("sprintsField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="Assignee field">
            <Select
              data={assigneeFieldOptions}
              selected={resolveFieldOption(settings.assigneeField, assigneeFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("assigneeField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="Start date field">
            <Select
              data={dateFieldOptions}
              selected={resolveFieldOption(settings.startDateField, dateFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("startDateField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="Due date field">
            <Select
              data={dateFieldOptions}
              selected={resolveFieldOption(settings.dueDateField, dateFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("dueDateField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>
          <SettingRow label="Estimation field">
            <Select
              data={estimationFieldOptions}
              selected={resolveFieldOption(settings.estimationField, estimationFieldOptions)}
              onChange={(item: FieldOption | null) =>
                setSetting("estimationField", item?.value || undefined)
              }
              filter
              type={Select.Type.BUTTON}
              label="Select field…"
            />
          </SettingRow>

          <SectionHeader title="Extra Fields" />
          <SettingRow label="Extra custom fields">
            <Select
              multiple
              data={extraFieldOptions}
              selected={selectedExtraFields}
              onChange={(items: readonly FieldOption[]) =>
                setSetting(
                  "extraCustomFields",
                  items.length ? items.map((i) => i.key as string) : undefined,
                )
              }
              filter
              type={Select.Type.BUTTON}
              size={Select.Size.FULL}
              label="Select fields…"
            />
          </SettingRow>

          <SectionHeader title="Relation Configuration" />
          <SettingRow label="Upstream relations">
            <Select
              multiple
              data={relationOptions}
              selected={selectedUpstream}
              onChange={(items: readonly RelationOption[]) =>
                setSetting(
                  "upstreamRelations",
                  items.length ? items.map((i) => i.key as string) : undefined,
                )
              }
              filter
              type={Select.Type.BUTTON}
              size={Select.Size.FULL}
              label="Select relations…"
            />
          </SettingRow>
          <SettingRow label="Downstream relations">
            <Select
              multiple
              data={relationOptions}
              selected={selectedDownstream}
              onChange={(items: readonly RelationOption[]) =>
                setSetting(
                  "downstreamRelations",
                  items.length ? items.map((i) => i.key as string) : undefined,
                )
              }
              filter
              type={Select.Type.BUTTON}
              size={Select.Size.FULL}
              label="Select relations…"
            />
          </SettingRow>

          <SectionHeader title="Behavior" />
          <SettingRow label="Auto-load dependencies">
            <Toggle
              checked={!!settings.autoLoadDeps}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSetting("autoLoadDeps", e.target.checked)
              }
            />
          </SettingRow>
          <SettingRow label="Max recursion depth">
            <Input
              type="number"
              value={settings.maxRecursionDepth != null ? String(settings.maxRecursionDepth) : ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const n = parseInt(e.target.value, 10);
                setSetting("maxRecursionDepth", isNaN(n) ? undefined : n);
              }}
              placeholder="Default"
              style={{ width: 80 }}
            />
          </SettingRow>
        </tbody>
      </table>
      <Panel>
        <Button primary onClick={() => handleSave(settings)} disabled={saving} loader={saving}>
          Save
        </Button>
      </Panel>
    </div>
  );
};

export const App = memo(AppComponent);
