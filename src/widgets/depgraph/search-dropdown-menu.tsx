import CloseIcon from "@jetbrains/icons/close";
import SearchIcon from "@jetbrains/icons/search";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import DropdownMenu from "@jetbrains/ring-ui-built/components/dropdown-menu/dropdown-menu";
import Input from "@jetbrains/ring-ui-built/components/input/input";
import React, { useRef, useState } from "react";
import type { FieldInfo, FieldInfoKey } from "../../../@types/field-info";
import type { Settings } from "../../../@types/settings";
import type { IssueInfo } from "./issue-types";
import NestedMenuItem from "./nested-menu-item";

interface SearchDropdownMenuProps {
  fieldInfo: FieldInfo;
  issueData: { [key: string]: IssueInfo };
  settings: Settings;
  setHighlightedNodes: (value: Array<string> | null) => void;
  maxHeight?: number;
}

const SearchDropdownMenu: React.FunctionComponent<SearchDropdownMenuProps> = ({
  fieldInfo,
  issueData,
  settings,
  setHighlightedNodes,
  maxHeight,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const popupIcon = open ? CloseIcon : SearchIcon;

  const findNodes = (
    filterFunc: (issue: IssueInfo) => boolean,
    issueData: { [key: string]: IssueInfo },
  ) => {
    return Object.values(issueData)
      .filter(filterFunc)
      .map((x) => x.id);
  };

  const items = [];
  items.push({
    rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
    template: (
      <Button
        onClick={(e: any) => {
          setHighlightedNodes(null);
        }}
      >
        Clear
      </Button>
    ),
  });
  items.push({
    rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
    template: (
      <Input
        type="search"
        label="Highlight text matches"
        onChange={(e: any) =>
          setHighlightedNodes(
            findNodes((x: IssueInfo) => {
              const content = `${x.idReadable} ${x.summary}`;
              return content.toLowerCase().includes(e.target.value.toLowerCase());
            }, issueData),
          )
        }
      />
    ),
  });
  const fields: Array<["type" | "state", FieldInfoKey]> = [
    ["type", "typeField"],
    ["state", "stateField"],
  ];
  for (const [fieldName, fieldInfoKey] of fields) {
    if (fieldInfo?.[fieldInfoKey]) {
      const field = fieldInfo[fieldInfoKey];
      const submenuItems = [];
      for (const [valueName, valueProps] of Object.entries(field.values)) {
        if (valueProps.archived) {
          continue;
        }
        submenuItems.push({
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Button
              inline
              onClick={(e: any) =>
                setHighlightedNodes(
                  findNodes((x: IssueInfo) => x[fieldName] === valueName, issueData),
                )
              }
            >
              Highlight {valueName}
            </Button>
          ),
        });
      }
      items.push({
        rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
        template: (
          <button className="nested-menu-button" onClick={(e) => e.stopPropagation()}>
            <NestedMenuItem title={field.name} maxHeight={maxHeight} data={submenuItems} />
          </button>
        ),
      });
    }
  }

  const allSprints = Object.values(issueData)
    .flatMap((x) => x?.sprints)
    .filter((x) => !!x)
    .map((x) => x.name);
  const sprints = [...new Set(allSprints)].sort();
  if (sprints.length > 0) {
    const submenuItems = [];
    for (const sprint of sprints) {
      submenuItems.push({
        rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
        template: (
          <Button
            inline
            onClick={(e: any) =>
              setHighlightedNodes(
                findNodes(
                  (x: IssueInfo) =>
                    x?.sprints != undefined &&
                    x.sprints.filter((s) => s.name === sprint).length > 0,
                  issueData,
                ),
              )
            }
          >
            Highlight sprint {sprint}
          </Button>
        ),
      });
    }
    items.push({
      rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
      template: (
        <button className="nested-menu-button" onClick={(e) => e.stopPropagation()}>
          <NestedMenuItem title="Sprints" maxHeight={maxHeight} data={submenuItems} />
        </button>
      ),
    });
  }

  const searches: Array<[string, (issue: IssueInfo) => boolean]> = [
    ["Highlight root node", (x: IssueInfo) => x.depth == 0],
    ["Highlight resolved", (x: IssueInfo) => x.resolved],
    ["Highlight unresolved", (x: IssueInfo) => !x.resolved],
  ];
  if (settings?.assigneeField) {
    searches.push(["Highlight assigned", (x: IssueInfo) => x.assignee != null]);
    searches.push(["Highlight unassigned", (x: IssueInfo) => x.assignee == null]);
  }
  if (settings?.sprintsField) {
    searches.push([
      "Highlight planned",
      (x: IssueInfo) => x?.sprints != null && x.sprints.length > 0,
    ]);
    searches.push([
      "Highlight unplanned",
      (x: IssueInfo) => !(x?.sprints != null && x.sprints.length > 0),
    ]);
  }
  if (settings?.startDateField) {
    searches.push(["Highlight with start date", (x: IssueInfo) => !!x.startDate]);
    searches.push(["Highlight no start date", (x: IssueInfo) => !x.startDate]);
  }
  if (settings?.dueDateField) {
    searches.push(["Highlight with due date", (x: IssueInfo) => !!x.dueDate]);
    searches.push(["Highlight no due date", (x: IssueInfo) => !x.dueDate]);
  }
  if (settings?.estimationField) {
    searches.push(["Highlight estimated", (x: IssueInfo) => !!x.estimation]);
    searches.push(["Highlight non-estimated", (x: IssueInfo) => !x.estimation]);
  }
  items.push(
    ...searches.map(([label, filterFunc]) => ({
      rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
      template: (
        <Button inline onClick={(e: any) => setHighlightedNodes(findNodes(filterFunc, issueData))}>
          {label}
        </Button>
      ),
    })),
  );

  return (
    <DropdownMenu
      onShow={() => setOpen(true)}
      onHide={() => setOpen(false)}
      menuProps={{
        closeOnSelect: false,
        maxHeight: maxHeight,
      }}
      anchor={<Button inline icon={popupIcon} />}
      data={items}
    />
  );
};

export default SearchDropdownMenu;
