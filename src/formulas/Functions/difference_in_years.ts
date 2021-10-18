import { parseISO } from "date-fns";
import { differenceInYears } from "date-fns";

/*
 * difference_in_years(date1: Date, date2: Date)
 * Measures the distance between date1 and date2 in years
 */

class difference_in_years {
  // This is a preview for what will be returned from the function
  returnPreview = 0;
  // This variable holds dependencies
  dependencies = [];
  // Arguments
  arguments;

  // Preprocess the arguments
  constructor(args) {
    // If the dates come as string, parse them.
    this.arguments = [
      typeof args[0] === "string" ? parseISO(args[0]) : args[0],
      typeof args[1] === "string" ? parseISO(args[1]) : args[1],
    ];
    // Both arguments are dependencies
    this.dependencies.push(args[0]);
    this.dependencies.push(args[1]);
  }

  // Resolves the function
  resolve = () =>
    new Promise<number>((resolve, reject) => {
      resolve(differenceInYears(this.arguments[0], this.arguments[1]));
    });
}

export default difference_in_years;
