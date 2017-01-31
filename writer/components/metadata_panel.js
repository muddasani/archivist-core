var Substance = require("substance");
var $$ = React.createElement;
var Surface = Substance.Surface;
var _ = require("substance/helpers");
var TextProperty = require("substance-ui/text_property");

// Helpers
// ------------------

function label(name) {
  return $$('div', {className: 'label', contentEditable: false}, name);
}

function collapsibleLabel(name) {
  return $$('div', {className: 'label', contentEditable: false, onClick: handleCollapsible}, 
    $$('i', {className: 'fa fa-plus-circle'}),
    name
  );
}

function collapsible() {
  return $$('div', {className: 'collapse'}, arguments);
}

function handleCollapsible(e) {
  e.preventDefault();
  var label = $(e.currentTarget);
  label.find('i').toggleClass('fa-plus-circle fa-minus-circle');
  label.parent().toggleClass('active');
}

// Metadata Panel
// ------------------

var MetadataPanel = React.createClass({
  displayName: "Info",

  // State relevant things
  // ------------

  contextTypes: {
    backend: React.PropTypes.object.isRequired,
    app: React.PropTypes.object.isRequired,
    surfaceManager: React.PropTypes.object.isRequired
  },

  childContextTypes: {
    surface: React.PropTypes.object
  },

  getChildContext: function() {
    return {
      surface: this.surface
    };
  },

  getInitialState: function() {
    var app = this.context.app;
    var doc = app.doc;

    this.surface = new Surface(this.context.surfaceManager, doc, new Surface.FormEditor(), {name: 'metadata'});
    return null;
  },

  componentDidMount: function() {
    var app = this.context.app;
    app.registerSurface(this.surface, {
      enabledTools: ["strong", "emphasis"]
    });

    this.surface.attach(this.getDOMNode());

    var doc = app.doc;
    doc.connect(this, {
      'document:changed': this.handleDocumentChange
    });
    this.loadMetadata();
  },

  handleDocumentChange: function(change, info) {
    var refId = this.props.subjectReferenceId;

    if (change.isAffected(["document", "interviewee_waypoints"]) ||
        change.isAffected(["document", "forced_labor_type"]) ||
        change.isAffected(["document", "detention_place_type"]) ||
        change.isAffected(["document", "project_location"]) ||
        change.isAffected(["document", "record_type"]) ||
        change.isAffected(["document", "transcripted"]) ||
        change.isAffected(["document", "verified"]) ||
        change.isAffected(["document", "finished"]) ||
        change.isAffected(["document", "published"])) {
      this.loadMetadata();
    }
  },

  handleWaypointDensityChange: function(e) {
    var app = this.context.app;
    var doc = app.doc;
    var waypointId = e.currentTarget.dataset.waypointId;
    var newDensityValue = e.currentTarget.value;

    doc.transaction(function(tx) {
      tx.set([waypointId, "density"], newDensityValue);
    });
  },

  componentWillUnmount: function() {
    var app = this.context.app;
    app.doc.disconnect(this);
    app.unregisterSurface(this.surface);
    this.surface.detach();
  },

  loadProjectLocation: function(cb) {
    var backend = this.context.backend;
    var app = this.context.app;
    var doc = app.doc;

    var projectLocationId = doc.get('document').project_location;
    if (projectLocationId) {
      backend.getEntities([projectLocationId], function(err, locations) {
        if (err) return cb(err);
        cb(null, locations[0]);
      });
    } else {
      cb(null, null);
    }
  },

  loadWaypointLocations: function(cb) {
    var backend = this.context.backend;
    var app = this.context.app;
    var doc = app.doc;
    var waypoints = doc.get('document').getWaypoints();
    var waypointLocationIds = _.pluck(waypoints, 'entityId');

    backend.getEntities(waypointLocationIds, function(err, waypointLocations) {
      if (err) return cb(err);
      var res = {};
      _.each(waypointLocations, function(location) {
        res[location.id] =  location;
      });
      cb(null, res);
    });
  },

  loadMetadata: function() {
    var self = this;
    // console.log('loading/reloading external metadata and rerender');

    self.loadWaypointLocations(function(err, waypointLocations) {
      self.loadProjectLocation(function(err, projectLocation) {
        self.setState({
          waypointLocations: waypointLocations,
          projectLocation: projectLocation
        });
      });
    });
  },

  renderTextProperty: function(property) {
    var app = this.context.app;
    
    return $$(TextProperty, {
      doc: app.doc,
      path: [ "document", property]
    });
  },

  renderCheckboxProperty: function(property) {
    var app = this.context.app;
    var checked = app.doc.get('document')[property];

    return $$('input', {
      contentEditable: false,
      name: property,
      onChange: this.handleCheckboxChange,
      checked: checked,
      type: 'checkbox'
    });
  },

  renderCheckboxProperties: function(property, list) {
    var app = this.context.app;
    var checked = app.doc.get('document')[property];

    var checkboxes = list.map(function(item) {
      var active = checked === undefined ? false : checked.indexOf(item.id) > -1;
      return $$('div', {className: 'checkbox-wrapper', contentEditable: false, onClick: this.handleCheckboxesChange.bind(this, property)}, 
        $$('input', {contentEditable: false, name: item.id, checked: active, type: 'checkbox'}),
        $$('div', {className: 'label', contentEditable: false}, item.label)
      );
    }.bind(this));

    return $$('div', {className: 'checkboxes-wrapper', contentEditable: false}, checkboxes);
  },

  // getCheckboxValue: function(prop, value) {
  //   var app = this.context.app;
  //   var node = app.doc.get('document')[property];
  //   if(node === undefined) return false;
  //   return node.indexOf(value) > -1;
  // }

  renderInterviewType: function() {
    var app = this.context.app;
    var selected = app.doc.get('document').record_type;

    return $$('select', {contentEditable: false, onChange: this.handleInterviewTypeState, defaultValue: selected},
      $$('option', {value: 'video'}, "Video"),
      $$('option', {value: 'audio'}, "Audio")
    );
  },

  renderSelectList: function(prop, list) {
    var app = this.context.app;
    var selected = app.doc.get('document')[prop];

    var options = list.map(function(item) { 
      return $$('option', {value: item}, item)
    });

    return $$('select', {contentEditable: false, onChange: this.handleSelectListState.bind(this, prop), defaultValue: selected}, options);
  },

  handleSelectListState: function(prop, e) {
    var app = this.context.app;
    var doc = app.doc;
    var value = e.currentTarget.value;

    doc.transaction(function(tx) {
      tx.set(["document", prop], value);
    });
  },

  handleCheckboxChange: function(e) {
    var app = this.context.app;
    var doc = app.doc;
    var property = e.currentTarget.name;
    var checked = e.currentTarget.checked;

    doc.transaction(function(tx) {
      tx.set(["document", property], checked);
    });
  },

  handleCheckboxesChange: function(property, e) {
    var app = this.context.app;
    var doc = app.doc;
    var value = e.currentTarget.childNodes[0].name;
    var checked = e.currentTarget.childNodes[0].checked;
    var currentValue = app.doc.get('document')[property];
    var result = []
    if(currentValue === undefined) {
      result.push(value)
    } else {
      var index = currentValue.indexOf(value)
      result = currentValue
      if(index > -1) {
        result.splice(index, 1);
      } else {
        result.push(value)
      }
    }

    doc.transaction(function(tx) {
      tx.set(["document", property], result);
    });
  },

  handleInterviewTypeState: function(e) {
    var app = this.context.app;
    var doc = app.doc;
    var value = e.currentTarget.value;

    doc.transaction(function(tx) {
      tx.set(["document", "record_type"], value);
    });
  },

  handleAddWaypoint: function(e) {
    var app = this.context.app;
    e.preventDefault();
    app.replaceState({
      contextId: "selectWaypoint"
    });
  },

  handleSetProjectLocation: function(e) {
    var app = this.context.app;
    e.preventDefault();
    app.replaceState({
      contextId: "selectProjectLocation"
    });
  },

  handleRemoveProjectLocation: function(e) {
    e.preventDefault();
    var app = this.context.app;
    var doc = app.doc;

    doc.transaction(function(tx) {
      tx.set(["document", "project_location"], null);
    });
  },

  handleRemoveWaypoint: function(e) {
    var app = this.context.app;
    var doc = app.doc;
    var waypointId = e.currentTarget.dataset.id;
    e.preventDefault();

    var waypointIds = doc.get('document').interviewee_waypoints;
    waypointIds = _.without(waypointIds, waypointId);

    doc.transaction(function(tx) {
      tx.delete(waypointId);
      tx.set(["document", "interviewee_waypoints"], waypointIds);
    });
  },

  renderProjectLocation: function() {
    var elems = [label("Project Location")];

    if (this.state.projectLocation) {
      var projectLocation = $$('span', {className: 'entity-tag', contentEditable: false},
        $$('span', {className: 'project-location name'}, this.state.projectLocation.name),
        $$('a', {
          href: "#",
          "data-id": this.state.projectLocation.id,
          className: 'remove-tag remove-project-location',
          onClick: this.handleRemoveProjectLocation,
          dangerouslySetInnerHTML: {__html: '<i class="fa fa-remove"></i>'},
        })
      );
      elems.push(projectLocation);
    } else {
      elems.push($$('a', {
        href: '#',
        className: 'add-entity set-project-location',
        onClick: this.handleSetProjectLocation,
      }, "Set project Location"));
    }

    return $$('div', {contentEditable: false, className: 'project-location-wrapper'}, elems);
  },

  renderWaypoints: function() {
    var app = this.context.app;
    var doc = app.doc;
    var waypoints = doc.get("document").getWaypoints();

    var waypointEls = waypoints.map(function(waypoint) {
      var waypointLocation = this.state.waypointLocations[waypoint.entityId];

      return $$('span', {className: 'entity-tag waypoint'},
        $$('span', {className: 'name'}, waypointLocation.name),
        $$('input', {"data-waypoint-id": waypoint.id, className: 'density', min: 1, max: 5, type: 'number', defaultValue: waypoint.density, onChange: this.handleWaypointDensityChange}),
        $$('a', {
          href: "#",
          "data-id": waypoint.id,
          className: 'remove-tag remove-waypoint',
          onClick: this.handleRemoveWaypoint,
          dangerouslySetInnerHTML: {__html: '<i class="fa fa-remove"></i>'},
        })
      );
    }.bind(this));

    return $$('div', {className: 'waypoints-wrapper', contentEditable: false},
      label("Waypoints"),
      $$('div', {className: 'entity-tags waypoints'}, waypointEls),
      $$('a', {href: '#', className: 'add-entity add-waypoint', onClick: this.handleAddWaypoint}, "Add waypoint")
    );
  },

  render: function() {
    var props = this.props;

    if (!this.state) {
      return $$('div', {contentEditable: true, "data-id": "metadata"}, 'Loading');
    }

    return $$("div", {className: "panel metadata-panel-component", contentEditable: true, "data-id": "metadata"},
      $$('div', {className: 'panel-content'},
        $$('div', {className: 'summary section'},
          $$('h3', {contentEditable: false}, "Short summary"),
          // Short summary in russian
          collapsible(
            collapsibleLabel("Russian"),
            this.renderTextProperty('short_summary')
          ),

          // Short summary in english
          collapsible(
            collapsibleLabel("English"),
            this.renderTextProperty('short_summary_en')
          )
        ),

        $$('div', {className: 'abstracts section'},
          $$('h3', {contentEditable: false}, "Summary"),
          // Russian abstract
          collapsible(
            collapsibleLabel("Russian"),
            this.renderTextProperty('abstract')
          ),

          // English abstract
          collapsible(
            collapsibleLabel("English"),
            this.renderTextProperty('abstract_en')
          ),

          // German abstract
          collapsible(
            collapsibleLabel("German"),
            this.renderTextProperty('abstract_de')
          )
        ),

        $$('div', {className: 'biography section'},
          $$('h3', {contentEditable: false}, "Biography"),
          label("Name"),
          this.renderTextProperty("title"),

          // Russian biography
          collapsible(
            collapsibleLabel("Russian"),
            this.renderTextProperty("interviewee_bio")
          ),

          // English biography
          collapsible(
            collapsibleLabel("English"),
            this.renderTextProperty("interviewee_bio_en")
          ),

          // German biography
          collapsible(
            collapsibleLabel("German"),
            this.renderTextProperty("interviewee_bio_de")
          ),

          this.renderWaypoints()
        ),

        $$('div', {className: 'project section'},
          $$('h3', {contentEditable: false}, "Project Details"),
          // Project name
          label("Project Name"),
          this.renderTextProperty('project_name'),

          // Project location
          this.renderProjectLocation(),

          // Where the interview took place
          label("Place"),
          this.renderTextProperty('interview_location'),

          // Where the interview took place
          label("Persons present"),
          this.renderTextProperty('persons_present'),

          // Video or audio
          label("Interview Type"),
          this.renderInterviewType(),

          // Source of media
          label("Media identifier"),
          this.renderTextProperty('media_id'),

          // Interview duration
          label("Duration (in minutes)"),
          this.renderTextProperty('interview_duration'),

          // When the interview was recorded
          label("Interview date"),
          this.renderTextProperty('interview_date'),

          // Photo of respondent
          label("Respondent photo"),
          this.renderTextProperty('interviewee_photo'),

          // The interviewer
          label("Interviewer"),
          this.renderTextProperty('conductor'),

          // Interview operator
          label("Operator"),
          this.renderTextProperty('operator'),

          // Sound
          label("Sound Operator"),
          this.renderTextProperty('sound_operator'),

          label("Date of publication"),
          this.renderTextProperty('published_on')

          // $$('div', {className: "This interview was created on XX and published on YY. Last update was made"})
        ),

        $$('div', {className: 'person section'},
          $$('h3', {contentEditable: false}, "Person Details"),

          label("Тип принудительной работы"),
          this.renderCheckboxProperties('detention_place_type', [
            {id: 'Промышленность и строительство', label: 'Промышленность и строительство'}, 
            {id: 'Производство и хранение оружия', label: '→→ Производство и хранение оружия'},
            {id: 'Добыча ископаемых', label: '→→ Добыча ископаемых'}, 
            {id: 'Железная дорога, транспорт', label: '→→ Железная дорога, транспорт'}, 
            {id: 'Металлургия', label: '→→ Металлургия'}, 
            {id: 'Строительство', label: '→→ Строительство'}, 
            {id: 'Землеустроительные работы', label: '→→ Землеустроительные работы'}, 
            {id: 'Судоверфи', label: '→→ Судоверфи'}, 
            {id: 'Авиационная промышленность', label: '→→ Авиационная промышленность'}, 
            {id: 'Станкостроение и приборостроение', label: '→→ Станкостроение и приборостроение'}, 
            {id: 'Текстильная промышленность', label: '→→ Текстильная промышленность'}, 
            {id: 'Пищевая промышленность', label: '→→ Пищевая промышленность'}, 
            {id: 'Лесная промышленность', label: '→→ Лесная промышленность'}, 
            {id: 'Химический завод', label: '→→ Химический завод'}, 
            {id: 'Сельское хозяйство', label: 'Сельское хозяйство'}, 
            {id: 'Частный сектор и сфера услуг', label: 'Частный сектор и сфера услуг'}
          ]),

          label("Тип места заключения"),
          this.renderCheckboxProperties('forced_labor_type', [
            {id: 'рабочий лагерь', label: 'рабочий лагерь'},
            {id: 'штрафной лагерь', label: 'штрафной лагерь'},
            {id: 'концентрационный лагерь, лагерь смерти', label: 'концентрационный лагерь, лагерь смерти'},
            {id: 'тюрьма', label: 'тюрьма'},
            {id: 'частное хозяйство (ферма)', label: 'частное хозяйство (ферма)'},
            {id: 'частный дом (город)', label: 'частный дом (город)'}
          ]),

          label("Статус"),
          this.renderSelectList('person_state', [
            'военнопленный',
            'ост'
          ]),

          this.renderCheckboxProperty('military_service'),
          label("Служба в советской армии"),

          label("Пол"),
          this.renderSelectList('sex', [
            'мужчина',
            'женщина'
          ]),

          label("Место рождения (регион)"),
          this.renderTextProperty('place_of_birth'),

          label("Project"),
          this.renderSelectList('project', [
            'Международный проект документации рабского и принудительного труда',
            'Выжившие в Маутхаузене',
            'Коллекция №1'
          ]),

          label("Год рождения"),
          this.renderTextProperty('year_of_birth'),

          label("Год угона"),
          this.renderTextProperty('enslaving_year'),

          label("Год возвращения домой"),
          this.renderTextProperty('homecoming_year')
        ),

        $$('div', {className: 'status section', contentEditable: false},
          $$('h3', {contentEditable: false}, "Workflow"),

          this.renderCheckboxProperty('transcripted'),
          label("Transcription ready"),

          this.renderCheckboxProperty('verified'),
          label("Interview verified"),

          this.renderCheckboxProperty('finished'),
          label("Ready for publish"),

          this.renderCheckboxProperty('published'),
          label("Published")
        )
      )
    );
  }
});

MetadataPanel.contextId = "metadata";
MetadataPanel.icon = "fa-info";

module.exports = MetadataPanel;