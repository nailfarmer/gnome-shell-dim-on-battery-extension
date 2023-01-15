const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();

const SCHEMA_PATH = 'org.gnome.shell.extensions.dim-on-battery';

function Prefs() {
	var self = this;
	var settings = this.settings = ExtensionUtils.getSettings(SCHEMA_PATH);
	this.BATTERY_BRIGHTNESS = {
		key: 'battery-brightness',
		get: function() { return settings.get_double(this.key); },
		set: function(v) { settings.set_double(this.key, v); },
		changed: function(cb) { return settings.connect('changed::' + this.key, cb); },
		disconnect: function() { return settings.disconnect.apply(settings, arguments); },
	};
	this.AC_BRIGHTNESS = {
		key: 'ac-brightness',
		get: function() { return settings.get_double(this.key); },
		set: function(v) { settings.set_double(this.key, v); },
		changed: function(cb) { return settings.connect('changed::' + this.key, cb); },
		disconnect: function() { return settings.disconnect.apply(settings, arguments); },
    };
	this.LEGACY_MODE = {
		key: 'legacy-mode',
		get: function() { return settings.get_boolean(this.key); },
		set: function(v) { settings.set_boolean(this.key, v); },
		changed: function(cb) { return settings.connect('changed::' + this.key, cb); },
    };
	this.PREVIOUS_STATE = {
		key: 'previous-state',
		get: function() { return settings.get_int(this.key); },
		set: function(v) { settings.set_int(this.key, v); },
		changed: function(cb) { return settings.connect('changed::' + this.key, cb); },
		disconnect: function() { return settings.disconnect.apply(settings, arguments); },
	};
	this.PERCENTAGE_DIM = {
		key: 'percentage-dim',
		get: function() { return settings.get_double(this.key); },
		set: function(v) { settings.set_double(this.key, v); },
		changed: function(cb) { return settings.connect('changed::' + this.key, cb); },
	};
};
