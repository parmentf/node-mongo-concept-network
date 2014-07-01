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

      it('should get the maximum activation value for any token', function (done) {
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

      it('should get the maximum activation value for s tokens', function (done) {
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

    describe('##getActivatedTypedNodes', function () {

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

      it('should return an empty array', function () {
        cns.getActivatedTypedNodes(function (activatedNodes) {
          assert.deepEqual(activatedNodes, []);
        });
      });

      it('should return one-node-array', function () {
        cns.setActivationValue(node1._id, 100, function () {
          cns.getActivatedTypedNodes(function (result) {
            assert.deepEqual(result,
              [{"node": {"id": node1._id, "label": "Node 1", "occ": 1},
                "activationValue": 100}]);
          });
        });
      });

      it('should return two-nodes-array', function () {
        cns.setActivationValue(node2._id, 95, function () {
          cns.getActivatedTypedNodes(function (result) {
            assert.deepEqual(result,
              [
                {"node": {"id": node1._id, "label": "Node 1", "occ": 1},
                 "activationValue": 100},
                {"node": {"id": node2._id, "label": "sNode 2", "occ": 1},
                 "activationValue": 95}
              ]);
          });
        });
      });

      it('should return one-node-array of type s', function () {
        cns.getActivatedTypedNodes("s", function (result) {
          assert.deepEqual(result,
            [
              {"node": {"id": node2._id, "label": "sNode 2", "occ": 1},
               "activationValue": 95}
            ]);
        });
      });

      it('should return one-node-array where threshold = 96', function () {
        cns.getActivatedTypedNodes('', 96, function (result) {
          assert.deepEqual(result,
            [{"node": {"id": node1._id, "label": "Node 1", "occ": 1},
              "activationValue": 100}]);
        });
      });

    });

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

  describe('#propagate', function () {

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

    it('should deactivate node without afferent links', function (done) {
      cns.activate(node1._id, function (node) {
        cns.getActivationValue(node1._id, function (activationValue) {
          assert.equal(activationValue, 100);
          cns.propagate(function () {
            cns.getActivationValue(node1._id, function (activationValue) {
              assert.equal(activationValue < 100, true);
              done();
            });
          });
        });
      });
    });

    it('should activate node 2', function () {
      cns.getActivationValue(node2._id, function (activationValue) {
        assert.equal(activationValue > 0, true);
      });
    });

  });

});
