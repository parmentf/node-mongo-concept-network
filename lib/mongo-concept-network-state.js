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
  this.normalNumberComingLinks = 2;
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
   * @return {Number} the maximum activation value (in [0,100])
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
   * @return {Array} array of { node, activationValue }
   **/
  getActivatedTypedNodes : function (filter, threshold) {
    var array = [];
    if (typeof threshold === 'undefined') { threshold = 90; }
    if (typeof filter === 'undefined') { filter = ''; }
    for (var id in this.nodeState) {
      var node = this.cn.node[id];
      var activationValue = this.getActivationValue(id);
      if (node.label.startsWith(filter)) {
        if (activationValue > threshold) {
          array.push({node: node, activationValue: activationValue});
        }
      }
    }
    return array;
  },

  /**
   * ### propagate
   *
   * Propagate the activation values along the links.
   **/
  propagate : function () {
    var influenceNb = [];    // nodeId -> nb of influence number
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
    }
  }
};

module.exports.ConceptNetworkState = ConceptNetworkState;
