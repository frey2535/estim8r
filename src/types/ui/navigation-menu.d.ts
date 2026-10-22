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

export declare const NavigationMenu: UiForward | UiComp;
export declare const NavigationMenuContent: UiForward | UiComp;
export declare const NavigationMenuIndicator: UiForward | UiComp;
export declare const NavigationMenuItem: UiForward | UiComp;
export declare const NavigationMenuLink: UiForward | UiComp;
export declare const NavigationMenuList: UiForward | UiComp;
export declare const NavigationMenuTrigger: UiForward | UiComp;
export declare const NavigationMenuViewport: UiForward | UiComp;
export declare const navigationMenuTriggerStyle: UiForward | UiComp;
