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

const VERBOSE_LOGS=false;

const DEFAULT_BRIGHTNESS_AC = 100;
const DEFAULT_BRIGHTNESS_BATTERY = 50;

const BRIGHTNESS_THRESHOLD = 3;

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
       this._lastStatus = this._uPowerProxy.State;
       this._acBrightnessChangedSignal = this._settings.settings.connect('changed::ac-brightness', Lang.bind(this, this.loadACBrightness));
       this._batteryBrightnessChangedSignal = this._settings.settings.connect('changed::battery-brightness', Lang.bind(this, this.loadBatteryBrightness));
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           this.loadBatteryBrightness();
       } else {
           this.loadACBrightness();
       }
    },

   setBatteryBrightness: function() {
       if ( null == this._brightnessProxy ) return;

       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(this._brightnessProxy.Brightness, 10);

       // Save the ac brightness levels if there's been a significant change
       // and our current value is valid
       if ( currentBrightness > 1 && ! isNaN(currentBrightness) && 
            Math.abs(currentBrightness - this._acBrightness) > 1 ) {
       
           write_log('[dim-on-battery] dc brightness is valid, saving settings in dconf');
           this._acBrightness = currentBrightness;
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }

       // Set the brightness to battery levels if there's been a 
       // significant change, or if the current value is in doubt
       if ( currentBrightness < 1 || isNaN(currentBrightness) ||
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           write_log('[dim-on-battery] dc brightness has changed, updating');
           this._brightnessProxy.Brightness = this._batteryBrightness;
       }
   },


   setACBrightness: function() {
       if ( null == this._brightnessProxy ) return;
   
       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(this._brightnessProxy.Brightness, 10);

       // Save the battery brightness levels if there's been a significant
       // change and our current value is valid
       if ( currentBrightness > 1 && ! isNaN(currentBrightness) && 
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           write_log('[dim-on-battery] ac brightness is valid, saving settings in dconf');
           write_log('[dim-on-battery] new dc brightness value is ' + currentBrightness);
           this._batteryBrightness = currentBrightness;
           this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
       }

       // Set the brightness to ac levels if there's been a significant change
       // or if our current brightness value is in doubt
       if ( currentBrightness < 1 || isNaN(currentBrightness) || 
            Math.abs(currentBrightness - this._acBrightness) > 1) {
           write_log('[dim-on-battery] setting current brightness to dconf settings');
           this._brightnessProxy.Brightness = this._acBrightness;
       }

   },

   /*
    * Save the current brightness in dconf.
    *
    */
   saveBrightness: function() {
       if ( null == this._brightnessProxy ) {
           return;
       }
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness,10));
       if ( currentBrightness < 1 || isNaN(currentBrightness) ) {
           write_log('[dim-on-battery] not saving bad brightness value to dconf');
           return;
       }

       // Before saving brightness, we need to make sure that the change is
       // large enough to warrant saving.  Because brightness values can
       // fluctuate slightly when resuming, not checking for this can lead
       // to brightness values being unnecessarily degraded over time.
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           var diff = Math.abs(this._settings.BATTERY_BRIGHTNESS.get() - currentBrightness);
           write_log('[dim-on-battery] brightness diff is ' + diff);
           if ( diff > BRIGHTNESS_THRESHOLD ) {
               this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
               write_log('[dim-on-battery] saving brightness: ' + currentBrightness);
           }
       } else {
           var diff = Math.abs(this._settings.AC_BRIGHTNESS.get() - currentBrightness);
           write_log('[dim-on-battery] brightness diff is ' + diff);
           if ( diff > BRIGHTNESS_THRESHOLD ) {
               this._settings.AC_BRIGHTNESS.set(currentBrightness);
               write_log('[dim-on-battery] saving brightness: ' + currentBrightness);
           }
       }
   },

   fixBadDconfSettings: function() {
       if ( this._settings.AC_BRIGHTNESS.get() < 1 || isNaN(this._settings.AC_BRIGHTNESS.get()) ) {
           write_log('[dim-on-battery] unusual dconf ac brightness settings found');
           if ( this._acBrightness < 1 ) {
               write_log('[dim-on-battery] ac brightness is less than 1!');
               this._acBrightness = DEFAULT_BRIGHTNESS_AC;
           }
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }
       if ( this._settings.BATTERY_BRIGHTNESS.get() < 1 || isNaN(this._settings.BATTERY_BRIGHTNESS.get()) ) {
           write_log('[dim-on-battery] unusual dconf dc brightness settings found');
           if ( this._acBrightness < 1 ) {
               write_log('[dim-on-battery] dc brightness is less than 1!');
               this._batteryBrightness = DEFAULT_BRIGHTNESS_BATTERY;
           }
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

       if ( dconfBrightness > 1 && ! isNaN(dconfBrightness) ) {
           write_log('[dim-on-battery] ac brightness loaded from dconf');
           this._acBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State != UPower.DeviceState.DISCHARGING) {
           write_log('[dim-on-battery] device is not discharging, updating brightness');
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
       if ( dconfBrightness > 1 && ! isNaN(dconfBrightness) ) {
           write_log('[dim-on-battery] battery brightness loaded from dconf');
           this._batteryBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           write_log('[dim-on-battery] device is discharging, updating brightness');
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
       this._uPowerProxy.disconnect(this._uPowerSignal);
       this._settings.settings.disconnect(this._batteryBrightnessChangedSignal);
       this._settings.settings.disconnect(this._acBrightnessChangedSignal);
   }
}

function write_log(message) {
   if ( true == VERBOSE_LOGS ) {
       global.log(message);
   } 
}


function init() {
}

function enable() {
    write_log('[dim-on-battery] enabled');
    brightnessManager = new BrightnessManager();
}

function disable() {
    write_log('[dim-on-battery] disabled');
    brightnessManager.destroy();
    brightnesManager = null;
}

