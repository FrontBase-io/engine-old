import { Collection } from "mongodb";

/* Server technical types */
export interface DBCollectionsType {
  models: Collection;
  objects: Collection;
  usersettings: Collection;
  systemsettings: Collection;
}

/* Model */
export interface ModelType {
  _id: string;
  key: string;
  key_plural: string;
  label: string;
  label_plural: string;
  app: string;
  primary: string;
  icon: string;
  locked?: boolean;
  fields: { [key: string]: ModelFieldType };
  layouts: { [key: string]: ModelLayoutType };
  lists: { [key: string]: ModelListType };
  permissions: {
    create: string[];
    read: string[];
    read_own: string[];
    update: string[];
    update_own: string[];
    delete: string[];
    delete_own: string[];
  };
}

// Field
export interface ModelFieldType {
  label: string;
  type?:
    | "text"
    | "number"
    | "relationship"
    | "relationship_m"
    | "formula"
    | "options"
    | "date"
    | "free-data"
    | "color"
    | "image"
    | "file"
    | "boolean";
  required?: boolean;
  unique?: boolean;
  // Options
  selectMultiple?: boolean;
  optionsDisplayAs?: "dropdown" | "list" | string;
  options?: { label: string; value: string }[];
  // Relationship
  relationshipTo?: string;
  // Formula
  formula?: string;
}

// Layout
export interface ModelLayoutType {
  label: string;
  layout: LayoutItemType[];
}
export interface LayoutItemType {
  key?: string;
  label: string;
  type: string;
  items?: LayoutItemType[];
  args?: { [key: string]: any };
}

// List
export interface ModelListType {
  label?: string;
  filter?: {};
  fields?: string[];
}

/* Object types */
export interface ObjectType {
  _id: string;
  meta: {
    model: string;
    createdOn: Date;
    lastModifiedOn: Date;
    createdBy: string;
    lastModifiedBy: string;
    owner: string;
    team?: string;
  };
  [key: string]: any;
}

export interface UserObjectType extends ObjectType {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  roles: string[];
}

// Processes
export interface ProcessObjectType extends ObjectType {
  name: string;
  description: string;
  logic: ProcesLogicStepItemType[];
  variables?: { [key: string]: ProcessVariableType };
  triggers?: ProcessTriggersType;
}

export interface ProcesLogicStepItemType {
  id: string;
  type: string;
  data: {
    type: string;
    label: string;
    args: {
      // Update
      toUpdate?: string[];
    };
  };
  position: { x: number; y: number };
}

export interface ProcessVariableType {
  label: string;
  type: string;
  recordModel?: string;
  isInput?: boolean;
  isOutput?: boolean;
}
export interface ProcessTriggerType {
  label: string;
  // Change
  modelKey?: string;
  fields?: string[];
  oldObject?: string;
  newObject?: string;
  output?: string;
  operations?: string[];
  // Action
  input?: string;
  // Time
  trigger?: string;
  customTrigger?: string;
}

export interface ProcessTriggersType {
  beforeChange?: ProcessTriggerType[];
  afterChange?: ProcessTriggerType[];
  time?: ProcessTriggerType[];
  globalAction?: ProcessTriggerType[];
  singleAction?: ProcessTriggerType;
  manyAction?: ProcessTriggerType[];
}
