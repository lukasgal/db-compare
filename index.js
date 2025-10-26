#! /usr/bin/env node
import { program } from "commander";
import chalk from "chalk";

import {
  createConnection,
  getListOfDatabases,
  getListOfTables,
  getNumberOfRows,
  selectFromTable,
} from "./src/connection.js";
import checkboxSearch from "inquirer-checkbox-search";
import { updatedDiff } from "deep-object-diff";
import table from "./src/table.js";
import moment from "moment";
import { getResultHTML } from "./src/Result.js";
import figlet from "figlet";
import inquirer from "inquirer";
import ora from "ora";
import searchList from "inquirer-search-list";
import propmtSuggest from "inquirer-prompt-suggest";
const isEmptyObj = (obj) => {
  return Object.keys(obj).length === 0;
};

const markDifferences = (o, n, d, type, idField) => {
  let style, icon;
  switch (type) {
    case "ADD":
      style = "background: #b7e4db; color: black;";
      icon = "✅";
      break;
    case "UPDATE":
      style = "background: #fbedd6; color: black;";
      icon = "✏️";
      break;
    case "DELETE":
      style = "background: #fee5ec; color: black;";
      icon = "❌";
      break;
  }
  const sourceObj = isEmptyObj(o) ? n : o;
  const targetObj = isEmptyObj(n) ? o : n;
  const newObj = {
    id:
      sourceObj[idField] && sourceObj[idField].length > 0
        ? sourceObj[idField]
        : targetObj[idField],
  };
  for (const prop in sourceObj) {
    let value = sourceObj[prop];
    if (d[prop]) {
      value = `<div style='${style}'>${icon} ${value}  ${
        targetObj[prop] && "➜"
      }  ${targetObj[prop] || ""}</div>`;
    }
    newObj[prop] = value;
  }
  return newObj;
};

const getTableResultHTML = (title, res) => {
  if (res && res.length > 0) {
    const head = Object.keys(res[0]);
    const out = [];
    res.forEach((r) => out.push(Object.values(r)));
    const resHtml = new table(title);
    return resHtml.createTable({ head, data: out });
  }
};

const compareCounts = async (connectConfigLeft, connectConfigRight) => {
  let dborig, dbnew;

  const connectionOriginal = await createConnection(connectConfigLeft);
  dborig = await getNumberOfRows(connectionOriginal);
  connectionOriginal.close();

  const connectionNew = await createConnection(connectConfigRight);
  dbnew = await getNumberOfRows(connectionNew);
  connectionNew.close();

  const res = [];
  const difference = updatedDiff(dborig, dbnew);

  for (let dif in difference) {
    res.push({
      table: dif,
      original: dborig[dif],
      new: dbnew[dif],
    });
  }

  getResultHTML(
    "Comparison result of the database",
    connectConfigLeft.database,
    connectConfigRight.database,
    getTableResultHTML("Diff - number of rows", res)
  );
};

const convertObjValuesToStr = (obj) => {
  for (const d in obj) {
    if (obj[d] instanceof Date) {
      obj[d] = moment(obj[d]).format("YYYY-MM-DD HH:mm:ss");
    } else {
      obj[d] = String(obj[d]);
    }
  }
  return Object.assign({}, obj);
};

