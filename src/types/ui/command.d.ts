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

export declare const Command: UiForward | UiComp;
export declare const CommandDialog: UiForward | UiComp;
export declare const CommandEmpty: UiForward | UiComp;
export declare const CommandGroup: UiForward | UiComp;
export declare const CommandInput: UiForward | UiComp;
export declare const CommandItem: UiForward | UiComp;
export declare const CommandList: UiForward | UiComp;
export declare const CommandSeparator: UiForward | UiComp;
export declare const CommandShortcut: UiForward | UiComp;
