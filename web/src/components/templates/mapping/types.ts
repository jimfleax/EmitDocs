export type TextTransformMode =
  "none" | "uppercase" | "lowercase" | "capitalize";

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

export interface TemplateData {
  _id: string;
  name: string;
  ownerId: string;
  currentVersionId: string;
  createdAt: string;
}
