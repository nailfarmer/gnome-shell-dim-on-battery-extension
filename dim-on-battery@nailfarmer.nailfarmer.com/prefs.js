const Gtk = imports.gi.Gtk;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

const DimmingPrefsWidget = new GObject.Class({
    Name: "Dimming.Prefs.Widget",
    GTypeName: "DimmingPrefsWidget",
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this._settings = new Settings.Prefs();
        this.orientation = Gtk.Orientation.VERTICAL;
        this.spacing = 0;
        let builder = new Gtk.Builder();
        builder.set_translation_domain("dim-on-battery");
        builder.add_from_file(Extension.path + "/prefs.ui");

        let mainContainer = builder.get_object("mainContainer");
        if (shellVersion < 40) {
            this.add(mainContainer);
        } else {
            this.append(mainContainer);
        }


    },
});

function init () {}

function buildPrefsWidget () {
    let _prefsWidget = new DimmingPrefsWidget();
    if (shellVersion < 40) {
        _prefsWidget.connect('destroy', Gtk.main_quit);
        _prefsWidget.show_all();
    }
    return _prefsWidget;
}

