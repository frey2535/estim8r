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

export declare const Breadcrumb: UiForward | UiComp;
export declare const BreadcrumbEllipsis: UiForward | UiComp;
export declare const BreadcrumbItem: UiForward | UiComp;
export declare const BreadcrumbLink: UiForward | UiComp;
export declare const BreadcrumbList: UiForward | UiComp;
export declare const BreadcrumbPage: UiForward | UiComp;
export declare const BreadcrumbSeparator: UiForward | UiComp;
