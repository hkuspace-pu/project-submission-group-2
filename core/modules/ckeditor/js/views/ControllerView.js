/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, Backbone, CKEDITOR, _) {
  Drupal.ckeditor.ControllerView = Backbone.View.extend({
    events: {},
    initialize: function initialize() {
      this.getCKEditorFeatures(this.model.get('hiddenEditorConfig'), this.disableFeaturesDisallowedByFilters.bind(this));
      this.model.listenTo(this.model, 'change:activeEditorConfig', this.model.sync);
      this.listenTo(this.model, 'change:isDirty', this.parseEditorDOM);
    },
    parseEditorDOM: function parseEditorDOM(model, isDirty, options) {
      if (isDirty) {
        var currentConfig = this.model.get('activeEditorConfig');
        var rows = [];
        this.$el.find('.ckeditor-active-toolbar-configuration').children('.ckeditor-row').each(function () {
          var groups = [];
          $(this).find('.ckeditor-toolbar-group').each(function () {
            var $group = $(this);
            var $buttons = $group.find('.ckeditor-button');
            if ($buttons.length) {
              var group = {
                name: $group.attr('data-drupal-ckeditor-toolbar-group-name'),
                items: []
              };
              $group.find('.ckeditor-button, .ckeditor-multiple-button').each(function () {
                group.items.push($(this).attr('data-drupal-ckeditor-button-name'));
              });
              groups.push(group);
            }
          });
          if (groups.length) {
            rows.push(groups);
          }
        });
        this.model.set('activeEditorConfig', rows);
        this.model.set('isDirty', false);
        if (options.broadcast !== false) {
          var prev = this.getButtonList(currentConfig);
          var next = this.getButtonList(rows);
          if (prev.length !== next.length) {
            this.$el.find('.ckeditor-toolbar-active').trigger('CKEditorToolbarChanged', [prev.length < next.length ? 'added' : 'removed', _.difference(_.union(prev, next), _.intersection(prev, next))[0]]);
          }
        }
      }
    },
    getCKEditorFeatures: function getCKEditorFeatures(CKEditorConfig, callback) {
      var getProperties = function getProperties(CKEPropertiesList) {
        return _.isObject(CKEPropertiesList) ? _.keys(CKEPropertiesList) : [];
      };
      var convertCKERulesToEditorFeature = function convertCKERulesToEditorFeature(feature, CKEFeatureRules) {
        for (var i = 0; i < CKEFeatureRules.length; i++) {
          var CKERule = CKEFeatureRules[i];
          var rule = new Drupal.EditorFeatureHTMLRule();
          var tags = getProperties(CKERule.elements);
          rule.required.tags = CKERule.propertiesOnly ? [] : tags;
          rule.allowed.tags = tags;
          rule.required.attributes = getProperties(CKERule.requiredAttributes);
          rule.allowed.attributes = getProperties(CKERule.attributes);
          rule.required.styles = getProperties(CKERule.requiredStyles);
          rule.allowed.styles = getProperties(CKERule.styles);
          rule.required.classes = getProperties(CKERule.requiredClasses);
          rule.allowed.classes = getProperties(CKERule.classes);
          rule.raw = CKERule;
          feature.addHTMLRule(rule);
        }
      };
      var hiddenCKEditorID = 'ckeditor-hidden';
      if (CKEDITOR.instances[hiddenCKEditorID]) {
        CKEDITOR.instances[hiddenCKEditorID].destroy(true);
      }
      var hiddenEditorConfig = this.model.get('hiddenEditorConfig');
      if (hiddenEditorConfig.drupalExternalPlugins) {
        var externalPlugins = hiddenEditorConfig.drupalExternalPlugins;
        Object.keys(externalPlugins || {}).forEach(function (pluginName) {
          CKEDITOR.plugins.addExternal(pluginName, externalPlugins[pluginName], '');
        });
      }
      CKEDITOR.inline($("#".concat(hiddenCKEditorID)).get(0), CKEditorConfig);
      CKEDITOR.once('instanceReady', function (e) {
        if (e.editor.name === hiddenCKEditorID) {
          var CKEFeatureRulesMap = {};
          var rules = e.editor.filter.allowedContent;
          var rule;
          var name;
          for (var i = 0; i < rules.length; i++) {
            rule = rules[i];
            name = rule.featureName || ':(';
            if (!CKEFeatureRulesMap[name]) {
              CKEFeatureRulesMap[name] = [];
            }
            CKEFeatureRulesMap[name].push(rule);
          }
          var features = {};
          var buttonsToFeatures = {};
          Object.keys(CKEFeatureRulesMap).forEach(function (featureName) {
            var feature = new Drupal.EditorFeature(featureName);
            convertCKERulesToEditorFeature(feature, CKEFeatureRulesMap[featureName]);
            features[featureName] = feature;
            var command = e.editor.getCommand(featureName);
            if (command) {
              buttonsToFeatures[command.uiItems[0].name] = featureName;
            }
          });
          callback(features, buttonsToFeatures);
        }
      });
    },
    getFeatureForButton: function getFeatureForButton(button) {
      if (button === '-') {
        return false;
      }
      var featureName = this.model.get('buttonsToFeatures')[button.toLowerCase()];
      if (!featureName) {
        featureName = button.toLowerCase();
      }
      var featuresMetadata = this.model.get('featuresMetadata');
      if (!featuresMetadata[featureName]) {
        featuresMetadata[featureName] = new Drupal.EditorFeature(featureName);
        this.model.set('featuresMetadata', featuresMetadata);
      }
      return featuresMetadata[featureName];
    },
    disableFeaturesDisallowedByFilters: function disableFeaturesDisallowedByFilters(features, buttonsToFeatures) {
      this.model.set('featuresMetadata', features);
      this.model.set('buttonsToFeatures', buttonsToFeatures);
      this.broadcastConfigurationChanges(this.$el);
      var existingButtons = [];
      var buttonGroups = _.flatten(this.model.get('activeEditorConfig'));
      for (var i = 0; i < buttonGroups.length; i++) {
        var buttons = buttonGroups[i].items;
        for (var k = 0; k < buttons.length; k++) {
          existingButtons.push(buttons[k]);
        }
      }
      existingButtons = _.unique(existingButtons);
      for (var n = 0; n < existingButtons.length; n++) {
        var button = existingButtons[n];
        var feature = this.getFeatureForButton(button);
        if (feature === false) {
          continue;
        }
        if (Drupal.editorConfiguration.featureIsAllowedByFilters(feature)) {
          this.$el.find('.ckeditor-toolbar-active').trigger('CKEditorToolbarChanged', ['added', existingButtons[n]]);
        } else {
          $(".ckeditor-toolbar-active li[data-drupal-ckeditor-button-name=\"".concat(button, "\"]")).detach().appendTo('.ckeditor-toolbar-disabled > .ckeditor-toolbar-available > ul');
          this.model.set({
            isDirty: true
          }, {
            broadcast: false
          });
        }
      }
    },
    broadcastConfigurationChanges: function broadcastConfigurationChanges($ckeditorToolbar) {
      var view = this;
      var hiddenEditorConfig = this.model.get('hiddenEditorConfig');
      var getFeatureForButton = this.getFeatureForButton.bind(this);
      var getCKEditorFeatures = this.getCKEditorFeatures.bind(this);
      $ckeditorToolbar.find('.ckeditor-toolbar-active').on('CKEditorToolbarChanged.ckeditorAdmin', function (event, action, button) {
        var feature = getFeatureForButton(button);
        if (feature === false) {
          return;
        }
        var configEvent = action === 'added' ? 'addedFeature' : 'removedFeature';
        Drupal.editorConfiguration[configEvent](feature);
      }).on('CKEditorPluginSettingsChanged.ckeditorAdmin', function (event, settingsChanges) {
        Object.keys(settingsChanges || {}).forEach(function (key) {
          hiddenEditorConfig[key] = settingsChanges[key];
        });
        getCKEditorFeatures(hiddenEditorConfig, function (features) {
          var featuresMetadata = view.model.get('featuresMetadata');
          Object.keys(features || {}).forEach(function (name) {
            var feature = features[name];
            if (featuresMetadata.hasOwnProperty(name) && !_.isEqual(featuresMetadata[name], feature)) {
              Drupal.editorConfiguration.modifiedFeature(feature);
            }
          });
          view.model.set('featuresMetadata', features);
        });
      });
    },
    getButtonList: function getButtonList(config) {
      var buttons = [];
      config = _.flatten(config);
      config.forEach(function (group) {
        group.items.forEach(function (button) {
          buttons.push(button);
        });
      });
      return _.without(buttons, '-');
    }
  });
})(jQuery, Drupal, Backbone, CKEDITOR, _);