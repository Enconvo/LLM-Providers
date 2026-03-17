#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const endpoint = process.argv[2];
if (!endpoint) {
  console.error("Usage: node api_detail.js <endpoint-path>");
  process.exit(1);
}

const schemaPath = path.join(__dirname, "..", "schemas.json");
const schemas = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

// Read extension name from package.json for matching router entries
const pkgPath = path.join(__dirname, "..", "..", "package.json");
const extName = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf-8")).name : "";

for (const schema of schemas) {
  // Match leaf endpoint by routePath
  if (schema.routePath === endpoint) {
    console.log(JSON.stringify(schema, null, 2));
    process.exit(0);
  }
  // Match router entry by extensionName/schemaName pattern
  if (schema.routes && (extName + "/" + schema.name === endpoint || schema.name === endpoint)) {
    console.log(JSON.stringify(schema, null, 2));
    process.exit(0);
  }
  if (schema.routes) {
    for (const route of schema.routes) {
      if (route.routePath === endpoint) {
        console.log(JSON.stringify(route, null, 2));
        process.exit(0);
      }
    }
  }
}

console.error("Endpoint not found: " + endpoint);
process.exit(1);
