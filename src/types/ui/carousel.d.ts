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

export declare const Carousel: UiForward | UiComp;
export declare const CarouselContent: UiForward | UiComp;
export declare const CarouselItem: UiForward | UiComp;
export declare const CarouselNext: UiForward | UiComp;
export declare const CarouselPrevious: UiForward | UiComp;
