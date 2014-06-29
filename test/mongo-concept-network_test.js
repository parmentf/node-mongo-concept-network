/* jshint node:true */
/*global describe:true, it:true, before:true */
"use strict";

// # Tests for mongo-concept-network module

// ## Required libraries
var assert = require('assert');
var pmongo = require('promised-mongo');

// Module to test
var ConceptNetwork = require('../lib/mongo-concept-network').ConceptNetwork;

var db = pmongo("test",["conceptnetwork"]);

// ## ConceptNetwork
describe('ConceptNetwork', function () {
  // ### Constructor
  describe('#Constructor', function () {
    it('should not throw an exception', function () {
      assert.doesNotThrow(function () {
        var cn = new ConceptNetwork();
      }, null, "unexpected error");
    });
  });

  var cn;
  // ### addNode
  describe('#addNode', function () {

    before(function (done) {
      db.conceptnetwork.remove()
      .then(function() {
        cn = new ConceptNetwork("test");
        done();
      });
    });

    it('should return an object', function (done) {
      cn.addNode("Chuck Norris", function(node) {
        assert.equal(node.hasOwnProperty("_id"), true);
        assert.equal(node.label, "Chuck Norris");
        assert.equal(node.occ, 1);
        done();
      });
    });

    it('should increment occ', function (done) {
      var node = cn.addNode("Chuck Norris", function(node) {
        assert.equal(node.occ, 2);
        done();
      });
    });

    it('should have two nodes', function (done) {
      var node = cn.addNode("World", function (node) {
        db.conceptnetwork.count()
          .then(function (res) {
          assert.equal(res, 2);
          done();
        });
      });
    });

    it('should increment a previous node too', function (done) {
      var node = cn.addNode("Chuck Norris", function (node) {
        assert.equal(node.occ, 3);
        done();
      });
    });
  });

  // ### decrementNode
  describe('#decrementNode', function () {

    it('should decrement a node with occ of 3', function (done) {
      var node = cn.decrementNode("Chuck Norris", function (node) {
        assert.equal(node.occ, 2);
        done();
      });
    });

    it('should remove a node with an occ of 1', function (done) {
      var node = cn.decrementNode("World", function (node) {
        assert.equal(node, null);
        done();
      });
    });
  });

  // ### removeNode
  describe('#removeNode', function () {

    it('should remove even a node with occ value of 2', function (done) {
      db.conceptnetwork.findOne({ label: "Chuck Norris"})
      .then(function(node) {
        assert.equal(node.occ, 2);
        cn.removeNode(node._id, function (err1) {
          db.conceptnetwork.findOne({ label: "Chuck Norris"})
          .then(function(err2) {
            done(err2);
          });
        });
      });
    });

  });

  describe("#addLink", function () {

    var node1id, node2id, node3id;
    
    before(function (done) {
      cn = new ConceptNetwork("test");
      cn.addNode("Node 1", function (node1) {
        node1id = node1._id;
        cn.addNode("Node 2", function (node2) {
          node2id = node2._id;
          cn.addNode("Node 3", function (node3){
            node3id = node3._id;
            done();
          });
        });
      });
    });

    it('should return an object', function (done) {
      cn.addLink(node1id, node2id, function (link) {
        assert.equal(link.coOcc, 1);
        done();
      });
    });

    it('should increment coOcc', function (done) {
      cn.addLink(node1id, node2id, function (link) {
        assert.equal(link.coOcc, 2);
        done();
      });
    });

    it('should create a good fromIndex', function (done) {
      cn.addLink(node1id, node3id, function (link) {
        assert.equal(link.fromId.toString(), node1id.toString());
        assert.equal(link.toId.toString(), node3id.toString());
        done();
      });
      
    });

    it('should not accept non number ids', function (done) {
      cn.addLink(node1id, "berf", function(link) {
        assert.equal(link instanceof Error, true);
        cn.addLink("barf", node2id, function (link) {
          assert.equal(link instanceof Error, true);
          done();
        });
      });
    });

  });

  describe("#decrementLink", function () {

    var node1id, node2id, link12;
    
    before(function (done) {
      db.conceptnetwork.remove()
      .then(function() {
        cn = new ConceptNetwork("test");
        cn.addNode("Node 1", function (node1) {
          node1id = node1._id;
          cn.addNode("Node 2", function (node2) {
            node2id = node2._id;
            cn.addLink(node1id, node2id, function (link) {
              cn.addLink(node1id, node2id, function (link) {
                link12 = link;
                done();
              });
            });
          });
        });
      });
    });

    it('should decrement a coOcc value of 2', function (done) {
      assert.equal(link12.coOcc, 2);
      cn.decrementLink(node1id, node2id, function (link) {
        assert.equal(link.coOcc, 1);
        done();
      });
    });

    it('should remove a link with a coOcc value of 0', function (done) {
      cn.decrementLink(node1id, node2id, function (link) {
        assert.equal(link, null);
        done();
      });
    });

  });

  describe("#removeLink", function () {
    
    var node1id, node2id, link12;
    
    before(function (done) {
      db.conceptnetwork.remove()
      .then(function() {
        cn = new ConceptNetwork("test");
        cn.addNode("Node 1", function (node1) {
          node1id = node1._id;
          cn.addNode("Node 2", function (node2) {
            node2id = node2._id;
            cn.addLink(node1id, node2id, function (link) {
              link12 = link;
              done();
            });
          });
        });
      });
    });

    it('should remove the link', function (done) {
      assert.equal(link12.fromId.toString(), node1id.toString());
      assert.equal(link12.toId.toString(), node2id.toString());
      assert.equal(link12.coOcc, 1);
      /*assert.deepEqual(cn.link['1_2'], { fromId: 1, toId: 2, coOcc: 1 });*/
      cn.removeLink(link12._id, function (err) {
        db.conceptnetwork.findOne({ fromId: node1id, toId: node2id })
        .then(function (res) {
          assert.equal(res, null);
          done(err);
        });
      });
      
    });
  });

  describe.skip('#getters', function () {

    before(function () {
      cn = new ConceptNetwork("test");
      cn.addNode("Node 1");
      cn.addNode("Node 2");
      cn.addNode("Node 3");
      cn.addLink(1, 2);
      cn.addLink(1, 3);
      cn.addLink(2, 3);
    });

    describe('#getNode', function () {

      it('should get the second node', function () {
        var node = cn.getNode('Node 2');
        assert.equal(node.id, 2);
      });

      it('should return null when the node does not exist', function () {
        var node = cn.getNode('Nonexistent');
        assert.equal(node, null);
      });

    });

    describe('#getLink', function () {

      it('should get the link', function () {
        var link = cn.getLink('1_2');
        assert.equal(link.fromId, 1);
        assert.equal(link.toId, 2);
        assert.equal(link.coOcc, 1);
      });

      it('should return null when the node does not exist', function () {
        var link = cn.getLink('1_100');
        assert.equal(link, null);
      });

    });

    describe('#getNodeFromLinks', function () {

      it('should get all links from node 2', function () {
        var fromLinks = cn.getNodeFromLinks(2);
        assert.deepEqual(fromLinks, ['2_3']);
      });

      it('should get all links from node 1', function () {
        var fromLinks = cn.getNodeFromLinks(1);
        assert.deepEqual(fromLinks, ['1_2', '1_3']);
      });

      it('should get no links from node 3', function () {
        var fromLinks = cn.getNodeFromLinks(3);
        assert.deepEqual(fromLinks, []);
      });

    });

    describe('#getNodeToLinks', function () {

      it('should get all links to node 2', function () {
        var toLinks = cn.getNodeToLinks(2);
        assert.deepEqual(toLinks, ['1_2']);
      });

      it('should get all links to node 3', function () {
        var toLinks = cn.getNodeToLinks(3);
        assert.deepEqual(toLinks, ['1_3', '2_3']);
      });

      it('should get no links to node 1', function () {
        var toLinks = cn.getNodeToLinks(1);
        assert.deepEqual(toLinks, []);
      });

    });

  });

});
