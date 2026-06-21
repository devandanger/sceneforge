// Publish-time guard: the bundle is correct but easy to ship with broken packaging
// metadata (missing license, NOTICE dropped from the tarball, bin pointing at source
// instead of dist). This fails before `npm publish` so those never reach the registry.
import fs from "node:fs";

const errors = [];
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

if (!pkg.license) errors.push('package.json is missing a "license" field');
if (pkg.private) errors.push('package.json has "private": true — it cannot be published');

for (const file of ["LICENSE", "NOTICE.md"]) {
  if (!fs.existsSync(file)) errors.push(`required file is missing: ${file}`);
}

const files = pkg.files ?? [];
for (const entry of ["dist", "LICENSE", "NOTICE.md"]) {
  if (!files.includes(entry)) errors.push(`package.json "files" must include "${entry}" (else it won't ship in the tarball)`);
}

const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.sceneforge;
if (!bin) errors.push('package.json "bin" is unset');
else if (!bin.includes("dist/")) errors.push(`package.json "bin" should point into dist/ (got "${bin}") — source won't run once installed`);

if (errors.length > 0) {
  console.error("Packaging check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("Packaging metadata OK (license, NOTICE, files whitelist, bin).");
