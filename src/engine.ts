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

  // Initialise
  constructor(db) {
    this.db = db;
    this.collections = {
      models: db.collection("models"),
      objects: db.collection("objects"),
      usersettings: db.collection("usersettings"),
    };
    console.log("Engine booting up");
  }

  // Parse formulas
  parseFormulas() {
    console.log("Parsing formulas");
    this.collections.models.find({}).forEach((model: ModelType) => {
      map(model.fields, (field, key) => {
        if (field.type === "formula") {
          console.log(`🧪 Parsing formula ${field.label}.`);
          const formula = new Formula(field.formula);
        }
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
