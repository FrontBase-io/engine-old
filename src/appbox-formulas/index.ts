const uniqid = require("uniqid");

class Formula {
  // Original formula string
  formulaString;
  // Holds formula template (tags replaced by unique identifiers)
  formulaTemplate;
  // Array holding all tags
  tags: { tag: string; identifier: string }[] = [];

  // Constructor
  constructor(formula, mode: "{{" | "[[" = "{{") {
    this.formulaString = formula;
    this.formulaTemplate = formula;

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

    // Loop through all the tags
    console.log(this.formulaString, this.formulaTemplate, this.tags);
  }
}

export default Formula;
