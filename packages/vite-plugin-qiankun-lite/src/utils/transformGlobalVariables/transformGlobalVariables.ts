import { type NodePath, transformSync, types as t } from "@babel/core";
import { declare } from "@babel/helper-plugin-utils";
import { parse } from "@babel/parser";

type Options = {
  replace: Record<string, string>;
};

const babelPluginTransformGlobalVariables = declare<Options>((api, options) => {
  const replacementIdentifiers = getReplacementIdentifiers(options.replace);
  return {
    visitor: {
      Identifier(path) {
        if (isReplaceableIdentifier(path, replacementIdentifiers)) {
          const name = path.node.name;
          const replacementIdentifier = replacementIdentifiers[name];
          path.replaceWith(replacementIdentifier);
        }
      },
    },
  };
});

export function transformGlobalVariables(code: string, options: Options) {
  const result = transformSync(code, {
    plugins: [[babelPluginTransformGlobalVariables, options]],
  });
  return result?.code;
}

function isReplaceableIdentifier(
  path: NodePath<t.Identifier>,
  identifiers: Record<string, t.Identifier | t.MemberExpression>,
) {
  return (
    // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
    identifiers.hasOwnProperty(path.node.name) &&
    !path.scope.hasBinding(path.node.name) &&
    !path.parentPath.isMemberExpression({ property: path.node }) &&
    !path.parentPath.isObjectProperty({ key: path.node })
  );
}

function getReplacementIdentifiers(replace: Record<string, string>) {
  return Object.keys(replace).reduce(
    (object, name) =>
      Object.assign(object, {
        [name]: parseToMemberExpressionOrIdentifier(replace[name]),
      }),
    {} as Record<string, t.Identifier | t.MemberExpression>,
  );
}

function parseToMemberExpressionOrIdentifier(code: string) {
  const ast = parse(code);
  const statement = ast.program.body[0];
  if (!t.isExpressionStatement(statement)) {
    throw new Error("Expected ExpressionStatement");
  }
  const expression = statement.expression;
  if (t.isMemberExpression(expression) && t.isIdentifier(expression)) {
    throw new Error("Expected MemberExpression or Identifier");
  }
  return expression as t.Identifier | t.MemberExpression;
}
