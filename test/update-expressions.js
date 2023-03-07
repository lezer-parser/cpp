// based on test-parser.js
// based on manual-test.js

//import {parser} from "../dist/index.js"
import {parser} from "../dist/index.es.js"

// use a patched version of fileTests to parse test files
// https://github.com/lezer-parser/generator/pull/7
// https://github.com/lezer-parser/generator/blob/main/src/test.ts
//import {fileTests} from "@lezer/generator/dist/test"
function toLineContext(file, index) {
  const endEol = file.indexOf('\n', index + 80);
  const endIndex = endEol === -1 ? file.length : endEol;
  return file.substring(index, endIndex).split(/\n/).map(str => '  | ' + str).join('\n');
}

const defaultIgnore = false

function fileTests(file, fileName, mayIgnore = defaultIgnore) {
  let caseExpr = /#[ \t]*(.*)(?:\r\n|\r|\n)([^]*?)==+>([^]*?)(?:$|(?:\r\n|\r|\n)+(?=#))/gy
  let tests = []
  let lastIndex = 0;
  for (;;) {
    let m = caseExpr.exec(file)
    if (!m) throw new Error(`Unexpected file format in ${fileName} around\n\n${toLineContext(file, lastIndex)}`)
    let execResult = /(.*?)(\{.*?\})?$/.exec(m[1])
    if (execResult === null) throw Error('execResult is null')
    let [, name, configStr] = execResult

    let text = m[2].trim(), expected = m[3].trim()
    let config = configStr ? JSON.parse(configStr) : null
    let strict = !/⚠|\.\.\./.test(expected)

    tests.push({ name, text, expected, configStr, config, strict })
    lastIndex = m.index + m[0].length
    if (lastIndex == file.length) break
  }
  return tests
}

import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from 'url';
let caseDir = path.dirname(fileURLToPath(import.meta.url))

const writePrettyTree = true

for (let file of fs.readdirSync(caseDir)) {
  if (!/\.txt$/.test(file)) continue
  //let fileName = /^[^\.]*/.exec(file)[0]
  let filePath = path.join(caseDir, file)
  let fileContent = fs.readFileSync(filePath, "utf8")
  const result = []
  for (let testData of fileTests(fileContent, file)) {
    const { name, text, expected: oldExpected, configStr, strict } = testData;
    const tree = parser.parse(testData.text);
    const stringifyOptions = writePrettyTree && { pretty: true, text };
    const newExpected = stringifyTree(tree, stringifyOptions).trim();
    //if (name == 'some test name') { console.dir(testData) } // debug
    result.push(`# ${name}${(configStr || '')}\n${text}\n==>\n${newExpected}`)
    const oldExpectedErrors = (oldExpected.match(/⚠/g) || []).length;
    const newExpectedErrors = (newExpected.match(/⚠/g) || []).length;
    if (oldExpectedErrors != newExpectedErrors) {
      console.log(`# ${name}\n# error count changed: ${oldExpectedErrors} -> ${newExpectedErrors}\n# old expected:\n${oldExpected}\n# new expected:\n${newExpected}\n`)
    }
  }
  const newFileContent = result.join("\n\n") + "\n";
  // TODO backup?
  console.log(`writing ${filePath}`);
  fs.writeFileSync(filePath, newFileContent, "utf8");
}



/** @param {Tree | TreeNode} tree */

function stringifyTree(tree, options) {

  if (!options) options = {};
  const pretty = options.pretty || false;
  const human = options.human || false; // human readable, like python or yaml
  const positions = options.positions || false; // add node positions
  const firstLine = options.firstLine || false; // show only first line of node source
  const compact = (!pretty && !human);
  const format = compact ? 'compact' : pretty ? 'pretty' : human ? 'human' : null;
  const source = options.source || options.text || '';
  const indentStep = options.indent || '  ';

  const cursor = tree.cursor();
  if (!cursor) return '';

  let depth = 0;
  let result = '';

  const indent = () => indentStep.repeat(depth);
  const cursorName = () => (cursor.name == cursorText()) ? JSON.stringify(cursor.name) : cursor.name;
  const cursorType = () => positions ? `${cursorName()}:${cursor.from}` : cursorName();
  const cursorText = () => {
    let src = source.slice(cursor.from, cursor.to);
    if (firstLine) {
      return src.split('\n')[0];
    }
    return src;
  };

  const formatNodeByFormat = {
    human: () => `${indent()}${cursorType()}: ${cursorText()}\n`,
    pretty: () => `${indent()}${cursorType()}`,
    compact: () => cursorType(),
  };
  const formatNode = formatNodeByFormat[format];

  while (true) {
    // NLR: Node, Left, Right
    // Node
    result += formatNode()
    // Left
    if (cursor.firstChild()) {
      // moved down
      depth++;
      if (compact) result += '('
      if (pretty) result += ' (\n'
      continue;
    }
    // Right
    if (depth > 0 && cursor.nextSibling()) {
      // moved right
      if (compact) result += ','
      if (pretty) result += ',\n'
      continue;
    }
    let continueMainLoop = false;
    let firstUp = true;
    while (cursor.parent()) {
      // moved up
      depth--;
      //console.log(`stringifyTree: moved up to depth=${depth}. result: ${result}`)
      if (compact) result += ')'
      if (pretty && firstUp) result += `\n`
      if (pretty) result += `${indent()})`
      if (depth <= 0) {
        // when tree is a node, stop at the end of node
        // == dont visit sibling or parent nodes
        return result;
      }
      if (cursor.nextSibling()) {
        // moved up + right
        continueMainLoop = true;
        if (compact) result += ','
        if (pretty) result += ',\n'
        break;
      }
      if (pretty) result += `\n`
      firstUp = false;
    }
    if (continueMainLoop) continue;

    break;
  }

  //console.log(`stringifyTree: final depth: ${depth}`)

  return result;
}
