import Formula from "../index";

/*
 * AND(...arg1, etc)
 * returns true if ALL children are true
 */

export default {
  execute: (fArguments, data, formula: Formula) =>
    new Promise(async (resolve, reject) => {
      let isTrue = true;
      for (let x = 0; x < fArguments.length; x++) {
        if (fArguments[x] !== true) isTrue = false;
      }

      resolve(isTrue);
    }),
  onCompile: (fArguments) => {
    const deps = [];

    // For each argument, check if their type is string (so not a "string", but a string). If so, it refers to a field and is a dependency.
    for (let x = 0; x < fArguments.length; x++) {
      if (typeof fArguments[x] === "string") deps.push(fArguments[x]);
    }

    return deps;
  },
  // Give a sample result so it's parent functions know what we will return on execute and can perform the right precompiling.
  returnPreview: true,
};
