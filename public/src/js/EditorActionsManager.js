var GenomicDataOverlayManager = require('./GenomicDataOverlayManager.js');

module.exports = (function()
{
    "use strict";
    var EditorActionsManager = function(isCollaborative, realtimeManager, cyInst)
    {
        //Set cy instance and set real time manager reference if collaborative mode
        this.cy = cyInst;
        this.isCollaborative = isCollaborative;
        if(this.isCollaborative && realtimeManager)
            this.realTimeManager = realtimeManager;

        this.defaultLayoutProperties =
        {
            name: 'cose-bilkent',
            nodeRepulsion: 4500,
            nodeOverlap: 10,
            idealEdgeLength: 50,
            edgeElasticity: 0.45,
            nestingFactor: 0.1,
            gravity: 0.15,
            numIter: 2500,
            tile: true,
            animate: "end",
            randomize: true,
            gravityRangeCompound: 1.5,
            // Gravity force (constant) for compounds
            gravityCompound: 1.0,
            // Gravity range (constant)
            gravityRange: 1.5
        };
        this.FIT_CONSTANT = 50;

        this.layoutProperties = _.clone(this.defaultLayoutProperties);
        this.observers = [];
        this.genomicDataOverlayManager = new GenomicDataOverlayManager();
    };

    //Simple observer-observable pattern for views!!!!!
    EditorActionsManager.prototype.registerObserver = function(observer)
    {
        this.observers.push(observer);
    };

    EditorActionsManager.prototype.notifyObservers = function()
    {
        for (var i in this.observers)
        {
            var observer = this.observers[i];
            observer.notify();
        }
    };

    EditorActionsManager.prototype.registerGenomicDataObserver = function(observer)
    {
        this.genomicDataOverlayManager.registerObserver(observer);
    }

    EditorActionsManager.prototype.updateGenomicDataVisibility = function(dataMap)
    {
        if(this.isCollaborative)
        {
            //TODO compound OP
            this.realTimeManager.clearGenomicVisData();

            this.realTimeManager.addGenomicVisibilityData('visMap', dataMap);
        }
        else
        {
            for (var _key in dataMap)
            {
                this.genomicDataOverlayManager.updateGenomicDataVisibility(_key, dataMap[_key]);
            }
            this.genomicDataOverlayManager.showGenomicData();
        }
    }

    //Global options related functions, zoom etc..
    EditorActionsManager.prototype.getGlobalOptions = function()
    {
        return {
            zoomLevel: cy.zoom(),
            panLevel: cy.pan()
        };
    }

    EditorActionsManager.prototype.changeGlobalOptions = function(globalOptions)
    {
        cy.zoom(globalOptions.zoomLevel);
        cy.pan(globalOptions.panLevel);
    }

    EditorActionsManager.prototype.updateGlobalOptions = function(newOptions)
    {
        if(this.isCollaborative)
            this.realTimeManager.updateGlobalOptions(newOptions);
    }

    //Layout properties related functions
    EditorActionsManager.prototype.saveLayoutProperties = function(newLayoutProps)
    {
        if(this.isCollaborative)
        {
            // Call a real time function that updated real time object and
            // its callback (updateLayoutPropertiesCallback) will handle sync of this object
            // across collaborators
            this.realTimeManager.updateLayoutProperties(newLayoutProps);
        }
        else
        {
            this.layoutProperties = _.clone(newLayoutProps);
        }
    };

    EditorActionsManager.prototype.updateLayoutPropertiesCallback = function(newLayoutProps)
    {
        this.layoutProperties = _.clone(newLayoutProps);
        //Notify observers to reflect changes on colalborative object to the views
        this.notifyObservers();
    };

    EditorActionsManager.prototype.performLayout = function()
    {
        cy.layout(this.layoutProperties);
    };

    //Node Related Functions
    EditorActionsManager.prototype.addNode = function(nodeData, posData)
    {
        if (this.isCollaborative)
        {
            this.addNewNodeToRealTime(nodeData, posData);
        }
        else
        {
            this.addNodetoCy(nodeData,posData);
        }
    };

    EditorActionsManager.prototype.addNodes = function(nodes)
    {
        for (var i in nodes)
        {
            this.addNode(nodes[i].data, nodes[i].position);
        }
    };

    EditorActionsManager.prototype.addNodesCy = function(nodes)
    {
        for (var i in nodes)
        {
            this.addNodetoCy(nodes[i].data, nodes[i].position);
        }
    };

    EditorActionsManager.prototype.addNodetoCy = function(nodeData, posData)
    {
        var newNode =
        {
            group: "nodes",
            data: nodeData
        };

        if (nodeData.parent === undefined )
        {
            delete newNode.data.parent;
        }

        if (posData)
        {
            newNode.position =
            {
                x: posData.x,
                y: posData.y
            }
        }

        this.cy.add(newNode);
        this.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.realTimeNodeAddRemoveEventCallBack = function(event)
    {
        //Get real time node object and sync it to node addition or removal
        var node = event.newValue;
        var nodeID = event.property;

        //Removal Operation
        if (node === null)
        {
            //Remove element from existing graph
            var cyEle = this.cy.$("#" + nodeID);
            this.removeElementCy(cyEle);
            this.cy.nodes().updateCompoundBounds();
        }
        //Addition Operation
        else
        {
            this.addNewNodeLocally(node)
        }
    };

    EditorActionsManager.prototype.addNewNodesLocally = function(realTimeNodeArray)
    {
        var nodeList = [];
        for (var i in realTimeNodeArray)
        {
            var realTimeNode= realTimeNodeArray[i];

            var nodeID = this.realTimeManager.getCustomObjId(realTimeNode);
            var nodeData =
            {
                group: 'nodes',
                data:
                {
                    id: nodeID,
                    type: realTimeNode.type,
                    name: realTimeNode.name,
                    parent: realTimeNode.parent
                }
            };

            if (nodeData.data.parent === undefined )
            {
                delete nodeData.data.parent;
            }

            if (realTimeNode.x && realTimeNode.y)
            {
                nodeData.position =
                {
                    x: realTimeNode.x,
                    y: realTimeNode.y
                }
            }

            nodeList.push(nodeData);
        }
        this.cy.add(nodeList);
        this.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.addNewNodeLocally = function(realtimeNode)
    {
        var nodeID = this.realTimeManager.getCustomObjId(realtimeNode);
        var nodeData =
        {
            id: nodeID,
            type: realtimeNode.type,
            name: realtimeNode.name,
            parent: realtimeNode.parent
        };

        if (realtimeNode.x != "undefined" && realtimeNode.y != "unedfined")
        {
            this.addNodetoCy(nodeData, {x: realtimeNode.x, y: realtimeNode.y});
        }
        else
        {
            this.addNodetoCy(nodeData);
        }
        this.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.addNewNodeToRealTime = function(nodeData, posData)
    {
        this.realTimeManager.addNewNode(nodeData,posData);
    };

    //Edge related functions
    EditorActionsManager.prototype.addEdge = function(edgeData)
    {
        if (this.isCollaborative)
        {
            this.addNewEdgeRealTime(edgeData);
        }
        else
        {
            this.addNewEdgetoCy(edgeData);
        }
    };

    EditorActionsManager.prototype.addEdges = function(edges)
    {
        for (var i in edges)
        {
            this.addEdge(edges[i].data);
        }
    };

    EditorActionsManager.prototype.addEdgesCy = function(edges)
    {
        for (var i in edges)
        {
            this.addNewEdgetoCy(edges[i].data);
        }
    };

    EditorActionsManager.prototype.addNewEdgeRealTime = function(edgeData)
    {
        this.realTimeManager.addNewEdge(edgeData);
    };

    EditorActionsManager.prototype.addNewEdgetoCy = function(edgeData)
    {
        this.cy.add(
            {
                group: "edges",
                data: edgeData
            });
    };

    EditorActionsManager.prototype.realTimeEdgeAddRemoveEventCallBack = function(event)
    {
        //Get real time edge object and sync it to node addition or removal
        var edge = event.newValue;
        var edgeID = event.property;

        //Removal Operation
        if (edge === null)
        {
            //Remove element from existing graph
            var cyEle = this.cy.$("#" + edgeID);
            this.removeElementCy(cyEle);
        }
        //Addition Operation
        else
        {
            this.addNewEdgeLocally(edge);
        }
    };

    EditorActionsManager.prototype.addNewEdgesLocally = function(realTimeEdgeArray)
    {
        var edgeList = [];
        for (var i in realTimeEdgeArray)
        {
            var edge= realTimeEdgeArray[i];
            var edgeID = this.realTimeManager.getCustomObjId(edge);

            var edgeData =
            {
                group: 'edges',
                data:
                {
                    id: edgeID,
                    type: edge.type,
                    source: edge.source,
                    target: edge.target
                }
            };

            edgeList.push(edgeData);
        }
        this.cy.add(edgeList);
    };

    EditorActionsManager.prototype.addNewEdgeLocally = function(edge)
    {
        var edgeID = this.realTimeManager.getCustomObjId(edge);
        var edgeData =
        {
            id: edgeID,
            type: edge.type,
            source: edge.source,
            target: edge.target
        };
        this.addNewEdgetoCy(edgeData);
    };

    //Removal functions
    EditorActionsManager.prototype.removeElement = function(ele)
    {
        if (this.isCollaborative)
        {
            var self = this;
            ele.forEach(function (elem, index)
            {
                var connectedEdges = elem.connectedEdges();

                //Remove all connected edges also !
                connectedEdges.forEach(function (edge, j)
                {
                    self.removeElementFromRealTime(edge);
                });

                self.removeElementFromRealTime(elem);
            });
        }
        else
        {
            this.removeElementCy(ele);
        }
    };

    EditorActionsManager.prototype.removeElementCy = function(ele)
    {
        this.cy.remove(ele);
    };

    EditorActionsManager.prototype.removeElementFromRealTime = function(ele)
    {
        this.realTimeManager.removeElement(ele.id());
    };

    EditorActionsManager.prototype.changeParents = function(eles, newParentId)
    {
        if(this.isCollaborative)
        {
            this.changeParentRealTime(eles, newParentId);
        }
        else
        {
            this.changeParentCy(eles, newParentId);
        }
    };

    EditorActionsManager.prototype.changeParentCy = function(eles, newParentId)
    {
        var lockedNodes = {};
        var self = this;

        function removeNodes(nodes)
        {
            //Get removed edges first
            var removedEles = nodes.connectedEdges().remove();
            var children = nodes.children();

            if (children != null && children.length > 0)
            {
                children.forEach(function(childNode, i)
                {
                    lockedNodes[childNode.id()] = true;
                });

                removedEles = removedEles.union(removeNodes(children));
            }

            removedEles = removedEles.union(nodes.remove());
            self.cy.nodes().updateCompoundBounds();
            return removedEles;
        }


        var removedNodes = removeNodes(eles);

        for (var i = 0; i < removedNodes.length; i++)
        {
            var removedNode = removedNodes[i];

            //Just alter the parent id of corresponding nodes !
            if (removedNode.isEdge() || lockedNodes[removedNode.id()])
            {
                continue;
            }

            removedNode._private.data.parent = newParentId;
            if(removedNode._private.parent){
                delete removedNode._private.parent;
            }
        }

        self.cy.add(removedNodes);
        self.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.changeParentRealTime = function (eles, newParentId)
    {

        var classRef = this;
        function getTopLevelParents(eles)
        {
            var tpMostNodes = classRef.cy.collection();
            var parentMap = {};

            //Get all parents
            eles.forEach(function (node, index)
            {
                if(node.isParent())
                    parentMap[node.id()] = node;
            });

            //Get all parents
            eles.forEach(function (node, index)
            {
                var nodeParent = node.parent();

                if(parentMap[nodeParent.id()] === undefined)
                    tpMostNodes = tpMostNodes.union(node);
            });

            return tpMostNodes;
        }

        var NodeObj = function(nodeObj){
            this.nodeRef  = nodeObj;
            this.children = [];
        };

        var connectedEdges = eles.connectedEdges();
        // Traverses given elements and constructs subgraph relations
        // creates a nested structure into rootnodeObj
        function traverseNodes(eles, rootNodeObj)
        {
            eles.forEach(function (ele, index)
            {
                connectedEdges = connectedEdges.union(ele.connectedEdges());

                if(ele.isParent())
                {
                    rootNodeObj.children.push(new NodeObj(ele));
                    var lengthOfChildrenArray = rootNodeObj.children.length;
                    traverseNodes(ele.children(), rootNodeObj.children[lengthOfChildrenArray-1]);
                }
                else
                {
                    rootNodeObj.children.push(new NodeObj(ele));
                }
            });
        }

        //Create new collection
        var topMostNodes = getTopLevelParents(eles);

        var rootNodeR = new NodeObj(null);

        traverseNodes(topMostNodes, rootNodeR);
        this.realTimeManager.changeParent(rootNodeR, newParentId, connectedEdges);
    };

    EditorActionsManager.prototype.moveElements = function(ele)
    {
        var classRef = this;
        //Sync movement to real time api
        if(this.isCollaborative)
        {
            ele.forEach(function (ele,index)
            {
                classRef.realTimeManager.moveElement(ele);
            });
        }
    };

    EditorActionsManager.prototype.mergeGraph = function(nodes, edges)
    {
        if (this.isCollaborative)
        {
            //Collaborative usage
            this.realTimeManager.mergeGraph(nodes,edges);
        }
        else
        {
            //Local usage file load
            this.mergeGraphCy(nodes,edges);
        }
        this.fitGraph();
    };

    EditorActionsManager.prototype.mergeGraphCy = function(nodes, edges)
    {
        //Define arrays and maps
        var nodesToBeAdded = [];
        var edgesToBeAdded = [];
        var nodeMap = {};

        //Iterate over nodes and find nodes that does not exist in current graph by looking their name
        for (var index in nodes)
        {
            var ele = nodes[index];
            nodeMap[ele.data.id] = ele;

            if (cy.filter('node[name = "'+ele.data.name+'"]').length <= 0)
            {
                delete ele.data.id;
                //TODO need to update parent ?
                nodesToBeAdded.push(ele);
            }
        }

        cy.add(nodesToBeAdded);

        //Iterate over all edges
        for (var index in edges)
        {
            //Get corresponding source and target node in merge file
            var ele = edges[index];
            var sourceNode = nodeMap[ele.data.source];
            var targetNode = nodeMap[ele.data.target];

            //Check if there are nodes with same name in current graph
            var cySourceNode = cy.nodes('[name="'+sourceNode.data.name+'"]');
            var cyTargetNode = cy.nodes('[name="'+targetNode.data.name+'"]');

            if (cySourceNode.length > 0)
            {
                ele.data.source = cySourceNode.id();
            }

            if (cyTargetNode.length > 0)
            {
                ele.data.target = cyTargetNode.id();
            }

            if (cyTargetNode.length < 0 && cySourceNode.length < 0 ) {
                continue;
            }

            var edgesBtw = cy.filter('edge[source = "'+cySourceNode.id()+'"][target = "'+cyTargetNode.id()+'"]');

            //We assume there could be one edge between source and target node with same type
            var isFound = false;
            edgesBtw.forEach(function(edge,i)
            {
                if (edge.data().type == ele.data.type)
                {
                    isFound = true;
                    return false;
                }
            });

            if (!isFound)
            {
                delete ele.data.id;
                edgesToBeAdded.push(ele);
            }
        }

        cy.add(edgesToBeAdded);
    };

    EditorActionsManager.prototype.fitGraph = function()
    {
        if(this.isCollaborative)
        {
            cy.fit(this.FIT_CONSTANT);
            var newState =
            {
                zoomLevel: cy.zoom(),
                panLevel: cy.pan()
            };
            this.updateGlobalOptions(newState);
        }
        else
        {
            cy.fit(this.FIT_CONSTANT);
        }
    }

    EditorActionsManager.prototype.loadFile = function(nodes, edges)
    {
        if (this.isCollaborative)
        {
            //Real time load graph
            this.loadfileRealTime(nodes,edges);
        }
        else
        {
            //Local usage file load
            this.loadFileCy(nodes,edges);
        }
        this.fitGraph();
    };

    EditorActionsManager.prototype.loadFileCy = function(nodes, edges)
    {
        //Remove all elements
        this.removeElementCy(cy.elements());
        this.addNodesCy(nodes);
        this.addEdgesCy(edges);
    };

    EditorActionsManager.prototype.loadfileRealTime = function(nodes, edges)
    {
        this.realTimeManager.loadGraph(nodes,edges);
    };

    EditorActionsManager.prototype.removeAllElements = function()
    {
        if (this.isCollaborative)
        {
            this.realTimeManager.removeAllElements();
        }
        else
        {
            cy.remove(cy.elements());
        }
    };

    EditorActionsManager.prototype.changeName = function(ele, newName)
    {
        if (this.isCollaborative)
        {
            this.realTimeManager.changeName(ele, newName);
        }
        else
        {
            this.changeNameCy(ele, newName);
        }
    };

    EditorActionsManager.prototype.changeNameCy = function(ele, newName)
    {
        ele.data('name', newName);
        ele.css('content', newName);
    };

    EditorActionsManager.prototype.updateElementCallback = function(ele, id)
    {
        //Remove element from existing graph
        var nodeID = id;
        var cyEle = this.cy.$("#" + nodeID);
        cyEle.position({x: ele.x, y: ele.y});
        this.changeNameCy(cyEle, ele.name);
    };

    EditorActionsManager.prototype.removeGenomicData = function()
    {
        if(this.isCollaborative)
        {
            this.realTimeManager.clearGenomicData();
            this.realTimeManager.clearGenomicVisData();
        }
        else
        {
            //TODO wrap this in afunction in genomic data overlay manager
            this.genomicDataOverlayManager.removeGenomicData();
            this.genomicDataOverlayManager.removeGenomicVisData();
            this.genomicDataOverlayManager.hideGenomicData();
            this.genomicDataOverlayManager.notifyObservers();
        }

    }

    EditorActionsManager.prototype.addGenomicData = function(genomicData)
    {
        if(this.isCollaborative)
        {
            //TODO compound OP
            this.removeGenomicData();

            //TODO clear visibility map
            var parsedGenomicData = this.genomicDataOverlayManager.prepareGenomicDataRealTime(genomicData);
            var genomicDataMap = parsedGenomicData.genomicDataMap;
            var visibilityMap = parsedGenomicData.visibilityMap;
            this.realTimeManager.addGenomicData('genomicData', genomicDataMap);
            this.realTimeManager.addGenomicVisibilityData('visMap', visibilityMap);
        }
        else
        {
            this.genomicDataOverlayManager.addGenomicDataLocally(genomicData);
        }
    }

    EditorActionsManager.prototype.realTimeGenomicDataHandler = function(event)
    {

        var newData = event.newValue;
        var geneSymbol = event.property;

        //Addition
        if(newData)
        {
            this.genomicDataOverlayManager.addGenomicData(newData);
        }
        //Removal
        else
        {   
            this.genomicDataOverlayManager.removeGenomicData(geneSymbol);
        }
    }

    EditorActionsManager.prototype.realTimeGenomicDataVsibilityHandler = function(event)
    {

        var data = event.newValue;

        //Addition
        if(data)
        {
            this.genomicDataOverlayManager.addGenomicVisData(data);
        }
        //Removal
        else
        {
            this.genomicDataOverlayManager.removeGenomicVisData(data);
        }
        this.genomicDataOverlayManager.showGenomicData();
        this.genomicDataOverlayManager.notifyObservers();

    }

    //Utility Functions
    //TODO move functions thar are inside class functions here

    return EditorActionsManager;

})();
