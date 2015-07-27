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
       this._brightnessProxy = null;
       this._settings = (new Settings.Prefs());

       this._batteryBrightness = DEFAULT_BRIGHTNESS_BATTERY;
       this._acBrightness = DEFAULT_BRIGHTNESS_AC;
       
       this.fixBadDconfSettings();

       this._batteryBrightness = this._settings.BATTERY_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_BATTERY);
       this._acBrightness = this._settings.AC_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_AC); 

       this._screenProxyWrapper = Gio.DBusProxy.makeProxyWrapper(ScreenIface);
       this._uPowerProxy = Main.panel.statusArea["aggregateMenu"]._power._proxy;
       
       this._uPowerSignal = this._uPowerProxy.connect('g-properties-changed', Lang.bind(this, this._onPowerChange));

       new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, Lang.bind(this, this.initBrightness));

   },

   initBrightness: function(proxy) {
       this._brightnessProxy = proxy;
       this.saveBrightness();
       this._lastStatus = this._uPowerProxy.State;
       this._acBrightnessChangedSignal = this._settings.settings.connect('changed::ac-brightness', Lang.bind(this, this.loadACBrightness));
       this._batteryBrightnessChangedSignal = this._settings.settings.connect('changed::battery-brightness', Lang.bind(this, this.loadBatteryBrightness));
    },

   setBatteryBrightness: function() {
       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(this._brightnessProxy.Brightness, 10);

       // Save the ac brightness levels if there's been a significant change
       // and our current value is valid
       if ( currentBrightness > 1 && 
            Math.abs(currentBrightness - this._acBrightness) > 1 ) {
           this._acBrightness = currentBrightness;
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }

       // Set the brightness to battery levels if there's been a 
       // significant change, or if the current value is in doubt
       if ( currentBrightness < 1 || 
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           this._brightnessProxy.Brightness = this._batteryBrightness;
       }
   },


   setACBrightness: function() {
       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(this._brightnessProxy.Brightness, 10);

       // Save the battery brightness levels if there's been a significant
       // change and our current value is valid
       if ( currentBrightness > 1 && 
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           this._batteryBrightness = currentBrightness;
	   this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
       }

       // Set the brightness to ac levels if there's been a significant change
       // or if our current brightness value is in doubt
       if ( currentBrightness < 1 || 
	    Math.abs(currentBrightness - this._acBrightness) > 1) {
           this._brightnessProxy.Brightness = this._acBrightness;
       }

   },

   /*
    * Save the current brightness in dconf.
    *
    */
   saveBrightness: function() {
       var currentBrightness = parseInt(this._brightnessProxy.Brightness,10);
       if ( currentBrightness < 1 ) return;

       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
	   this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
       } else {
	   this._settings.AC_BRIGHTNESS.set(currentBrightness);
       }
   },

   fixBadDconfSettings: function() {
       if ( this._settings.AC_BRIGHTNESS.get() < 1 ) {
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }
       if ( this._settings.BATTERY_BRIGHTNESS.get() < 1 ) {
           this._settings.BATTERY_BRIGHTNESS.set(this._batteryBrightness);
       }
   },

   /*
    * Load AC settings from dconf, and update screen brightness if 
    * we're on AC.
    *
    */
   loadACBrightness: function() {
       var currentBrightness = parseInt(this._brightnessProxy.Brightness,10);
       var dconfBrightness = this._settings.AC_BRIGHTNESS.get();

       if ( dconfBrightness > 1 ) {
           this._acBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State != UPower.DeviceState.DISCHARGING) {
           this._brightnessProxy.Brightness = this._acBrightness;
       }

       this.fixBadDconfSettings();
   },

   /*
    * Load battery settings from dconf, and update brightness settings if
    * we're on battery.
    *
    */
   loadBatteryBrightness: function() {
       var currentBrightness = parseInt(this._brightnessProxy.Brightness,10);
       var dconfBrightness = this._settings.BATTERY_BRIGHTNESS.get();
       if ( dconfBrightness > 1 ) {
           this._batteryBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           this._brightnessProxy.Brightness = this._batteryBrightness;
       }

       this.fixBadDconfSettings();
   },

   /*
    * Handles changes in power state, such as from AC to battery power
    *
    */
   _onPowerChange: function() {
       // look for a change from charging to discharging, or vice versa
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
	   if ( this._lastStatus != UPower.DeviceState.DISCHARGING ) {
	       this.setBatteryBrightness();
	       this._lastStatus = UPower.DeviceState.DISCHARGING;
	   }
       } else {
	   if ( this._lastStatus == UPower.DeviceState.DISCHARGING || this._lastStatus == -1 ) {
	       this.setACBrightness();
	       this._lastStatus = UPower.DeviceState.CHARGING;
	   }
       }
   },

   destroy: function() {
       this.saveBrightness();
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

