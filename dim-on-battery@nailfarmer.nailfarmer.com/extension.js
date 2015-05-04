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

const DEFAULT_BRIGHTNESS_AC = 100;
const DEFAULT_BRIGHTNESS_BATTERY = 50;


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
       this._batteryBrightness = this._settings.BATTERY_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_BATTERY);
       this._acBrightness = this._settings.AC_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_AC); 
       this._screenProxyWrapper = Gio.DBusProxy.makeProxyWrapper(ScreenIface);
       this._uPowerProxy = Main.panel.statusArea["aggregateMenu"]._power._proxy;
       
       this._uPowerSignal = this._uPowerProxy.connect('g-properties-changed', Lang.bind(this, this._onPowerChange));

       this.lastStatus = this._uPowerProxy.State;
       this._acBrightnessChangedSignal = this._settings.settings.connect('changed::ac-level', Lang.bind(this, this._onSettingsChange));
       this._batteryBrightnessChangedSignal = this._settings.settings.connect('changed::battery-level', Lang.bind(this, this._onSettingsChange));
       this._onPowerChange();
   },

   setLowBrightness: function(proxy) {
       if ( Math.abs(parseInt(proxy.Brightness,10) - parseInt(this._acBrightness, 10)) > 1) {
	   if ( ! isNaN(proxy.Brightness) ) {
               this._acBrightness = parseInt(proxy.Brightness, 10);
	       this._settings.AC_BRIGHTNESS.set(parseInt(this._acBrightness));
	   }
       }
       if ( isNaN(proxy.Brightness) || Math.abs(parseInt(proxy.Brightness,10) - parseInt(this._batteryBrightness,10)) > 1) {
           proxy.Brightness=parseInt(this._batteryBrightness,10);
       }
   },


   setHighBrightness: function(proxy) {
       if ( Math.abs(parseInt(proxy.Brightness,10) - parseInt(this._batteryBrightness, 10)) > 1) {
	   if ( ! isNaN(proxy.Brightness) ) {
               this._batteryBrightness = parseInt(proxy.Brightness, 10);
	       this._settings.BATTERY_BRIGHTNESS.set(parseInt(this._batteryBrightness));
	   }
       }
       if ( isNaN(proxy.Brightness) || Math.abs(parseInt(proxy.Brightness,10) - parseInt(this._acBrightness,10)) > 1) {
           proxy.Brightness=parseInt(this._acBrightness,10);
       }
   },

   _onSettingsChange: function() {
       var changed = false;
       if ( Math.abs(parseInt(this._batteryBrightness,10) - parseInt(this._settings.BATTERY_BRIGHTNESS.get(),10)) > 1 ) {
           this._batteryBrightness = parseInt(this._settings.BATTERY_BRIGHTNESS.get(),10);
	   changed = true;
       }
       
       if ( Math.abs(parseInt(this._acBrightness,10) - parseInt(this._settings.AC_BRIGHTNESS.get(),10)) > 1 ) {
           this._acBrightness = parseInt(this._settings.AC_BRIGHTNESS.get(),10);
	   changed = true;
       }
       if ( changed ) {
           this._onPowerChange();
       }
       global.log('[dim-on-battery] settings have changed');
   },

   _onPowerChange: function() {
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
	   if ( this._lastStatus != UPower.DeviceState.DISCHARGING ) {
               new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, Lang.bind(this, this.setLowBrightness));
	       this._lastStatus = UPower.DeviceState.DISCHARGING;
	   }
       } else {
	   if ( this._lastStatus == UPower.DeviceState.DISCHARGING ) {
               new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, Lang.bind(this, this.setHighBrightness));
	       this._lastStatus = UPower.DeviceState.CHARGING;
	   }
       }
   },

   destroy: function() {
       this._uPowerProxy.disconnect(this._upowerSignal);
       this._settings.settings.disconnect(this._batteryBrightnessChangedSignal);
       this._settings.settings.disconnect(this._acBrightnessChangedSignal);
   }
}


function init() {
}

function enable() {
    global.log('[dim-on-battery] enabled');
    brightnessManager = new BrightnessManager();
}

function disable() {
    global.log('[dim-on-battery] disabled');
    brightnessManager.destroy();
}

