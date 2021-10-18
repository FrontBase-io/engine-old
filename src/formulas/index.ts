import { DBCollectionsType, ModelType } from "./Types";
import { find, reject } from "lodash";
import uniqid from "uniqid";
import { ObjectID } from "mongodb";
const uniqid = require("uniqid");
import functions from "./Functions";

const systemVars = { _TODAY: new Date() };

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
  // Start model key
  startingModelKey;
  // Promise to check if constructor is done working asynchronously
  onParsed: Promise<void>;
  // If this is a parsed formula field, we'll register what the model of origin is
  modelOfOrigin;
  formulaFieldName;
  // Data
  data;

  // Constructor
  constructor(
    formula,
    startingModelKey: string,
    label?: string,
    mode: "{{" | "[[" = "{{", // This is for nested formulas, such as templates
    models?: ModelType[], // Some data may be statically delivered in JSON format. Then we don't need this. If we have dynamic (field__r) data we need to query the database and parse the correct dependencies.
    modelFieldName?: string // This is required for remote formulas to see what field to update
  ) {
    this.formulaString = formula;
    this.formulaTemplate = formula;
    this.models = models;
    this.label = label;
    this.modelOfOrigin = startingModelKey;
    this.formulaFieldName = modelFieldName;
    this.startingModelKey = startingModelKey;

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
      this.parseDependencies().then(
        () => resolve(),
        (reason) =>
          reject(`(${label}) couldn't process dependencies: ${reason}`)
      )
    );
  }

  // Parse dependencies for all tags
  parseDependencies = () =>
    new Promise<void>(async (resolve, reject) => {
      //@ts-ignore
      await this.tags.reduce(async (prevTag, tag) => {
        await prevTag;

        const tagParts = tag.tag.split(/[-+*\/](?![^\(]*\))/gm);
        //@ts-ignore
        await tagParts.reduce(async (prevTagPart, tagPart) => {
          await prevTagPart;
          // The regexp splits on -, but not within parenthesis
          const part = tagPart.trim();
          return await this.processDependency(part);
        }, tagParts[0]);

        return tag;
      }, this.tags[0]);

      resolve();
    });

  // Takes a string (dependency) and parses it in the correct manner, depending on it's type
  processDependency(part: string) {
    return new Promise<void>(async (resolve, reject) => {
      // Check the context of the tag part and perform the appropriate action
      if (part.match(/\w*\(.+\)/)) {
        // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
        const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(part);
        await this.preprocessFunction(func.groups.fName, func.groups.fArgs);
        resolve();
      } else if (part.match(/\./)) {
        if (part.match("__r")) {
          // This is an object based relationship. Resolve the dependencies
          if (this.models) {
            // We're going to split by . and resolve them all to set a dependency.
            const tagParts = part.split(".");
            let currentModelKey = this.startingModelKey;
            //@ts-ignore
            await tagParts.reduce(async (prevPart, currPart) => {
              await prevPart;

              if (currPart.match("__r")) {
                const fieldName = currPart.replace("__r", "");

                // This is a part of the relationship. It needs to be registered as dependency, in case it's value changes.
                if (Object.keys(systemVars).includes(fieldName)) {
                  this.dependencies.push({ model: "SYSTEM", field: fieldName });
                } else {
                  this.dependencies.push({
                    model: currentModelKey,
                    field: fieldName,
                    ...(currentModelKey === this.startingModelKey
                      ? { localDependency: true }
                      : {}),
                  });
                }
                // It also needs to be parsed to figure out what model the next
                const currentModel = find(
                  this.models,
                  (o) => o.key === currentModelKey
                );
                const field = currentModel.fields[fieldName];
                currentModelKey = field.relationshipTo;
              } else {
                if (Object.keys(systemVars).includes(currPart)) {
                  this.dependencies.push({
                    model: "SYSTEM",
                    field: currPart,
                  });
                } else {
                  this.dependencies.push({
                    model: currentModelKey,
                    field: currPart,
                  });
                }
              }

              return currPart;
            }, tagParts[0]);
            resolve();
          } else {
            reject("no-models-provided");
          }
        } else {
          // This is a regular dependency (a.b.c), so we can just add it as a field
          if (Object.keys(systemVars).includes(part)) {
            this.dependencies.push({ model: "SYSTEM", field: part });
          } else {
            this.dependencies.push({
              field: part,
              model: this.startingModelKey,
              localDependency: true,
            });
          }
          resolve();
        }
      } else {
        if (Object.keys(systemVars).includes(part)) {
          this.dependencies.push({ model: "SYSTEM", field: part });
        } else {
          this.dependencies.push({
            field: part,
            model: this.startingModelKey,
            localDependency: true,
          });
        }
        resolve();
      }
    });
  }

  // Pre-process a function
  // -> Runs the func's preprocess call and returns it's dependencies
  preprocessFunction = (fName, fArgs) =>
    new Promise<[]>(async (resolve) => {
      // Step 1, process arguments
      // --> Split arguments based on comma
      const fArguments = fArgs.split(
        /,(?!(?=[^"]*"[^"]*(?:"[^"]*"[^"]*)*$))(?![^\(]*\))(?![^\[]*\])(?![^\{]*\})/gm
      ); // Splits commas, except when they're in brackets or apostrophes
      const functionArguments = [];
      // Loop through arguments (async) and if they are a function themselves, preprocess those first.
      await fArguments.reduce(async (prev, curr) => {
        await prev;
        const variable = curr.trim();
        if (variable.match(/\w*\(.+\)/)) {
          // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
          const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(curr);
          const projectedResult = await this.preprocessFunction(
            func.groups.fName,
            func.groups.fArgs
          );
          functionArguments.push(projectedResult);
        } else {
          if (variable.charAt(0) === '"' || variable.charAt(0) === "'") {
            // This is a "string"
            functionArguments.push({
              str: variable.replace(/^['"]/g, "").replace(/['"]$/g, ""),
            });
          } else if (isNaN(variable.charAt(0))) {
            // This is not a number, therefore a variable
            functionArguments.push(variable);
          } else {
            // This is a number, therefore a simple number
            functionArguments.push({ number: parseInt(variable) });
          }
        }
        return true;
      }, fArguments[0]);

      // Step 2: we now have all the arguments, preprocess the function
      if (functions[fName]) {
        const f = new functions[fName](functionArguments);
        f.dependencies.map((d) => this.processDependency(d));
        resolve(f.returnPreview);
      } else {
        reject(`unknown-function-${fName}`);
      }
    });

  // Parse the formula
  // Uses all the information available to parse the formula to a value
  parse = (data: { [key: string]: any }, collections?: DBCollectionsType) =>
    new Promise(async (resolve, reject) => {
      this.data = data;
      let parsedFormula = this.formulaTemplate;
      console.log(`🧪 Parsing ${this.label}...`);

      //@ts-ignore
      await this.tags.reduce(async (prevTag, currTag) => {
        await prevTag;

        if (currTag.tag.match(/\w*\(.+\)/)) {
          // Process the function (possible recurring)
          const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(
            currTag.tag
          );
          parsedFormula = parsedFormula.replace(
            `$___${currTag.identifier}___$`,
            await this.processFunction(func.groups.fName, func.groups.fArgs)
          );
        } else if (currTag.tag.match("\\.")) {
          if (currTag.tag.match("__r")) {
            if (collections) {
              const tagParts = currTag.tag.split(".");
              let currentObject = data;
              // @ts-ignore
              await tagParts.reduce(async (prevTagPart, currTagPart) => {
                await prevTagPart;

                if (currTagPart.match("__r")) {
                  const objectKey = currTagPart.replace("__r", "");
                  currentObject = await collections.objects.findOne({
                    _id: new ObjectID(currentObject[objectKey]),
                  });
                } else {
                  // Final part of the relationship,
                  parsedFormula = parsedFormula.replace(
                    `$___${currTag.identifier}___$`,
                    currentObject[currTagPart]
                  );
                }

                return currTagPart;
              }, tagParts[0]);
            } else {
              reject("remote-relationship-no-db-provided");
            }
          } else {
            // Log this is a non-dynamic remote relationship (the data has been provided)
            console.log("Todo: non dynamic remote");
          }
        } else {
          // Local dependency
          parsedFormula = parsedFormula.replace(
            `$___${currTag.identifier}___$`,
            data[currTag.tag]
          );
        }

        return currTag;
      }, this.tags[0]);
      resolve(parsedFormula);
    });

  // Process function
  processFunction = (fName, fArgs) =>
    new Promise(async (resolve, reject) => {
      // Step 1, process arguments
      // --> Split arguments based on comma
      const fArguments = fArgs.split(
        /,(?!(?=[^"]*"[^"]*(?:"[^"]*"[^"]*)*$))(?![^\(]*\))(?![^\[]*\])(?![^\{]*\})/gm
      ); // Splits commas, except when they're in brackets or apostrophes
      const functionArguments = [];
      // Loop through arguments (async) and if they are a function themselves, preprocess those first.
      await fArguments.reduce(async (prev, curr) => {
        await prev;
        const variable = curr.trim();
        if (variable.match(/\w*\(.+\)/)) {
          // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
          const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(curr);
          functionArguments.push(
            await this.processFunction(func.groups.fName, func.groups.fArgs)
          );
        } else {
          if (variable.charAt(0) === '"' || variable.charAt(0) === "'") {
            // This is a "string"
            functionArguments.push({
              str: variable.replace(/^['"]/g, "").replace(/['"]$/g, ""),
            });
          } else if (isNaN(variable.charAt(0))) {
            // This is not a number, therefore a variable
            functionArguments.push(variable);
          } else {
            // This is a number, therefore a simple number
            functionArguments.push({ number: parseInt(variable) });
          }
        }
        return true;
      }, fArguments[0]);

      // Map system vars to actual variables
      functionArguments.map((fa, faIndex) => {
        if (Object.keys(systemVars).includes(fa)) {
          functionArguments[faIndex] = systemVars[fa];
        } else {
          functionArguments[faIndex] = this.data[fa];
        }
      });

      // Step 2: process function
      if (functions[fName]) {
        const f = new functions[fName](functionArguments);
        resolve(await f.resolve());
      } else {
        reject(`unknown-function-${fName}`);
      }
    });
}

export default Formula;
