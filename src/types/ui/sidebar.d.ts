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

export declare const Sidebar: UiForward | UiComp;
export declare const SidebarContent: UiForward | UiComp;
export declare const SidebarFooter: UiForward | UiComp;
export declare const SidebarGroup: UiForward | UiComp;
export declare const SidebarGroupAction: UiForward | UiComp;
export declare const SidebarGroupContent: UiForward | UiComp;
export declare const SidebarGroupLabel: UiForward | UiComp;
export declare const SidebarHeader: UiForward | UiComp;
export declare const SidebarInput: UiForward | UiComp;
export declare const SidebarInset: UiForward | UiComp;
export declare const SidebarMenu: UiForward | UiComp;
export declare const SidebarMenuAction: UiForward | UiComp;
export declare const SidebarMenuBadge: UiForward | UiComp;
export declare const SidebarMenuButton: UiForward | UiComp;
export declare const SidebarMenuItem: UiForward | UiComp;
export declare const SidebarMenuSkeleton: UiForward | UiComp;
export declare const SidebarMenuSub: UiForward | UiComp;
export declare const SidebarMenuSubButton: UiForward | UiComp;
export declare const SidebarMenuSubItem: UiForward | UiComp;
export declare const SidebarProvider: UiForward | UiComp;
export declare const SidebarRail: UiForward | UiComp;
export declare const SidebarSeparator: UiForward | UiComp;
export declare const SidebarTrigger: UiForward | UiComp;
export declare const useSidebar: UiForward | UiComp;