const getTableDiffs = async (
  connectConfigLeft,
  connectConfigRight,
  tableName
) => {
  let letfResults, rightResults;

  const connectionOriginal = await createConnection(connectConfigLeft);
  letfResults = await selectFromTable(connectionOriginal, tableName);
  connectionOriginal.close();

  const connectionNew = await createConnection(connectConfigRight);
  rightResults = await selectFromTable(connectionNew, tableName);
  connectionNew.close();

  const res = [];
  let recordsLeft, recordsRight;
  let origHasMoreRec = true;
  recordsLeft = letfResults.recordset;
  recordsRight = rightResults.recordset;

  if (recordsLeft.length == 0 && recordsRight.length == 0) {
    return [];
  }

  const objKeys = Object.keys(
    recordsLeft.length == 0 ? recordsRight[0] : recordsLeft[0]
  );
  const pk = objKeys[0];

  const emptyObj = {};
  objKeys.reduce((prev, curr) => {
    prev[curr] = "";
    return prev;
  }, emptyObj);

  recordsLeft.forEach((leftRec, i) => {
    let newItem = recordsRight.find((item) => item[pk] == leftRec[pk]);
    const index = recordsRight.indexOf(newItem);

    if (index >= 0) {
      recordsRight.splice(index, 1);
    }
    let difference;
    let type = "";

    if (newItem) {
      difference = updatedDiff(
        origHasMoreRec ? leftRec : newItem,
        origHasMoreRec ? newItem : leftRec
      );
      type = "UPDATE";
    } else {
      difference = leftRec;
      type = "DELETE";
      newItem = Object.assign({ ...emptyObj });
    }

    if (difference != null && Object.keys(difference).length > 0) {
      const o = convertObjValuesToStr(leftRec);
      const n = convertObjValuesToStr(newItem);

      const diffs = Object.assign({ ...emptyObj }, difference);

      const d = convertObjValuesToStr(diffs);

      res.push(markDifferences(o, n, d, type, pk));
    }
  });

  if (recordsRight.length > 0) {
    recordsRight.forEach((item) => {
      const o = convertObjValuesToStr(Object.assign({ ...emptyObj }));
      const n = convertObjValuesToStr(item);

      res.push(markDifferences(o, n, n, "ADD", pk));
    });
  }
  res.sort((a, b) => {
    const pk1 = Number(a["id"]);
    const pk2 = Number(b["id"]);
    return pk1 - pk2;
  });
  res.forEach((item) => delete item["id"]);
  return res;
};

const tableDiff = async (connectConfigLeft, connectConfigRight, tableName) => {
  if (!Array.isArray(tableName)) {
    tableName = [tableName];
  }
  const resTables = [];
  for (const name of tableName) {
    resTables.push(
      getTableResultHTML(
        `Diff for table ${name}`,
        await getTableDiffs(connectConfigLeft, connectConfigRight, name)
      )
    );
  }
  return getResultHTML(
    "Comparison result of the database",
    connectConfigLeft.database,
    connectConfigRight.database,
    resTables.join("")
  );
};
const allDiffs = async (connectConfigLeft, connectConfigRight, options) => {
  const connectionOriginal = await createConnection(connectConfigLeft);
  connectionOriginal.close();

  const results = [];
  if (options.excluded && options.excluded.length > 0) {
    options.excluded = options.excluded.map((ex) => ex.toLowerCase());
  }
  const filteredTables = tables.filter((table) => {
    if (
      options.excluded &&
      options.excluded.length > 0 &&
      options.excluded.includes(table.toLowerCase())
    ) {
      return false;
    }

    if (options.filterByPrefix && options.filterByPrefix.length > 0) {
      return options.filterByPrefix.find((prefix) =>
        table.toLowerCase().startsWith(prefix.toLowerCase())
      );
    }
    return true;
  });

  for (const table of filteredTables) {
    try {
      const difference = await getTableDiffs(
        connectConfigLeft,
        connectConfigRight,
        table
      );
      if (difference.length > 0) {
        results.push(getTableResultHTML(table, difference));
      }
    } catch (e) {
      console.log(table);
      console.error(e);
    }
  }

  getResultHTML(
    "Comparison result of the database",
    connectConfigLeft.database,
    connectConfigRight.database,
    results.join("")
  );
};

let tables = [],
  databases = [];

const listDatabases = async (config) => {
  const cn = await createConnection(config);
  try {
    return await getListOfDatabases(cn);
  } catch (e) {
  } finally {
    cn.close();
  }
};

const listTables = async (config) => {
  const cn = await createConnection(config);
  try {
    return await getListOfTables(cn);
  } catch (e) {
  } finally {
    cn.close();
  }
};

function filterTables(answers, input) {
  input = input || "";
  const inputArray = input.split(" ");

  return new Promise((resolve) => {
    resolve(
      tables.filter((state) => {
        let shouldInclude = true;

        inputArray.forEach((inputChunk) => {
          // if any term to filter by doesn't exist, exclude
          if (!state.toLowerCase().includes(inputChunk.toLowerCase())) {
            shouldInclude = false;
          }
        });

        return shouldInclude;
      })
    );
  });
}

