import fs from "fs";

export default function blacklist() {
  const f = fs.readFileSync("./health-check.txt").toString();
  const lines = f.split("\n");
  const failures = lines.filter((l) => l.indexOf("404") > -1);
  const symbols = failures.map((s) => s.split(" ")[0].toUpperCase());
  return new Set(symbols);
}
