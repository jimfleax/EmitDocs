/**
 * @file select-utils.ts
 * @description Helper functions and cache for Radix Select components and label resolution.
 * @architecture Supports the custom Select component by maintaining label/text lookups for complex option trees.
 */

import * as React from "react";
import { getReactNodeText } from "./utils";

export const selectItemCache = new Map<
  string,
  { label: React.ReactNode; text: string }
>();

/**
 * @desc Registers static or computed display labels for select item keys into cache.
 * @param {Record<string, React.ReactNode>} items - Dictionary of select values to React nodes.
 */
export function registerSelectLabels(items: Record<string, React.ReactNode>) {
  for (const [key, label] of Object.entries(items)) {
    const text = typeof label === "string" ? label : getReactNodeText(label);
    selectItemCache.set(key, { label, text });
  }
}

/**
 * @desc Recursively traverses React child elements to extract values, nodes, and plain text for SelectItems.
 * @param {React.ReactNode} children - Component children to inspect.
 * @param {Map<string, { label: React.ReactNode; text: string }>} [map] - Accumulator map.
 * @returns {Map<string, { label: React.ReactNode; text: string }>} Map of values to label objects.
 */
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
