angular.module("Pundit2.MyItemsContainer")
.constant('MYITEMSDEFAULTS', {

    // Key used for the /services/preferences/ server API to store the my items object
    apiPreferencesKey: 'favorites',

    // Container used to store the my items in the itemsExchange
    container: 'myItems',

    debug: true
})
.service("MyItems", function(BaseComponent, NameSpace, $http, Item, ItemsExchange, MYITEMSDEFAULTS) {

    var myItems = new BaseComponent("MyItems", MYITEMSDEFAULTS);

    // The very first time that we get my items from pundit server we might obtain pundit1 items:
    // - value is pundit2 uri property
    // - type property is not necessary (in pundit2 we use this property name with other semantic)
    // - rdfData is not necessary
    // - favorite is not necessary
    //
    // in pundit2 item:
    // - uri property replace value property
    // - type property replace rdftype property
    //
    // itemsExchange store all application items
    // "new Item()" adds the item to itemsExchange "default" container
    // then we add it to "myItems" container too

    myItems.getMyItems = function(){
        var item;

        $http({
            headers: { 'Accept': 'application/json' },
            method: 'GET',
            url: NameSpace.get('asPref', { key: myItems.options.apiPreferencesKey }),
            withCredentials: true         
        }).success(function(data) {
            var num = 0;

            for (var i in data.value) {
                num++;

                // TODO is pundit1 object? (need to add a dedicated flag?)
                if (data.value[i].rdftype) {
                    // delete property
                    delete data.value[i].type;
                    delete data.value[i].rdfData;
                    delete data.value[i].favorite;
                    // rename "rdftype" property in "type"
                    data.value[i].type = data.value[i].rdftype;
                    delete data.value[i].rdftype;
                    // rename "value" property in "uri"
                    data.value[i].uri = data.value[i].value;
                    delete data.value[i].value;
                }

                // create new item (now is a pundit2 item) (implicit add to default container)
                item = new Item(data.value[i].uri, data.value[i]);               
                
                // add to myItems container
                ItemsExchange.addItemToContainer(item, myItems.options.container);
            }

            myItems.log('Retrieved my items from the server: '+num+' items');

        }).error(function(msg) {
            myItems.log('Http error while retrieving my items from the server: ', msg);
        });
    };

    myItems.deleteAllMyItems = function(){
        var currentTime = new Date();

        // remove all my items on application
        // controller watch now update the view
        ItemsExchange.wipeContainer(myItems.options.container);

        // remove all my item on pundit server
        // setting it to []
        $http({
            headers: {"Content-Type":"application/json;charset=UTF-8;"},
            method: 'POST',
            url: NameSpace.get('asPref', { key: myItems.options.apiPreferencesKey }),
            withCredentials: true,
            data: angular.toJson({value: [], created: currentTime.getTime()})     
        }).success(function(data) {
            myItems.log('Deleted all my items on server', data);
        }).error(function(msg) {
            myItems.err('Cant delete my items on server: ', msg);
        });
    };

    myItems.deleteSingleMyItem = function(value){

        var currentTime = new Date();

        // get all my items (inside app)
        var items = ItemsExchange.getItemsByContainer(myItems.options.container);
        // remove value from my items
        // controller watch now update the view
        ItemsExchange.removeItemFromContainer(value, myItems.options.container);        

        // update to server the new my items 
        // the new my items format is different from pundit1 item format
        // this break pundit1 compatibility
        $http({
            headers: {"Content-Type":"application/json;charset=UTF-8;"},
            method: 'POST',
            url: NameSpace.get('asPref', { key: myItems.options.apiPreferencesKey }),
            withCredentials: true,
            data: angular.toJson({value: items, created: currentTime.getTime()})     
        }).success(function(data) {

            myItems.log('Deleted from my item: '+ value.label);

        }).error(function(msg) {
            myItems.err('Cant delete a my item on the server: ', msg);
        });
    };

    // add one item to my items on pundit server
    myItems.addSingleMyItem = function(value){

        var currentTime = new Date();

        // add value to my items
        // controller watch now update the view
        ItemsExchange.addItemToContainer(value, myItems.options.container);       
        // get all my items
        var items = ItemsExchange.getItemsByContainer(myItems.options.container);

        // update to server the new my items
        // the new my items format is different from pundit1 item format
        // this break punti1 compatibility
        $http({
            headers: {"Content-Type":"application/json;charset=UTF-8;"},
            method: 'POST',
            url: NameSpace.get('asPref', { key: myItems.options.apiPreferencesKey }),
            withCredentials: true,
            data: angular.toJson({value: items, created: currentTime.getTime()})     
        }).success(function(data) {

            myItems.log('Added item to my items: '+ value.label);

        }).error(function(msg) {
            myItems.err('Cant add item to my items on the server: ', msg);
        });

    };

    myItems.getMyItemsContainer = function(){
        return myItems.options.container;
    };

    return myItems;

});