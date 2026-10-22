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

export declare const reducer: UiFn;
export declare const toast: (props: Record<string, unknown>) => { id: string; dismiss: () => void; update: (p: Record<string, unknown>) => void };
export declare function useToast(): {
  toast: (props: Record<string, unknown>) => { id: string; dismiss: () => void; update: (p: Record<string, unknown>) => void };
  dismiss: (id?: string) => void;
  toasts: unknown[];
};
