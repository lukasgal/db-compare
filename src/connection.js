import chalk from "chalk";
import sql from "mssql";

// SQL Server configuration
var defaultConfig = {
  user: "player1", // Database username
  password: "player1", // Database password
  server: "127.0.0.1", // Server IP address
  database: "", // Database name
  options: {
    encrypt: false, // Disable encryption
    charset: "utf8mb4",
  },
};

export async function createConnection(config) {
  const cfg = Object.assign(defaultConfig, config);
  return await sql.connect(cfg);
}

export const getNumberOfRows = async (connection) => {
  try {
    const tables = await getListOfTables(connection);
    const counts = {};
    for (const c of tables) {
      const sqlQuery = `SELECT count(1) as no FROM ${c}`;
      const numberOfRecords = await connection.request().query(sqlQuery);
      counts[c] = numberOfRecords.recordset[0].no;
    }
    return counts;
  } catch (err) {
    console.log(chalk.redBright("Error occured:"), err);
  }
};

export const selectFromTable = async (connection, tableName) => {
  try {
    const query = `SELECT *
        FROM
          ${tableName}`;
    return connection.request().query(query);
  } catch (err) {
    console.log(chalk.redBright("Error occured:"), err);
  }
};

export const getListOfTables = async (connection) => {
  try {
    const result = await connection.request().query(`SELECT name
     FROM
       SYSOBJECTS
     WHERE
       xtype = 'U' order by name asc`);
    return result.recordset.map((r) => r.name);
  } catch (err) {
    console.log(chalk.redBright("Error occured:"), err);
  }
};

export const getListOfDatabases = async (connection) => {
  try {
    const result = await connection
      .request()
      .query(
        `SELECT name FROM master.dbo.sysdatabases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb');`
      );
    return  result.recordset.map((r) => r.name);
  } catch (err) {
    console.log(chalk.redBright("Error occured:"), err);
  }
};
