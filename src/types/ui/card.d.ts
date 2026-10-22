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

export declare const Card: UiForward | UiComp;
export declare const CardContent: UiForward | UiComp;
export declare const CardDescription: UiForward | UiComp;
export declare const CardFooter: UiForward | UiComp;
export declare const CardHeader: UiForward | UiComp;
export declare const CardTitle: UiForward | UiComp;
