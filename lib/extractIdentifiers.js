module.exports = (expr) => {
  return Array.from(new Set(extractIdentifiers(expr._ast)));
};

function extractIdentifiers(ast) {
  if (ast.type == 'Identifier') {
    return [concatIdentifier(ast)];
  } else if (ast.type == 'BinaryExpression') {
    return extractIdentifiers(ast.left).concat(extractIdentifiers(ast.right));
  } else if (ast.type == 'UnaryExpression') {
    return extractIdentifiers(ast.right);
  } else if (ast.type == 'Literal') {
    return [];
  } else if (ast.type == 'FilterExpression') {
    return extractIdentifiers(ast.subject).concat(extractIdentifiers(ast.expr));
  } else if (ast.type == 'ConditionalExpression') {
    return extractIdentifiers(ast.test).concat(extractIdentifiers(ast.consequent), extractIdentifiers(ast.alternate));
  } else if (ast.type == 'ArrayLiteral') {
    return ast.value.flatMap(value => extractIdentifiers(value));
  } else if (ast.type == 'ObjectLiteral') {
    return Object.values(ast.value).flatMap(value => extractIdentifiers(value));
  } else if (ast.type == 'Transform') {
    return extractIdentifiers(ast.subject).concat(ast.args.flatMap(value => extractIdentifiers(value)));
  }
}

function concatIdentifier(identifier) {
  if (identifier.from) {
    return concatIdentifier(identifier.from) + '.' + identifier.value;
  } else {
    return identifier.value;
  }
}
