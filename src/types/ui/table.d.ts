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

export declare const Table: UiForward | UiComp;
export declare const TableBody: UiForward | UiComp;
export declare const TableCaption: UiForward | UiComp;
export declare const TableCell: UiForward | UiComp;
export declare const TableFooter: UiForward | UiComp;
export declare const TableHead: UiForward | UiComp;
export declare const TableHeader: UiForward | UiComp;
export declare const TableRow: UiForward | UiComp;
