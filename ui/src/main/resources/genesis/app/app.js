require([
  "genesis",
  "router",
  // Libs
  "jquery",
  "backbone",
  "underscore",
  //services
  "services/backend",
  // Modules
  "modules/status",
  "modules/projects",
  "modules/environments",
  "modules/breadcrumbs",
  "cs!utils/inactivity",
//jquery plugins
  "bootstrap",
  "tabs"
],

function(genesis, routermodule, jQuery, Backbone, _, backend, status, Projects, Environments, Breadcrumbs, Inactivity) {

  var app = genesis.app;
  var inactive = new Inactivity({timeout: 15 * 60 * 1000});
  jQuery(function($) {
    var errorDialog = $("<div style='margin-top: 10px' id='server-communication-error-dialog'></div>").dialog({
      title: 'Failed to complete request',
      dialogClass: 'error-notification-dialog',
      width: 400,
      minHeight: 80
    });

    var sessionExpireDialog = $("<div style='margin-top: 10px' id='genesis-warning-dialog'></div>").dialog({
      title: 'Session expiry',
      dialogClass: 'error-notification-dialog',
      width: 400,
      minHeight: 80
    });

    var sessionShutdownDialog =  $("<div style='margin-top: 10px' id='genesis-session-expire-dialog'></div>").dialog({
      title: 'Session expired',
      dialogClass: 'error-notification-dialog',
      width: 400,
      minHeight: 80
    });

    genesis.app.bind('session-expire', function(message) {
      if (! sessionExpireDialog.dialog('isOpen')) {
        $('#genesis-warning-dialog').html(message);
        sessionExpireDialog.dialog("option", "buttons", {
          "OK": function() {
             $(this).dialog('close');
            inactive.reset();
          }
        }).dialog("open");
        setTimeout(function() {
          $('#genesis-warning-dialog').dialog('close');
          inactive.shutdown();
        }, 60000);
      }
    });

    genesis.app.bind('polling-shutdown', function(message) {
      if (! sessionShutdownDialog.dialog('isOpen')) {
        $('#genesis-session-expire-dialog').html(message);
        sessionShutdownDialog.dialog("option", "buttons", {
          "Refresh" : function() {
            $(this).dialog('close');
            setTimeout(function(){location.reload(true)}, 50);
          }
        }).dialog("open");
      }
    });

    genesis.app.bind("server-communication-error", function(message, url) {
      if (!errorDialog.dialog('isOpen')) {
        $("#server-communication-error-dialog").html(message);
        errorDialog.dialog("option", "buttons", {
          "OK": function() {
            $(this).dialog("close");
            if(!_.isUndefined(url)) {
              if(_.isFunction(url)){
                url();
              } else {
                if (genesis.app.router) genesis.app.router.navigate(url, {trigger: true});
              }
            }
          }
        }).dialog('open');
      }
    });


    (function initializeErrorHandler(doc) {
      var errorHandler = {
        401: function (event, xhr, settings) {
          if(app.currentConfiguration.logout_disabled) {
            var retry = settings.retry || 1;
            if(retry < 2) {
              settings.retry = retry + 1;
              $.ajax(settings);
            } else {
              genesis.app.trigger("server-communication-error", "Server authentication has expired <br/><br/> Press OK to reload the page", function(){ location.reload(true); });
            }
          } else {
            window.location.href = "login.html?expire=true";
          }
        },

        403: function () {
          genesis.app.trigger("server-communication-error", "You don't have enough permissions to access this page", "/")
        },

        404: function () {
          genesis.app.trigger("server-communication-error", "Requested resource wasn't found", "/");
        },

        500: function (event, xhr, settings) {
          var errorMsg = "";
          try {
            var error = JSON.parse(xhr.responseText).error;
            errorMsg = "Internal server error: " + error;
          } catch (e) {
            errorMsg = "Internal server error occurred.";
          }
          genesis.app.trigger("server-communication-error", errorMsg + (!app.currentUser.administrator ? "<br/><br/> Please contact system administrator" : ""));
        },

        503: function () {
          if (!errorDialog.dialog('isOpen')) {
            errorDialog.dialog("option", "buttons", {});
            $("#server-communication-error-dialog").
              html("Backend service became unreachable (or took to long to respond). <br/><br/>" +
                "Please try again later or contact administrator if the problem persists.");
            errorDialog.dialog('open');
          }
        }
      };

      $(doc).ajaxError(function (event, xhr, settings) {
        if (!settings.suppressErrors) {
          genesis.app.trigger("page-view-loading-completed");
          (errorHandler[xhr.status] || function () {}) (event, xhr, settings);
        }
      });

      $.ajaxPrefilter(function( options, originalOptions, jqXHR ) {
        options.error = function (xhr, status, thrown) {
          if(xhr.status != 401 && originalOptions.error) {
            originalOptions.error(xhr, status, thrown);
          }
        }
      });

    })(document || {});

    $.when(backend.UserManager.whoami()).done(function(restRoot) {
      initCurrentUser(restRoot);
      Environments.fixFilter();

      var projectsUrlRoot = _(restRoot.links).find( backend.LinkTypes.Project.any );

      var userProjects = new Projects.Collection([], {url: projectsUrlRoot.href });

      var projectsDropdownTmpl = _.template($("#project-dropdown-list-tmpl").html());

      userProjects.bind("all", function () {
        $(".project-list").html(projectsDropdownTmpl({
          projects: userProjects.toJSON()
        }));
      });

      userProjects.fetch().done(function() {

        genesis.app.bind("projects-changed", function() {
          userProjects.fetch();
        });

        app.router = new routermodule.Router({projects: userProjects});
        app.breadcrumbs = new Breadcrumbs.View({router: app.router, projects: userProjects});

        app.router.bind('all', function () {
          var path = /project\/(\d*)/g.exec(Backbone.history.fragment);
          var currentProject = "Projects";
          if(path && path[1] && userProjects.get(path[1])) {
            currentProject = userProjects.get(path[1]).get('name');
          }
          $("#current-project").html(currentProject);
        });

        genesis.app.trigger("page-view-loading-completed");
        Backbone.history.start();
      });
    }).fail(function(jxhr){
       if (jxhr.status == 403) {
          status.StatusPanel.error("You are not allowed to access this page");
          genesis.app.trigger("page-view-loading-completed");
       }
    });

    $.when(backend.SettingsManager.coreDetails()).done(function(details) {
      $(".core-details").data("details", details).text("v" + details.build.version + "-sha:" + details.revision.short)
    });

    $.when(backend.SettingsManager.distributionDetails()).done(function(details) {
      var hasVersion = details.build && details.build.version;
      var hasRevision = details.revision && details.revision.short;

      var info = details.name || 'Unknown';
      if (hasVersion) info = info + " v" + details.build.version;
      if (hasRevision) info = info + (hasVersion ? "-" : " ") + "sha:" + details.revision.short;

      $(".distr-details").data("details", details).text(info)
    });

    $.when(backend.SettingsManager.contentList()).done(function(contentList) {
      var contentTemplate = _.template($("#content-list-tmpl").html());
      if (contentList.length > 0) {
        $('.additional-content-list').html(contentTemplate({
          links: contentList
        }));
        $(".content-list").show();
      }
    }).fail(function(jxhr){});

    $(".genesis-version").click(function(e) {
      if (e.shiftKey && window) {
        window.prompt("Copy to clipboard: Ctrl+C, Enter",
          JSON.stringify({
            "core": $(".core-details").data("details") || null,
            "distribution": $(".distr-details").data("details") || null
          }));
        return false;
      }
    });

    function initCurrentUser(user){
      app.currentUser = user;
      app.currentConfiguration = user.configuration || {};

      var logoutLink = _(user.links).find(function(link) { return link.rel == "logout"});
      app.currentConfiguration["logout_disabled"] = _.isUndefined(logoutLink);

      var systemSettingsLink = _(user.links).find(backend.LinkTypes.SystemSettings.any);

      $('.user-name').text(user.user);
      if (systemSettingsLink) {
        $(".system-settings")
          .show()
          .attr("data-settings-url", systemSettingsLink.href);
      }

      $(document).on("focus", ".readonly input", function(){
        if (! $(this).is('[data-access-all]'))
          $(this).attr('disabled', 'disabled');
      });
      $(document).on("focus", ".readonly textarea", function(){
        if (! $(this).is('[data-access-all]'))
          $(this).attr('disabled', 'disabled');
      });
      $(document).on("mouseenter focus", ".readonly select", function(){
        if (! $(this).is('[data-access-all]'))
          $(this).attr('disabled', 'disabled');
      });

      if ( !logoutLink ) {
        $("#logout_elt a").css("cursor", "default");
        $("#logout_elt .caret").remove();
        $("#logout_elt .dropdown-menu").remove();
      } else {
        $(".logout-link").attr("href", logoutLink.href)
      }
      // datetime picker settings customization:
      var locale = app.currentConfiguration.locale;
      $.timepicker.setDefaults({
        controlType :"select",
        showOn: "button", buttonText: "Select date & time",
        buttonImage: "assets/img/date-picker.png", buttonImageOnly: true,
        // TODO: provide timepicker localization file
        timeFormat: locale == "en-US" ? "hh:mm tt" : "HH:mm"
      });
    }

    $("#connection-error").ajaxError(function(event, jqXHR) {
      if (((jqXHR.status === 0 && jqXHR.statusText !== "abort") || jqXHR.status === 12029) && $(this).is(":hidden")) {
        if(jqXHR.statusText === "timeout") {
          genesis.app.trigger("page-view-loading-completed");
          genesis.app.trigger("server-communication-error", "Timeout. Server took too long to respond.")
        } else {
          $(this).show();
          pollServerStatus($(this));
        }
      }
    });

    function pollServerStatus($errorPanel) {
      setTimeout(function () {
        $.when(backend.UserManager.whoami()).fail(function (jqXHR) {
          if (jqXHR.status === 0) {
            pollServerStatus($errorPanel);
          } else {
            $errorPanel.text("Server communication error");
          }
        }).done(function() {
            $errorPanel.hide()
        })
      }, 5000)
    }

    var $loadingSpinner = $("#page-view-loading");
    var $overlay = $("#overlay");
    genesis.app.bind("page-view-loading-started", function() {
      $loadingSpinner.show();
      $overlay.show();
    });
    genesis.app.bind("page-view-loading-completed", function() {
      $loadingSpinner.hide();
      $overlay.hide();
    });
    inactive.start();
  });

  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  $(document).on("click", "a:not([data-bypass])", function(evt) {
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";
    if (href && href !== "#" &&
        href.slice(0, protocol.length) !== protocol &&
        href.indexOf("javascript:") !== 0) {
      evt.preventDefault();
      app.router.navigate(href, true);
    }
  });

  // fix validation error placement
  $.validator.setDefaults({
    errorPlacement: function(error, element) {
      error.appendTo(element.parent());
    }
  });

});
