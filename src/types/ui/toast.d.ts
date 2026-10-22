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

export declare const Toast: UiForward | UiComp;
export declare const ToastAction: UiForward | UiComp;
export declare const ToastClose: UiForward | UiComp;
export declare const ToastDescription: UiForward | UiComp;
export declare const ToastProvider: UiForward | UiComp;
export declare const ToastTitle: UiForward | UiComp;
export declare const ToastViewport: UiForward | UiComp;
