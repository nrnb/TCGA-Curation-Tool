;
(function($, $$) {
    var defaults = {
        height: 30,   //height of the icon container
        width: 30,    //width of the icon container
        padding: 5,  //padding of the icon container(from right & top)
        backgroundColorDiv: '#f8f8f8',   //background color of the icon container
        borderColorDiv: '#CFCFCF',    //border color of the icon container
        borderWidthDiv: '1px',    //border width of the icon container
        borderRadiusDiv: '5px',    //border radius of the icon container

        icon: 'fa fa-square-o',   //icon class name

        nodeParams: function(){
            // return element object to be passed to cy.add() for adding node
            return {};
        }
    };

    $.fn.cytoscapeNodeadd = function(params) {
        var options = $.extend(true, {}, defaults, params);
        var fn = params;

        var functions = {
            destroy: function() {
                var $this = $(this);

                $this.find(".ui-cytoscape-nodeadd").remove();
            },
            init: function() {
                return $(this).each(function() {
                    var $container = $(this);
                    var dragContainer = options.container;
                    var explanationText = options.explanationText;

                    var $nodeadd = $('<div class="ui-cytoscape-nodeadd"></div>');
                    dragContainer.append($nodeadd);

                    var $nodeDragHandle = $('<div class="ui-cytoscape-nodeadd-nodediv"> \
                                              <span id="ui-cytoscape-nodeadd-icon" class="draggable icon ' + options.icon + '">\
                                              <span  class="">'+explanationText+'</span>\
                                              </span>\
                                            </div>');
                    $nodeadd.append($nodeDragHandle);

                    function setUpUI() {
                          dragContainer.find(".ui-cytoscape-nodeadd-nodediv").css({
                            background: options.backgroundColorDiv,
                            border: options.borderWidthDiv + ' solid ' + options.borderColorDiv,
                            'border-radius': options.borderRadiusDiv
                        });
                    }
                    setUpUI();

                    function initDraggable() {
                        dragContainer.find("#ui-cytoscape-nodeadd-icon").draggable({
                            helper: "clone",
                            cursor: "pointer"
                        });
                    }
                    initDraggable();

                    function initDroppable() {
                        $container.droppable({
                            activeClass: "ui-state-highlight",
                            // accept: "#ui-cytoscape-nodeadd-icon",
                            drop: function(event, ui) {
                                $container.removeClass("ui-state-highlight");

                                var currentOffset = $container.offset();
                                var relX = event.pageX - currentOffset.left;
                                var relY = event.pageY - currentOffset.top;

                                var cy = $container.cytoscape("get");
                                cy.add($.extend(true,{
                                    group: "nodes",
                                    renderedPosition: {
                                        x: relX,
                                        y: relY
                                    }
                                }, options.nodeParams()));

                            }
                        });
                    }
                    initDroppable();

                    $nodeDragHandle.bind("mousedown", function(e) {
                        handler(e);
                    });

                    var handler = function(e) {
                        e.stopPropagation(); // don't trigger dragging of nodeadd
                        e.preventDefault(); // don't cause text selection
                    };

                });
            }
        };
        if (functions[fn]) {
            return functions[fn].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof fn == 'object' || !fn) {
            return functions.init.apply(this, arguments);
        } else {
            $.error("No such function `" + fn + "` for jquery.cytoscapenodeadd");
        }

        return $(this);
    };

    $.fn.cynodeadd = $.fn.cytoscapeNodeadd;

    /* Adding as an extension to the core functionality of cytoscape.js*/
    $$('core', 'nodeadd', function(options) {
        var cy = this;

        $(cy.container()).cytoscapeNodeadd(options);
    });

})(jQuery, cytoscape);
