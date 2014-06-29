/* jshint node:true */
 /*
 * mongo-concept-network
 * https://github.com/parmentf/node-concept-network
 *
 * Copyright (c) 2012 François Parmentier
 * Licensed under the MIT license.
 */
"use strict";

var pmongo = require('promised-mongo');

/**
 * ## ConceptNetwork's constructor
 *
 * Use it to instanciate a Concept Network.
 **/
function ConceptNetwork(mongoConnectionString) {
  if (!(this instanceof ConceptNetwork)) {
    return new ConceptNetwork();
  }
  
  this.connectionString = mongoConnectionString || 'ector';
  this.db = pmongo(this.connectionString, ["conceptnetwork"]);

  this.node = {}; // id -> id, label, occ
  this.link = {}; // linkId -> fromId, toId, coOcc
  this.nodeLastId = 0;
  this.labelIndex = {}; // label -> id
  this.fromIndex  = {}; // fromId -> linkId
  this.toIndex    = {}; // toId   -> linkId

}

// ## ConceptNetwork's methods
ConceptNetwork.prototype = {
  /**
   * ### addNode
   *
   * @this ConceptNetwork
   * @param {string} label Symbol for the node
   * @param {function(_id, label, occ)} callback({id = identifier, occ = occurrence})
   **/
  addNode : function (label, callback) {
    this.db.conceptnetwork.findAndModify(
    {
      query: { label: label }, 
      update: { 
        $inc: { occ: 1 }
      }, 
      upsert: true,
      new: true
    })
    .then(function(nodeRes) {
      callback(nodeRes[0]);
    });
  },

  /**
   * ### decrementNode
   *
   * Decrement the occurrence of a node. Remove it if its counts down to zero.
   * @param {string} label identifier of the node.
   * @param {function({_id, label, occ})} callback({id = identifier, occ = occurrence} || `null` if it has been removed)
   **/
  decrementNode : function (label, callback) {
    var self = this;
    this.db.conceptnetwork.findAndModify(
    {
      query: { label: label },
      update: {
        $inc: { occ: -1 }
      },
      new: true
    })
    .then(function(nodeRes) {
      var node = nodeRes[0];
      if (node.occ === 0) {
        self.removeNode(node._id, function(err) {
          callback(err);
        });
      }
      else {
        callback(node);
      }
    });
  },

  /**
   * ### removeNode
   *
   * _Private_
   *
   * Remove the node which *id* is given from the ConceptNetwork.
   * Also remove the links from and to this node.
   * Also remove the node from the *labelIndex*.
   * @param {ObjectID} id Identifier of the node
   * @param {function} callback(err)
   **/
  removeNode : function (id, callback) {
    /*var linksToRemove = [];
    var i;*/
    // remove links from id
    /*if (this.fromIndex[id]) {
      for (i = 0; i < this.fromIndex[id].length; i += 1) {
        linksToRemove.push(this.fromIndex[id][i]);
      }
    }*/
    // remove links to id
    /*if (this.toIndex[id]) {
      for (i = 0; i < this.toIndex[id].length; i += 1) {
        linksToRemove.push(this.toIndex[id][i]);
      }
    }
    for (i = 0; i < linksToRemove.length; i += 1) {
      this.removeLink(linksToRemove[i]);
    }*/
    // remove from the labelIndex and from the node array.
    /*var label = this.node[id].label;
    delete this.node[id];
    delete this.labelIndex[label];*/
    this.db.conceptnetwork.remove({ _id: id})
    .then(function (removed) {
      callback(removed.n === undefined ? null : new Error("Node " + id.toString() + "not removed"));
    });
    
  },

  /**
   * ### addLink
   *
   * Add a link between fromId and toId
   * @param {Number} fromId Identifier of the afferent node
   * @param {Number} toId   Identifier of the efferent node
   * @param {function} callback(link {fromId, toId, coOcc})
   **/
  addLink : function (fromId, toId, callback) {
    if (typeof fromId !== 'object') {
      callback(new Error('fromId should be an object'));
      return; // don't create the link
    }
    if (typeof toId !== 'object') {
      callback(new Error('toId should be an object'));
      return; // don't create the link
    }
    this.db.conceptnetwork.findAndModify(
    {
      query: { fromId: fromId, toId: toId }, 
      update: { 
        $inc: { coOcc: 1 }
      }, 
      upsert: true,
      new: true
    })
    .then(function(linkRes) {
      callback(linkRes[0]);
    });
  },

  /**
   * ### decrementLink
   *
   * Decrement the coOcc of a link.
   *
   * *linkId* is a string composed of fromNodeId + "_" + toNodeId
   *
   * @param {string} linkId Identifier of the link to change
   * @return {Object} the modified link
   **/
  decrementLink : function (linkId) {
    var link = this.link[linkId];
    link.coOcc -= 1;
    if (link.coOcc === 0) {
      this.removeLink(linkId);
    }
    return link;
  },

  /**
   * ### removeLink
   *
   * {Private}
   *
   * Remove the link which *linkId* is given from the ConceptNetwork.
   *
   * Also remove the *linkId* from *fromIndex* and *toIndex*.
   *
   * @param {string} linkId Identifier of the link
   **/
  removeLink : function (linkId) {
    var link = this.link[linkId];
    delete this.fromIndex[link.fromId];
    delete this.toIndex[link.toId];
    delete this.link[linkId];
  },

  /**
   * ### getNode
   *
   * Get the node from its label
   * @param {string} label Label of the node to get
   * @return {Object} the node {id, label, occ}
   **/
  getNode : function (label) {
    var id = this.labelIndex[label];
    if (typeof this.node[id] === 'undefined') {
      return null;
    }
    return (this.node[id]);
  },

  /**
   * ### getLink
   *
   * Get the link from its node ids.
   * @param {string} linkId Identifier of the link
   * @return {Object} the found link {fromId, toId, coOcc}
   **/
  getLink : function (linkId) {
    if (typeof this.link[linkId] === 'undefined') {
      return null;
    }
    return this.link[linkId];
  },

  /**
   * ### getNodeFromLinks
   *
   * Get the array of links ids for all links going from node *id*.
   * @param {Number} id Identifier of the node.
   * @return {Array} [linkId1, linkId2] or []
   **/
  getNodeFromLinks : function (id) {
    var fromLinks = this.fromIndex[id];
    if (typeof fromLinks === 'undefined') {
      return [];
    }
    return fromLinks;
  },

  /**
   * ### getNodeToLinks
   *
   * Get the array of links ids for all links going to node *id*.
   * @param {Number} id Identifier of the node.
   * @return {Array} [linkId1, linkId2] or []
   **/
  getNodeToLinks : function (id) {
    var toLinks = this.toIndex[id];
    if (typeof toLinks === 'undefined') {
      return [];
    }
    return toLinks;
  }

};

module.exports.ConceptNetwork = ConceptNetwork;
