/**
 * 文言スプレッドシートの「サイト管理」メニュー（docs/SITE_COPY.md）。
 * スプレッドシートの「拡張機能 → Apps Script」に貼り付けて使う。
 *
 * - 文言を取り込む（PR を作る）: GitHub Actions の「Sync site copy」を今すぐ動かす。
 *   シートの内容が検証され、問題がなければ develop 向けの取り込み PR ができる。
 *   本番には出ない（PR をマージして、次のリリースで出る）。
 * - コードの文言をシートに足す: develop の content/site-copy/texts.json と sheet-layout.json を読み、
 *   シートに無い ID の行だけを、決まったタブの下に足す（タブが無ければ作る）。
 *   今ある行の文言は書き換えない。コードで新しい文言を足したあと、シートに行を足す手間をなくすためのもの。
 *   リポジトリは公開なので、トークンは要らない。
 *
 * 事前設定（1回だけ。「文言を取り込む」にだけ要る）: Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に
 *   GITHUB_TOKEN = Fine-grained personal access token（このリポジトリだけ / Actions: Read and write）
 * を入れる。トークンはコードに書かない。
 */

var REPO = "KochiDXClub/nicchyo";
var WORKFLOW_FILE = "sync-site-copy.yml";
var BRANCH = "develop";
var RAW_BASE = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/content/site-copy/";

// 文言のタブの見出し（scripts/site-copy/sync.mjs と同じ文字。列の並びは自由で、見出しの文字で列を探す）
var ID_HEADER = "ID（変更不可）";
var TEXT_TAB_HEADER = ["場所", "項目", "文言", "最大文字数", ID_HEADER];
var ID_COLUMN_COLOR = "#e8e8e8";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("サイト管理")
    .addItem("文言を取り込む（PR を作る）", "runSync")
    .addItem("取り込みの実行状況を見る", "openRuns")
    .addSeparator()
    .addItem("コードの文言をシートに足す", "addMissingRows")
    .addToUi();
}

function runSync() {
  var ui = SpreadsheetApp.getUi();
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) {
    ui.alert(
      "GITHUB_TOKEN が設定されていません",
      "Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に GITHUB_TOKEN を入れてください（手順は docs/SITE_COPY.md）。",
      ui.ButtonSet.OK
    );
    return;
  }

  var answer = ui.alert(
    "文言を取り込みますか？",
    "今のシートの内容を検証して、サイトの文言への取り込み PR を作ります。\n本番にはすぐ出ません（PR をマージして、次のリリースで出ます）。",
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;

  var res = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + REPO + "/actions/workflows/" + WORKFLOW_FILE + "/dispatches",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      payload: JSON.stringify({ ref: BRANCH }),
      muteHttpExceptions: true,
    }
  );

  var code = res.getResponseCode();
  if (code === 204) {
    ui.alert(
      "取り込みを始めました",
      "1〜2分後に「取り込みの実行状況を見る」で結果を確認してください。\n問題があるセルは実行ログに「◯行目」の形で出ます（その場合、何も取り込まれず、サイトは今のままです）。",
      ui.ButtonSet.OK
    );
  } else if (code === 401 || code === 403 || code === 404) {
    ui.alert(
      "取り込みを始められませんでした（HTTP " + code + "）",
      "トークンが無効か、このリポジトリの Actions を動かす権限がありません。トークンを作り直して、GITHUB_TOKEN を入れ替えてください。",
      ui.ButtonSet.OK
    );
  } else {
    ui.alert("取り込みを始められませんでした（HTTP " + code + "）", res.getContentText().slice(0, 300), ui.ButtonSet.OK);
  }
}

function openRuns() {
  var url = "https://github.com/" + REPO + "/actions/workflows/" + WORKFLOW_FILE;
  var html = HtmlService.createHtmlOutput(
    '<p><a href="' + url + '" target="_blank" rel="noopener">GitHub Actions の実行状況を開く</a></p>'
  )
    .setWidth(320)
    .setHeight(80);
  SpreadsheetApp.getUi().showModalDialog(html, "取り込みの実行状況");
}

