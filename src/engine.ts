import { map } from "lodash";
import Formula from "frontbase-formulas";
import { DBCollectionsType, ModelType } from "./Utils/Types";
const { MongoClient } = require("mongodb");
require("dotenv").config();
import { ProcessObjectType, ProcessTriggerType } from "./Types";
import { Process, Interactor } from "frontbase-server-utils";
var cron = require("node-cron");

interface TriggerType {
  type: "formula" | "process";
  id: string;

  // Formula
  isLocal?: boolean;

  // Process
  trigger?: ProcessTriggerType;
}

class Engine {
  // The database
  db;
  // Collections
  collections: DBCollectionsType = {
    models: null,
    objects: null,
    usersettings: null,
  };
  // All models
  models: ModelType[];
  // Update triggers
  updateTriggers: { [key: string]: TriggerType[] } = {};
  // Time triggers
  timeTriggers: { [cron: string]: TriggerType[] } = {};
  // ProcessMap
  processMap: { [id: string]: Process } = {};
  // Formula map (id => formula)
  formulaMap = {};

  // Initialise
  constructor(db) {
    this.db = db;
    this.collections = {
      models: db.collection("models"),
      objects: db.collection("objects"),
      usersettings: db.collection("usersettings"),
    };
    this.collections.models
      .find({})
      .toArray()
      .then((models: ModelType[]) => (this.models = models));
    console.log("Engine booting up");
  }

  // Parse formulas
  async parseFormulas() {
    console.log("Parsing formulas");
    const models = await this.collections.models.find({}).toArray();
    await models.reduce(async (prevModel, model) => {
      await prevModel;

      map(model.fields, (field, key) => {
        if (field.type === "formula") {
          console.log(`🧪 Parsing formula '${model.label} -> ${field.label}'.`);
          const formula = new Formula(
            field.formula,
            model.key,
            `🧪 ${model.label} -> ${field.label}`,
            "{{",
            this.models,
            key
          );
          formula.onParsed.then(() => {
            formula.dependencies.map((dep) => {
              if (!this.updateTriggers[`${dep.model}___${dep.field}`])
                this.updateTriggers[`${dep.model}___${dep.field}`] = [];
              this.updateTriggers[`${dep.model}___${dep.field}`].push({
                type: "formula",
                isLocal: dep.localDependency || false,
                id: formula.id,
              });
            });
            this.formulaMap[formula.id] = formula;
          });
        }
      });
      return model;
    }, models[0]);
    console.log("🥼 Done parsing formulas");
    this.registerOnObjectChangeListeners();
    this.registerTimeTriggers();
  }

