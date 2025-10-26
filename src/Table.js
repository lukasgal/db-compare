import { JSDOM } from "jsdom";

export default function (title) {
  const dom = new JSDOM(`<!DOCTYPE html><head><body></body></html>`);
  const document = dom.window.document;
  const table = document.createElement("table");
  const wrapper = document.createElement("div");
  const titleEl = document.createElement("h2");
  let numberOfColumns = 1;
  titleEl.innerHTML = `📊 ${title}`;
  document.body.appendChild(wrapper);
  wrapper.appendChild(titleEl);
  wrapper.appendChild(table);
  const thead = table.appendChild(document.createElement("thead"));
  const tbody = table.appendChild(document.createElement("tbody"));

  const addHead = (head) => {
    const row = document.createElement("tr");
    for (const column of head) {
      const colEl = document.createElement("th");
      colEl.innerHTML = column;
      row.appendChild(colEl);
    }
    thead.appendChild(row);
    numberOfColumns = head.length;
  };

  const addRow = (rowData) => {
    const row = document.createElement("tr");
    if (!rowData || rowData.length == 0) {
      const colEl = document.createElement("td");
      colEl.colSpan = numberOfColumns;
      colEl.innerHTML = "&nbsp;";
      colEl.style.backgroundColor = "black";
      row.appendChild(colEl);
    } else {
      for (let i = 0; i < rowData.length; i++) {
        const column = rowData[i];
        const colEl = document.createElement("td");
        colEl.innerHTML = column;
        row.appendChild(colEl);
      }
    }
    tbody.appendChild(row);
  };

  const createTable = (options) => {
    if (Array.isArray(options.head)) {
      addHead(options.head);
    }

    if (Array.isArray(options.data)) {
      options.data.forEach((row) => addRow(row));
    }
    return wrapper.outerHTML;
  };

  return {
    createTable,
  };
}
