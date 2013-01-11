define ["genesis", "backbone", "cs!modules/settings/plugins", "cs!modules/settings/configs", "cs!modules/settings/groups", "cs!modules/settings/users", "cs!modules/settings/roles", "cs!modules/settings/databags", "services/backend"], (genesis, Backbone, Plugins, SystemConfigs, Groups, Users, Roles, Databags, backend) ->
  AppSettings = genesis.module()
  class AppSettings.Views.Main extends Backbone.View
    template: "app/templates/settings.html"
    pluginsView: null
    configsView: null
    groupsView: null
    usersView: null
    events:
      "click #plugin-panel-tab-header": "showPluginsTab"
      "click #settings-panel-tab-header": "showSettings"
      "click #group-panel-tab-header": "showGroupsTab"
      "click #user-panel-tab-header": "showUsersTab"
      "click #roles-panel-tab-header": "showRolesTab"
      "click #databags-panel-tab-header": "showDatabags"

    onClose: ->
      genesis.utils.nullSafeClose @pluginsView
      genesis.utils.nullSafeClose @configsView
      genesis.utils.nullSafeClose @groupsView
      genesis.utils.nullSafeClose @usersView
      genesis.utils.nullSafeClose @rolesView
      genesis.utils.nullSafeClose @databagsView

    showPluginsTab: ->
      unless @pluginsView?
        @pluginsView = new Plugins.Views.Main(
          el: @$("#plugin-panel")
          main: this
        )

    showSettings: ->
      unless @configsView?
        @configsView = new SystemConfigs.Views.Main(
          el: @$("#config-panel")
          main: this
        )
      @toggleRestart()

    showGroupsTab: ->
      @groupsView = new Groups.Views.Main(el: @$("#group-panel"))  unless @groupsView?

    showUsersTab: ->
      @usersView = new Users.Views.Main(el: @$("#user-panel"))  unless @usersView?

    showRolesTab: ->
      unless @rolesView?
        @rolesView = new Roles.Views.Main(el: @$("#roles-panel"))
      else
        @rolesView.trigger "opened"

    showDatabags: ->
      @databagsView = new Databags.Views.Main(el: @$("#databags-panel"))  unless @databagsView?

    toggleRestart: ->
      $.when(backend.SettingsManager.restartRequired()).done (restart) =>
        @$("#restart").toggle restart


    render: ->
      $.when(backend.UserManager.hasUsers(), backend.UserManager.hasGroups(), genesis.fetchTemplate(@template)).done (hasUsers, hasGroups, tmpl) =>
        @$el.html tmpl(
          users: hasUsers[0]
          groups: hasGroups[0]
        )
        @showSettings()

  AppSettings

