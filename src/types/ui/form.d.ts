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

export declare const Form: UiForward | UiComp;
export declare const FormControl: UiForward | UiComp;
export declare const FormDescription: UiForward | UiComp;
export declare const FormField: UiForward | UiComp;
export declare const FormItem: UiForward | UiComp;
export declare const FormLabel: UiForward | UiComp;
export declare const FormMessage: UiForward | UiComp;
export declare const useFormField: UiForward | UiComp;