  // This function watches the objects collection and fires the appropriate trigger
  // Todo:
  /// Formulas:
  //// Congregate all object changes into a single datase query; right now it updates every field seperately
  registerOnObjectChangeListeners() {
    this.collections.objects
      .watch([], { fullDocument: "updateLookup" }) // fullDocument: updateLookup sends the entire object along with the change event
      .on("change", async (change) => {
        if (change.operationType === "update") {
          let triggersFired: TriggerType[] = [];
          map(change.updateDescription.updatedFields, (_, newKey) => {
            const updateKey = `${change.fullDocument.meta.model}___${newKey}`;
            (this.updateTriggers[updateKey] || []).map((updateToTrigger) => {
              if (!triggersFired.includes(updateToTrigger)) {
                triggersFired.push(updateToTrigger);
              }
            });
          });

          // Fire events
          triggersFired.map(async (trigger) => {
            if (trigger.type === "formula") {
              // Update action
              const formula: Formula = this.formulaMap[trigger.id];
              console.log(`Formula fired: ${formula.label}`);

              if (trigger.isLocal) {
                formula
                  .parse(change.fullDocument, this.collections)
                  .then((parsedFormula) => {
                    console.log(
                      `🧪 ${formula.label} resolved to ${parsedFormula}`
                    );

                    this.collections.objects.updateOne(
                      { _id: change.fullDocument._id },
                      {
                        $set: { [formula.formulaFieldName]: parsedFormula },
                      }
                    );
                  });
              } else {
                // Foreign trigger
                // Since this formula applies to a foreign object relationship, find all objects of that model and parse.
                // Todo: this can be made more effecient by precalculating only the affected objects and then only parse those.
                const objectList = await this.collections.objects
                  .find({
                    "meta.model": formula.modelOfOrigin,
                  })
                  .toArray();
                objectList.map((object) => {
                  formula
                    .parse(object, this.collections)
                    .then((parsedFormula) => {
                      // If the value has changed, update it
                      if (object[formula.formulaFieldName] !== parsedFormula) {
                        object[formula.formulaFieldName] = parsedFormula;
                        this.collections.objects.updateOne(
                          { _id: object._id },
                          {
                            $set: { [formula.formulaFieldName]: parsedFormula },
                          }
                        );
                      }
                    });
                });
              }
            }
          });
        } else if (change.operationType === "insert") {
          // Insert action
          let triggersFired: TriggerType[] = [];
          map(change.fullDocument, (_, newKey) => {
            const updateKey = `${change.fullDocument.meta.model}___${newKey}`;
            (this.updateTriggers[updateKey] || []).map((updateToTrigger) => {
              if (!triggersFired.includes(updateToTrigger)) {
                triggersFired.push(updateToTrigger);
              }
            });
          });

          // Fire events
          triggersFired.map(async (trigger) => {
            if (trigger.type === "formula") {
              const formula: Formula = this.formulaMap[trigger.id];
              console.log(`Formula fired: ${formula.label}`);

              if (trigger.isLocal) {
                formula
                  .parse(change.fullDocument, this.collections)
                  .then((parsedFormula) => {
                    console.log("🧪 Formula parsed", parsedFormula);

                    this.collections.objects.updateOne(
                      { _id: change.fullDocument._id },
                      {
                        $set: { [formula.formulaFieldName]: parsedFormula },
                      }
                    );
                  });
              } else {
                // Foreign trigger
                // Since this formula applies to a foreign object relationship, find all objects of that model and parse.
                // Todo: this can be made more effecient by precalculating only the affected objects and then only parse those.
                const objectList = await this.collections.objects
                  .find({
                    "meta.model": formula.modelOfOrigin,
                  })
                  .toArray();
                objectList.map((object) => {
                  formula
                    .parse(object, this.collections)
                    .then((parsedFormula) => {
                      // If the value has changed, update it
                      if (object[formula.formulaFieldName] !== parsedFormula) {
                        object[formula.formulaFieldName] = parsedFormula;
                        this.collections.objects.updateOne(
                          { _id: object._id },
                          {
                            $set: { [formula.formulaFieldName]: parsedFormula },
                          }
                        );
                      }
                    });
                });
              }
            }
          });
        }
      });
  }

  // Register time based processes
  async registerTimeTriggers() {
    const processes = (await this.collections.objects
      .find({
        "meta.model": "process",
      })
      .toArray()) as ProcessObjectType[];

    // The engine interactor is a fake version of the server interactor. It operates at a higher level of permissions.
    const engineInteractor = new Interactor(null, this.db, true);

    const newTriggers: { [cron: string]: TriggerType[] } = {};

    processes.map((processObject) => {
      if (processObject.triggers.time) {
        // Create the process

        this.processMap[processObject._id.toString()] = new Process(
          processObject,
          engineInteractor
        );

        // Triggers
        (processObject.triggers.time || []).map((trigger) => {
          const timeTrigger =
            trigger.trigger === "cron"
              ? trigger.customTrigger
              : trigger.trigger;

          newTriggers[timeTrigger] = newTriggers[timeTrigger] || [];
          newTriggers[timeTrigger].push({
            type: "process",
            id: processObject._id.toString(),
            trigger,
          });
        });
      }
    });

    this.timeTriggers = newTriggers;
    Object.keys(this.timeTriggers).map((time) => {
      cron.schedule(time, () => {
        this.timeTriggers[time].map((triggeredProcess) => {
          const process = this.processMap[triggeredProcess.id];
          process.execute(triggeredProcess.trigger, {});
        });
      });
    });
  }
}

async function main() {
  const uri = "mongodb://" + process.env.DBURL + "&appname=Frontbase%20Engine";
  const client = new MongoClient(uri, {
    //@ts-ignore
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    const server = new Engine(client.db("FrontBase"));
    server.parseFormulas();
  } catch (e) {
    console.error("Error state", e);
  }
}
main();
