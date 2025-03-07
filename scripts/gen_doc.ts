import Pkg from '../package.json';
import fs from 'fs';
import { JSONSchema7, JSONSchema7Type } from 'json-schema';
import util from 'util';

const fsp = fs.promises;

type Definition = JSONSchema7;
type Cmd = {
  title: string;
  command: string;
};

type Row = {
  key: string;
  description: string;
  type?: string | object;
  default?: JSONSchema7Type;
};

const hint =
  "<!-- Generated by 'yarn run gen:doc', please don't edit it directly -->";
const ignorePrettier = '<!-- prettier-ignore -->';

async function attach(
  headLevel: number,
  attachTitle: string,
  markdownPath: string,
  rows: Row[],
) {
  const markdown = await fsp.readFile(markdownPath, 'utf8');
  const markdownLines = markdown.split('\n');
  let startIndex = markdownLines.findIndex((line) =>
    new RegExp('#'.repeat(headLevel) + '\\s*' + attachTitle + '\\s*').test(
      line,
    ),
  );
  if (startIndex < 0) {
    return;
  }
  startIndex += 1;
  const endIndex = markdownLines
    .slice(startIndex)
    .findIndex((line) => new RegExp('#'.repeat(headLevel) + '[^#]').test(line));
  const removeCount = endIndex < 0 ? 0 : endIndex;
  const lines = printAsDetails(rows);
  markdownLines.splice(startIndex, removeCount, ...lines);
  await fsp.writeFile(markdownPath, markdownLines.join('\n'));
}

function printJson(obj: JSONSchema7Type, format = false) {
  return JSON.stringify(obj, undefined, format ? '  ' : undefined);
}

function printAsDetails(rows: Row[]) {
  const lines: string[] = ['', hint, ignorePrettier];
  rows.forEach((row) => {
    lines.push('<details>');
    lines.push(
      `<summary><code>${row.key}</code>: ${row.description}. type: <code>${row.type}</code></summary>`,
    );
    let line = '';
    if (row.default !== undefined) {
      line += 'Default: ';
      line += '<pre><code>' + printJson(row.default, true) + '</code></pre>';
    }
    lines.push(line);
    lines.push('</details>');
  });
  lines.push('');
  return lines;
}

function printAsList(rows: Row[]) {
  const lines: string[] = ['', hint, ignorePrettier];
  rows.forEach((row) => {
    let line = `- \`${row.key}\``;
    const descriptions: string[] = [];
    if (row.description) {
      descriptions.push(row.description);
    }
    if (row.type) {
      descriptions.push(`type: \`${printJson(row.type)}\``);
    }
    if (row.default !== undefined) {
      descriptions.push(`default: \`${printJson(row.default)}\``);
    }
    if (descriptions.length) {
      line += ': ' + descriptions.join(', ');
    }
    lines.push(line);
  });
  lines.push('');
  return lines;
}

function genCommandDoc() {
  const cmds = Pkg.contributes.commands as Cmd[];
  const rows: Row[] = [];
  cmds.forEach((cmd) => {
    rows.push({
      key: cmd.command,
      description: cmd.title,
    });
  });
  return rows;
}

function genType(
  property: string,
  def: Definition & {
    default_doc?: string;
  },
): string {
  if (def.enum) {
    return def.enum.map((e) => `"${e}"`).join(' | ');
  } else if (def.type) {
    if (Array.isArray(def.type)) {
      return def.type.join(' | ');
    } else if (def.type === 'array') {
      return genType(property, def.items as Definition);
    } else {
      return def.type;
    }
  } else if (def.anyOf) {
    return def.anyOf.map((d) => genType(property, d as Definition)).join(' | ');
  }
  throw new Error(`${property} definition not supported ${util.inspect(def)}`);
}

function genConfigurationDoc() {
  const conf = Pkg.contributes.configuration.properties;
  const rows: Row[] = [];
  for (const property in conf) {
    const def = Reflect.get(conf, property) as Definition & {
      default_doc?: string;
    };
    const row: Row = {
      key: property,
      description: def.description ?? '',
    };
    row.type = genType(property, def);
    if (def.default_doc) {
      if (typeof def.default_doc === 'string') {
        row.default = def.default_doc === '' ? '`[empty]`' : def.default_doc;
      } else {
        row.default = def.default_doc;
      }
    } else if (def.default !== undefined) {
      if (typeof def.default === 'string') {
        row.default = def.default === '' ? '`[empty]`' : def.default;
      } else {
        row.default = def.default;
      }
    }
    rows.push(row);
  }
  return rows;
}

async function main() {
  // await attach(2, 'Commands', 'readme.md', genCommandDoc());
  // console.log('Attach to Commands header');
  await attach(2, 'Configuration', 'readme.md', genConfigurationDoc());
  console.log('Attach to Configuration header');
}

main().catch((error) => console.error(error));
