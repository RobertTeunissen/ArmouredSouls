/**
 * Custom ESLint rule: require-validate-request
 *
 * Ensures every router.get/post/put/delete/patch() call in route files
 * includes a `validateRequest` call in its middleware arguments.
 *
 * Works with both single-line and multi-line route definitions by
 * walking the AST arguments array rather than doing text matching.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require validateRequest middleware on all route handlers',
    },
    messages: {
      missingValidation:
        'Route handler "{{method}} {{path}}" is missing validateRequest middleware. All route handlers must use validateRequest() for Zod schema validation.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Match router.get(), router.post(), router.put(), router.delete(), router.patch()
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.object.name !== 'router' ||
          node.callee.property.type !== 'Identifier' ||
          !['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
        ) {
          return;
        }

        // Walk all arguments looking for a validateRequest call
        const hasValidateRequest = node.arguments.some((arg) => {
          return containsValidateRequest(arg);
        });

        if (!hasValidateRequest) {
          const method = node.callee.property.name.toUpperCase();
          const pathArg = node.arguments[0];
          const path = pathArg && pathArg.type === 'Literal' ? pathArg.value : '(dynamic)';
          context.report({
            node,
            messageId: 'missingValidation',
            data: { method, path },
          });
        }
      },
    };

    /**
     * Recursively check if a node is or contains a call to validateRequest.
     * Handles direct calls, array expressions, spread elements, conditionals, etc.
     */
    function containsValidateRequest(node) {
      if (!node) return false;

      // Direct call: validateRequest({...})
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'validateRequest'
      ) {
        return true;
      }

      switch (node.type) {
        case 'ArrayExpression':
          return node.elements.some((el) => containsValidateRequest(el));
        case 'SpreadElement':
          return containsValidateRequest(node.argument);
        case 'SequenceExpression':
          return node.expressions.some((expr) => containsValidateRequest(expr));
        case 'ConditionalExpression':
          return (
            containsValidateRequest(node.consequent) ||
            containsValidateRequest(node.alternate)
          );
        case 'LogicalExpression':
          return (
            containsValidateRequest(node.left) || containsValidateRequest(node.right)
          );
        case 'CallExpression':
        case 'NewExpression':
          return (
            containsValidateRequest(node.callee) ||
            node.arguments.some((arg) => containsValidateRequest(arg))
          );
        default:
          return false;
      }
    }
  },
};
