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

export declare const Menubar: UiForward | UiComp;
export declare const MenubarCheckboxItem: UiForward | UiComp;
export declare const MenubarContent: UiForward | UiComp;
export declare const MenubarGroup: UiForward | UiComp;
export declare const MenubarItem: UiForward | UiComp;
export declare const MenubarLabel: UiForward | UiComp;
export declare const MenubarMenu: UiForward | UiComp;
export declare const MenubarPortal: UiForward | UiComp;
export declare const MenubarRadioGroup: UiForward | UiComp;
export declare const MenubarRadioItem: UiForward | UiComp;
export declare const MenubarSeparator: UiForward | UiComp;
export declare const MenubarShortcut: UiForward | UiComp;
export declare const MenubarSub: UiForward | UiComp;
export declare const MenubarSubContent: UiForward | UiComp;
export declare const MenubarSubTrigger: UiForward | UiComp;
export declare const MenubarTrigger: UiForward | UiComp;
