Ext.define("TSFieldCopier", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container', itemId:'selector_box', defaults: { margin: 10 }, layout: 'hbox', items: [
            { xtype:'container', itemId: 'type_box' },
            { xtype:'container', layout: 'vbox', items: [
                { xtype:'container', itemId: 'from_box' },
                { xtype:'container', itemId: 'from_msg' }
            ]},
            { xtype:'container', layout: 'vbox', items: [
                { xtype:'container', itemId: 'to_box' },
                { xtype:'container', itemId: 'to_msg' }
            ]},
            { xtype:'container', itemId:'button_box' }
        ]},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSFieldCopier"
    },
                        
    launch: function() {
        this._addSelectors(this.down('#selector_box'));
    },
    
    _addSelectors: function(container) {
        var type_filter = Rally.data.wsapi.Filter.and([
            { property: 'Creatable', value: true },
            { property: 'ReadOnly', value: false },
            { property: 'Restorable', value: true }
        ]
        );
        
        container.down('#type_box').add({
            xtype:'tsrecordtypecombobox',
            itemId: 'model_selector',
            typeFilter: type_filter,
            typeSorter: [
                { property: 'Name', direction: 'Asc' },
                { property: 'Ordinal', direction: 'Desc' }
            ],
            listeners: {
                scope: this,
                change:this._addFieldSelectors
            }
        });
    
        container.down('#button_box').add({
            xtype:'rallybutton',
            text: 'Copy All Values',
            cls: 'primary',
            listeners: {
                scope: this,
                click: this._copyValues
            }
        });
    },
    
    _addFieldSelectors: function(cb) {
        var from_container = this.down('#from_box'),
              to_container = this.down('#to_box');
        from_container.removeAll();
        to_container.removeAll();
                            
        from_container.add({
            xtype: 'rallyfieldcombobox',
            model: cb.getRecord().get('TypePath'),
            itemId: 'from_field_selector',
            __typePath: cb.getRecord().get('TypePath'),
            fieldLabel: 'Copy Values from:',
            labelWidth: 100,
            width: 235,
            _isNotHidden: function(field) {
                var isCollection = false;
                if ( field.attributeDefinition ) {
                    isCollection = ( field.attributeDefinition.AttributeType == "COLLECTION" );
                }
                return !field.hidden && !field.readOnly && !isCollection;
            },
            listeners: {
                scope: this,
                change: this._updateFromCount
            }
        });
        
        to_container.add({
            xtype: 'rallyfieldcombobox',
            model: cb.getRecord().get('TypePath'),
            __typePath: cb.getRecord().get('TypePath'),
            itemId: 'to_field_selector',
            fieldLabel: 'to:',
            labelWidth: 25,
            width: 155,
            _isNotHidden: function(field) {
                var isCollection = false;
                if ( field.attributeDefinition ) {
                    isCollection = ( field.attributeDefinition.AttributeType == "COLLECTION" );
                }
                return !field.hidden && !field.readOnly && !isCollection;
            },
            listeners: {
                scope: this,
                change: this._updateToCount
            }
        });
        
    },
    
    _updateFromCount: function(combobox) {
        var msg_box = this.down('#from_msg');
        msg_box.removeAll();
        
        var model = combobox.__typePath;
        var field = combobox.getRecord().get('value');
        var field_defn = combobox.getRecord().get('fieldDefinition');
        
        //console.log(combobox.getRecord());
        
        var filters = Rally.data.wsapi.Filter.or([{property: field, operator: '!=', value: '' }]);
        // for date fields, we want (<field> != "")
        if ( field_defn && field_defn.type && field_defn.type.type == "date" ) {
            var filters = Rally.data.wsapi.Filter.or([{property: field, operator: '!=', value: null }]);
        }
        var config = {
            model:model,
            filters: filters,
            pageSize: 1,
            limit: 1
        };
        
        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(results, operation, success) {
                if ( !success ) {
                    Ext.Msg.alert('Problem counting records', operation.error && operation.error.errors.join('') + "<br/>" + filters.toString());
                } else {
                    msg_box.add({
                        xtype:'container',
                        html: Ext.String.format("{0} records found with a value in {1}",
                            operation.resultSet.totalRecords,
                            combobox.getRecord().get('name')
                        )
                    });
                }
            }
        });
    },
    
    _updateToCount: function(combobox) {
        var msg_box = this.down('#to_msg');
        msg_box.removeAll();
        var combobox = this.down('#to_field_selector');
        
        var field   = combobox.getRecord().get('value');
        var model   = combobox.__typePath;
        var field_name = combobox.getRecord().get('name');
        
        var field_defn = combobox.getRecord().get('fieldDefinition');
        
        //console.log(combobox.getRecord());
        
        var filters = Rally.data.wsapi.Filter.or([{property: field, operator: '!=', value: '' }]);
        // for date fields, we want (<field> != "")
        if ( field_defn && field_defn.type && field_defn.type.type == "date" ) {
            var filters = Rally.data.wsapi.Filter.or([{property: field, operator: '!=', value: null }]);
        }

        var config = {
            model:model,
            filters: filters,
            pageSize: 1,
            limit: 1
        };
        
        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(results, operation, success) {
                if ( !success ) {
                    Ext.Msg.alert('Problem counting records', operation.error && operation.error.errors.join(''));
                    console.error('ERROR: ', operation);
                } else {
                    msg_box.add({
                        xtype:'container',
                        html: Ext.String.format("{0} records found with a value in {1}",
                            operation.resultSet.totalRecords,
                            field_name
                        )
                    });
                }
            }
        });
    },
    
    _copyValues: function() {
        var me = this;
        this.setLoading('Loading items to change');
        
        var model      = this.down('#model_selector').getRecord().get('TypePath');
        var from_field = this.down('#from_field_selector').getRecord().get('value');
        var to_field   = this.down('#to_field_selector').getRecord().get('value');
        var field_defn = this.down('#from_field_selector').getRecord().get('fieldDefinition');

        var filters = Rally.data.wsapi.Filter.or([{property: from_field, operator: '!=', value: '' }]);
        // for date fields, we want (<field> != "")
        if ( field_defn && field_defn.type && field_defn.type.type == "date" ) {
            var filters = Rally.data.wsapi.Filter.or([{property: from_field, operator: '!=', value: null }]);
        }
        
        var config = {
            model: model,
            filters: filters,
            limit: Infinity,
            fetch: ['FormattedID','ObjectID','Name',from_field]
        };
        
        this._loadWsapiRecords(config).then({
            scope: this,
            success: function(results) {
                this.logger.log("Found ", results.length);
                var number_of_items = results.length;
                
                var promises = [];
                Ext.Array.each(results, function(result,idx){
                    promises.push( function() {
                        var counter = idx + 1;
                        me.setLoading('Updating ' + counter + ' of ' + number_of_items);
                        return me._setValue(result, from_field, to_field); 
                    });
                });
                
                this.setLoading(false);
                if ( promises.length === 0 ) {
                    Ext.Msg.alert('',"Nothing to Do");
                    return;
                }
                
                Deft.Chain.sequence(promises).then({
                    success: function(results) {
                        me.setLoading(false);
                        Ext.Msg.alert('', 'Updated ' + results.length + ' records');
                        me._updateToCount();
                    },
                    failure: function(msg) {
                        me.setLoading(false);
                        Ext.Msg.alert('Error on Save', msg);
                    }
                });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading records', msg);
            }
        });
    },
    
    _setValue: function(record, from_field, to_field) {
        var deferred = Ext.create('Deft.Deferred');
        record.set(to_field, record.get(from_field));
        record.save({
            callback: function(records, operation, success) {
                console.log(operation);
                
                if ( !success ) {
                    deferred.reject(operation.error && operation.error.errors.join(''));
                } else {
                    deferred.resolve(records);
                }
            }
        });
        return deferred.promise;
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
