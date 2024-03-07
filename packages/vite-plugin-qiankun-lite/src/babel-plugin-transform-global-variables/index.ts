import { type NodePath, types as t } from "@babel/core";
import generator from "@babel/generator";
import { declare } from "@babel/helper-plugin-utils";
import { parse } from "@babel/parser";

type Options = {
  replace: Record<string, string>;
};

export default declare<Options>((api, options) => {
  const replaces = Object.keys(options.replace).map((name) =>
    parseToExpression(name),
  );
  const replacementIdentifiers = replaces.filter(
    (replace): replace is t.Identifier => t.isIdentifier(replace),
  );
  const replacementMemberExpressions = replaces.filter(
    (replace): replace is t.MemberExpression => t.isMemberExpression(replace),
  );
  const replacementExpressions = getReplacementExpressions(options.replace);
  return {
    visitor: {
      Identifier(path) {
        if (isReplaceableIdentifiers(path, replacementIdentifiers)) {
          const name = path.node.name;
          const replacementIdentifier = replacementExpressions[name];
          path.replaceWith(replacementIdentifier);
        }
      },
      MemberExpression(path) {
        if (isReplaceableMemberExpression(path, replacementMemberExpressions)) {
          const replacementMemberExpression =
            replacementExpressions[generator(path.node).code];
          path.replaceWith(replacementMemberExpression);
        }
      },
    },
  };
});

function isReplaceableIdentifiers(
  path: NodePath<t.Identifier>,
  replacement: t.Identifier[],
) {
  return (
    replacement.some((replace) => replace.name === path.node.name) &&
    !path.scope.hasBinding(path.node.name) &&
    !path.parentPath.isMemberExpression({ property: path.node }) &&
    !path.parentPath.isObjectProperty({ key: path.node }) &&
    !path.parentPath.isObjectMethod({ key: path.node }) &&
    !path.parentPath.isClassProperty({ key: path.node }) &&
    !path.parentPath.isClassMethod({ key: path.node }) &&
    !path.parentPath.isPrivateName({ id: path.node })
  );
}

function isReplaceableMemberExpression(
  path: NodePath<t.MemberExpression>,
  replacement: t.MemberExpression[],
) {
  const deepestExpression = getDeepestExpression(path);
  return (
    replacement.some((replace) =>
      isMatchingMemberExpression(path.node, replace),
    ) &&
    t.isIdentifier(deepestExpression.node) &&
    !deepestExpression.scope.hasBinding(deepestExpression.node.name) &&
    !path.parentPath.isMemberExpression({ object: path.node })
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

function getDeepestExpression(path: NodePath<t.MemberExpression>) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let deepestExpression: any = path;
  while (deepestExpression.node.object) {
    deepestExpression = deepestExpression.get("object");
  }
  return deepestExpression;
}

function getReplacementExpressions(replace: Record<string, string>) {
  return Object.keys(replace).reduce(
    (object, name) =>
      Object.assign(object, {
        [name]: parseToExpression(replace[name]),
      }),
    {} as Record<string, t.Expression>,
  );
}

function parseToExpression(code: string) {
  const ast = parse(code);
  const statement = ast.program.body[0];
  if (!t.isExpressionStatement(statement)) {
    throw new Error("Expected ExpressionStatement");
  }
  const expression = statement.expression;
  if (t.isMemberExpression(expression) && t.isIdentifier(expression)) {
    throw new Error("Expected MemberExpression or Identifier");
  }
  return expression as t.Expression;
}
