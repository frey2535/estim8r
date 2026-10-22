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

export declare const Dialog: UiForward | UiComp;
export declare const DialogClose: UiForward | UiComp;
export declare const DialogContent: UiForward | UiComp;
export declare const DialogDescription: UiForward | UiComp;
export declare const DialogFooter: UiForward | UiComp;
export declare const DialogHeader: UiForward | UiComp;
export declare const DialogOverlay: UiForward | UiComp;
export declare const DialogPortal: UiForward | UiComp;
export declare const DialogTitle: UiForward | UiComp;
export declare const DialogTrigger: UiForward | UiComp;
