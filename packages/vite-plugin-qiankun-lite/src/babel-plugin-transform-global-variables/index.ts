import { type NodePath, types as t } from "@babel/core";
import { declare } from "@babel/helper-plugin-utils";
import { parse } from "@babel/parser";

type Options = {
  replace: Record<string, string>;
};

export default declare<Options>((api, options) => {
  const replacementExpressions = getReplacementExpressions(options.replace);
  return {
    visitor: {
      Identifier(path) {
        if (isReplaceableExpressions(path, replacementExpressions)) {
          const name = path.node.name;
          const replacementIdentifier = replacementExpressions[name];
          path.replaceWith(replacementIdentifier);
        }
      },
    },
  };
});

function isReplaceableExpressions(
  path: NodePath<t.Identifier>,
  identifiers: Record<string, t.Expression>,
) {
  return (
    // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
    identifiers.hasOwnProperty(path.node.name) &&
    !path.scope.hasBinding(path.node.name) &&
    !path.parentPath.isMemberExpression({ property: path.node }) &&
    !path.parentPath.isObjectProperty({ key: path.node })
  );
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
