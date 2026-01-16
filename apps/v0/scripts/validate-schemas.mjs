#!/usr/bin/env node
// ESM AJV schema validator for examples
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schemasDir = 'schemas';
const examplesDir = 'examples';

// load schemas
const schemas = {};
for (const file of fs.readdirSync(schemasDir)) {
  if (!file.endsWith('.json')) continue;
  const full = path.join(schemasDir, file);
  schemas[file] = JSON.parse(fs.readFileSync(full, 'utf8'));
  ajv.addSchema(schemas[file]);
}

let ok = true;
for (const file of fs.readdirSync(examplesDir)) {
  if (!file.endsWith('.json')) continue;
  const full = path.join(examplesDir, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  // map example to schema by filename prefix
  const key = file.split('.')[0]; // e.g., input.message.example.json -> input.message
  let schemaName = null;
  for (const s of Object.keys(schemas)) {
    if (s.startsWith(key)) {
      schemaName = s;
      break;
    }
  }
  if (!schemaName) {
    console.error('No matching schema for example', file);
    ok = false;
    continue;
  }
  const validate = ajv.getSchema(schemas[schemaName]["$id"]) || ajv.compile(schemas[schemaName]);
  const valid = validate(data);
  if (!valid) {
    ok = false;
    console.error('❌', file, 'invalid:', validate.errors);
  } else {
    console.log('✅', file, 'OK');
  }
}

process.exit(ok ? 0 : 1);
