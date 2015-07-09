angular.module('Pundit2.Communication')

.constant('MODELHELPERDEFAULTS', {
    annotationServerPrefix: 'http://purl.org/pundit/local/'
})

.service('ModelHelper', function(BaseComponent, Config, MODELHELPERDEFAULTS, Consolidation, XpointersHelper, MyPundit, NameSpace, TypesHelper, md5) {

    var modelHelper = new BaseComponent("ModelHelper", MODELHELPERDEFAULTS);

    var annotationServerVersion = Config.annotationServerVersion;

    var error = false,
        errorMessage = '';

    var targetURIs = function(xpointer) {
        var md5URI = md5.createHash(xpointer);
        return {
            'target': modelHelper.options.annotationServerPrefix + 'target/' + md5URI,
            'selector': modelHelper.options.annotationServerPrefix + 'selector/' + md5URI
        };
    };

    var addGraphElem = function(el, res) {
        var triple = el.scope.get();
        // skip incomplete triple
        if (triple.subject === null || triple.predicate === null || triple.object === null) {
            return;
        }
        if (typeof(res[triple.subject.uri]) === 'undefined') {
            // subject uri not exist (happy it's easy)
            res[triple.subject.uri] = {};
            // predicate uri not exist
            res[triple.subject.uri][triple.predicate.uri] = [modelHelper.buildObject(triple.object)];
        } else {
            // subject uri already exists
            if (typeof(res[triple.subject.uri][triple.predicate.uri]) === 'undefined') {
                // predicate uri not exist (happy it's easy)
                res[triple.subject.uri][triple.predicate.uri] = [modelHelper.buildObject(triple.object)];
            } else {
                // predicate uri already exists
                var u = triple.object.uri,
                    arr = res[triple.subject.uri][triple.predicate.uri];
                // search object
                var found = arr.some(function(o) {
                    return angular.equals(o.value, u);
                });
                // object not eqaul (happy it's easy)
                if (!found) {
                    arr.push(modelHelper.buildObject(triple.object));
                }
            }
        }
    };

    var addItemElem = function(el, res, val) {
        var triple = el.scope.get();

        // skip incomplete triple
        if (triple.subject === null || triple.predicate === null || triple.object === null) {
            return;
        }

        // TODO: Add support to image fragment 
        // // check if items are image fragment
        // // in this case add the polygon to the items list
        // if (typeof(triple.subject.polygon) !== 'undefined' && typeof(triple.subject.polygonUri) !== 'undefined') {
        //     // make a polygon rdf object
        //     res[triple.subject.polygonUri] = {};
        //     res[triple.subject.polygonUri][NameSpace.item.type] = [{
        //         type: 'uri',
        //         value: NameSpace.selectors.polygonType
        //     }];
        //     val = {
        //         type: 'polygon',
        //         points: triple.subject.polygon
        //     };
        //     res[triple.subject.polygonUri][NameSpace.rdf.value] = [{
        //         type: 'literal',
        //         value: angular.toJson(val)
        //     }];
        // }
        // if (typeof(triple.object.polygon) !== 'undefined' && typeof(triple.object.polygonUri) !== 'undefined') {
        //     // make a polygon rdf object
        //     res[triple.object.polygonUri] = {};
        //     res[triple.object.polygonUri][NameSpace.item.type] = [{
        //         type: 'uri',
        //         value: NameSpace.selectors.polygonType
        //     }];
        //     val = {
        //         type: 'polygon',
        //         points: triple.object.polygon
        //     };
        //     res[triple.object.polygonUri][NameSpace.rdf.value] = [{
        //         type: 'literal',
        //         value: angular.toJson(val)
        //     }];
        // }

        if (triple.subject.isTarget() === false) {
            // add item and its rdf properties
            res[triple.subject.uri] = triple.subject.toRdf();
        }

        res[triple.predicate.uri] = triple.predicate.toRdf();

        // discard literals
        if (typeof(triple.object.uri) !== 'undefined') {
            if (triple.object.isTarget() === false) {
                res[triple.object.uri] = triple.object.toRdf();
                // add object types and its label
                triple.object.type.forEach(function(e, i) {
                    var type = triple.object.type[i];
                    res[type] = {};
                    res[type][NameSpace.rdfs.label] = [{
                        type: 'literal',
                        value: TypesHelper.getLabel(e)
                    }];
                });
            }
        }

        if (triple.subject.isTarget() === false) {
            // add subject types and its label
            triple.subject.type.forEach(function(e, i) {
                var type = triple.subject.type[i];
                res[type] = {};
                res[type][NameSpace.rdfs.label] = [{
                    type: 'literal',
                    value: TypesHelper.getLabel(e)
                }];
            });
        }

        // add predicate types and its label
        triple.predicate.type.forEach(function(e, i) {
            var type = triple.predicate.type[i];
            res[type] = {};
            res[type][NameSpace.rdfs.label] = [{
                type: 'literal',
                value: TypesHelper.getLabel(e)
            }];
        });
    }

    var addTargetElem = function(el, res, flat) {
        var triple = el.scope.get(),
            uris;

        // Skip incomplete triple.
        if (triple.subject === null || triple.predicate === null || triple.object === null) {
            return;
        }

        // Subject.
        [triple.subject, triple.object].forEach(function(a, i, arr) {
            // TODO: add code to handle imageFragments.
            var statementPart = arr[i];
            if (typeof statementPart === 'string') {
                return;
            }
            if (statementPart.isTarget()) {
                uris = targetURIs(statementPart.xpointer);
                // If it's not already present.
                if (typeof res[uris.target] === 'undefined') {
                    var target = {};
                    var selector = {};

                    // Building target info.
                    // isPartOf.
                    if (statementPart.hasOwnProperty('isPartOf')) {
                        target[NameSpace.item.isPartOf] = [{
                            "value": statementPart.isPartOf,
                            "type": "uri"
                        }];
                    }
                    if (!statementPart.isWebPage()) {
                        // hasSelector.
                        target[NameSpace.annotation.hasSelector] = [{
                            "value": uris.selector,
                            "type": "uri"
                        }];

                        if (statementPart.hasOwnProperty('pageContext')) {
                            // hasScope.
                            target[NameSpace.annotation.hasScope] = [{
                                "value": statementPart.pageContext,
                                "type": "uri"
                            }];
                            // hasSource.
                            target[NameSpace.annotation.hasSource] = [{
                                "value": statementPart.isImage() ? statementPart.image : statementPart.pageContext,
                                "type": "uri"
                            }];
                        } else {
                            error = true;
                            errorMessage = 'Page context missing! Cannot proceed with annotation build.';
                            return;
                        }
                    }

                    // type
                    target[NameSpace.rdf.type] = [];
                    for (var i in statementPart.type) {
                        target[NameSpace.rdf.type].push({
                            'value': statementPart.type[i],
                            'type': 'uri'
                        });
                    }

                    if (!statementPart.isWebPage()) {
                        // Building selector info.
                        // conformsTo.
                        selector[NameSpace.target.conformsTo] = [{
                            "value": "http://tools.ietf.org/rfc/rfc3023",
                            "type": "uri"
                        }];

                        // Type
                        if (statementPart.isTextFragment() || statementPart.isImage()) {
                            selector[NameSpace.rdf.type] = [{
                                "value": NameSpace.target.fragmentSelector,
                                "type": "uri"
                            }];

                            // Label
                            selector[NameSpace.rdfs.label] = [{
                                "value": statementPart.label,
                                "type": "literal"
                                    // "lang": "it"
                            }];

                            // Value
                            selector[NameSpace.rdf.value] = [{
                                "value": statementPart.uri,
                                "type": "literal"
                                    // "lang": "it"
                            }];
                        } else {
                            // TODO check other types.
                        }

                        // Add selector info only if it's not a webpage.
                        res[uris.selector] = selector;
                    }

                    res[uris.target] = target;
                    flat.push(statementPart.uri);
                }
            }
        });
    };

    modelHelper.buildObject = function(item) {
        if (typeof(item) === 'string') {
            // date or literal
            return {
                type: 'literal',
                value: item
            };
        } else {
            return {
                type: 'uri',
                value: item.uri
            };
        }
    };

    modelHelper.buildGraph = function(statements) {
        var res = {};

        statements.forEach(function(el) {
            addGraphElem(el, res);
        });

        return res;
    };

    modelHelper.buildItems = function(statements) {
        var res = {},
            val;

        statements.forEach(function(el) {
            addItemElem(el, res, val);
        });

        return res;
    };

    modelHelper.buildTargets = function(statements) {
        var res = {};
        var flat = [];
        statements.forEach(function(el) {
            addTargetElem(el, res, flat);
        });

        return {
            'obj': res,
            'flat': flat
        };
    };

    modelHelper.buildAllData = function(statements) {
        error = false;
        errorMessage = '';
        var res = {
                'graph': {},
                'items': {},
                'target': {},
                'flatTargets': []
            },
            val;

        statements.forEach(function(el) {
            addGraphElem(el, res.graph);
            addItemElem(el, res.items, val);
            addTargetElem(el, res.target, res.flatTargets);
        });

        if (annotationServerVersion === 'v1') {
            res.target = undefined;
        }

        return res;
    };

    modelHelper.getLastError = function() {
        return {
            error: error,
            errorMessage: errorMessage
        }
    };

    modelHelper.hasError = function() {
        return !error;
    };

    /**
     * @ngdoc method
     * @name ModelHelper#parseAnnotations
     * @module Pundit2.Communication
     * @function
     *
     * @description
     *
     */
    modelHelper.parseAnnotations = function(data) {
        if (annotationServerVersion === 'v1') {
            return data;
        }

        if (typeof(data) === "undefined" ||
            typeof(data.graph) === "undefined" ||
            typeof(data.metadata) === "undefined" ||
            typeof(data.items) === "undefined" ||
            typeof(data.target) === "undefined") {
            error = true;
            errorMessage = "Malformed annotations data";
            return;
        }

        var res = {};
        // Cycling metadata.
        for (var metadataURI in data.metadata) {
            // Get metadata object
            var metadata = data.metadata[metadataURI];

            // Get Annotation ID.
            var metadataURIParts = metadataURI.split('/');
            var annotationID = metadataURIParts[metadataURIParts.length - 1];

            // Get graph URI.
            var graphURI = metadata.hasBody[0].value;

            res[annotationID] = {
                'graph': data.graph[graphURI],
                'metadata': {
                    metadataURI: metadata
                }
            };

            // Get graph.
            //var graph = data.graph[graphURI];

            // Reusable var.
            //var selectorURI;

            //// Replace hashed graph URI
            //for (var subjectURI in graph) {
            //    var newSubjectURI = subjectURI;
            //    /*
            //    // Replace hash
            //    if (typeof data.target[subjectURI] !== 'undefined') {
            //        selectorURI = data.target[subjectURI][NameSpace.annotation.hasSelector][0].value;
            //        if (typeof data.target[selectorURI] !== 'undefined') {
            //            newSubjectURI = data.target[selectorURI][NameSpace.rdf.value][0].value;
            //        }
            //    }
            //    */
            //    res[annotationID].graph[newSubjectURI] = {};
            //    for (var predicateURI in graph[subjectURI]) {
            //        res[annotationID].graph[newSubjectURI][predicateURI] = [];
            //        for (var i in graph[subjectURI][predicateURI]) {
            //            var objectValue = graph[subjectURI][predicateURI][i].value;
            //            /*
            //            // Replace hash
            //            if (graph[subjectURI][predicateURI][i].type === 'uri' && typeof data.target[objectValue] !== 'undefined' ) {
            //                selectorURI = data.target[objectValue][NameSpace.annotation.hasSelector][0].value;
            //                objectValue = data.target[selectorURI][NameSpace.rdf.value][0].value;
            //            }
            //            */
            //            res[annotationID].graph[newSubjectURI][predicateURI].push({
            //                'type': graph[subjectURI][predicateURI][i].type,
            //                'value': objectValue
            //            });
            //        }
            //    }
            //}

        }
    };

    return modelHelper;
});