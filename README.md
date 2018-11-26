# gnome-shell-dim-on-battery-extension
An extension for gnome shell that will change the screen brightness when the machine is running on battery power.  

In the default dim-by-value mode, the screen will be dimmed to 50% brightness when running on battery.  When the brightness is changed, the new brightness level will be remembered whenever you're on battery power.

In the new dim-by-percent mode, the screen will be dimmed to 50% of the plugged-in brightness level.  If the brightness level is at 75% when your machine is plugged in, once your machine is on battery power, the brightness level wll be changed to 38%.  This is useful in environments where the light level changes frequently.

## To install from git
    git clone git://github.com/nailfarmer/gnome-shell-dim-on-battery-extension.git
    cd gnome-shell-dim-pn-battery-extension
    cp -r dim-on-battery@nailfarmer.nailfarmer.com ~/.local/share/gnome-shell/extensions
