import { type NodePath, types as t } from "@babel/core";
import generator from "@babel/generator";
import { declare } from "@babel/helper-plugin-utils";
import { parse } from "@babel/parser";
import { globalBrowserVariables } from "./globalBrowserVariables";

type Options = {
  replace?: Record<string, string>;
  addWindowPrefix?: boolean;
};

export default declare<Options>((api, options = {}) => {
  const replace = {
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
  const replacementExpressions = getReplacementExpressions(replace);
  return {
    visitor: {
      Identifier(path) {
        const replaceableIdentifiers = Object.values(replacementExpressions)
          .map(({ from }) => from)
          .filter((from): from is t.Identifier => t.isIdentifier(from));
        if (isReplaceableIdentifier(path, replaceableIdentifiers)) {
          const replacementIdentifier =
            replacementExpressions[path.node.name].to;
          path.replaceWith(replacementIdentifier);
        }
      },
      MemberExpression(path) {
        const replaceableMemberExpressions = Object.values(
          replacementExpressions,
        )
          .map(({ from }) => from)
          .filter((from): from is t.MemberExpression =>
            t.isMemberExpression(from),
          );
        if (isReplaceableMemberExpression(path, replaceableMemberExpressions)) {
          const replacementMemberExpression =
            replacementExpressions[generator(path.node).code].to;
          path.replaceWith(replacementMemberExpression);
        }
      },
    },
  };
});

function isReplaceableIdentifier(
  path: NodePath<t.Identifier>,
  replaceableIdentifiers: t.Identifier[],
) {
  return (
    replaceableIdentifiers.some(
      (replaceableIdentifier) => replaceableIdentifier.name === path.node.name,
    ) &&
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
  replaceableMemberExpressions: t.MemberExpression[],
) {
  const deepestNodePath = getDeepestNodePath(path);
  return (
    replaceableMemberExpressions.some((replaceableMemberExpression) =>
      isMatchingMemberExpression(path.node, replaceableMemberExpression),
    ) &&
    t.isIdentifier(deepestNodePath.node) &&
    !deepestNodePath.scope.hasBinding(deepestNodePath.node.name) &&
    !path.parentPath.isMemberExpression({ object: path.node }) &&
    !path.parentPath.isOptionalMemberExpression({ object: path.node })
  );
}

function isMatchingMemberExpression(
  pathNode: t.PrivateName | t.Expression,
  targetPathNode: t.PrivateName | t.Expression,
): boolean {
  if (t.isMemberExpression(pathNode) && t.isMemberExpression(targetPathNode)) {
    return (
      isMatchingMemberExpression(pathNode.object, targetPathNode.object) &&
      isMatchingMemberExpression(pathNode.property, targetPathNode.property)
    );
  }
  if (t.isIdentifier(pathNode) && t.isIdentifier(targetPathNode)) {
    return pathNode.name === targetPathNode.name;
  }
  if (
    (t.isStringLiteral(pathNode) && t.isStringLiteral(targetPathNode)) ||
    (t.isNumericLiteral(pathNode) && t.isNumericLiteral(targetPathNode))
  ) {
    return pathNode.value === targetPathNode.value;
  }
  return false;
}

function getDeepestNodePath(path: NodePath<t.MemberExpression>) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let deepestNodePath: any = path;
  while (deepestNodePath.node.object) {
    deepestNodePath = deepestNodePath.get("object");
  }
  return deepestNodePath as NodePath<t.Node>;
}

function getReplacementExpressions(replace: Record<string, string>) {
  type ReplacementExpressions = Record<
    string,
    {
      from: t.MemberExpression | t.Identifier;
      to: t.MemberExpression | t.Identifier;
    }
  >;
  return Object.keys(replace).reduce((acc, from) => {
    const fromMemberExpressionOrIdentifier =
      parseToMemberExpressionOrIdentifier(from);
    return Object.assign(acc, {
      [from]: {
        from: fromMemberExpressionOrIdentifier,
        to: parseToMemberExpressionOrIdentifier(replace[from]),
      },
    });
  }, {} as ReplacementExpressions);
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
