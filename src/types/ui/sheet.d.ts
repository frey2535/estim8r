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

export declare const Sheet: UiForward | UiComp;
export declare const SheetClose: UiForward | UiComp;
export declare const SheetContent: UiForward | UiComp;
export declare const SheetDescription: UiForward | UiComp;
export declare const SheetFooter: UiForward | UiComp;
export declare const SheetHeader: UiForward | UiComp;
export declare const SheetOverlay: UiForward | UiComp;
export declare const SheetPortal: UiForward | UiComp;
export declare const SheetTitle: UiForward | UiComp;
export declare const SheetTrigger: UiForward | UiComp;
