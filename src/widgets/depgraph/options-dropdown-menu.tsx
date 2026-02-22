import CloseIcon from "@jetbrains/icons/close";
import MoreOptionsIcon from "@jetbrains/icons/more-options";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import DropdownMenu from "@jetbrains/ring-ui-built/components/dropdown-menu/dropdown-menu";
import Theme from "@jetbrains/ring-ui-built/components/global/theme";
import Input from "@jetbrains/ring-ui-built/components/input/input";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";
import React, { useRef, useState } from "react";

interface OptionsDropdownMenuProps {
  maxDepth: number;
  maxNodeWidth: number | undefined;
  useHierarchicalLayout: boolean;
  useDepthRendering: boolean;
  followUpstream: boolean;
  followDownstream: boolean;
  showNodeLabelFlags: boolean;
  showNodeLabelSummary: boolean;
  showNodeLabelType: boolean;
  setMaxDepth: (value: number) => void;
  setMaxNodeWidth: (value: number) => void;
  setUseHierarchicalLayout: (value: boolean) => void;
  setUseDepthRendering: (value: boolean) => void;
  setFollowUpstream: (value: boolean) => void;
  setFollowDownstream: (value: boolean) => void;
  setShowNodeLabelFlags: (show: boolean) => void;
  setShowNodeLabelSummary: (show: boolean) => void;
  setShowNodeLabelType: (show: boolean) => void;
  onExportData: () => void;
}

const OptionsDropdownMenu: React.FunctionComponent<OptionsDropdownMenuProps> = ({
  maxDepth,
  maxNodeWidth,
  useHierarchicalLayout,
  useDepthRendering,
  followUpstream,
  followDownstream,
  showNodeLabelFlags,
  showNodeLabelSummary,
  showNodeLabelType,
  setMaxDepth,
  setMaxNodeWidth,
  setUseHierarchicalLayout,
  setUseDepthRendering,
  setFollowUpstream,
  setFollowDownstream,
  setShowNodeLabelFlags,
  setShowNodeLabelSummary,
  setShowNodeLabelType,
  onExportData,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const popupIcon = open ? CloseIcon : MoreOptionsIcon;

  return (
    <DropdownMenu
      onShow={() => setOpen(true)}
      onHide={() => setOpen(false)}
      menuProps={{
        closeOnSelect: false,
      }}
      anchor={<Button inline icon={popupIcon} />}
      data={[
        {
          rgItemType: DropdownMenu.ListProps.Type.TITLE,
          label: "Layout",
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Tree layout"
              checked={useHierarchicalLayout}
              onChange={(e: any) => setUseHierarchicalLayout(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Strict depth layout"
              checked={useDepthRendering}
              onChange={(e: any) => setUseDepthRendering(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Input
              type="number"
              label="Max depth"
              value={maxDepth}
              onChange={(e: any) => setMaxDepth(Number(e.target.value))}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.TITLE,
          label: "Nodes",
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Show ticket flags"
              checked={showNodeLabelFlags}
              onChange={(e: any) => setShowNodeLabelFlags(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Show ticket summary"
              checked={showNodeLabelSummary}
              onChange={(e: any) => setShowNodeLabelSummary(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Show ticket type"
              checked={showNodeLabelType}
              onChange={(e: any) => setShowNodeLabelType(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Input
              type="number"
              label="Max node width"
              value={maxNodeWidth}
              onChange={(e: any) => setMaxNodeWidth(Number(e.target.value))}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.TITLE,
          label: "Follow direction",
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Follow upstream relations"
              checked={followUpstream}
              onChange={(e: any) => setFollowUpstream(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Checkbox
              label="Follow downstream relations"
              checked={followDownstream}
              onChange={(e: any) => setFollowDownstream(e.target.checked)}
            />
          ),
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.TITLE,
          label: "Export",
        },
        {
          rgItemType: DropdownMenu.ListProps.Type.CUSTOM,
          template: (
            <Button inline onClick={() => onExportData()}>
              Export data as CSV
            </Button>
          ),
        },
      ]}
    />
  );
};

export default OptionsDropdownMenu;
