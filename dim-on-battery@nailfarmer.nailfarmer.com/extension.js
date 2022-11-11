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

const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const UPower = imports.gi.UPowerGlib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;

const VERBOSE_LOGS=false;

const DEFAULT_BRIGHTNESS_AC = 100;
const DEFAULT_BRIGHTNESS_BATTERY = 50;
const DEFAULT_USE_LEGACY_MODE = true;
const DEFAULT_PERCENT_DIM = 50;
const DEFAULT_PREVIOUS_STATE = -1;

const BRIGHTNESS_THRESHOLD = 3;

const Config = imports.misc.config;


let BUS_NAME = 'org.gnome.SettingsDaemon.Power';

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
       this._brightnessLoaded = false;
       this._brightnessProxy = null;
       this._settings = (new Settings.Prefs());

       this.fixBadDconfSettings();

       this._batteryBrightness = this._settings.BATTERY_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_BATTERY);
       this._acBrightness = this._settings.AC_BRIGHTNESS.get(DEFAULT_BRIGHTNESS_AC); 
       this._percentageDim = this._settings.PERCENTAGE_DIM.get(DEFAULT_PERCENT_DIM);
       this._previousState = this._settings.PREVIOUS_STATE.get(DEFAULT_PREVIOUS_STATE);
       this._legacyMode = this._settings.LEGACY_MODE.get(DEFAULT_USE_LEGACY_MODE);

       this._screenProxyWrapper = Gio.DBusProxy.makeProxyWrapper(ScreenIface);
       this._uPowerProxy = Main.panel.statusArea["aggregateMenu"]._power._proxy;

       this._uPowerSignal = this._uPowerProxy.connect('g-properties-changed', this._onPowerChange.bind(this));
       new this._screenProxyWrapper(Gio.DBus.session, BUS_NAME, OBJECT_PATH, this.initBrightnessProxy.bind(this));
       this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, this.initBrightness.bind(this));
   },

   initBrightnessProxy: function(proxy) {
       this._brightnessProxy = proxy;
       if ( ! this._brightnessLoaded )  this.initBrightness(); 
   },

   /* 
    * We can't initialize brightness until both dbus proxies have been 
    * initialized themselves and have valid properties available. Ideally, this
    * should be true in initBrightnessProxy, but in practice, neither the
    * brightness nor upower properties are always immediately available. Since
    * I can't find any relevent dbus signals to listen for, that means we have to
    * poll until they are accessible.
    * 
    */
   initBrightness: function() {
       if ( this._brightnessLoaded ) {
           this._sourceId = 0;
           return GLib.SOURCE_REMOVE;
       }
       if ( null == this._brightnessProxy  ) {
           write_log('warning, brightness proxy not yet loaded, proxy value is ' + this._brightnessProxy);
           return GLib.SOURCE_CONTINUE;
       } 
       if ( null == this._brightnessProxy.Brightness || isNaN(this._brightnessProxy.Brightness) ) {
           write_log('warning, brightness state not yet loaded, proxy value is ' + this._brightnessProxy.Brightness);
           return GLib.SOURCE_CONTINUE;
       }
       if ( null == this._uPowerProxy.State ) {
           write_log('warning, uPowerProxy state not yet loaded, proxy value is ' + this._uPowerProxy);
           write_log('power device type is ' + this._uPowerProxy.Type);
           return GLib.SOURCE_CONTINUE;
       }

       write_log('at init, brightness proxy is' + this._brightnessProxy);
       write_log('at init, current brightness level is ' + this._brightnessProxy.Brightness);

       this._acBrightnessChangedSignal = this._settings.settings.connect('changed::ac-brightness', this.loadACBrightness.bind(this));
       this._batteryBrightnessChangedSignal = this._settings.settings.connect('changed::battery-brightness', this.loadBatteryBrightness.bind(this));
       this._legacyModeChangedSignal = this._settings.settings.connect('changed::legacy-mode', this.toggleLegacyMode.bind(this));
       this._percentageDimChangedSignal = this._settings.settings.connect('changed::percentage-dim', this.percentDimChanged.bind(this));

       if ( this._legacyMode ) {
           this._lastStatus = this._uPowerProxy.State;

       if ( this.isDischargeState(this._uPowerProxy.State) ) {
           this.loadBatteryBrightness();
       } else {
           this.loadACBrightness();
       }
       this._brightnessLoaded = true;
       } else {
           this._brightnessLoaded = true;
           this._lastStatus = this._settings.PREVIOUS_STATE.get();
           var consistent = !(this.isDischargeState(this._lastStatus) ^ this.isDischargeState(this._uPowerProxy.State));

           // on first run, dim if we are discharging
           if ( this._lastStatus == -1 && this.isDischargeState(this._uPowerProxy.State) ) {
               this.setBatteryBrightness();

           // if states are consistent, do nothing, otherwise if discharging, dim and if charging, boost
           } else if ( ! consistent ) {
               if ( this.isDischargeState(this._uPowerProxy.State) ) {
                   this.setPercentBatteryBrightness();
                   this._lastStatus = UPower.DeviceState.DISCHARGING;
               } else {
                   this.setPercentACBrightness();
                   this._lastStatus = UPower.DeviceState.CHARGING;
               }
           }

       }
       this._sourceId = 0;
       return GLib.SOURCE_REMOVE;
    },

    isDischargeState: function(state) {
        if ( state == UPower.DeviceState.DISCHARGING ) return true;
        if ( state == UPower.DeviceState.PENDING_DISCHARGE ) return true;
        return false;
    },

    roundValue: function(val) {
        return parseInt(Math.round(val), 10);
    },

    toggleLegacyMode: function() {
        this._legacyMode = this._settings.LEGACY_MODE.get();
    },

    percentDimChanged: function() {
        this._percentageDim = this._settings.PERCENTAGE_DIM.get();
        this._onPowerChange();
    },

   setBatteryBrightness: function() {
       if ( this._legacyMode ) this.setLegacyBatteryBrightness();
       else this.setPercentBatteryBrightness();
   },

   setLegacyBatteryBrightness: function() {
       if ( ! this._brightnessLoaded ) return;
       write_log('setting battery brightness');

       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness), 10);

       // Save the ac brightness levels if there's been a significant change
       // and our current value is valid
       if ( currentBrightness > 1 && ! isNaN(currentBrightness) && 
            Math.abs(currentBrightness - this._acBrightness) > 1 ) {
       
           write_log('dc brightness is valid, saving settings in dconf');
           this._acBrightness = currentBrightness;
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }

       // Set the brightness to battery levels if there's been a 
       // significant change, or if the current value is in doubt
       if ( currentBrightness < 1 || isNaN(currentBrightness) ||
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           write_log('dc brightness has changed, updating to ' + this._batteryBrightness);
           this._brightnessProxy.Brightness = this._batteryBrightness;
       }
   },

   setPercentBatteryBrightness: function() {
       if ( ! this._brightnessLoaded ) return;
       var currentBrightness = this.roundValue(this._brightnessProxy.Brightness);
       var newBrightness = this.roundValue(currentBrightness*((100.0-this._percentageDim)/100.0));
       newBrightness = Math.min(newBrightness, 100);
       newBrightness = Math.max(newBrightness, 0);

       if ( currentBrightness < 1 ) {
           write_log('bad brightness value');
           return;
       }
       this._brightnessProxy.Brightness = newBrightness;
       var actualBrightness = this._brightnessProxy.Brightness;
       this._lastStatus = UPower.DeviceState.DISCHARGING;
       this._settings.PREVIOUS_STATE.set(UPower.DeviceState.DISCHARGING);
       write_log('brightness from ' + currentBrightness + ' to ' + newBrightness);
       write_log('actual brightness is ' + actualBrightness);
       write_log('saved state should be ' + this._uPowerProxy.State);
   },


   setACBrightness: function() {
       if ( this._legacyMode ) this.setLegacyACBrightness();
       else this.setPercentACBrightness();
   },
   
   setLegacyACBrightness: function() {
       if ( ! this._brightnessLoaded ) return;
       // this will cast to 0 if DBUS times out
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness), 10);

       // Save the battery brightness levels if there's been a significant
       // change and our current value is valid
       if ( currentBrightness > 1 && ! isNaN(currentBrightness) && 
            Math.abs(currentBrightness - this._batteryBrightness) > 1 ) {
           write_log('ac brightness is valid, saving settings in dconf');
           write_log('new dc brightness value is ' + currentBrightness);
           this._batteryBrightness = currentBrightness;
           this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
       }

       // Set the brightness to ac levels if there's been a significant change
       // or if our current brightness value is in doubt
       if ( currentBrightness < 1 || isNaN(currentBrightness) || 
            Math.abs(currentBrightness - this._acBrightness) > 1) {
           write_log('setting current brightness to dconf settings of ' + this._acBrightness);
           this._brightnessProxy.Brightness = this._acBrightness;
       }

   },

   setPercentACBrightness: function() {
       if ( ! this._brightnessLoaded ) return;
       var currentBrightness = this.roundValue(this._brightnessProxy.Brightness)+1;
       var newBrightness = this.roundValue(currentBrightness*(100.0/(100.0-this._percentageDim)));
       newBrightness = Math.min(newBrightness, 100);
       newBrightness = Math.max(newBrightness, 0);

       if ( currentBrightness < 1 ) {
           write_log('bad brightness value');
           return;
       }
       this._brightnessProxy.Brightness = newBrightness;
       var actualBrightness = this._brightnessProxy.Brightness;
       this._lastStatus = UPower.DeviceState.CHARGING;
       this._settings.PREVIOUS_STATE.set(UPower.DeviceState.CHARGING);

       write_log('dim percentage:  ' + this._percentageDim);
       write_log('brightness from ' + currentBrightness + ' to ' + newBrightness);
       write_log('actual brightness is ' + actualBrightness);
       write_log('saved state should be ' + this._uPowerProxy.State);
   },

   /*
    * Save the current brightness in dconf.
    */
   saveBrightness: function() {
       if ( ! this._brightnessLoaded ) return;
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness,10));
       if ( currentBrightness < 1 || isNaN(currentBrightness) ) {
           write_log('not saving bad brightness value to dconf');
           return;
       }

       // Before saving brightness, we need to make sure that the change is
       // large enough to warrant saving.  Because brightness values can
       // fluctuate slightly when resuming, not checking for this can lead
       // to brightness values being unnecessarily degraded over time.
       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           var diff = Math.abs(this._settings.BATTERY_BRIGHTNESS.get() - currentBrightness);
           write_log('brightness diff is ' + diff);
           if ( diff > BRIGHTNESS_THRESHOLD ) {
               this._settings.BATTERY_BRIGHTNESS.set(currentBrightness);
               write_log('saving brightness: ' + currentBrightness);
           }
       } else {
           var diff = Math.abs(this._settings.AC_BRIGHTNESS.get() - currentBrightness);
           write_log('brightness diff is ' + diff);
           if ( diff > BRIGHTNESS_THRESHOLD ) {
               this._settings.AC_BRIGHTNESS.set(currentBrightness);
               write_log('saving brightness: ' + currentBrightness);
           }
       }
   },

   /* Sometimes Dconf settings are corrupt.  Check for these and overwrite with
    * the current settings (if valid) or with the default settings.
    */
   fixBadDconfSettings: function() {
       if ( this._settings.AC_BRIGHTNESS.get() < 1 || isNaN(this._settings.AC_BRIGHTNESS.get()) ) {
           write_log('unusual dconf ac brightness settings found');
           if ( this._acBrightness < 1 ) {
               write_log('ac brightness is less than 1!');
               this._acBrightness = DEFAULT_BRIGHTNESS_AC;
           }
           this._settings.AC_BRIGHTNESS.set(this._acBrightness);
       }
       if ( this._settings.BATTERY_BRIGHTNESS.get() < 1 || isNaN(this._settings.BATTERY_BRIGHTNESS.get()) ) {
           write_log('unusual dconf dc brightness settings found');
           if ( this._acBrightness < 1 ) {
               write_log('dc brightness is less than 1!');
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
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness),10);
       var dconfBrightness = this._settings.AC_BRIGHTNESS.get();

       if ( dconfBrightness > 1 && ! isNaN(dconfBrightness) ) {
           write_log('ac brightness loaded from dconf');
           this._acBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State != UPower.DeviceState.DISCHARGING) {
           write_log('device proxy is ' + this._uPowerProxy);
           write_log('device state is ' + this._uPowerProxy.State);
           write_log('device is not discharging, updating brightness to ' + this._acBrightness);
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
       var currentBrightness = parseInt(Math.round(this._brightnessProxy.Brightness),10);
       var dconfBrightness = this._settings.BATTERY_BRIGHTNESS.get();
       if ( dconfBrightness > 1 && ! isNaN(dconfBrightness) ) {
           write_log('battery brightness loaded from dconf ' + dconfBrightness);
           this._batteryBrightness = dconfBrightness;
       } 

       if ( this._uPowerProxy.State == UPower.DeviceState.DISCHARGING) {
           write_log('device is discharging, updating brightness to ' + this._batteryBrightness);
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
       write_log('power changed');
       if ( ! this._brightnessLoaded )  this.initBrightness();
       if ( this.isDischargeState(this._uPowerProxy.State) )  {
           if ( ! this.isDischargeState(this._lastStatus) ) {
               this.setBatteryBrightness();
               this._lastStatus = UPower.DeviceState.DISCHARGING;
           }
       } else {
           if ( this.isDischargeState(this._lastStatus) || this._lastStatus == -1 ) {
               this.setACBrightness();
               this._lastStatus = UPower.DeviceState.CHARGING;
           }
       }
   },

   destroy: function() {
       this.saveBrightness();
       this._uPowerProxy.disconnect(this._uPowerSignal);

       if ( this._batteryBrightnessChangedSignal ) {
           this._settings.settings.disconnect(this._batteryBrightnessChangedSignal);
       }
       if ( this._acBrightnessChangedSignal ) {
           this._settings.settings.disconnect(this._acBrightnessChangedSignal);
       }
       if ( this._legacyModeChangedSignal ) {
           this._settings.settings.disconnect(this._legacyModeChangedSignal);
       }
       if ( this._percentageDimChangedSignal ) {
           this._settings.settings.disconnect(this._percentageDimChangedSignal);
       }
 
       if ( this._sourceId ) {
           GLib.Source.remove(this._sourceId);
       }
   }
}

function write_log(message) {
   if ( true == VERBOSE_LOGS ) {
       global.log('[dim-on-battery] ' + message);
   } 
}


function init() {
}

function enable() {
    write_log('enabled');
    brightnessManager = new BrightnessManager();
}

function disable() {
    write_log('disabled');
    brightnessManager.destroy();
    brightnessManager = null;
}

