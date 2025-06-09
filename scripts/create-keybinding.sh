#!/bin/bash

# Define the new keybinding
name="Voice Transcription"
command="bash /path/to/scripts/transcribe.sh"
binding="<Ctrl><Alt>u"
path="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/"

# Set the keybinding properties
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path name "$name"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path command "$command"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path binding "$binding"

# Get current custom keybindings
current=$(gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings)

# Add new keybinding to the list
if [ "$current" = "@as []" ]; then
    # No existing custom keybindings
    gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "['$path']"
else
    # Append to existing keybindings
    updated=$(echo "$current" | sed "s/]/, '$path']/")
    gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "$updated"
fi

echo "Keyboard shortcut set: $binding -> $command"