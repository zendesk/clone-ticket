(function() {
  return {
    customFieldRegExp: new RegExp(/custom_field_([0-9]+)/),
    dateRegExp : new RegExp(/([0-9]:00:00 GMT[+])/),  
    events: {
      // App lifecycle events
      'app.created':'init',
      // DOM events
      'click .start' : 'switchToInput',
      'click .createTicket': 'confirmAmount',
      'keyup #inputValueIdFirst': function(event){
        if(event.keyCode === 13)
          return this.confirmAmount();
      },
      'click .createTicketConfirm': 'createTicket',
      'keyup #inputValueIdSecond': function(event){
        if(event.keyCode === 13)
          return this.createTicket();
      },
      'createTicketRequest.always': 'createTicketRequestDone'
    },
    requests: {
      createTicketRequest: function(ticket, custom_fields) { // Create single ticket clone
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            "ticket": {
              "subject": ticket.subject(),
              "comment": { 
                "body":  ticket.description()
              },
              "status": ticket.status(),
              "priority": ticket.priority(),
              "type": ticket.type(),
              "tags": ticket.tags(),
              "assignee_id": (ticket.assignee().user() && ticket.assignee().user().id()) || null,
              "group_id": (ticket.assignee().group() && ticket.assignee().group().id()) || null,
              "requester_id": ticket.requester().id(),
              "collaborator_ids": _.map(ticket.collaborators(), function(cc) { return cc.id(); }),
              "custom_fields": custom_fields
            }
          })
        };
      }
    },
    init: function() {
      this.switchTo('main');
    },
    switchToInput: function() {
      this.switchTo('create'); // Present use with 'create' template to confirm # clones to create
    },
    confirmAmount: function() { // Add code to disable button unless value entered is correct
      var inputValueFirst          = parseInt(this.$('input#inputValueIdFirst').val(), 10),
          maximum             = parseInt(this.setting('Creation Limit'), 10);
      
      if (isNaN(inputValueFirst) === false) { // If value entered is a number
        if (inputValueFirst < maximum+1) { // If value entered is less than the set ticket creation limit
          services.notify('Please enter <strong>' + inputValueFirst + '</strong> to confirm', 'alert', 1000);
          this.switchTo('confirm', { // Only switch to Confirm template if value entered is an permissible value
            inputValueFirst: inputValueFirst
          });
        } else {
          services.notify('Can only create up to <strong>' + (maximum) + ' tickets</strong> at a time', 'error', 1000);
        }
      } else {
        services.notify('Value entered is not a number', 'error', 800);
      }
      this.$('input#inputValueIdFirst').val(''); // Empty the input field
      this.inputValueFirst = inputValueFirst; // Set input value to the root of the app
    },
    createTicket: function() {
      var ticket              = this.ticket(),
          inputValueSecond    = parseInt(this.$('input#inputValueIdSecond').val(), 10),
          maximum             = parseInt(this.setting('Creation Limit'), 10),
          inputValueFirst     = this.inputValueFirst,
          custom_fields       = this.serializeCustomFields();

      this.inputValueSecond = inputValueSecond; 

      if (inputValueFirst === inputValueSecond) { // If initial accepted value matches what is entered in confirm
        if (inputValueSecond === 1) { // If making only one clone
          services.notify('Creating <strong>' + inputValueSecond + '</strong> copy of this ticket', 'notice', 500);
          this.switchTo('loading');
              for (var i = 0; inputValueSecond > i; i++) { // Make AJAX requests to create a ticket until i = number confirmed by user
                console.log('Creating single ticket');
                for (var z = 0; custom_fields.length > z; z++) { // Loop through all custom fields
                  if (typeof custom_fields[z].value === 'object') { // Only the custom ticket field for 'date' has a typeof 'object'
                    var formattedCustomDateValueA = (((JSON.stringify(custom_fields[z].value)).split('"'))[1].split('T'))[0]; // reformat to string 'YYYY-MM-DD'
                    custom_fields[z].value = formattedCustomDateValueA; // Set value for only this custom date field to new date formatting
                  }
                }

                // Make Request
                this.ajax('createTicketRequest', ticket, custom_fields);
              }
          services.notify('Created <strong>' + inputValueSecond + '</strong> copy of this ticket', 'notice', 1500);
          this.switchTo('main');
        } else {
          services.notify('Creating <strong>' + inputValueSecond + '</strong> copies of this ticket', 'notice', 500);
          this.switchTo('loading');
          var reqs = [];
          console.log(this);
            for (var j = 0; inputValueSecond > j; j++) { // Make AJAX requests to create a ticket until i = number confirmed by user
              console.log('Creating multiple tickets');
              for (var f = 0; custom_fields.length > f; f++) { // Loop through all custom fields
                if (typeof custom_fields[f].value === 'object') { // If custom date field - reformat date 
                  var formattedCustomDateValueB = (((JSON.stringify(custom_fields[f].value)).split('"'))[1].split('T'))[0];
                  custom_fields[f].value = formattedCustomDateValueB; // Set value for only this custom date field to new date formatting
                }
              }

              // Make Request
              reqs.push(this.ajax('createTicketRequest', ticket, custom_fields)); // Include ticket object for use in ticket creation request
            }

          this.when.apply(this, reqs).then(_.bind(function(){
            var inputValueSecond = this.inputValueSecond;
            services.notify('Created <strong>' + inputValueSecond + '</strong> copies of this ticket', 'notice', 1500);
            this.switchTo('main');
          }, this));

        }
      } else {
        services.notify('You entered <strong>' + inputValueSecond + '</strong>, please enter <strong>' + inputValueFirst + '</strong> to proceed', 'error', 500);
      }

      inputValueSecond = this.$('input#inputValueIdSecond').val(''); // Empties input field 
    },
    createTicketRequestDone: function(data){
      console.log('Created Ticket ID: ' + data.ticket.id);
    },
    serializeCustomFields: function() {
      var fields = [];

      this.forEachCustomField(function(field){

        if (field.value !== ""){
          var test = ""+field.value+"";
          var isDate = "";
          
          if (field.value !== undefined){
              isDate = test.match(this.dateRegExp);
          }
          
          var value = "";
          
          if (isDate !== "" && isDate !== null) {
              var date = new Date(field.value);
              var year = date.getFullYear();
              var month = (1 + date.getMonth()).toString();
              month = month.length > 1 ? month : '0' + month;
              var day = date.getDate().toString();
              day = day.length > 1 ? day : '0' + day;
              value = year+"-"+month+"-"+day;
          } else {
              value = field.value;
          }

          if (field.value !== null) { // Only save field ID & value is there is a value present
            fields.push({
              id: field.id,
              value: value
            });
          }
        }
      });

      return fields;
    },
    forEachCustomField: function(block){
      _.each(this._customFields(), function(field){
        var id      = field.match(this.customFieldRegExp)[1],
            value   = this.normalizeValue(this.ticket().customField(field));
        block.call(this, {
          label: field,
          id: id,
          value: value
        });
      }, this);
    },
    normalizeValue: function(value){
      return {
        "yes": true,
        "no": false
      }[value] || value;
    },
    _customFields: _.memoize(function(){
      return _.filter(_.keys(this.containerContext().ticket), function(field){
        return field.match(this.customFieldRegExp);
      }, this);
    })
  };
}());