console.log(
  chalk.yellow(figlet.textSync("COMPARE-DB", { horizontalLayout: "full" }))
);
inquirer.registerPrompt("suggest", propmtSuggest);
inquirer.registerPrompt("search-list", searchList);
inquirer.registerPrompt("checkbox-search", checkboxSearch);

program.version("1.0.0").description("compare-db");

program.action(() => {
  inquirer
    .prompt([
      {
        type: "suggest",
        name: "server",
        message: "IP address of the server",
        suggestions: ["127.0.0.1"],
      },
      {
        type: "suggest",
        name: "user",
        message: "Server user",
        suggestions: ["player1"],
      },
      {
        type: "password",
        name: "password",
        message: "Server password",
      },
      {
        type: "list",
        name: "database1",
        message: "Name of the first database",
        choices: () => databases,
        when: async (answers) => {
          const { server, user, password } = answers;
          databases = await listDatabases({
            server,
            password,
            user: user,
            database: "",
          });
          return databases.length > 0;
        },
      },
      {
        type: "list",
        name: "database2",
        message: "Name of the second database",
        choices: () => databases,
      },
      {
        type: "list",
        name: "action",
        message: "What do you want to compare?",
        choices: ["Number of rows", "Table", "All tables"],
      },
      {
        type: "checkbox-search",
        name: "tableName",
        message: "Which tables do you want to compare?",
        source: filterTables,
        transformer: (input, answers) => {
          const displayValue = answers.tableName.join(",");
          return displayValue;
        },
        validate: function (answer) {
          if (answer.length < 1) {
            return "You must choose at least one table.";
          }
          return true;
        },
        when: async (answers) => {
          const { server, user, password } = answers;
          tables = await listTables({
            server,
            password,
            user: user,
            database: answers.database1,
          });
          return answers.action == "Table";
        },
      },
      {
        type: "input",
        name: "filterByPrefix",
        message:
          "Compare only tables with a specific prefix? (comma-separated list)",
        when: (answers) => answers.action == "All tables",
      },
      {
        type: "input",
        name: "excluded",
        message: "Which tables do you want to exclude? (comma-separated list)",
        when: (answers) => answers.action == "All tables",
      },
    ])
    .then(async (answers) => {
      const spinner = ora(`Comparing...`).start(); // Start the spinner
      const { server, user, password } = answers;
      const connectOpt = {
        server,
        user,
        password,
      };
      const connectConfigLeft = Object.assign(
        { database: answers.database1 },
        connectOpt
      );
      const connectConfigRight = Object.assign(
        { database: answers.database2 },
        connectOpt
      );
      ``;

      switch (answers.action) {
        case "Number of rows":
          await compareCounts(connectConfigLeft, connectConfigRight);
          break;
        case "Table":
          await tableDiff(
            connectConfigLeft,
            connectConfigRight,
            answers.tableName
          );
          break;
        case "All tables":
          const options = {};
          options.excluded = answers.excluded
            ? commaSeparatedList(answers.excluded)
            : "";
          options.filterByPrefix = answers.filterByPrefix
            ? commaSeparatedList(answers.filterByPrefix)
            : "";
          await allDiffs(connectConfigLeft, connectConfigRight, options);
          break;
      }
      spinner.succeed(chalk.green("Done!"));
    });
});

program
  .command("counts")
  .requiredOption("-db1 <db_name>", "name of database")
  .requiredOption("-db2 <db_name>", "name of database")
  .description("compares number of records in tables")
  .action(compareCounts);

program
  .command("table <tableName>")
  .description("returns diff of table")
  .requiredOption("-db1 <db_name>", "name of database")
  .requiredOption("-db2 <db_name>", "name of database")
  .action(tableDiff);

program
  .command("all")
  .description("returns diff of all tables")
  .requiredOption("-db1 <db_name>", "name of database")
  .requiredOption("-db2 <db_name>", "name of database")
  .option("-e, --exluded <tables>", "excluded tables", commaSeparatedList)
  .option(
    "-ep, --exluded-prefix <prefixes>",
    "excluded tables with prefix",
    commaSeparatedList
  )
  .action(allDiffs);

function commaSeparatedList(value, dummyPrevious) {
  return value.split(",");
}

program.parse();
