import { ModelType } from "./Types";
import { find } from "lodash";
import uniqid from "uniqid";
const uniqid = require("uniqid");
/*
 * The Formula class
 */
class Formula {
  id = uniqid();
  // Label
  label;
  // Original formula string
  formulaString;
  // Holds formula template (tags replaced by unique identifiers)
  formulaTemplate;
  // Array holding all tags
  tags: { tag: string; identifier: string }[] = [];
  // Array holding all dependencies
  dependencies: { field: string; model: string; localDependency?: true }[] = [];
  // Hold all models
  models: ModelType[];
  // Promise to check if constructor is done working asynchronously
  onParsed: Promise<void>;

  // Constructor
  constructor(
    formula,
    startingModelKey: string,
    label?: string,
    mode: "{{" | "[[" = "{{", // This is for nested formulas, such as templates
    models?: ModelType[] // Some data may be statically delivered in JSON format. Then we don't need this. If we have dynamic (field__r) data we need to query the database and parse the correct dependencies.
  ) {
    this.formulaString = formula;
    this.formulaTemplate = formula;
    this.models = models;
    this.label = label;

    // Pre-parse tags
    const tagPattern =
      mode === "[["
        ? new RegExp(/\[\[\s*(?<var>.*?)\s*\]\]/gm)
        : new RegExp(/{{\s*(?<var>.*?)\s*}}/gm);
    [...this.formulaString.matchAll(tagPattern)].map((match) => {
      const varName = uniqid();
      this.tags.push({ tag: match.groups.var, identifier: varName });
      this.formulaTemplate = this.formulaTemplate.replace(
        match[0],
        `$___${varName}___$`
      );
    });

    // Parse dependencies
    this.onParsed = new Promise((resolve, reject) =>
      this.parseDependencies(startingModelKey).then(
        () => resolve(),
        (reason) =>
          reject(`(${label}) couldn't process dependencies: ${reason}`)
      )
    );
  }

  // Parse dependencies for all tags (asynchronously used in )
  parseDependencies = (startModelKey: string) =>
    new Promise<void>(async (resolve, reject) => {
      //@ts-ignore
      await this.tags.reduce(async (prevTag, tag) => {
        await prevTag;

        const tagParts = tag.tag.split(/[-+*\/](?![^\(]*\))/gm);
        //@ts-ignore
        await tagParts.reduce(async (prevTagPart, tagPart) => {
          // The regexp splits on -, but not within parenthesis
          const part = tagPart.trim();

          // Check the context of the tag part and perform the appropriate action
          if (part.match(/\w*\(.+\)/)) {
            // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
            const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(
              part
            );
            console.log("Preprocessing", func.groups.fName, func.groups.fArgs);
          } else if (part.match(/\./)) {
            if (part.match("__r")) {
              // This is an object based relationship. Resolve the dependencies
              if (this.models) {
                // We're going to split by . and resolve them all to set a dependency.
                const tagParts = part.split(".");
                let currentModelKey = startModelKey;
                //@ts-ignore
                await tagParts.reduce(async (prevPart, currPart) => {
                  await prevPart;

                  if (currPart.match("__r")) {
                    const fieldName = currPart.replace("__r", "");

                    // This is a part of the relationship. It needs to be registered as dependency, in case it's value changes.
                    this.dependencies.push({
                      model: currentModelKey,
                      field: fieldName,
                      ...(currentModelKey === startModelKey
                        ? { localDependency: true }
                        : {}),
                    });
                    // It also needs to be parsed to figure out what model the next
                    const currentModel = find(
                      this.models,
                      (o) => o.key === currentModelKey
                    );
                    const field = currentModel.fields[fieldName];
                    currentModelKey = field.relationshipTo;
                  } else {
                    this.dependencies.push({
                      model: currentModelKey,
                      field: currPart,
                    });
                  }

                  return currPart;
                }, tagParts[0]);
                resolve();
              } else {
                reject("no-models-provided");
              }
            } else {
              // This is a regular dependency (a.b.c), so we can just add it as a field
              this.dependencies.push({
                field: part,
                model: startModelKey,
                localDependency: true,
              });
            }
          } else {
            this.dependencies.push({
              field: part,
              model: startModelKey,
              localDependency: true,
            });
          }
        }, tagParts[0]);

        return tag;
      }, this.tags[0]);

      resolve();
    });
}

export default Formula;
