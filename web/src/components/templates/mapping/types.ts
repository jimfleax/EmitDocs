/**
 * @file types.ts
 * @description Type definitions for PDF template field mappings, template version models, and transformation modes.
 * @architecture Shared contract types for visual field mapping, layout persistence, and canvas rendering.
 * @agent_note Used across xyflow canvas nodes, toolbars, and inspector panels to coordinate coordinates, styling, and font configuration.
 */

/**
 * Text casing transformation mode applied during PDF rendering.
 */
export type TextTransformMode =
  "none" | "uppercase" | "lowercase" | "capitalize";

/**
 * Visual field mapping contract defining position, typography, styling, and format rules on a template page.
 */
export interface IFieldMapping {
  id: string;
  key: string;
  label?: string;
  type: "text" | "date" | "number";
  pageIndex: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  alignment: "left" | "center" | "right";
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  maxFontSize: number;
  color: string;
  fitMode: "shrink-to-fit" | "fixed" | "multi-line";
  maskMode: "none" | "solid-white" | "custom-color" | "acroform-field";
  maskColor?: string;
  customFontBytes?: string;
  customFontUrl?: string;
  lineHeight?: number;
  format?: string;
  sampleValue?: string;
  textTransform?: TextTransformMode;
}

/**
 * Version model capturing persisted template page geometry, status, and field mappings.
 */
export interface TemplateVersionData {
  _id: string;
  templateId: string;
  version: number;
  sourceObjectKey: string;
  bytes: number;
  pageCount: number;
  status: "draft" | "active" | "superseded";
  fieldMappings: IFieldMapping[];
  mappingHash: string | null;
  createdAt: string;
}

/**
 * Root template entity reference.
 */
export interface TemplateData {
  _id: string;
  name: string;
  ownerId: string;
  currentVersionId: string;
  createdAt: string;
}

