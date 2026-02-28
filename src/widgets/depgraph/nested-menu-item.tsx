import ChevronRightIcon from "@jetbrains/icons/chevron-right";
import DropdownMenu, {
  DropdownMenuProps,
} from "@jetbrains/ring-ui-built/components/dropdown-menu/dropdown-menu";
import Group from "@jetbrains/ring-ui-built/components/group/group";
import Icon from "@jetbrains/ring-ui-built/components/icon/icon";
import { ListDataItem } from "@jetbrains/ring-ui-built/components/list/consts";
import { Directions } from "@jetbrains/ring-ui-built/components/popup/popup.consts";
import React from "react";

export interface NestedMenuProps {
  title: string;
  data?: ListDataItem[];
  children?: React.ReactNode;
  maxHeight?: number;
}

export const NestedMenuItem = (props: NestedMenuProps) => {
  const anchor: DropdownMenuProps["anchor"] = ({ active }, ariaProps = {}) => (
    <Group
      role="menu"
      className="nested-menu-item"
      {...{
        "aria-expanded": active,
        "aria-label": props.title,
      }}
      {...ariaProps}
    >
      <span className="nested-menu-title">{props.title}</span>
      <Icon glyph={ChevronRightIcon} className="chevron-icon" />
    </Group>
  );
  const dropdownProps: DropdownMenuProps = {
    hoverMode: true,
    hoverShowTimeOut: 50,
    hoverHideTimeOut: 100,
    anchor,
  };
  const menuProps: DropdownMenuProps["menuProps"] = {
    directions: [
      Directions.RIGHT_BOTTOM,
      Directions.LEFT_BOTTOM,
      Directions.RIGHT_TOP,
      Directions.LEFT_TOP,
    ],
    left: 20,
    top: -12,
    minWidth: 150,
    ["data-test"]: "nested-menu",
    hidden: false,
    activateFirstItem: false,
    maxHeight: props?.maxHeight,
  };
  if (props.data) {
    // dropdown menu has automatic support for aria-navigation
    return <DropdownMenu {...dropdownProps} data={props.data} menuProps={menuProps} />;
  }
  return <DropdownMenu {...dropdownProps} menuProps={menuProps} />;
};

export default NestedMenuItem;
