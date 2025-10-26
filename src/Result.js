import { JSDOM } from "jsdom";
import fs from "fs";
import open, { apps } from "open";
import path from "path";
import chalk from "chalk";
const css = `
        body {
          font-family: monospace;
        }
        h1 {
          border-bottom: 1px solid black;
          padding: 10px;
          letter-spacing: 1.6;
        }
        h2 {
          border: 1px dotted black;
          padding: 8px;
          background: gray;
          color: white;
        }
        .db-names {
          padding: 4px;
          font-size: 16px;
          background: none;
          color: gray;
        } 
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th, td {
          padding: 4px;
          border: 1px solid #ddd;
          font-family: monospace;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        th {
          background-color: whitesmoke;
          color: black;
          font-family: monospace;
        }`;

export const getResultHTML = async (title, db1, db2, html) => {
  const dom = new JSDOM(
    `<!DOCTYPE html>
    <head>
    <meta charset="UTF-8"/>
    <title>db-compare|${title}</title>
    <style>${css}</style>
    </head>
    <body></body>
    </html>`
  );

  const document = dom.window.document;
  const titleEl = document.createElement("h1");

  titleEl.innerHTML = `<h1>${title}</h1><h2 class="db-names">🛢️ ${db1} ⇄ ${db2}</h2>`;
  document.body.appendChild(titleEl);
  const content = document.createElement("div");
  content.innerHTML = html
    ? html
    : "<b style='color: gray;'>No difference found</b>";
  document.body.appendChild(content);

  const output = dom.window.document.documentElement.outerHTML;
  const outFilename = `./compare-db_result-${Date.now()}.html`;
  const file = path.resolve(process.env.APPDATA, outFilename);
  fs.writeFile(file, output, () => {
    open(file, {
      app: { name: apps.chrome },
    });
    console.log(chalk.greenBright("Output file " + file + " was generated."));
  });
};
