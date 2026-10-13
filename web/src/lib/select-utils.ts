import * as React from "react";
import { getReactNodeText } from "./utils";

export const selectItemCache = new Map<
  string,
  { label: React.ReactNode; text: string }
>();

export function registerSelectLabels(items: Record<string, React.ReactNode>) {
  for (const [key, label] of Object.entries(items)) {
    const text = typeof label === "string" ? label : getReactNodeText(label);
    selectItemCache.set(key, { label, text });
  }
}

export function extractItemsFromChildren(
  children: React.ReactNode,
  map = new Map<string, { label: React.ReactNode; text: string }>(),
): Map<string, { label: React.ReactNode; text: string }> {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    const props = child.props as Record<string, any> | undefined;
    if (props) {
      if (typeof props.value === "string") {
        const label =
          props.textValue !== undefined ? props.textValue : props.children;
        const text =
          props.textValue !== undefined
            ? props.textValue
            : typeof props.children === "string"
              ? props.children
              : getReactNodeText(props.children);
        map.set(props.value, { label, text });
      }

      if (props.children) {
        extractItemsFromChildren(props.children, map);
      }
    }
  });
  return map;
}
