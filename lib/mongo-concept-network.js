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
      callback(removed.n === undefined ? null : new Error("Node " + id.toString() + " not removed"));
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
   * @param {Number} fromId Identifier of the afferent node
   * @param {Number} toId   Identifier of the efferent node
   * @param {function} callback(link {fromId, toId, coOcc})
   **/
  decrementLink : function (fromId, toId, callback) {
    /*var link = this.link[linkId];
    link.coOcc -= 1;
    if (link.coOcc === 0) {
      this.removeLink(linkId);
    }
    return link;*/
    var self = this;
    this.db.conceptnetwork.findAndModify(
    {
      query: { fromId: fromId, toId: toId },
      update: {
        $inc: { coOcc: -1 }
      },
      new: true
    })
    .then(function(linkRes) {
      var link = linkRes[0];
      if (link.coOcc === 0) {
        self.removeLink(link._id, function(err) {
          callback(err);
        });
      }
      else {
        callback(link);
      }
    });

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
   * @param {ObjectID} linkId Identifier of the link
   * @param {function} callback(err)
   **/
  removeLink : function (linkId, callback) {
    this.db.conceptnetwork.remove({ _id: linkId})
    .then(function (isRemoved) {
      callback(isRemoved.n === undefined ? null : new Error("Link " + linkId.toString() + " not removed"));
    });
  },

  /**
   * ### getNode
   *
   * Get the node from its label
   * @param {string} label Label of the node to get
   * @param {function} callback function(node)
   * @return {Object} the node {id, label, occ}
   **/
  getNode : function (label, callback) {
    this.db.conceptnetwork
    .findOne({ label: label })
    .then(function (node) {
      callback(node);
    });
  },

  /**
   * ### getLink
   *
   * Get the link from its node ids.
   * @param {Number} fromId Identifier of the afferent node
   * @param {Number} toId   Identifier of the efferent node
   * @param {function} callback(link {fromId, toId, coOcc})
   **/
  getLink : function (fromId, toId, callback) {
    this.db.conceptnetwork
    .findOne({ fromId: fromId, toId: toId })
    .then(function (link) {
      callback(link);
    });
  },

  /**
   * ### getNodeFromLinks
   *
   * Get the array of links ids for all links going from node *id*.
   * @param {Number} fromId Identifier of the afferent node
   * @param {function} callback([link1, link2] or [])
   **/
  getNodeFromLinks : function (fromId, callback) {
    this.db.conceptnetwork
    .find({ fromId: fromId})
    .toArray(function (err, links) {
      callback(links);
    });
  },

  /**
   * ### getNodeToLinks
   *
   * Get the array of links ids for all links going to node *id*.
   * @param {Number} toId Identifier of the efferent node
   * @param {function} callback([link1, link2] or [])
   **/
  getNodeToLinks : function (toId, callback) {
    this.db.conceptnetwork
    .find({ toId: toId })
    .toArray(function (err, links) {
      callback(links);
    });
  }

};

module.exports.ConceptNetwork = ConceptNetwork;
