/**
 * 文言スプレッドシートの「サイト管理」メニュー（docs/SITE_COPY.md）。
 * スプレッドシートの「拡張機能 → Apps Script」に貼り付けて使う。
 *
 * 押すと GitHub Actions の「Sync site copy」を今すぐ動かす。
 * シートの内容が検証され、問題がなければ develop 向けの取り込み PR ができる。
 * 本番には出ない（PR をマージして、次のリリースで出る）。
 *
 * 事前設定（1回だけ）: Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に
 *   GITHUB_TOKEN = Fine-grained personal access token（このリポジトリだけ / Actions: Read and write）
 * を入れる。トークンはコードに書かない。
 */

var REPO = "KochiDXClub/nicchyo";
var WORKFLOW_FILE = "sync-site-copy.yml";
var BRANCH = "develop";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("サイト管理")
    .addItem("文言を取り込む（PR を作る）", "runSync")
    .addItem("取り込みの実行状況を見る", "openRuns")
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