/** develop の content/site-copy/<file> を JSON で読む。無ければ null */
function fetchSiteCopyJson_(file) {
  var res = UrlFetchApp.fetch(RAW_BASE + file, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

/** 1行目の見出しから、見出しの文字 → 列番号（1始まり）を作る */
function headerIndex_(sheet) {
  var lastColumn = sheet.getLastColumn();
  var index = {};
  if (lastColumn === 0) return index;
  var header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  for (var i = 0; i < header.length; i++) index[String(header[i]).trim()] = i + 1;
  return index;
}

/** 全部のタブの ID 列に入っている ID */
function existingIds_(spreadsheet) {
  var ids = {};
  spreadsheet.getSheets().forEach(function (sheet) {
    var column = headerIndex_(sheet)[ID_HEADER];
    var lastRow = sheet.getLastRow();
    if (!column || lastRow < 2) return;
    sheet.getRange(2, column, lastRow - 1, 1).getValues().forEach(function (row) {
      var id = String(row[0]).trim();
      if (id) ids[id] = true;
    });
  });
  return ids;
}

/** 文言のタブを新しく作る（見出し・ID 列の色・ID 列の保護（警告）つき） */
function createTextTab_(spreadsheet, name) {
  var sheet = spreadsheet.insertSheet(name);
  sheet.getRange(1, 1, 1, TEXT_TAB_HEADER.length).setValues([TEXT_TAB_HEADER]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  var idColumn = TEXT_TAB_HEADER.indexOf(ID_HEADER) + 1;
  var idRange = sheet.getRange(1, idColumn, sheet.getMaxRows(), 1);
  idRange.setBackground(ID_COLUMN_COLOR);
  idRange.protect().setDescription("ID は変更しない（docs/SITE_COPY.md）").setWarningOnly(true);
  sheet.setColumnWidth(3, 420);
  return sheet;
}

function addMissingRows() {
  var ui = SpreadsheetApp.getUi();
  var texts = fetchSiteCopyJson_("texts.json");
  var layout = fetchSiteCopyJson_("sheet-layout.json");
  if (!texts || !layout) {
    ui.alert(
      "コードの文言を読めませんでした",
      "GitHub の " + BRANCH + " ブランチに content/site-copy/texts.json と sheet-layout.json があるか確かめてください。",
      ui.ButtonSet.OK
    );
    return;
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var ids = existingIds_(spreadsheet);
  var missing = layout.filter(function (entry) {
    return !ids[entry.key] && texts[entry.key] !== undefined;
  });
  if (missing.length === 0) {
    ui.alert("足す行はありません", "コードの文言は、すべてシートに載っています。", ui.ButtonSet.OK);
    return;
  }

  var byTab = {};
  var tabOrder = [];
  missing.forEach(function (entry) {
    if (!byTab[entry.tab]) {
      byTab[entry.tab] = [];
      tabOrder.push(entry.tab);
    }
    byTab[entry.tab].push(entry);
  });
  var summary = tabOrder
    .map(function (tab) {
      var note = spreadsheet.getSheetByName(tab) ? "" : "（タブを新しく作る）";
      return "・" + tab + "：" + byTab[tab].length + "行" + note;
    })
    .join("\n");
  var answer = ui.alert(
    "シートに無い文言を足しますか？",
    summary + "\n\n各タブのいちばん下に足します。今ある行は書き換えません。",
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;

  var problems = [];
  var added = 0;
  tabOrder.forEach(function (tab) {
    var sheet = spreadsheet.getSheetByName(tab) || createTextTab_(spreadsheet, tab);
    var index = headerIndex_(sheet);
    if (!index["文言"] || !index[ID_HEADER]) {
      problems.push("「" + tab + "」に見出し「文言」か「" + ID_HEADER + "」の列がないので、足していません");
      return;
    }
    var width = sheet.getLastColumn();
    var rows = byTab[tab].map(function (entry) {
      var row = [];
      for (var i = 0; i < width; i++) row.push("");
      var values = { 場所: entry.place, 項目: entry.item, 文言: texts[entry.key] };
      values[ID_HEADER] = entry.key;
      Object.keys(values).forEach(function (label) {
        if (index[label]) row[index[label] - 1] = values[label];
      });
      return row;
    });
    var range = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width);
    // 「300」や「=」で始まる文言が数や数式にならないよう、書式を文字にしてから書く
    range.setNumberFormat("@").setValues(rows);
    sheet.getRange(range.getRow(), index[ID_HEADER], rows.length, 1).setBackground(ID_COLUMN_COLOR);
    added += rows.length;
  });

  ui.alert(
    added + "行を足しました",
    (problems.length ? problems.join("\n") + "\n\n" : "") +
      "文言はコードと同じものです。直したいところを直してから「文言を取り込む」を押してください。",
    ui.ButtonSet.OK
  );
}
