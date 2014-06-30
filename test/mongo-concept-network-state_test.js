/* jshint node:true */
/*global describe:true, it:true, before:true, beforeEach:true */
"use strict";

// # Tests for mongo-concept-network-state module

// ## Required libraries
var assert = require('assert');

// Module to test
var ConceptNetwork = require('../lib/mongo-concept-network').ConceptNetwork;
var ConceptNetworkState = require('../lib/mongo-concept-network-state')
                          .ConceptNetworkState;

// ## ConceptNetwork
describe('ConceptNetworkState', function () {
  // ### Constructor
  describe('#Constructor', function () {

    it('should throw an exception if no ConceptNetwork is given', function () {
      assert.throws(function () {
        var cns = new ConceptNetworkState();
      },
      Error);
    });

    it('should not throw an exception', function () {
      assert.doesNotThrow(function () {
        var cn = new ConceptNetwork("test");
        var cns = new ConceptNetworkState(cn);
      }, null, "unexpected error");
    });

  });

  describe('#activate', function () {

    var cn, cns, node1;
    before(function (done) {
      cn = new ConceptNetwork("test");
      cns = new ConceptNetworkState(cn);
      cn.addNode("Node 1", function (node) {
        node1 = node;
        done();
      });
    });

    it('should put the node activation to 100', function (done) {
      cns.activate(node1._id, function (nodeState) {
        assert.equal(nodeState.activationValue, 100);
        done();
      });
    });

  });

  describe('#getters', function () {

    var cn, cns, node1, node2, node3;

    describe('##getActivationValue', function () {

      before(function (done) {
        cn = new ConceptNetwork("test");
        cns = new ConceptNetworkState(cn);
        cn.addNode("Node 1", function (node) {
          node1 = node;
          cn.addNode("Node 2", function (node) {
            node2 = node;
            cns.activate(node1._id, function (nodeState) {
              done();
            });
          });
        });
        
      });

      it('should get a zero activation value', function (done) {
        cns.getActivationValue(node2._id, function (activationValue) {
          assert.equal(activationValue, 0);
          done();
        });
      });

      it('should get a 100 activation value', function (done) {
        cns.getActivationValue(node1._id, function (activationValue) {
          assert.equal(activationValue, 100);
          done();
        });
      });
    });

    describe.skip('##getOldActivationValue', function () {

      before(function () {
        cn = new ConceptNetwork("test");
        cns = new ConceptNetworkState(cn);
        node1 = cn.addNode("Node 1");
        node2 = cn.addNode("Node 2");
        cns.activate(node1.id);
        cns.propagate();
      });

      it('should get a zero activation value', function () {
        assert.deepEqual(cns.getOldActivationValue(node2.id), 0);
      });

      it('should get a 100 activation value', function () {
        assert.deepEqual(cns.getOldActivationValue(node1.id), 100);
      });
    });

    describe('##getMaximumActivationValue', function () {

      before(function (done) {
        cn = new ConceptNetwork("test");
        cns = new ConceptNetworkState(cn);
        cn.db.conceptnetwork.remove()
        .then(function () {
          cn.addNode("Node 1", function (node) {
            node1 = node;
            cn.addNode("sNode 2", function (node) {
              node2 = node;
              cn.addNode("tNode 3", function (node) {
                node3 = node;
                done();
              });
            });
          });
        });
      });

      it('should return 0 when no node is activated', function (done) {
        cns.getMaximumActivationValue(function (maximumActivationValue) {
          assert.equal(maximumActivationValue, 0);
          done();
        });
      });

      it.only('should get the maximum activation value for any token', function (done) {
        cns.setActivationValue(node1._id, 75, function () {
          cns.setActivationValue(node2._id, 70, function () {
            cns.setActivationValue(node3._id, 50, function () {
              cns.getMaximumActivationValue(function (maximumActivationValue) {
                assert.equal(maximumActivationValue, 75);
                done();
              });
            });
          });
        });
      });

      it('should get the maximum activation value for t tokens', function (done) {
        cns.setActivationValue(node1._id, 75, function () {
          cns.setActivationValue(node2._id, 70, function () {
            cns.setActivationValue(node3._id, 50, function () {
              cns.getMaximumActivationValue('s', function (maximumActivationValue) {
                assert.equal(maximumActivationValue, 70);
                done();
              });
            });
          });
        });
      });
    });

    describe.skip('##getActivatedTypedNodes', function () {

      before(function () {
        cn = new ConceptNetwork("test");
        cns = new ConceptNetworkState(cn);
        node1 = cn.addNode("Node 1");
        node2 = cn.addNode("sNode 2");
        node3 = cn.addNode("tNode 3");
      });

      it('should return an empty array', function () {
        assert.deepEqual(cns.getActivatedTypedNodes(), []);
      });

      it('should return one-node-array', function () {
        cns.setActivationValue(node1.id, 100);
        var result = cns.getActivatedTypedNodes();
        assert.deepEqual(result,
          [{"node": {"id": 1, "label": "Node 1", "occ": 1},
            "activationValue": 100}]);
      });

      it('should return two-nodes-array', function () {
        cns.setActivationValue(node2.id, 95);
        var result = cns.getActivatedTypedNodes();
        assert.deepEqual(result,
          [{"node": {"id": 1, "label": "Node 1", "occ": 1},
            "activationValue": 100},
           {"node": {"id": 2, "label": "sNode 2", "occ": 1},
            "activationValue": 95}
          ]);
      });

      it('should return one-node-array of type s', function () {
        cns.setActivationValue(node2.id, 95);
        var result = cns.getActivatedTypedNodes('s');
        assert.deepEqual(result,
          [{"node": {"id": 2, "label": "sNode 2", "occ": 1},
            "activationValue": 95}
          ]);
      });

      it('should return one-node-array where threshold = 96', function () {
        cns.setActivationValue(node1.id, 100);
        var result = cns.getActivatedTypedNodes('', 96);
        assert.deepEqual(result,
          [{"node": {"id": 1, "label": "Node 1", "occ": 1},
            "activationValue": 100}]);
      });

    });



      /*(self, cn, typeNames, threshold=90):
        """Get the activated nodes of cn.

        The returned nodes must be in the list of typeNames, and
        have an activation value greater than threshold

        Return a list of tuples (node,activation value)"""')*/

  });

  describe('#setters', function () {

    var cn, cns, node1, node2;

    describe('##setActivationValue', function () {

      before(function (done) {
        cn = new ConceptNetwork("test");
        cns = new ConceptNetworkState(cn);
        cn.db.conceptnetwork.remove()
        .then(function () {
          cn.addNode("Node 1", function (node) {
            node1 = node;
            cn.addNode("Node 2", function (node) {
              node2 = node;
              done();
            });
          });
        });
      });

      it('should set a zero activation value', function (done) {
        cns.setActivationValue(node2._id, 0, function () {
          cns.getActivationValue(node2._id, function (activationValue) {
            assert.deepEqual(activationValue, 0);
            done();
          });
        });
      });

      it('should set a 75 activation value', function (done) {
        cns.setActivationValue(node1._id, 75, function () {
          cns.getActivationValue(node1._id, function (activationValue) {
            assert.deepEqual(activationValue, 75);
            done();
          });
        });
      });

    });
  });

  describe.skip('#propagate', function () {

    var cn, cns, node1, node2, link12;
    before(function (done) {
      cn = new ConceptNetwork("test");
      cns = new ConceptNetworkState(cn);
      cn.db.conceptnetwork.remove()
      .then(function () {
        cn.addNode("Node 1", function (node) {
          node1 = node;
          cn.addNode("Node 2", function (node) {
            node2 = node;
            cn.addLink(node1._id, node2._id, function (link) {
              link12 = link;
              done();
            });
          });
        });
      });
    });

    it('should deactivate node without afferent links', function () {
      cns.activate(node1.id);
      assert.equal(cns.getActivationValue(node1.id), 100);
      cns.propagate();
      assert.equal(cns.getActivationValue(node1.id) < 100, true);
    });

    it('should activate node 2', function () {
      assert.equal(cns.getActivationValue(node2.id) > 0, true);
    });

  });

});
