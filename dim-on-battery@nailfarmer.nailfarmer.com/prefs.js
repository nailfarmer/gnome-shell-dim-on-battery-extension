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

        this._legacyToggleSwitch = builder.get_object("legacyToggle");
        this._dimByValueFrame = builder.get_object("dimByValueFrame");
        this._dimByPercentFrame = builder.get_object("dimByPercentFrame");
        this._legacyToggleSwitch.connect('state-set', Lang.bind(this, this._onLegacyToggleSwitch));
    
        if (this._settings.LEGACY_MODE.get() === true ) {
            this._legacyToggleSwitch.set_active(true);
            this._dimByValueFrame.set_sensitive(true);
            this._dimByPercentFrame.set_sensitive(false);
        } else {
            this._legacyToggleSwitch.set_active(false);
            this._dimByValueFrame.set_sensitive(false);
            this._dimByPercentFrame.set_sensitive(true);
        }
    },

    _onLegacyToggleSwitch: function(toggle, state) {
        var oldval = this._settings.LEGACY_MODE.get();
        if (state != this._settings.LEGACY_MODE.get()) {
            this._settings.LEGACY_MODE.set(state);
            if ( state === true ) {
                this._dimByValueFrame.set_sensitive(true);
                this._dimByPercentFrame.set_sensitive(false);
            } else {
                this._dimByValueFrame.set_sensitive(false);
                this._dimByPercentFrame.set_sensitive(true);
            }
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

