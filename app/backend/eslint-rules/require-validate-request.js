/**
 * Custom ESLint rule: require-validate-request
 *
 * Ensures every router.get/post/put/delete/patch() call in route files
 * includes a `validateRequest` call in its middleware arguments.
 *
 * Additionally, if the route path contains `:params`, the `validateRequest`
 * call must include a `params` key. If the handler accesses `req.body`,
 * it must include a `body` key. Routes without params or body access
 * may use `validateRequest({})` or add `// eslint-disable-next-line` with
 * an explanation if they genuinely have no input.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require validateRequest middleware on all route handlers with appropriate schema keys',
    },
    messages: {
      missingValidation:
        'Route handler "{{method}} {{path}}" is missing validateRequest middleware. All route handlers must use validateRequest() for Zod schema validation.',
      missingParamsSchema:
        'Route "{{method}} {{path}}" has URL parameters but validateRequest() is missing a `params` schema key.',
      missingBodySchema:
        'Route "{{method}} {{path}}" accesses req.body but validateRequest() is missing a `body` schema key.',
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

        const method = node.callee.property.name.toUpperCase();
        const pathArg = node.arguments[0];
        const path = pathArg && pathArg.type === 'Literal' ? pathArg.value : '(dynamic)';

        // Walk all arguments looking for a validateRequest call
        const validateCallNode = findValidateRequestCall(node.arguments);

        if (!validateCallNode) {
          context.report({
            node,
            messageId: 'missingValidation',
            data: { method, path },
          });
          return;
        }

        // Check if route has URL params (e.g. :id, :robotId)
        const hasUrlParams = typeof path === 'string' && path.includes(':');

        // Check if validateRequest has a `params` key
        const schemaArg = validateCallNode.arguments[0];
        const hasParamsKey = schemaArg && hasObjectKey(schemaArg, 'params');
        const hasBodyKey = schemaArg && hasObjectKey(schemaArg, 'body');

        // Report missing params schema for routes with URL parameters
        if (hasUrlParams && !hasParamsKey) {
          context.report({
            node: validateCallNode,
            messageId: 'missingParamsSchema',
            data: { method, path },
          });
        }

        // Check if the handler function accesses req.body
        const handlerNode = findHandlerFunction(node.arguments);
        if (handlerNode && accessesReqBody(handlerNode) && !hasBodyKey) {
          context.report({
            node: validateCallNode,
            messageId: 'missingBodySchema',
            data: { method, path },
          });
        }
      },
    };

    /**
     * Find the validateRequest CallExpression node within the arguments.
     */
    function findValidateRequestCall(args) {
      for (const arg of args) {
        const found = findValidateRequestNode(arg);
        if (found) return found;
      }
      return null;
    }

    /**
     * Recursively search for the validateRequest call node.
     */
    function findValidateRequestNode(node) {
      if (!node) return null;

      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'validateRequest'
      ) {
        return node;
      }

      switch (node.type) {
        case 'ArrayExpression':
          for (const el of node.elements) {
            const found = findValidateRequestNode(el);
            if (found) return found;
          }
          return null;
        case 'SpreadElement':
          return findValidateRequestNode(node.argument);
        case 'SequenceExpression':
          for (const expr of node.expressions) {
            const found = findValidateRequestNode(expr);
            if (found) return found;
          }
          return null;
        case 'ConditionalExpression':
          return findValidateRequestNode(node.consequent) || findValidateRequestNode(node.alternate);
        case 'LogicalExpression':
          return findValidateRequestNode(node.left) || findValidateRequestNode(node.right);
        case 'CallExpression':
        case 'NewExpression':
          for (const arg of node.arguments) {
            const found = findValidateRequestNode(arg);
            if (found) return found;
          }
          return findValidateRequestNode(node.callee);
        default:
          return null;
      }
    }

    /**
     * Check if an ObjectExpression node has a specific key.
     */
    function hasObjectKey(node, keyName) {
      if (!node || node.type !== 'ObjectExpression') return false;
      return node.properties.some(
        (prop) =>
          prop.type === 'Property' &&
          ((prop.key.type === 'Identifier' && prop.key.name === keyName) ||
           (prop.key.type === 'Literal' && prop.key.value === keyName))
      );
    }

    /**
     * Find the handler function (last arrow/function expression in the arguments).
     */
    function findHandlerFunction(args) {
      for (let i = args.length - 1; i >= 0; i--) {
        const arg = args[i];
        if (
          arg.type === 'ArrowFunctionExpression' ||
          arg.type === 'FunctionExpression'
        ) {
          return arg;
        }
      }
      return null;
    }

    /**
     * Check if a function node accesses `req.body` anywhere in its body.
     */
    function accessesReqBody(fnNode) {
      const reqParam = fnNode.params[0];
      if (!reqParam) return false;

      // Get the name of the request parameter (could be 'req', 'request', '_req', etc.)
      let reqName = null;
      if (reqParam.type === 'Identifier') {
        reqName = reqParam.name;
      } else if (reqParam.type === 'AssignmentPattern' && reqParam.left.type === 'Identifier') {
        reqName = reqParam.left.name;
      }
      if (!reqName) return false;

      return containsBodyAccess(fnNode.body, reqName);
    }

    /**
     * Recursively check if an AST node contains `<reqName>.body` access.
     */
    function containsBodyAccess(node, reqName) {
      if (!node) return false;

      if (
        node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        node.object.name === reqName &&
        node.property.type === 'Identifier' &&
        node.property.name === 'body'
      ) {
        return true;
      }

      // Recurse into child nodes
      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item.type === 'string' && containsBodyAccess(item, reqName)) {
                return true;
              }
            }
          } else if (typeof child.type === 'string') {
            if (containsBodyAccess(child, reqName)) return true;
          }
        }
      }
      return false;
    }
  },
};
