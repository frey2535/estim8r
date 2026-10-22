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

export declare const Drawer: UiForward | UiComp;
export declare const DrawerClose: UiForward | UiComp;
export declare const DrawerContent: UiForward | UiComp;
export declare const DrawerDescription: UiForward | UiComp;
export declare const DrawerFooter: UiForward | UiComp;
export declare const DrawerHeader: UiForward | UiComp;
export declare const DrawerOverlay: UiForward | UiComp;
export declare const DrawerPortal: UiForward | UiComp;
export declare const DrawerTitle: UiForward | UiComp;
export declare const DrawerTrigger: UiForward | UiComp;
