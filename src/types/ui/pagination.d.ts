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

export declare const Pagination: UiForward | UiComp;
export declare const PaginationContent: UiForward | UiComp;
export declare const PaginationEllipsis: UiForward | UiComp;
export declare const PaginationItem: UiForward | UiComp;
export declare const PaginationLink: UiForward | UiComp;
export declare const PaginationNext: UiForward | UiComp;
export declare const PaginationPrevious: UiForward | UiComp;
