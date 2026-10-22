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

export declare const ChartContainer: UiForward | UiComp;
export declare const ChartLegend: UiForward | UiComp;
export declare const ChartLegendContent: UiForward | UiComp;
export declare const ChartStyle: UiForward | UiComp;
export declare const ChartTooltip: UiForward | UiComp;
export declare const ChartTooltipContent: UiForward | UiComp;
