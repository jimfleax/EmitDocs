/**
 * @file utils.ts
 * @description Core UI and React DOM utility functions for styling and text extraction.
 * @architecture Shared utility layer used across all UI components, selects, and toast systems.
 */

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @desc Merges Tailwind CSS class names with clsx and tailwind-merge to avoid conflicts.
 * @param {...ClassValue} inputs - Class values, objects, or arrays to merge.
 * @returns {string} Merged single className string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @desc Recursively extracts raw plain text content from a ReactNode tree.
 * @param {React.ReactNode} node - React element, text, fragment, or array of nodes.
 * @returns {string} Flattened string representation of the node content.
 */
export function getReactNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getReactNodeText).join("");
  }
  if (React.isValidElement(node)) {
    return getReactNodeText(
      (node.props as { children?: React.ReactNode })?.children,
    );
  }
  return "";
}
