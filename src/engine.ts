import { map } from "lodash";
import Formula from "./appbox-formulas";
import { DBCollectionsType, ModelType } from "./Utils/Types";

const { MongoClient } = require("mongodb");
require("dotenv").config();

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
  updateTriggers: { [key: string]: string } = {};

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
          console.log(`🧪 Parsing formula '${field.label}'.`);
          const formula = new Formula(
            field.formula,
            model.key,
            `🧪 ${field.label}`,
            "{{",
            this.models
          );
          formula.onParsed.then(() => {
            formula.dependencies.map((dep) => {
              this.updateTriggers[`${dep.model}___${dep.field}`] = formula.id;
            });
          });
        }
      });
      return model;
    }, models[0]);
    console.log("🥼 Done parsing formulas");
    this.registerOnObjectChangeListeners();
  }

  registerOnObjectChangeListeners() {
    this.collections.objects.watch().on("change", async (change) => {
      console.log(change);
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
