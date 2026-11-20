// Only recognize the project's canonical early-return form. Other control flow needs review.
import ts from "typescript";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

function guardLine(fn, source, aliases) {
  if (!fn?.body || !ts.isBlock(fn.body) || fn.parameters.some(p => p.initializer || !ts.isIdentifier(p.name))) return null;
  const [assignment, check] = fn.body.statements;
  if (!assignment || !ts.isVariableStatement(assignment) || !check || !ts.isIfStatement(check)) return null;
  const [binding] = assignment.declarationList.declarations;
  if (assignment.declarationList.declarations.length !== 1 || !ts.isIdentifier(binding.name)) return null;
  const init = binding.initializer;
  if (!init || !ts.isAwaitExpression(init) || !ts.isCallExpression(init.expression)) return null;
  const call = init.expression;
  if (!ts.isIdentifier(call.expression) || !aliases.has(call.expression.text) || call.arguments.length) return null;
  const guard = call.expression.text;
  if (fn.parameters.some(p => p.name.getText(source) === guard)) return null;
  const condition = check.expression;
  if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.InKeyword ||
      !ts.isStringLiteral(condition.left) || condition.left.text !== "error" ||
      !ts.isIdentifier(condition.right) || condition.right.text !== binding.name.text) return null;
  const denial = ts.isBlock(check.thenStatement) ? check.thenStatement.statements[0] : check.thenStatement;
  const result = denial && ts.isReturnStatement(denial) && denial.expression;
  if (!result || !ts.isPropertyAccessExpression(result) || !ts.isIdentifier(result.expression) ||
      result.expression.text !== binding.name.text || result.name.text !== "error") return null;
  return source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1;
}

export function inspectAdminHandlers(path, content) {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  const aliases = new Set();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || node.moduleSpecifier.text !== "@/lib/auth/requireAdminApi") continue;
    const imports = node.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements) {
        if ((item.propertyName ?? item.name).text === "requireAdminApi") aliases.add(item.name.text);
      }
    }
  }
  const rows = [];
  function add(name, fn) {
    if (!name || !methods.has(name.text)) return;
    rows.push({ method: name.text, path, line: source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1,
      guardLine: guardLine(fn, source, aliases) });
  }
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const item of node.exportClause.elements) add(item.name);
      } else if (!node.exportClause) {
        rows.push({ method: "*", path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, guardLine: null });
      }
      continue;
    }
    if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(node)) add(node.name, node);
    if (ts.isVariableStatement(node)) {
      for (const item of node.declarationList.declarations) {
        const fn = item.initializer;
        add(item.name, fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) ? fn : null);
      }
    }
  }
  return rows;
}
