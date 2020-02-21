const jexl = require('jexl');
const extractIdentifiers = require('../lib/extractIdentifiers.js');
const assert = require('assert');

describe('extractIdentifiers', function() {
  describe('literal', function() {
    it('should return an empty list when finding a literal', function() {
      let expr = jexl.compile('1');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
  });

  describe('identifier', function() {
    it('should return a single identifier when finding an identifier', function() {
      let expr = jexl.compile('x');
      assert.deepEqual(extractIdentifiers(expr), ['x']);
    });

    it('should return full name of nested identifier', function() {
      let expr = jexl.compile('x.y.z');
      assert.deepEqual(extractIdentifiers(expr), ['x.y.z']);
    });
  });

  describe('unaryExpression', function() {
    it('should return a single identifier when finding an identifier', function() {
      let expr = jexl.compile('!x');
      assert.deepEqual(extractIdentifiers(expr), ['x']);
    });

    it('should return an empty list when finding a literal', function() {
      let expr = jexl.compile('!1');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
  });

  describe('binaryExpression', function() {
    it('should return all identifiers on both sides of the expression', function() {
      let expr = jexl.compile('x > b');
      assert.deepEqual(extractIdentifiers(expr), ['x', 'b']);
    });

    it('should return the single identifier on the left side', function() {
      let expr = jexl.compile('x > 1');
      assert.deepEqual(extractIdentifiers(expr), ['x']);
    });

    it('should return the single identifier on the right side', function() {
      let expr = jexl.compile('1 > x');
      assert.deepEqual(extractIdentifiers(expr), ['x']);
    });

    it('should return no identifiers', function() {
      let expr = jexl.compile('1 > 2');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
  });

  describe('conditionalExpression', function() {
    it('should return three identifiers', function() {
      let expr = jexl.compile('x?y:z');
      assert.deepEqual(extractIdentifiers(expr), ['x', 'y', 'z']);
    });

    it('should return two identifiers', function() {
      let expr = jexl.compile('x?y:2');
      assert.deepEqual(extractIdentifiers(expr), ['x', 'y']);
    });
  });

  describe('filterExpression', function() {
    it('should return two identifiers', function() {
      let expr = jexl.compile('test[.x>30]');
      assert.deepEqual(extractIdentifiers(expr), ['test', 'x']);
    });
  });

  describe('arrayLiteral', function() {
    it('should return three identifiers when given an array of variables', function() {
      let expr = jexl.compile('[x,y,z]');
      assert.deepEqual(extractIdentifiers(expr), ['x', 'y', 'z']);
    });

    it('should return no identifiers when given an array of values', function() {
      let expr = jexl.compile('[1,2,3]');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
  });
  describe('objectLiteral', function() {
    it('should return a single identifier', function() {
      let expr = jexl.compile('{test: x}');
      assert.deepEqual(extractIdentifiers(expr), ['x']);
    });

    it('should return no identifiers', function() {
      let expr = jexl.compile('{test: 1}');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
  });
});
