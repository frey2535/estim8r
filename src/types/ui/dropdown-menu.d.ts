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

export declare const DropdownMenu: UiForward | UiComp;
export declare const DropdownMenuCheckboxItem: UiForward | UiComp;
export declare const DropdownMenuContent: UiForward | UiComp;
export declare const DropdownMenuGroup: UiForward | UiComp;
export declare const DropdownMenuItem: UiForward | UiComp;
export declare const DropdownMenuLabel: UiForward | UiComp;
export declare const DropdownMenuPortal: UiForward | UiComp;
export declare const DropdownMenuRadioGroup: UiForward | UiComp;
export declare const DropdownMenuRadioItem: UiForward | UiComp;
export declare const DropdownMenuSeparator: UiForward | UiComp;
export declare const DropdownMenuShortcut: UiForward | UiComp;
export declare const DropdownMenuSub: UiForward | UiComp;
export declare const DropdownMenuSubContent: UiForward | UiComp;
export declare const DropdownMenuSubTrigger: UiForward | UiComp;
export declare const DropdownMenuTrigger: UiForward | UiComp;
