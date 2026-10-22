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

export declare const Select: UiForward | UiComp;
export declare const SelectContent: UiForward | UiComp;
export declare const SelectGroup: UiForward | UiComp;
export declare const SelectItem: UiForward | UiComp;
export declare const SelectLabel: UiForward | UiComp;
export declare const SelectScrollDownButton: UiForward | UiComp;
export declare const SelectScrollUpButton: UiForward | UiComp;
export declare const SelectSeparator: UiForward | UiComp;
export declare const SelectTrigger: UiForward | UiComp;
export declare const SelectValue: UiForward | UiComp;
