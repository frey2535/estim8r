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

export declare const AlertDialog: UiForward | UiComp;
export declare const AlertDialogAction: UiForward | UiComp;
export declare const AlertDialogCancel: UiForward | UiComp;
export declare const AlertDialogContent: UiForward | UiComp;
export declare const AlertDialogDescription: UiForward | UiComp;
export declare const AlertDialogFooter: UiForward | UiComp;
export declare const AlertDialogHeader: UiForward | UiComp;
export declare const AlertDialogOverlay: UiForward | UiComp;
export declare const AlertDialogPortal: UiForward | UiComp;
export declare const AlertDialogTitle: UiForward | UiComp;
export declare const AlertDialogTrigger: UiForward | UiComp;
