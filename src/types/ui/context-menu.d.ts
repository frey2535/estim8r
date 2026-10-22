import type * as React from "react";

/** @typedef {React.ComponentPropsWithoutRef<"div"> & { className?: string; children?: React.ReactNode } & Record<string, unknown>} UiDivProps */
type UiDivProps = React.ComponentPropsWithoutRef<"div"> & {
  className?: string;
  children?: React.ReactNode;
} & Record<string, unknown>;

type UiForward = React.ForwardRefExoticComponent<
  UiDivProps & React.RefAttributes<HTMLElement>
>;
type UiComp = React.ComponentType<UiDivProps>;
type UiFn = (...args: never[]) => unknown;

export declare const ContextMenu: UiForward | UiComp;
export declare const ContextMenuCheckboxItem: UiForward | UiComp;
export declare const ContextMenuContent: UiForward | UiComp;
export declare const ContextMenuGroup: UiForward | UiComp;
export declare const ContextMenuItem: UiForward | UiComp;
export declare const ContextMenuLabel: UiForward | UiComp;
export declare const ContextMenuPortal: UiForward | UiComp;
export declare const ContextMenuRadioGroup: UiForward | UiComp;
export declare const ContextMenuRadioItem: UiForward | UiComp;
export declare const ContextMenuSeparator: UiForward | UiComp;
export declare const ContextMenuShortcut: UiForward | UiComp;
export declare const ContextMenuSub: UiForward | UiComp;
export declare const ContextMenuSubContent: UiForward | UiComp;
export declare const ContextMenuSubTrigger: UiForward | UiComp;
export declare const ContextMenuTrigger: UiForward | UiComp;
