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
        this._acValue = builder.get_object("acValue");
        this._batteryValue = builder.get_object("batteryValue");
        this._percentDimValue = builder.get_object("percentDimValue");
        this._dimByValueFrame = builder.get_object("dimByValueFrame");
        this._dimByPercentFrame = builder.get_object("dimByPercentFrame");

        this._acValue.set_value(this._settings.AC_BRIGHTNESS.get());
        this._batteryValue.set_value(this._settings.BATTERY_BRIGHTNESS.get());
        this._percentDimValue.set_value(this._settings.PERCENTAGE_DIM.get());

        this._legacyToggleSwitch.connect('state-set', Lang.bind(this, this._onLegacyToggleSwitch));
        this._acValue.connect('value-changed', Lang.bind(this, this._onACValueChange));
        this._batteryValue.connect('value-changed', Lang.bind(this, this._onBatteryValueChange));
        this._percentDimValue.connect('value-changed', Lang.bind(this, this._onPercentDimChange));

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

    _onBatteryValueChange: function(spin_button) {
        if (spin_button.get_value() != this._settings.BATTERY_BRIGHTNESS.get()) {
            this._settings.BATTERY_BRIGHTNESS.set(spin_button.get_value());
        }
    },

    _onACValueChange: function(spin_button) {
        if (spin_button.get_value() != this._settings.AC_BRIGHTNESS.get()) {
            this._settings.AC_BRIGHTNESS.set(spin_button.get_value());
        }
    },

    _onPercentDimChange: function(spin_button) {
        if (spin_button.get_value() != this._settings.PERCENTAGE_DIM.get()) {
            this._settings.PERCENTAGE_DIM.set(spin_button.get_value());
        }
    },

    destroy: function() {
        this._legacyToggleSwitch.disconnect();
        this._acValue.disconnect();
        this._batteryValue.disconnect();
        this._percentDimValue.disconnect();
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

