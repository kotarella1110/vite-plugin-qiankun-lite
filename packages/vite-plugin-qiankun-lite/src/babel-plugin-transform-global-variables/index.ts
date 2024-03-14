import { type NodePath, types as t } from "@babel/core";
import { declare } from "@babel/helper-plugin-utils";
import { parse } from "@babel/parser";
import { globalBrowserVariables } from "./globalBrowserVariables";

type Options = {
  replace?: Record<string, string>;
  addWindowPrefix?: boolean;
};

export default declare<Options>((api, options = {}) => {
  const replace: Record<string, string> = {
    ...(options.addWindowPrefix &&
      globalBrowserVariables.reduce(
        (acc, globalBrowserVariables) =>
          Object.assign(acc, {
            [globalBrowserVariables]: `${
              options.replace?.window ?? "window"
            }.${globalBrowserVariables}`,
          }),
        {},
      )),
    ...options.replace,
  };
  return {
    visitor: {
      Identifier(path) {
        if (!isReplaceableIdentifier(path, Object.keys(replace))) return;
        const replacementIdentifier = parseToMemberExpressionOrIdentifier(
          replace[path.node.name],
        );
        path.replaceWith(replacementIdentifier);
      },
      MemberExpression(path, state) {
        const code = state.file.code.substring(
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          path.node.start!,
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          path.node.end!,
        );
        if (!isReplaceableMemberExpression(path, code, Object.keys(replace)))
          return;
        const replacementMemberExpression = parseToMemberExpressionOrIdentifier(
          replace[code],
        );
        path.replaceWith(replacementMemberExpression);
      },
    },
  };
});

function isReplaceableIdentifier(
  path: NodePath<t.Identifier>,
  fromStrings: string[],
) {
  return (
    fromStrings.includes(path.node.name) &&
    !path.scope.hasBinding(path.node.name) &&
    !path.parentPath.isMemberExpression({ property: path.node }) &&
    !path.parentPath.isOptionalMemberExpression({ property: path.node }) &&
    !path.parentPath.isObjectProperty({ key: path.node }) &&
    !path.parentPath.isObjectMethod({ key: path.node }) &&
    !path.parentPath.isClassProperty({ key: path.node }) &&
    !path.parentPath.isClassMethod({ key: path.node }) &&
    !path.parentPath.isPrivateName({ id: path.node }) &&
    !path.parentPath.isExportSpecifier()
  );
}

function isReplaceableMemberExpression(
  path: NodePath<t.MemberExpression>,
  code: string,
  fromStrings: string[],
) {
  if (!fromStrings.includes(code)) return false;
  const deepestNodePath = getDeepestNodePath(path);
  return (
    t.isIdentifier(deepestNodePath.node) &&
    !deepestNodePath.scope.hasBinding(deepestNodePath.node.name) &&
    !path.parentPath.isMemberExpression({ object: path.node }) &&
    !path.parentPath.isOptionalMemberExpression({ object: path.node })
  );
}

function getDeepestNodePath(path: NodePath<t.MemberExpression>) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let deepestNodePath: any = path;
  while (deepestNodePath.node.object) {
    deepestNodePath = deepestNodePath.get("object");
  }
  return deepestNodePath as NodePath<t.Node>;
}

function parseToMemberExpressionOrIdentifier(
  code: string,
): t.MemberExpression | t.Identifier {
  const ast = parse(code);
  const statement = ast.program.body[0];
  if (!t.isExpressionStatement(statement)) {
    throw new Error("Expected ExpressionStatement");
  }
  const expression = statement.expression;
  if (!t.isMemberExpression(expression) && !t.isIdentifier(expression)) {
    throw new Error("Expected MemberExpression or Identifier");
  }
  return expression;
}
