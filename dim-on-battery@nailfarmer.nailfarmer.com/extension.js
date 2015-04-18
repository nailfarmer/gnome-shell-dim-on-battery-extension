/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// Dim On Battery Power: Lower screen brightness when on battery power and
//                       restore to previous level on ac.
//
// Copyright (C) 2015 nailfarmer

// This program is free software: you can redistribute it and/or m odify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Author: nailfarmer

const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const UPower = imports.ui.status.power.UPower;
const St = imports.gi.St;
const Main = imports.ui.main;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;


const BUS_NAME = 'org.gnome.SettingsDaemon';
const OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

const ScreenIface = '<node>\
  <interface name="org.gnome.SettingsDaemon.Power.Screen">\
    <property type="i" name="Brightness" access="readwrite">\
    </property>\
  </interface>\
</node>';


let brightnessManager = null;

function BrightnessManager() {
    this._init();
}

BrightnessManager.prototype = {
   __proto__: function() {
   },

   _init: function() {
       this._lastStatus = -1;
       this._settings = (new Settings.Prefs());
       this._dimLevel = this._settings.DIMLEVEL.get();
       this._brightLevel = 100;
       this._screenProxyWrapper = Gio.DBusProxy.makeProxyWrapper(ScreenIface);
       this._uPowerProxy = Main.panel.statusArea["aggregateMenu"]._power._proxy;
       
       this._uPowerSignal = this._uPowerProxy.connect('g-properties-changed', Lang.bind(this, this._onPowerChange));

       this._settingsChangedSignal = this._settings.settings.connect('changed::dim-level', Lang.bind(this, this._onSettingsChange));
       this._onPowerChange();
   },

   setLowBrightness: function(proxy) {
	   global.log(this._dimLevel);
       proxy.Brightness=parseInt(this._dimLevel);
   },


   setHighBrightness: function(proxy) {
       proxy.Brightness=parseInt(this._brightLevel);
   },

   _onSettingsChange: function() {
       this._dimLevel = this._settings.DIMLEVEL.get();
       this._onPowerChange();
       global.log('settings have changed');
   },

   _onPowerChange: function() {
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
	   if ( this._lastStatus != UPower.DeviceState.DISCHARGING ) {
               new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, Lang.bind(this, this.setLowBrightness));
	       this._lastStatus == UPower.DeviceState.DISCHARGING;
	   } else {
	   }
       } else {
               new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, Lang.bind(this, this.setHighBrightness));
       }
   },

   destroy: function() {
       this._uPowerProxy.disconnect(this._upowerSignal);
       this._settings.settings.disconnect(this._settingsChangedSignal);
   }
}


function init() {
}

function enable() {
    global.log('Dim On Battery Power enabled');
    brightnessManager = new BrightnessManager();
}

function disable() {
    global.log('Dim On Battery Power disabled');
    brightnessManager.destroy();
}

