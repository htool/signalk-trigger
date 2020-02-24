const jexl = require('jexl');
const extractIdentifiers = require('../lib/extractIdentifiers.js');
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

describe('extractIdentifiers', function() {
  describe('literal', function() {
    it('should return an empty list when finding a literal', function() {
      let expr = jexl.compile('1');
      assert.deepEqual(extractIdentifiers(expr), []);
    });
    it('should return an empty list when finding a string literal', function() {
      let expr = jexl.compile('"test"');
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

  describe('Transform', function() {
    it('should return one identifier no arguments', function() {
      let expr = jexl.compile('test|double');
      assert.deepEqual(extractIdentifiers(expr), ['test']);
    });
    it('should return two identifiers one argument', function() {
      let expr = jexl.compile('test|split(temp)');
      assert.deepEqual(extractIdentifiers(expr), ['test', 'temp']);
    });
    it('should return one identifier one argument literal', function() {
      let expr = jexl.compile('test|split("temp")');
      assert.deepEqual(extractIdentifiers(expr), ['test']);
    });
    it('should return one identifier one argument subject literal', function() {
      let expr = jexl.compile('"test"|split(temp)');
      assert.deepEqual(extractIdentifiers(expr), ['temp']);
    });
    it('should return no identifiers one argument both literal', function() {
      let expr = jexl.compile('"test"|split("temp")');
      assert.deepEqual(extractIdentifiers(expr), []);
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
  describe('noDuplicates', function() {
    it('should return a single identifier not two', function() {
      let expr = jexl.compile('test + test');
      assert.deepEqual(extractIdentifiers(expr), ['test']);
    });
  });
  describe('noAst', function() {
    it('should throw an exception when given an empty object', function() {
      expect(() => extractIdentifiers({})).to.throw();
    });
    it('should throw an exception when given a null', function() {
      expect(() => extractIdentifiers(null)).to.throw();
    });
    it('should throw an exception when given a string', function() {
      expect(() => extractIdentifiers("null")).to.throw();
    });
    it('should throw an exception when given an undefined', function() {
      expect(() => extractIdentifiers(undefined)).to.throw();
    });
  });
  describe('unkownType', function() {
    it('should throw an exception when finding an unkown type', function() {
      expect(() => extractIdentifiers({
        _ast: {
          type: "unknown"
        }
      })).to.throw();
    });
  });
});
