import { Collection } from "mongodb";

/* Server technical types */
export interface DBCollectionsType {
  models: Collection;
  objects: Collection;
  usersettings: Collection;
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
  type?: "text" | "number" | "relationship" | "formula" | "options";
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
