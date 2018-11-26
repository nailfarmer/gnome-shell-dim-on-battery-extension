const Gtk = imports.gi.Gtk;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;

function init() {
}

function buildPrefsWidget() {
	let config = new Settings.Prefs();
	let mainBox = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		border_width: 10,
	        spacing: 10
	});

	(function() {

        let dim_by_value_frame = new Gtk.Frame();
		let dim_by_value_label = new Gtk.Label({
			label: "Dim by value settings",
			use_markup: true,
		});
        let dim_by_value_box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            border_width: 10
        });

        let dim_by_percent_frame = new Gtk.Frame();
		let dim_by_percent_label = new Gtk.Label({
			label: "Dim by percent settings",
			use_markup: true,
		});
        let dim_by_percent_box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            border_width: 10
        });

		let battery_container = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let battery_label = new Gtk.Label({
			label: "Screen brightness when on battery power",
			use_markup: true,
		});
		let battery_adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 100,
			step_increment: 1 
		});
		let battery_scale = new Gtk.HScale({
			digits:2,
			adjustment: battery_adjustment,
			value_pos: Gtk.PositionType.RIGHT
		});

		var battery_pref = config.BATTERY_BRIGHTNESS;
		let battery_value = Gtk.SpinButton.new_with_range(0,100,1);
	        battery_value.set_value(battery_pref.get());	
		
		battery_value.connect('value-changed', function(sw) {
			var oldval = battery_pref.get();
			var newval = sw.get_value();
			if (newval != battery_pref.get()) {
				battery_pref.set(newval);
			}
		});

		let legacy_toggle_container = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let legacy_toggle_label = new Gtk.Label({
			label: "Use legacy dim-by-value behavior",
			use_markup: true,
		});

		var legacy_toggle_pref = config.LEGACY_MODE;
		let legacy_toggle_value = new Gtk.Switch({active: legacy_toggle_pref.get()});
	
		legacy_toggle_value.connect('state-set', function(w, s, udata) {
			var oldval = legacy_toggle_pref.get();
			if (s != legacy_toggle_pref.get()) {
				legacy_toggle_pref.set(s);
                if ( s === true ) {
                    dim_by_value_frame.set_sensitive(true);
                    dim_by_percent_frame.set_sensitive(false);
                } else {
                    dim_by_value_frame.set_sensitive(false);
                    dim_by_percent_frame.set_sensitive(true);
                }
			}
		});


		let ac_container = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let ac_label = new Gtk.Label({
			label: "Screen brightness when on AC power",
			use_markup: true,
		});
		let ac_adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 100,
			step_increment: 1 
		});

		var ac_pref = config.AC_BRIGHTNESS;
		let ac_value = Gtk.SpinButton.new_with_range(0,100,1);
	        ac_value.set_value(ac_pref.get());	

		ac_value.connect('value-changed', function(sw) {
			var oldval = ac_pref.get();
			var newval = sw.get_value();
			if (newval != ac_pref.get()) {
				ac_pref.set(newval);
			}
		});


		/*
		 * grid.add(battery_label);
		grid.attach_next_to(battery_value, battery_label, Gtk.PositionType.RIGHT, 1, 1);
		grid.attach_next_to(ac_label, battery_label, Gtk.PositionType.BOTTOM, 1, 1);
		grid.attach_next_to(ac_value, ac_label, Gtk.PositionType.RIGHT, 1, 1);
		*/

        if ( legacy_toggle_pref.get() === true ) {
            dim_by_value_frame.set_sensitive(true);
            dim_by_percent_frame.set_sensitive(false);
        } else {
            dim_by_value_frame.set_sensitive(false);
            dim_by_percent_frame.set_sensitive(true);
        }

        legacy_toggle_container.add(legacy_toggle_value);
        legacy_toggle_container.add(legacy_toggle_label);
        mainBox.add(legacy_toggle_container);


		battery_container.add(battery_label);
		battery_container.pack_end(battery_value, false, false, 0);
		dim_by_value_box.add(battery_container);

		ac_container.add(ac_label);
		ac_container.pack_end(ac_value, false, false, 0);
		dim_by_value_box.add(ac_container);

        	dim_by_value_frame.set_label("Dim by value settings");
        	dim_by_value_frame.add(dim_by_value_box);
        	mainBox.add(dim_by_value_frame);
	})();

	mainBox.show_all();
	return mainBox;
}
