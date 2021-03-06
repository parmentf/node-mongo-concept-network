/*jshint node:true, maxlen:80, curly:true, eqeqeq:true, immed:true,
 latedef:true, newcap:true, noarg:true, sub:true, undef:true,
 eqnull:true, laxcomma:true, indent:2, white:true */
/* global emit:true */
 /*
 * mongo-concept-network-state
 * https://github.com/francois/node-mongo-concept-network
 *
 * Copyright (c) 2014 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

var sugar = require('sugar');
var debug = require('debug')('mongo-concept-network-state');

var pmongo = require('promised-mongo');
var ConceptNetwork = require('../index').ConceptNetwork;


/**
 * ## ConceptNetworkState's constructor
 *
 * The state of a concept network is bound to a user.
 *
 * @param {ConceptNetwork} cn The concept network of which it is a state.
 **/
function ConceptNetworkState(cn) {
  if (!(this instanceof ConceptNetworkState)) {
    return new ConceptNetworkState();
  }

  this.nodeState = {}; // nodeId -> {activationValue, oldActivationValue, age}
  this.cn = cn;
  if (!(cn instanceof ConceptNetwork)) {
    throw new Error("Parameter is required");
  }
  this.normalNumberComingLinks = 2; // May be unused
}

// ## ConceptNetworkState's methods
ConceptNetworkState.prototype = {

  /**
   * ### activate
   *
   * Activate the value of the node, which nodeId is given
   * @param {Number} nodeId Identifier of the node to activate
   * @param {Function} callback (nodeState)
   **/
  activate : function (nodeId, callback) {
    this.cn.db.conceptnetwork.findAndModify(
    {
      query: { nodeId: nodeId }, 
      update: { 
        $set: { activationValue: 100 },
      }, 
      upsert: true,
      new: true
    })
    .then(function (nodeStateRes) {
      callback(nodeStateRes[0]);
    });
  },

  /**
   * ### getActivationValue
   * @param {Number} nodeId Identifier of the node
   * @param {Function} callback (activation value (in [0,100]))
   **/
  getActivationValue : function (nodeId, callback) {
    this.cn.db.conceptnetwork
    .findOne({ nodeId: nodeId })
    .then(function (nodeState) {
      if (nodeState === null) {
        callback(0);
      }
      else {
        callback(nodeState.activationValue);
      }
    });
  },

  /**
   * ### setActivationValue
   * @param {Number} nodeId Identifier of the node
   * @param {Number} value new activation value
   * @return {Function} callback
   **/
  setActivationValue : function (nodeId, value, callback) {
    // Reactivate non-activated nodes.
    if (value === 0) {
      this.cn.db.conceptnetwork
      .remove({ nodeId: nodeId })
      .then(function () {
        callback();
      });
    }
    else {
      this.cn.db.conceptnetwork.findAndModify(
      {
        query: { nodeId: nodeId }, 
        update: { 
          $set: { activationValue: value },
        }, 
        upsert: true,
        new: true
      })
      .then(function () {
        callback();
      });
    }
  },

  /**
   * ### getOldActivationValue
   * @param {Number} nodeId Identifier of the node
   * @param {Function} callback (old activation value (in [0,100]))
   **/
  getOldActivationValue : function (nodeId, callback) {
    this.cn.db.conceptnetwork
    .findOne({ nodeId: nodeId })
    .then(function (nodeState) {
      if (nodeState === null) {
        callback(0);
      }
      else {
        callback(nodeState.oldActivationValue);
      }
    });
  },

  /**
   * ### getMaximumActivationValue
   * @param {string|regex} filter beginning of the node label to
   *                              take into account
   * @param {Function} callback (maximum activation value (in [0,100]))
   **/
  getMaximumActivationValue : function (filter, callback) {
    if (!callback) {
      // No filter given
      callback = filter;
      filter = null;
      this.cn.db.conceptnetwork
      .mapReduce(
        function () { emit(1, this.activationValue); },
        function (id, values) { return Math.max.apply(null, values); }, 
        { 
          out: { inline: 1 },
          query: { activationValue: { $exists: true} }
        })
        .then(function (results) {
          if (results.length > 0) {
            callback(results[0].value);
          }
          else {
            callback(0);
          }
        });
    }
    else {
      var self = this;
      // Find nodes which label begins with filter 
      this.cn.db.conceptnetwork
      .find(
        { label: { $regex: "^" + filter } },
        { _id: 1 }
      )
      .toArray(function (err, typedNodesIdsRes) {
        // Make an array of ObjectId
        var typedNodesIds = typedNodesIdsRes.map(function (x) { return x._id });

        // Get the maximum activation value of filtered (typed) nodes
        self.cn.db.conceptnetwork
        .mapReduce(
          function () { emit(1, this.activationValue); },
          function (id, values) { return Math.max.apply(null, values); }, 
          { 
            out: { inline: 1 },
            query: { 
              activationValue: { $exists: true},
              nodeId: { $in: typedNodesIds }
            }
          })
          .then(function (results) {
            if (results.length > 0) {
              callback(results[0].value);
            }
            else {
              callback(0);
            }
          });
        
      });
    }
  },

  /**
   * ### getActivatedTypedNodes
   *
   * Get the activated nodes of ConceptNetwork
   * @param {string} filter beginning of the node label to
   *                        take into account
   * @param {Number} threshold (default: 90)
   * @param {Function} callback ([{ node, activationValue}]))
   **/
  getActivatedTypedNodes : function (filter, threshold, callback) {
    if (callback === undefined) {
      if (threshold === undefined) {
        callback = filter;
        filter = undefined;
      }
      else {
        callback = threshold;
      }
    }
    if (threshold === undefined) { threshold = 90; }
    if (filter === undefined) { filter = '' }
    var self = this;
    this.cn.db.conceptnetwork
    .find(
      { label: { $regex: "^" + filter } },
      { _id: 1 }
    )
    .toArray(function (err, typedNodesIdsRes) {
      // Make an array of ObjectId
      var typedNodesIds = typedNodesIdsRes.map(function (x) { return x._id });

      // Get the activated nodes amongst filtered (typed) nodes
      self.cn.db.conceptnetwork
      .mapReduce(
        function () 
        { 
          if (this.activationValue && this.activationValue > threshold) {
            emit(this._id, this.activationValue);
          }
        },
        function (id, values) { return Math.max.apply(null, values); }, 
        { 
          out: { inline: 1 },
          query: { 
            nodeId: { $in: typedNodesIds }
          }
        })
        .then(function (results) {
          callback(results);
        });

    });
  },

  /**
   * ### propagate
   *
   * Propagate the activation values along the links.
   **/
  propagate : function (callback) {
    // Update states (age + oldActivationValue)
    this.cn.db.eval(function () { // eval on mongo server
      var normalNumberComingLinks = 2;
      var nodeState = {};     // nodeId -> node state
      db.conceptnetwork
      .find({ nodeId: { $exists: true} }) // only the nodeStates
      .snapshot()
      .forEach(function (state) {
        // update document, using its own properties
        state.age = (state.age ? state.age : 0) + 1;
        state.oldActivationValue = state.activationValue;
        
        nodeState[state.nodeId] = state;

        // save the updated document
        db.conceptnetwork.save(state);
      });
      
      // Compute influences
      var influenceNb = {};    // nodeId -> nb of influence number
      var influenceValue = {}; // node._id -> influence value
      db.conceptnetwork
      .find({ label: { $exists: true } }) // all the nodes
      .snapshot()
      .forEach(function (node) {
        
        // Get the nodes influenced by current node
        db.conceptnetwork
        .find({ fromId: node._id }) // links from the current node
        .snapshot()
        .forEach(function (link) {
          var nodeToId = link.toId;
          
          // Compute influence value afferent to each node
          var infl = influenceValue[nodeToId] !== undefined ? 
                      influenceValue[nodeToId] : 0;
          infl += 0.5 
                + (nodeState[node._id].oldActivationValue ? 
                    nodeState[node._id].oldActivationValue : 0 ) 
                * link.coOcc;
          influenceValue[nodeToId] = infl;
          influenceNb[nodeToId] = influenceNb[nodeToId] !== undefined ?
                              influenceNb[nodeToId] : 0;
          influenceNb[nodeToId] += 1;
        }); // end: all the links from the current node
        
      }); // end: all the nodes
      
      db.conceptnetwork
      .find({ label: { $exists: true } }) // all the nodes
      .snapshot()
      .forEach(function (node) {
        var nodeState2 = nodeState[node._id] !== undefined ? 
                          nodeState[node._id] : 
                        { activationValue: 0, oldActivationValue: 0, age: 0, nodeId: node._id };
        var decay = 40;
        var memoryPerf = 100;
        var minusAge = 200 / ( 1 + Math.exp(-nodeState2.age / memoryPerf)) - 100;
        var newActivationValue;
        // If this node is not influenced at all
        if (influenceValue[node._id] === undefined || 
           !influenceValue[node._id]) {
          newActivationValue = nodeState2.oldActivationValue -
                               decay * nodeState2.oldActivationValue / 100 -
                               minusAge;
        }
        // If this node receives influence
        else {
          var influence = influenceValue[node._id];
          var nbIncomings = influenceNb[node._id];
          influence /= Math.log(normalNumberComingLinks + nbIncomings) /
                       Math.log(normalNumberComingLinks);
          newActivationValue = nodeState2.oldActivationValue -
                               decay * nodeState2.oldActivationValue / 100 +
                               influence -
                               minusAge;
        }
        newActivationValue = Math.max(newActivationValue, 0);
        newActivationValue = Math.min(newActivationValue, 100);
        //this.setActivationValue(nodeId, newActivationValue);
        nodeState2.activationValue = newActivationValue;
        if(newActivationValue) {
          db.conceptnetwork.save(nodeState2);
        }
        else {
          db.conceptnetwork.remove({ nodeId: node._id });
        }
      }); // end: all the nodes
    }, callback);
    /*var influenceNb = [];    // nodeId -> nb of influence number
    var influenceValue = []; // nodeId -> influence value
    for (var nodeId in this.nodeState) {
      this.nodeState[nodeId].age += 1;
      this.nodeState[nodeId].oldActivationValue =
        this.nodeState[nodeId].activationValue;
    }
    // #### Fill influence table
    // Get the nodes influenced by others
    for (nodeId in this.cn.node) {
      var ov = this.getOldActivationValue(nodeId);
      var links = this.cn.getNodeFromLinks(nodeId);
      debug('links', links);
      // for all outgoing links
      for (var linkIndex in links) {
        debug('linkIndex', linkIndex);
        var linkId = links[linkIndex];
        debug('linkId', linkId);
        var link = this.cn.getLink(linkId);
        debug('link', link);
        var nodeToId = link.toId;
        var infl = typeof influenceValue[nodeToId] !== "undefined" ?
                    influenceValue[nodeToId] : 0;
        infl += 0.5 + ov * link.coOcc;
        influenceValue[nodeToId] = infl;
        influenceNb[nodeToId] = typeof influenceNb[nodeToId] !== "undefined" ?
                              influenceNb[nodeToId] : 0;
        influenceNb[nodeToId] += 1;
      }
    }
    debug('influenceNb', influenceNb);
    debug('influenceValue', influenceValue);
    // For all the nodes in the state
    for (nodeId in this.cn.node) {
      var nodeState = this.nodeState[nodeId];
      if (typeof nodeState === 'undefined') {
        nodeState = { activationValue: 0, oldActivationValue: 0, age: 0 };
      }
      var decay = 40;
      var memoryPerf = 100;
      var minusAge = 200 / (1 + Math.exp(-nodeState.age / memoryPerf)) - 100;
      var newActivationValue;
      // If this node is not influenced at all
      if (typeof influenceValue[nodeId] === 'undefined' ||
          !influenceValue[nodeId]) {
        newActivationValue = nodeState.oldActivationValue -
                             decay * nodeState.oldActivationValue / 100 -
                             minusAge;
      }
      // If this node receives influence
      else {
        var influence = influenceValue[nodeId];
        var nbIncomings = influenceNb[nodeId];
        influence /= Math.log(this.normalNumberComingLinks + nbIncomings) /
                     Math.log(this.normalNumberComingLinks);
        newActivationValue = nodeState.oldActivationValue -
                             decay * nodeState.oldActivationValue / 100 +
                             influence -
                             minusAge;
      }
      newActivationValue = Math.max(newActivationValue, 0);
      newActivationValue = Math.min(newActivationValue, 100);
      this.setActivationValue(nodeId, newActivationValue);
    }*/
  }
};

module.exports.ConceptNetworkState = ConceptNetworkState;
